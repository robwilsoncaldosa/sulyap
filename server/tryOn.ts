// Personal try-on API shared by the Vite dev/preview middleware and Vercel functions.
// Routes (JSON unless noted):
//   GET  /api/try-on/config            → { configured, provider }
//   POST /api/try-on/photo  (image)    → { photoId }
//   POST /api/try-on/looks  {photoId, garmentId} → { taskId }
//   GET  /api/try-on/looks?task=<id>   → { status, imageUrl? , error? }
// Person photos are forwarded to YouCam and never stored or logged here.
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { catalog } from "../src/data/catalog.js";
import {
  createYouCamClient,
  YouCamError,
  type ClothTask,
  type YouCamClient,
} from "./youcam.js";

export const PROVIDER_NAME = "YouCam AI Clothes V4";
const MAX_PHOTO_BYTES = 4 * 1024 * 1024; // below Vercel's 4.5 MB request limit
const ID_PATTERN = /^[A-Za-z0-9._~=+/-]{8,512}$/;
const HOUR = 60 * 60 * 1000;

const messages: Record<string, string> = {
  error_pose:
    "YouCam couldn't find a standing pose. Use a full-length photo where you're standing and facing the camera.",
  error_invalid_src:
    "The photo needs to show your face and upper body, not only your legs or feet.",
  error_apply_region_mismatch:
    "Your photo doesn't show enough of you for a full-length dress. Use a full-length photo.",
  error_multi_person: "More than one person is in the photo. Use a photo of only you.",
  error_below_min_image_size: "This photo is too small. Use one at least 512 pixels tall.",
  exceed_max_filesize: "This photo is too large. Use a JPG or PNG under 10 MB and 4096 pixels.",
  error_nsfw_content_detected: "YouCam blocked this result. Try a different photo.",
  error_editing_failed:
    "YouCam couldn't change the outfit clearly. Try a photo with plain clothing and an uncluttered background.",
  error_download_image: "YouCam couldn't read the uploaded photo. Choose your photo again.",
  error_invalid_ref: "YouCam couldn't read this dress reference. Try again later.",
  invalid_parameter: "YouCam rejected the preview request. Try again.",
  task_expired: "This preview expired before it finished. Create it again.",
  provider_unreachable: "Couldn't reach YouCam. Check your connection and try again.",
  provider_busy: "YouCam is busy right now. Wait a minute, then try again.",
  provider_credits: "This demo has used its YouCam preview credits for now.",
  provider_auth: "Personal try-on isn't available right now: the server's YouCam key was rejected.",
  not_configured: "Personal try-on isn't configured on this server.",
  rate_limited: "You've reached this demo's preview limit. Try again later.",
  daily_limit: "This demo has reached today's preview limit. Try again tomorrow.",
  invalid_photo: "Use a JPG or PNG photo under 4 MB.",
  invalid_request: "That request wasn't valid.",
  unknown_garment: "That dress isn't in the sample collection.",
  not_found: "Not found.",
};

export function userMessage(code: string) {
  return messages[code] ?? "YouCam couldn't create this preview. Try again in a moment.";
}

/** Normalizes provider failures into our small public vocabulary. */
function classify(error: unknown): { code: string; status: number } {
  if (!(error instanceof YouCamError)) return { code: "unknown_error", status: 502 };
  const raw = error.code.toLowerCase();
  if (raw === "provider_unreachable") return { code: raw, status: 502 };
  if (raw.includes("invalidtaskid")) return { code: "task_expired", status: 410 };
  if (error.httpStatus === 401 || raw.includes("apikey") || raw.includes("accesstoken"))
    return { code: "provider_auth", status: 503 };
  if (error.httpStatus === 429) return { code: "provider_busy", status: 503 };
  if (error.httpStatus === 402 || /unit|credit|insufficient|quota/.test(raw))
    return { code: "provider_credits", status: 503 };
  if (raw in messages) return { code: raw, status: 422 };
  return { code: "unknown_error", status: 502 };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function failure(code: string, status: number) {
  return json({ error: { code, message: userMessage(code) } }, status);
}

function imageType(bytes: Uint8Array): "image/jpeg" | "image/png" | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47)
    return "image/png";
  return null;
}

/** Fixed-window counter; per server instance, so it is a best-effort guard. */
function createLimiter(limit: number, windowMs: number, now: () => number) {
  const hits = new Map<string, { count: number; start: number }>();
  return (key: string) => {
    const time = now();
    if (hits.size > 1000)
      for (const [stale, entry] of hits) if (time - entry.start >= windowMs) hits.delete(stale);
    const entry = hits.get(key);
    if (!entry || time - entry.start >= windowMs) {
      hits.set(key, { count: 1, start: time });
      return true;
    }
    if (entry.count >= limit) return false;
    entry.count += 1;
    return true;
  };
}

export type TryOnOptions = {
  apiKey?: string;
  client?: YouCamClient;
  /** Reads a catalog reference image; `origin` allows fetching it from the deployed site. */
  loadGarment?: (image: string, origin: string) => Promise<Uint8Array>;
  looksPerVisitorPerHour?: number;
  looksPerDay?: number;
  now?: () => number;
};

export function createTryOnHandler({
  apiKey,
  client = apiKey ? createYouCamClient({ apiKey }) : undefined,
  loadGarment = async (image, origin) => {
    try {
      return new Uint8Array(await readFile(join(process.cwd(), "public", image)));
    } catch {
      // Serverless bundles may omit public/; the same file is a static asset there.
      const response = await fetch(new URL(image, origin));
      if (!response.ok) throw new YouCamError("error_invalid_ref", 502);
      return new Uint8Array(await response.arrayBuffer());
    }
  },
  looksPerVisitorPerHour = 12,
  looksPerDay = 150,
  now = Date.now,
}: TryOnOptions) {
  const visitorLooks = createLimiter(looksPerVisitorPerHour, HOUR, now);
  const visitorPhotos = createLimiter(looksPerVisitorPerHour * 2, HOUR, now);
  const dailyLooks = createLimiter(looksPerDay, 24 * HOUR, now);
  // Provider file IDs live 30 days; refresh garment uploads well before that.
  const garmentFiles = new Map<string, { fileId: Promise<string>; at: number }>();
  // Same photo + garment within 30 minutes reuses the task instead of billing again.
  const recentTasks = new Map<string, { taskId: Promise<string>; at: number }>();

  function garmentFileId(garmentId: string, image: string, origin: string) {
    const cached = garmentFiles.get(garmentId);
    if (cached && now() - cached.at < 12 * HOUR) return cached.fileId;
    const fileId = loadGarment(image, origin).then((bytes) =>
      client!.uploadImage(bytes, imageType(bytes) ?? "image/png", `${garmentId}.png`),
    );
    garmentFiles.set(garmentId, { fileId, at: now() });
    fileId.catch(() => garmentFiles.delete(garmentId));
    return fileId;
  }

  async function createLook(request: Request, visitor: string) {
    const body = (await request.json().catch(() => null)) as {
      photoId?: unknown;
      garmentId?: unknown;
    } | null;
    const photoId = body?.photoId;
    const garment = catalog.find((dress) => dress.id === body?.garmentId);
    if (typeof photoId !== "string" || !ID_PATTERN.test(photoId))
      return failure("invalid_request", 400);
    if (!garment) return failure("unknown_garment", 400);
    const key = `${photoId}:${garment.id}`;
    const recent = recentTasks.get(key);
    if (recent && now() - recent.at < HOUR / 2)
      return json({ taskId: await recent.taskId, reused: true });
    if (!visitorLooks(visitor)) return failure("rate_limited", 429);
    if (!dailyLooks("all")) return failure("daily_limit", 429);
    const origin = new URL(request.url).origin;
    const taskId = garmentFileId(garment.id, garment.image, origin).then((refFileId) =>
      client!.createClothTask({
        srcFileId: photoId,
        refFileId,
        garmentCategory: "full_body",
      }),
    );
    if (recentTasks.size > 500)
      for (const [stale, entry] of recentTasks)
        if (now() - entry.at >= HOUR / 2) recentTasks.delete(stale);
    recentTasks.set(key, { taskId, at: now() });
    try {
      return json({ taskId: await taskId, reused: false });
    } catch (error) {
      recentTasks.delete(key);
      throw error;
    }
  }

  async function uploadPhoto(request: Request, visitor: string) {
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > MAX_PHOTO_BYTES) return failure("invalid_photo", 413);
    const bytes = new Uint8Array(await request.arrayBuffer());
    const type = imageType(bytes);
    if (!type || bytes.byteLength > MAX_PHOTO_BYTES || bytes.byteLength < 1024)
      return failure("invalid_photo", 400);
    if (!visitorPhotos(visitor)) return failure("rate_limited", 429);
    const photoId = await client!.uploadImage(
      bytes,
      type,
      type === "image/png" ? "person.png" : "person.jpg",
    );
    return json({ photoId });
  }

  async function lookStatus(url: URL) {
    const taskId = url.searchParams.get("task");
    if (!taskId || !ID_PATTERN.test(taskId)) return failure("invalid_request", 400);
    let task: ClothTask;
    try {
      task = await client!.getClothTask(taskId);
    } catch (error) {
      const { code } = classify(error);
      if (code === "task_expired")
        return json({ status: "error", error: { code, message: userMessage(code) } });
      throw error;
    }
    if (task.status === "error") {
      const code = task.code.toLowerCase() in messages ? task.code.toLowerCase() : task.code;
      return json({ status: "error", error: { code, message: userMessage(code) } });
    }
    return json(task);
  }

  return async function handle(
    request: Request,
    { clientIp }: { clientIp?: string } = {},
  ): Promise<Response> {
    const url = new URL(request.url);
    const route = `${request.method} ${url.pathname.replace(/\/+$/, "")}`;
    const visitor =
      clientIp ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    try {
      if (route === "GET /api/try-on/config")
        return json({ configured: Boolean(client), provider: PROVIDER_NAME });
      if (
        !["POST /api/try-on/photo", "POST /api/try-on/looks", "GET /api/try-on/looks"].includes(
          route,
        )
      )
        return failure("not_found", 404);
      if (!client) return failure("not_configured", 503);
      if (route === "POST /api/try-on/photo") return await uploadPhoto(request, visitor);
      if (route === "POST /api/try-on/looks") return await createLook(request, visitor);
      return await lookStatus(url);
    } catch (error) {
      const { code, status } = classify(error);
      // Log the provider code only: never the key, photo or file identifiers.
      console.error(`[try-on] ${route} failed: ${error instanceof YouCamError ? error.code : "unexpected"}`);
      return failure(code, status);
    }
  };
}

let shared: ReturnType<typeof createTryOnHandler> | undefined;
/** Process-wide handler configured from server-only environment variables. */
export function tryOnFromEnv(env: Record<string, string | undefined> = process.env) {
  shared ??= createTryOnHandler({
    apiKey: env.YOUCAM_API_KEY?.trim() || undefined,
    looksPerVisitorPerHour: Number(env.TRY_ON_LOOKS_PER_VISITOR_PER_HOUR) || undefined,
    looksPerDay: Number(env.TRY_ON_LOOKS_PER_DAY) || undefined,
  });
  return shared;
}
