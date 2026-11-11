// Rules-only verdicts (no model) for the real-world set in tests/realworld/ and for the scam screenshots read
// with OCR first, so the "keyword rules alone" column of the live results can be checked offline.
//   npm run realworld            (OCR rows need tesseract on PATH; skipped if it's missing)
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
process.env.REPLAY = "1"; process.env.DATA_DIR = process.env.DATA_DIR || "/tmp/day20-realworld";
const { readCase } = await import("../lib/cases.js");
const { extractClaims } = await import("../lib/claims.js");
const { compare } = await import("../lib/compare.js");
const r = await readCase("PP-R-UZH-10198816", { scenario: "open_day7" });
const now = new Date(new Date(r.openedAt).getTime() + 7 * 86400000 + 3600000);
const judge = (text) => compare(extractClaims(text), r, now);
const dir = new URL("../tests/realworld/", import.meta.url);
let close = 0, red = 0, safe = 0, n = 0;
for (const f of readdirSync(dir).filter((f) => f.endsWith(".txt")).sort()) {
  const c = judge(readFileSync(new URL(f, dir), "utf8")); n++;
  const warns = c.findings.some((x) => x.id === "close_request"); close += warns; red += c.overall === "mismatch"; safe += c.overall === "consistent";
  console.log(`${f}  ${c.overall}${warns ? "  · Don't close it" : ""}`);
}
console.log(`real-world, rules alone: told "Don't close it" ${close}/${n} · flagged red ${red}/${n} · called safe ${safe}/${n}`);
try {
  execFileSync("tesseract", ["--version"], { stdio: "ignore" });
  const s = new URL("../public/samples/", import.meta.url); let ocrRed = 0, k = 0;
  for (const f of readdirSync(s).filter((f) => /^scam_.*\.png$/.test(f)).sort()) {
    const text = execFileSync("tesseract", [new URL(f, s).pathname, "-", "-l", "eng"], { stdio: ["ignore", "pipe", "ignore"] }).toString();
    ocrRed += judge(text).overall === "mismatch"; k++;
  }
  console.log(`scam screenshots, OCR + rules alone: flagged red ${ocrRed}/${k}`);
} catch { console.log("tesseract not found: skipped the OCR baseline"); }
