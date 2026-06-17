import { handleRequest } from "../src/starter/app.js";

export default async function handler(req, res) {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const rewrittenPath = url.searchParams.get("__daone_path");
  if (rewrittenPath) {
    url.searchParams.delete("__daone_path");
    const query = url.searchParams.toString();
    req.url = `/api/${rewrittenPath}${query ? `?${query}` : ""}`;
  }
  await handleRequest(req, res);
}
