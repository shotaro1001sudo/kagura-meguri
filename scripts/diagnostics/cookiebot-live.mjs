// Temporary diagnostic for the public production banner, running on GitHub Actions.
// No credentials, cookies, personal data, or full HTML are printed.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dir = mkdtempSync(join(tmpdir(), "kagura-cookiebot-"));
const port = 19237;
let chrome, ws;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [], requests = [], failed = [];
let nextId = 0;
const waiting = new Map();

try {
  chrome = spawn("google-chrome", [
    "--headless=new", "--no-sandbox", "--disable-dev-shm-usage",
    "--no-first-run", "--no-default-browser-check",
    `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, "about:blank"
  ], { stdio: "ignore" });
  let target;
  for (let i = 0; i < 70; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json`);
      const list = await res.json();
      target = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
      if (target) break;
    } catch {}
    await sleep(200);
  }
  if (!target) throw Error("Chrome DevTools did not become ready");
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve, { once: true });
    ws.addEventListener("error", reject, { once: true });
  });
  ws.addEventListener("message", (e) => {
    let msg;
    try { msg = JSON.parse(e.data.toString()); } catch { return; }
    if (msg.id && waiting.has(msg.id)) {
      const cb = waiting.get(msg.id);
      waiting.delete(msg.id);
      cb(msg);
    }
    if (msg.method === "Log.entryAdded" || msg.method === "Runtime.consoleAPICalled") {
      const entry = msg.params?.entry;
      const message = entry?.text || msg.params?.args?.map((a) => a.value || a.description).join(" ") || "";
      if (/Content Security Policy|Refused to|Cookiebot|Cybot|consentcdn|blocked|Uncaught|error/i.test(message)) {
        errors.push(message.slice(0, 700));
      }
    }
    if (msg.method === "Runtime.exceptionThrown") {
      const e = msg.params?.exceptionDetails;
      errors.push((e?.text || "Exception") + ": " + (e?.exception?.description || "").slice(0, 350));
    }
    if (msg.method === "Network.requestWillBeSent") {
      const url = msg.params?.request?.url || "";
      if (/cookiebot|consentcdn|consent\.cookiebot|imgsct/i.test(url)) {
        requests.push({ id: msg.params.requestId, url: url.split("?")[0].slice(0, 200) });
      }
    }
    if (msg.method === "Network.loadingFailed" &&
        requests.some((x) => x.id === msg.params?.requestId)) {
      failed.push({ error: msg.params.errorText, blockedReason: msg.params.blockedReason || "" });
    }
    if (msg.method === "Network.responseReceived" &&
        requests.some((x) => x.id === msg.params?.requestId)) {
      const request = requests.find((x) => x.id === msg.params.requestId);
      request.status = msg.params.response?.status;
    }
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    const timer = setTimeout(() => { waiting.delete(id); reject(Error(method + " timeout")); }, 8000);
    waiting.set(id, (msg) => { clearTimeout(timer); msg.error ? reject(Error(msg.error.message)) : resolve(msg.result); });
    ws.send(JSON.stringify({ id, method, params }));
  });
  await Promise.all([
    call("Page.enable"), call("Runtime.enable"), call("Network.enable"), call("Log.enable")
  ]);
  const nav = await call("Page.navigate", { url: "https://kagurameguri.jp/" });
  console.log("NAVIGATION", JSON.stringify({ errorText: nav.errorText || null }));
  await sleep(12500);
  const status = await call("Runtime.evaluate", {
    expression: `JSON.stringify((() => {
      const d = document.querySelector("#CybotCookiebotDialog");
      const w = document.querySelector("#CookiebotWidget");
      const s = document.querySelector("#Cookiebot");
      const visual = el => el ? ({
        display: getComputedStyle(el).display,
        visibility: getComputedStyle(el).visibility,
        opacity: getComputedStyle(el).opacity,
        height: Math.round(el.getBoundingClientRect().height)
      }) : null;
      return {
        hostname: location.hostname, title: document.title, readyState: document.readyState,
        cookieScript: !!s,
        blockingMode: s?.getAttribute("data-blockingmode") || null,
        cookieApiType: typeof window.Cookiebot,
        hasResponse: window.Cookiebot?.hasResponse ?? null,
        statisticsConsent: window.Cookiebot?.consent?.statistics ?? null,
        consentMethod: window.Cookiebot?.consent?.method ?? null,
        dialog: visual(d), widget: visual(w),
        frames: [...document.querySelectorAll("iframe")].filter(x=>/cookiebot|consentcdn/i.test(x.src)).length,
        ga4Allowed: window.kaguraGa4Allowed ?? null
      };
    })())`,
    returnByValue: true
  });
  console.log("BROWSER_STATE", status.result?.value);
  console.log("COOKIEBOT_NETWORK", JSON.stringify(requests.map(({ url, status }) => ({ url, status: status ?? null })).slice(0, 20)));
  console.log("COOKIEBOT_NETWORK_FAILURES", JSON.stringify(failed.slice(0, 15)));
  console.log("CONSOLE_ERRORS", JSON.stringify([...new Set(errors)].slice(0, 30)));
} catch (e) {
  console.log("DIAGNOSTIC_ERROR", String(e));
  process.exitCode = 1;
} finally {
  ws?.close();
  chrome?.kill();
  try { rmSync(dir, { recursive: true, force: true }); } catch {}
}
