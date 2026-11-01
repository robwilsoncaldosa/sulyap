// Live check through Sulyap's own API: one photo upload, ONE YouCam render, bounded polling.
// Usage (dev server running with YOUCAM_API_KEY in .env.local):
//   node scripts/smoke-try-on.mjs path/to/full-length-photo.jpg [garmentId] [baseUrl]
import { readFile, writeFile } from "node:fs/promises";

const [photoPath, garmentId = "midnight", base = "http://127.0.0.1:5173"] = process.argv.slice(2);
if (!photoPath) {
  console.error("Usage: node scripts/smoke-try-on.mjs <photo.jpg|png> [garmentId] [baseUrl]");
  process.exit(1);
}
const json = async (response) => {
  const body = await response.json();
  if (!response.ok) throw new Error(`${response.status} ${body.error?.code}: ${body.error?.message}`);
  return body;
};
const config = await json(await fetch(`${base}/api/try-on/config`));
if (!config.configured) throw new Error("Server has no YOUCAM_API_KEY. Add it to .env.local and restart.");
const bytes = await readFile(photoPath);
const type = bytes[0] === 0x89 ? "image/png" : "image/jpeg";
const started = Date.now();
const { photoId } = await json(await fetch(`${base}/api/try-on/photo`, { method: "POST", headers: { "Content-Type": type }, body: bytes }));
console.log(`Uploaded photo (${bytes.byteLength} bytes) in ${Date.now() - started} ms`);
const { taskId, reused } = await json(await fetch(`${base}/api/try-on/looks`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ photoId, garmentId }),
}));
console.log(`Created ${garmentId} look${reused ? " (reused)" : ""}; polling…`);
for (let attempt = 0; attempt < 60; attempt += 1) {
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const result = await json(await fetch(`${base}/api/try-on/looks?task=${encodeURIComponent(taskId)}`));
  if (result.status === "running") continue;
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (result.status === "error") throw new Error(`YouCam error after ${seconds}s: ${result.error.code} – ${result.error.message}`);
  const image = await fetch(result.imageUrl);
  const out = `smoke-${garmentId}-${Date.now()}.jpg`;
  await writeFile(out, Buffer.from(await image.arrayBuffer()));
  console.log(`Success in ${seconds}s. Saved ${out} (link valid ~2 hours).`);
  process.exit(0);
}
throw new Error("Still running after 3 minutes; the task was not re-created.");
