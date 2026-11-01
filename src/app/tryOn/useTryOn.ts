import { useEffect, useRef, useState } from "react";
import { tryOnApi, TryOnRequestError, type TryOnConfig } from "./api";
import { PhotoError, preparePhoto, type PreparedPhoto } from "./photo";

// One look = one YouCam task for (photo, garment). Keys are `${photoHash}:${garmentId}`,
// so a changed photo never shows another photo's result and unchanged pairs are reused.
export type Look =
  | { status: "creating" }
  | { status: "running"; taskId: string }
  | { status: "stalled"; taskId: string; message: string }
  | { status: "success"; taskId: string; imageUrl: string; refreshed: boolean }
  | { status: "error"; message: string };

export type TryOn = ReturnType<typeof useTryOn>;

const FIRST_POLL_MS = 2500;
const POLL_MS = 3000;
const MAX_POLLS = 40; // about two minutes, then the shopper chooses to keep waiting
const STALLED = "Still working on it, or the connection dropped. Check again to keep waiting; this won't start a new preview.";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const messageOf = (error: unknown) =>
  error instanceof TryOnRequestError || error instanceof PhotoError
    ? error.message
    : "Something went wrong. Try again in a moment.";

export function useTryOn() {
  const [config, setConfig] = useState<TryOnConfig | null>(null);
  const [consent, setConsentState] = useState(false);
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [looks, setLooks] = useState<Record<string, Look>>({});
  const store = useRef<Record<string, Look>>({});
  const photoRef = useRef<PreparedPhoto | null>(null);
  const uploads = useRef(new Map<string, Promise<string>>());
  // key → task being polled, or null while the task is being created.
  const active = useRef(new Map<string, string | null>());
  const mounted = useRef(true);

  useEffect(() => {
    let live = true;
    tryOnApi.config().then(
      (result) => live && setConfig(result),
      () => live && setConfig({ configured: false, provider: "" }),
    );
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    mounted.current = true;
    const polling = active.current;
    return () => {
      mounted.current = false;
      polling.clear();
    };
  }, []);

  const update = (key: string, look: Look | null) => {
    const next = { ...store.current };
    if (look) next[key] = look;
    else delete next[key];
    store.current = next;
    setLooks(next);
  };

  async function poll(key: string, taskId: string, refreshed = false) {
    active.current.set(key, taskId);
    let failures = 0;
    for (let attempt = 0; attempt < MAX_POLLS; attempt += 1) {
      await wait(attempt ? POLL_MS : FIRST_POLL_MS);
      if (!mounted.current || active.current.get(key) !== taskId) return;
      try {
        const result = await tryOnApi.lookStatus(taskId);
        if (active.current.get(key) !== taskId) return;
        failures = 0;
        if (result.status === "running") continue;
        active.current.delete(key);
        update(
          key,
          result.status === "success"
            ? { status: "success", taskId, imageUrl: result.imageUrl, refreshed }
            : { status: "error", message: result.error.message },
        );
        return;
      } catch (error) {
        if (active.current.get(key) !== taskId) return;
        failures += 1;
        if (failures >= 3) {
          active.current.delete(key);
          update(key, { status: "stalled", taskId, message: messageOf(error) });
          return;
        }
      }
    }
    active.current.delete(key);
    update(key, { status: "stalled", taskId, message: STALLED });
  }

  function uploadOnce(current: PreparedPhoto) {
    let photoId = uploads.current.get(current.hash);
    if (!photoId) {
      photoId = tryOnApi.uploadPhoto(current.blob).then((result) => result.photoId);
      uploads.current.set(current.hash, photoId);
      photoId.catch(() => uploads.current.delete(current.hash));
    }
    return photoId;
  }

  /** Explicit request: creates a task only for pairs without a usable result. */
  function createLooks(garmentIds: string[]) {
    const current = photoRef.current;
    if (!current || !consent || !config?.configured) return;
    for (const garmentId of garmentIds) {
      const key = `${current.hash}:${garmentId}`;
      if (active.current.has(key)) continue;
      const look = store.current[key];
      if (look?.status === "success") continue;
      if (look?.status === "stalled") {
        update(key, { status: "running", taskId: look.taskId });
        void poll(key, look.taskId);
        continue;
      }
      active.current.set(key, null);
      update(key, { status: "creating" });
      void (async () => {
        try {
          const photoId = await uploadOnce(current);
          const { taskId } = await tryOnApi.createLook(photoId, garmentId);
          if (active.current.get(key) !== null) return;
          update(key, { status: "running", taskId });
          await poll(key, taskId);
        } catch (error) {
          if (active.current.get(key) !== null) return;
          active.current.delete(key);
          update(key, { status: "error", message: messageOf(error) });
        }
      })();
    }
  }

  /** Result links expire after about two hours; ask the same task for a fresh one once. */
  function previewFailed(garmentId: string) {
    const current = photoRef.current;
    if (!current) return;
    const key = `${current.hash}:${garmentId}`;
    const look = store.current[key];
    if (look?.status !== "success" || active.current.has(key)) return;
    if (look.refreshed) {
      update(key, {
        status: "error",
        message: "This preview can't be shown anymore. Create it again.",
      });
      return;
    }
    update(key, { status: "running", taskId: look.taskId });
    void poll(key, look.taskId, true);
  }

  function removePhoto() {
    const current = photoRef.current;
    if (!current) return;
    const prefix = `${current.hash}:`;
    for (const key of [...active.current.keys()])
      if (key.startsWith(prefix)) active.current.delete(key);
    store.current = Object.fromEntries(
      Object.entries(store.current).filter(([key]) => !key.startsWith(prefix)),
    );
    setLooks(store.current);
    uploads.current.delete(current.hash);
    URL.revokeObjectURL(current.url);
    photoRef.current = null;
    setPhoto(null);
    setPhotoError("");
  }

  async function choosePhoto(file: File) {
    if (!consent) return;
    setPreparing(true);
    setPhotoError("");
    try {
      const prepared = await preparePhoto(file);
      if (photoRef.current?.hash === prepared.hash) {
        URL.revokeObjectURL(prepared.url);
        return;
      }
      if (photoRef.current) URL.revokeObjectURL(photoRef.current.url);
      photoRef.current = prepared;
      setPhoto(prepared);
    } catch (error) {
      setPhotoError(messageOf(error));
    } finally {
      setPreparing(false);
    }
  }

  function setConsent(value: boolean) {
    setConsentState(value);
    if (!value) removePhoto();
  }

  const lookFor = (garmentId: string): Look | undefined =>
    photo ? looks[`${photo.hash}:${garmentId}`] : undefined;

  return {
    config,
    available: config?.configured === true,
    consent,
    setConsent,
    photo,
    photoError,
    preparing,
    choosePhoto,
    removePhoto,
    createLooks,
    previewFailed,
    lookFor,
  };
}
