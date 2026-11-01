// Prepares the person photo in the browser: upright, at most 1600px, re-encoded as JPEG.
// Re-encoding drops EXIF metadata such as location before anything leaves the device.
export type PreparedPhoto = {
  blob: Blob;
  url: string;
  hash: string;
  width: number;
  height: number;
};

export class PhotoError extends Error {}

const MAX_SIDE = 1600;

async function digest(blob: Blob) {
  if (!crypto?.subtle) return `${blob.size}:${Date.now()}`;
  const bytes = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(bytes), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  if (file.type && !file.type.startsWith("image/"))
    throw new PhotoError("Choose a photo file (JPG or PNG).");
  if (file.size > 25 * 1024 * 1024)
    throw new PhotoError("This photo is over 25 MB. Choose a smaller one.");
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new PhotoError(
      "This photo format can't be read in your browser. Use a JPG or PNG.",
    );
  }
  const long = Math.max(bitmap.width, bitmap.height);
  const short = Math.min(bitmap.width, bitmap.height);
  if (long < 512 || short < 384) {
    bitmap.close();
    throw new PhotoError(
      "This photo is too small. Use one at least 512 pixels on its longer side.",
    );
  }
  const scale = Math.min(1, MAX_SIDE / long);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new PhotoError("Your browser couldn't prepare this photo.");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.9),
  );
  if (!blob) throw new PhotoError("Your browser couldn't prepare this photo.");
  return {
    blob,
    url: URL.createObjectURL(blob),
    hash: await digest(blob),
    width,
    height,
  };
}
