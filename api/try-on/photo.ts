import { tryOnFromEnv } from "../../server/tryOn.js";

export const POST = (request: Request) => tryOnFromEnv()(request);
