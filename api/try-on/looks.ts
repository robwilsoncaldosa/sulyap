import { tryOnFromEnv } from "../../server/tryOn.js";

export const GET = (request: Request) => tryOnFromEnv()(request);
export const POST = (request: Request) => tryOnFromEnv()(request);
