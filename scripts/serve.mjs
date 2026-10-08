// ローカル確認用の静的サーバ: node scripts/serve.mjs [ディレクトリ=dist] [ポート=4173]
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const types = { ".html": "text/html; charset=utf-8", ".json": "application/json", ".xml": "application/xml", ".ics": "text/calendar", ".txt": "text/plain" };
const DIR = process.argv[2] || "dist", PORT = Number(process.argv[3]) || 4173;
createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  try {
    const body = await readFile(join(DIR, p));
    res.writeHead(200, { "content-type": types[extname(p)] || "application/octet-stream" });
    res.end(body);
  } catch { try { const nf = await readFile(join(DIR, "404.html")); res.writeHead(404, { "content-type": "text/html; charset=utf-8" }); res.end(nf); } catch { res.writeHead(404); res.end("not found"); } }
}).listen(PORT, () => console.log(`http://localhost:${PORT}`));
