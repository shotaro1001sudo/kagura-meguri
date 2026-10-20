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
const errors = [], requests = [], failed = [], ga4Requests = [];
let nextId = 0;
let phaseName = "initial";
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
      if (/googletagmanager\.com\/gtag\/js|google-analytics\.com\/(?:g\/collect|collect)/i.test(url)) {
        const parsed = new URL(url);
        ga4Requests.push({ id: msg.params.requestId, origin: parsed.origin, path: parsed.pathname, phase: phaseName });
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
        userCountry: window.Cookiebot?.userCountry || null,
        gdprApplies: window.Cookiebot?.regulations?.gdprApplies ?? null,
        ccpaApplies: window.Cookiebot?.regulations?.ccpaApplies ?? null,
        consentCookiePresent: document.cookie.split(";").some(x=>x.trim().startsWith("CookieConsent=")),
        dialog: visual(d), widget: visual(w),
        frames: [...document.querySelectorAll("iframe")].filter(x=>/cookiebot|consentcdn/i.test(x.src)).length,
        ga4Allowed: window.kaguraGa4Allowed ?? null
      };
    })())`,
    returnByValue: true
  });
  console.log("BROWSER_STATE", status.result?.value);
  console.log("COOKIEBOT_NETWORK", JSON.stringify(requests.map(({ url, status }) => ({ url, status: status ?? null })).slice(0, 20)));
  // Inspect PUBLIC settings only; avoid raw settings text or account identifiers.
  const publicSettings = await fetch("https://consentcdn.cookiebot.com/consentconfig/6a4ea6ee-9934-4406-b303-5cc8e491a686/settings.json");
  const raw = await publicSettings.text();
  let obj; try { obj = JSON.parse(raw); } catch { obj = null; }
  const relevant = [];
  const collect = (value, prefix = "", depth = 0) => {
    if (depth > 8 || relevant.length > 35 || !value || typeof value !== "object") return;
    for (const [key, v] of Object.entries(value)) {
      const path = prefix ? prefix + "." + key : key;
      if (/geo|distribut|countr|region|consent|banner|method|explicit|implied|strict|level|gdpr/i.test(key) && (typeof v === "string" || typeof v === "number" || typeof v === "boolean")) {
        relevant.push({ key: path.slice(0, 140), value: String(v).slice(0, 100) });
      }
      if (typeof v === "object") collect(v, path, depth + 1);
    }
  };
  collect(obj);
  console.log("PUBLIC_SETTINGS", JSON.stringify({ httpStatus: publicSettings.status, contentType: publicSettings.headers.get("content-type"), bytes: raw.length, topKeys: obj ? Object.keys(obj).slice(0, 30) : [], relevant }));
  console.log("COOKIEBOT_NETWORK_FAILURES", JSON.stringify(failed.slice(0, 15)));
  console.log("CONSOLE_ERRORS", JSON.stringify([...new Set(errors)].slice(0, 30)));
  // Exercise the public banner UI in an ephemeral browser profile. No booking/affiliate links.
  const evaluate = async (expression) => {
    const x = await call("Runtime.evaluate", { expression, returnByValue: true });
    if (x.exceptionDetails) throw Error("Browser evaluation: " + (x.exceptionDetails.exception?.description || x.exceptionDetails.text || ""));
    return x.result?.value;
  };
  const state = () => evaluate(`JSON.stringify((() => ({
    hasResponse: window.Cookiebot?.hasResponse ?? null,
    statistics: window.Cookiebot?.consent?.statistics ?? null,
    method: window.Cookiebot?.consent?.method ?? null,
    ga4Allowed: window.kaguraGa4Allowed ?? null,
    dialogVisible: (() => { const d = document.querySelector("#CybotCookiebotDialog"); return !!d && getComputedStyle(d).display !== "none" && d.getBoundingClientRect().height > 0; })()
  }))())`);
  const buttons = await evaluate(`JSON.stringify([...document.querySelectorAll("#CybotCookiebotDialog button, #CybotCookiebotDialog [role=button]")].map(x => ({ id: x.id, text: x.textContent.trim().slice(0, 75) })).slice(0, 25))`);
  console.log("CONSENT_BUTTONS", buttons);
  const choose = (reject) => evaluate(`(() => {
    const nodes = [...document.querySelectorAll("#CybotCookiebotDialog button, #CybotCookiebotDialog [role=button]")];
    const patterns = ${JSON.stringify(["decline", "deny", "reject", "拒否", "同意しない"])}.map(x=>new RegExp(x, "i"));
    const yes = ${JSON.stringify(["allow all", "accept all", "agree all", "すべて許可", "すべて同意", "allowall", "acceptall", "同意する"])}.map(x=>new RegExp(x, "i"));
    const p = ${reject ? "patterns" : "yes"};
    const btn = reject ? nodes.find(x => p.some(rx => rx.test(x.id+" "+x.textContent.trim()))) : nodes.find(x => /^(?:allow all|accept all|すべて許可|すべて同意)$/i.test(x.textContent.trim()) || /AllowAll$/i.test(x.id));
    if (!btn) return JSON.stringify({ found: false });
    const result = { found: true, id: btn.id, label: btn.textContent.trim().slice(0, 70) };
    btn.click();
    return JSON.stringify(result);
  })()`);
  const before = ga4Requests.length;
  phaseName = "reject";
  const reject = await choose(true);
  await sleep(3500);
  const afterReject = await state();
  console.log("REJECT_ACTION", reject);
  console.log("REJECT_STATE", afterReject);
  console.log("REJECT_GA4_REQUESTS", JSON.stringify(ga4Requests.slice(before)));

  phaseName = "reset";
  await call("Network.clearBrowserCookies");
  await call("Network.clearBrowserCache");
  await call("Page.reload", { ignoreCache: true });
  await sleep(7000);
  console.log("BEFORE_ACCEPT_STATE", await state());
  const acceptStart = ga4Requests.length;
  phaseName = "accept";
  const accept = await choose(false);
  await sleep(7000);
  const afterAccept = await state();
  console.log("ACCEPT_ACTION", accept);
  console.log("ACCEPT_STATE", afterAccept);
  console.log("ACCEPT_GA4_REQUESTS", JSON.stringify(ga4Requests.slice(acceptStart)));
  const wasRejected = JSON.parse(afterReject || "{}");
  const wasAccepted = JSON.parse(afterAccept || "{}");
  const collected = ga4Requests.slice(acceptStart);
  const success = JSON.parse(reject).found && JSON.parse(accept).found &&
    wasRejected.ga4Allowed === false && ga4Requests.slice(before, acceptStart).length === 0 &&
    wasAccepted.ga4Allowed === true && wasAccepted.method === "explicit" &&
    wasAccepted.statistics === true && collected.some(x => x.path === "/gtag/js");
  console.log("CONSENT_E2E_RESULT", success ? "PASS" : "NEEDS_INVESTIGATION");
} catch (e) {
  console.log("DIAGNOSTIC_ERROR", String(e));
  process.exitCode = 1;
} finally {
  ws?.close();
  chrome?.kill();
  try { rmSync(dir, { recursive: true, force: true }); } catch {}
}
