import { afterEach, describe, expect, it, vi } from "vitest";
import { createTryOnHandler } from "./tryOn";
import { createYouCamClient, YOUCAM_BASE_URL } from "./youcam";

const KEY = "sk-test-secret-key";
const jpeg = new Uint8Array(4096).fill(7);
jpeg.set([0xff, 0xd8, 0xff]);
const png = new Uint8Array(2048).fill(1);
png.set([0x89, 0x50, 0x4e, 0x47]);

type Call = { method: string; url: string; body?: unknown; auth?: string | null };

function fakeYouCam(taskResult: () => Response | Record<string, unknown> = () => ({ task_status: "running" })) {
  const calls: Call[] = [];
  let files = 0;
  let tasks = 0;
  const reply = (data: unknown, status = 200) =>
    new Response(JSON.stringify(status === 200 ? { status, data } : data), { status });
  const fetch = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    const method = init.method ?? "GET";
    const headers = new Headers(init.headers);
    const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
    calls.push({ method, url, body, auth: headers.get("authorization") });
    if (url === `${YOUCAM_BASE_URL}/s2s/v2.0/file`) {
      files += 1;
      return reply({
        files: [
          {
            file_id: `file_${String(files).padStart(4, "0")}`,
            requests: [
              { method: "PUT", url: `https://s3.test/upload/${files}`, headers: { "Content-Type": "image/jpeg" } },
            ],
          },
        ],
      });
    }
    if (url.startsWith("https://s3.test/")) return new Response(null, { status: 200 });
    if (url === `${YOUCAM_BASE_URL}/s2s/v2.0/task/cloth-v4` && method === "POST") {
      tasks += 1;
      return reply({ task_id: `task_${String(tasks).padStart(4, "0")}` });
    }
    if (url.startsWith(`${YOUCAM_BASE_URL}/s2s/v2.0/task/cloth-v4/`)) {
      const result = taskResult();
      return result instanceof Response ? result : reply(result);
    }
    return new Response("{}", { status: 404 });
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls };
}

function setup(options: Parameters<typeof createTryOnHandler>[0] = {}, task?: Parameters<typeof fakeYouCam>[0]) {
  const youcam = fakeYouCam(task);
  const handle = createTryOnHandler({
    client: createYouCamClient({ apiKey: KEY, fetch: youcam.fetch }),
    loadGarment: async () => png,
    ...options,
  });
  const call = (method: string, path: string, body?: BodyInit, type = "application/json") =>
    handle(
      new Request(`http://localhost${path}`, {
        method,
        body,
        headers: body ? { "Content-Type": type } : undefined,
      }),
      { clientIp: "203.0.113.5" },
    );
  return { ...youcam, handle, call };
}

const createLook = (call: ReturnType<typeof setup>["call"], garmentId = "sage", photoId = "file_0001") =>
  call("POST", "/api/try-on/looks", JSON.stringify({ photoId, garmentId }));

afterEach(() => vi.restoreAllMocks());

describe("try-on API", () => {
  it("reports configuration and refuses provider work without a server key", async () => {
    const handle = createTryOnHandler({});
    const config = await handle(new Request("http://localhost/api/try-on/config"));
    expect(await config.json()).toEqual({ configured: false, provider: "YouCam AI Clothes V4" });
    const photo = await handle(new Request("http://localhost/api/try-on/photo", { method: "POST", body: jpeg }));
    expect(photo.status).toBe(503);
    expect((await photo.json()).error.code).toBe("not_configured");
    const { call } = setup();
    expect(await (await call("GET", "/api/try-on/config")).json()).toMatchObject({ configured: true });
  });

  it("uploads a validated photo through the File API without exposing the key", async () => {
    const { call, calls } = setup();
    const rejected = await call("POST", "/api/try-on/photo", new Uint8Array(2048).fill(3), "image/jpeg");
    expect(rejected.status).toBe(400);
    expect(calls).toHaveLength(0);
    const response = await call("POST", "/api/try-on/photo", jpeg, "image/jpeg");
    const text = await response.text();
    expect(response.status).toBe(200);
    expect(JSON.parse(text)).toEqual({ photoId: "file_0001" });
    expect(text).not.toContain(KEY);
    expect(calls[0]).toMatchObject({
      method: "POST",
      auth: `Bearer ${KEY}`,
      body: { files: [{ content_type: "image/jpeg", file_name: "person.jpg", file_size: jpeg.byteLength }] },
    });
    expect(calls[1]).toMatchObject({ method: "PUT", url: "https://s3.test/upload/1" });
    expect(calls[1].auth).toBeNull();
  });

  it("creates one cloth-v4 task per photo and garment, reusing duplicates and garment uploads", async () => {
    const { call, calls } = setup();
    expect((await createLook(call, "not-a-dress")).status).toBe(400);
    const first = await createLook(call);
    expect(await first.json()).toEqual({ taskId: "task_0001", reused: false });
    const task = calls.find((entry) => entry.url.endsWith("/task/cloth-v4"));
    expect(task?.body).toEqual({
      src_file_id: "file_0001",
      ref_file_id: "file_0001",
      garment_category: "full_body",
      filter_multi_person: "normal",
    });
    const [again, concurrentA, concurrentB] = await Promise.all([
      createLook(call),
      createLook(call, "midnight"),
      createLook(call, "midnight"),
    ]);
    expect(await again.json()).toEqual({ taskId: "task_0001", reused: true });
    expect((await concurrentA.json()).taskId).toBe((await concurrentB.json()).taskId);
    expect(calls.filter((entry) => entry.url.endsWith("/task/cloth-v4"))).toHaveLength(2);
    // sage and midnight references uploaded once each.
    expect(calls.filter((entry) => entry.url.endsWith("/s2s/v2.0/file"))).toHaveLength(2);
  });

  it("limits billable looks per visitor and per day", async () => {
    const perVisitor = setup({ looksPerVisitorPerHour: 1 });
    expect((await createLook(perVisitor.call)).status).toBe(200);
    const limited = await createLook(perVisitor.call, "midnight");
    expect(limited.status).toBe(429);
    expect((await limited.json()).error.code).toBe("rate_limited");
    const daily = setup({ looksPerDay: 1 });
    await createLook(daily.call);
    expect((await (await createLook(daily.call, "plum", "file_0009")).json()).error.code).toBe("daily_limit");
  });

  it("maps task progress, results and provider failures to plain language", async () => {
    let next: Response | Record<string, unknown> = { task_status: "running" };
    const { call } = setup({}, () => next);
    const status = async () => (await call("GET", "/api/try-on/looks?task=task_0001")).json();
    expect(await status()).toEqual({ status: "running" });
    next = { task_status: "success", results: { url: "https://yce-us.example/result.jpg" } };
    expect(await status()).toEqual({ status: "success", imageUrl: "https://yce-us.example/result.jpg" });
    next = { task_status: "error", error: "error_pose" };
    expect(await status()).toMatchObject({ status: "error", error: { code: "error_pose", message: expect.stringContaining("standing pose") } });
    next = new Response(JSON.stringify({ status: 400, error: "Task id invalid", error_code: "InvalidTaskId" }), { status: 400 });
    expect(await status()).toMatchObject({ status: "error", error: { code: "task_expired" } });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    next = new Response(JSON.stringify({ status: 401, error: "This API key isn't recognized.", error_code: "InvalidApiKey" }), { status: 401 });
    const rejected = await call("GET", "/api/try-on/looks?task=task_0001");
    expect(rejected.status).toBe(503);
    expect((await rejected.json()).error.code).toBe("provider_auth");
    expect(JSON.stringify(error.mock.calls)).not.toContain(KEY);
    expect((await call("GET", "/api/try-on/looks?task=../../x")).status).toBe(400);
  });
});
