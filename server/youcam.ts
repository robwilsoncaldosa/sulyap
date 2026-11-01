// YouCam AI Clothes V4 (Perfect Corp) server-to-server client.
// Reference: https://docs.perfectcorp.com/reference/ai_clothes/v4.0
// The API key never leaves the server; callers receive file and task IDs only.
export const YOUCAM_BASE_URL = "https://yce-api-01.makeupar.com";
export const CLOTH_TASK = "cloth-v4";

export type GarmentCategory = "full_body" | "upper_body" | "lower_body" | "auto";

export type ClothTask =
  | { status: "running" }
  | { status: "success"; imageUrl: string }
  | { status: "error"; code: string };

export class YouCamError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  constructor(code: string, httpStatus: number, message = code) {
    super(message);
    this.name = "YouCamError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

type Fetch = typeof fetch;

export function createYouCamClient({
  apiKey,
  baseUrl = YOUCAM_BASE_URL,
  fetch: fetchImpl = globalThis.fetch,
  timeoutMs = 20000,
}: {
  apiKey: string;
  baseUrl?: string;
  fetch?: Fetch;
  timeoutMs?: number;
}) {
  async function call(path: string, init: RequestInit = {}) {
    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          ...(init.body ? { "Content-Type": "application/json" } : {}),
          ...init.headers,
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch {
      throw new YouCamError("provider_unreachable", 502);
    }
    const body = (await response.json().catch(() => null)) as {
      data?: Record<string, unknown>;
      error?: string;
      error_code?: string;
    } | null;
    if (!response.ok || !body?.data)
      throw new YouCamError(
        body?.error_code ?? `http_${response.status}`,
        response.status,
        body?.error,
      );
    return body.data;
  }

  return {
    /** Creates a provider file slot, then uploads the bytes to its presigned URL. */
    async uploadImage(
      bytes: Uint8Array,
      contentType: "image/jpeg" | "image/png",
      fileName: string,
    ): Promise<string> {
      const data = await call("/s2s/v2.0/file", {
        method: "POST",
        body: JSON.stringify({
          files: [
            { content_type: contentType, file_name: fileName, file_size: bytes.byteLength },
          ],
        }),
      });
      const file = (data.files as {
        file_id?: string;
        requests?: { method?: string; url?: string; headers?: Record<string, string> }[];
      }[] | undefined)?.[0];
      const upload = file?.requests?.[0];
      if (!file?.file_id || !upload?.url)
        throw new YouCamError("invalid_upload_response", 502);
      let uploaded: Response;
      try {
        uploaded = await fetchImpl(upload.url, {
          method: upload.method ?? "PUT",
          headers: upload.headers ?? { "Content-Type": contentType },
          body: bytes as BodyInit,
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch {
        throw new YouCamError("upload_failed", 502);
      }
      if (!uploaded.ok) throw new YouCamError("upload_failed", 502);
      return file.file_id;
    },

    async createClothTask({
      srcFileId,
      refFileId,
      garmentCategory,
    }: {
      srcFileId: string;
      refFileId: string;
      garmentCategory: GarmentCategory;
    }): Promise<string> {
      const data = await call(`/s2s/v2.0/task/${CLOTH_TASK}`, {
        method: "POST",
        body: JSON.stringify({
          src_file_id: srcFileId,
          ref_file_id: refFileId,
          garment_category: garmentCategory,
          // Reject photos with several people instead of guessing who to dress.
          filter_multi_person: "normal",
        }),
      });
      if (typeof data.task_id !== "string")
        throw new YouCamError("invalid_task_response", 502);
      return data.task_id;
    },

    async getClothTask(taskId: string): Promise<ClothTask> {
      const data = await call(
        `/s2s/v2.0/task/${CLOTH_TASK}/${encodeURIComponent(taskId)}`,
      );
      if (data.task_status === "success") {
        const url = (data.results as { url?: unknown } | undefined)?.url;
        if (typeof url !== "string")
          throw new YouCamError("invalid_result_response", 502);
        return { status: "success", imageUrl: url };
      }
      if (data.task_status === "error")
        return {
          status: "error",
          code: typeof data.error === "string" ? data.error : "unknown_error",
        };
      return { status: "running" };
    },
  };
}

export type YouCamClient = ReturnType<typeof createYouCamClient>;
