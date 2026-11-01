import { tryOnFromEnv } from "../../server/tryOn.js";

export const GET = (request: Request) => tryOnFromEnv()(request);
