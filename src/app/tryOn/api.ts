// Browser side of /api/try-on. The server holds the YouCam key; this only sees IDs and result URLs.
export type TryOnConfig = { configured: boolean; provider: string };
export type LookResult =
  | { status: "running" }
  | { status: "success"; imageUrl: string }
  | { status: "error"; error: { code: string; message: string } };

export class TryOnRequestError extends Error {
  readonly code: string;
  readonly httpStatus: number;
  constructor(code: string, message: string, httpStatus: number) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new TryOnRequestError(
      "network",
      "Couldn't reach Sulyap's server. Check your connection and try again.",
      0,
    );
  }
  const body = (await response.json().catch(() => null)) as
    | (T & { error?: { code: string; message: string } })
    | null;
  if (!response.ok || !body)
    throw new TryOnRequestError(
      body?.error?.code ?? "unknown_error",
      body?.error?.message ?? "Something went wrong. Try again in a moment.",
      response.status,
    );
  return body;
}

export const tryOnApi = {
  config: () => request<TryOnConfig>("/api/try-on/config"),
  uploadPhoto: (photo: Blob) =>
    request<{ photoId: string }>("/api/try-on/photo", {
      method: "POST",
      headers: { "Content-Type": photo.type },
      body: photo,
    }),
  createLook: (photoId: string, garmentId: string) =>
    request<{ taskId: string }>("/api/try-on/looks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId, garmentId }),
    }),
  lookStatus: (taskId: string) =>
    request<LookResult>(`/api/try-on/looks?task=${encodeURIComponent(taskId)}`),
};
