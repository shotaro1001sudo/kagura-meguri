import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { parse } from "../scripts/adapters/npo-hiroshima.mjs";
import { reconcile } from "../scripts/lib/collect-core.mjs";
import { quarantineUnlocated } from "../scripts/lib/collection-quarantine.mjs";
const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const sources = json("data/sources.json");
const source = sources.find((s) => s.id === "npo-hiroshima");
const html = readFileSync("tests/fixtures/npo-hiroshima-missing-slash.html", "utf8");
const [candidate] = parse(html, source);
assert.equal(candidate.city, "雲南市");
assert.equal(candidate.venue, "雲南市立田井小学校 体育館(雲南市吉田町深野90-1)");
assert.equal(candidate.start, "2026-11-22T10:30");
assert.equal(candidate.fee, "前売券1,500円/当日券2,000円");
for (const [input, expected] of [["10:30", "10:30"], ["１０：３０", "10:30"], ["10時", "10:00"], ["9時5分", "09:05"]]) {
  assert.equal(parse(html.replace("10時30分", input), source)[0].start, `2026-11-22T${expected}`);
}
for (const separator of ["/", "／", ":", "", "　"]) {
  assert.equal(parse(html.replace("■会場　", `■会場${separator}`), source)[0].venue, candidate.venue);
}
assert.equal(parse(html.replace(candidate.venue, "未定"), source)[0].city, "");
assert.equal(parse(html.replace(candidate.venue, ""), source)[0].venue, "");
assert.equal(parse(html.replace("開演10時30分", "開演■チケット取扱所/10:30"), source)[0].timeUnknown, true);
const now = new Date("2026-11-02T05:00:00+09:00");
const run = (events, candidates, src = source) => reconcile({ events, candidates, source: src, now });
let result = run([], [candidate]);
assert.equal(result.summary.published.length, 0);
assert.equal(result.summary.held.length, 1);
assert.match(result.events[0].holdReasons.join(), /10:30と18:00/);
assert.equal(result.events[0].lat, undefined);
assert.equal(run([], [{ ...candidate, start: "2026-11-22T18:00" }]).summary.held.length, 1);
assert.equal(run([{ ...result.events[0], status: "withdrawn" }], [candidate]).summary.published.length, 0);
// Reconstructed facts from run 41346599750's report. Times were absent in the log,
// so this fixture explicitly marks them unknown instead of inventing them.
const facts = json("tests/fixtures/collection-172-holds.json");
const tak = run([], facts.filter((e) => e.name.startsWith("高千穂")), sources.find((s) => s.id === "takachiho-yokagura"));
assert.equal(tak.summary.held.length, 21);
assert(tak.events.every((e) => e.holdReasons.includes("一度の新規が多すぎる")));
const kam = run([], facts.filter((e) => e.name.startsWith("かむくら")), sources.find((s) => s.id === "akitakata"));
assert.equal(kam.summary.held.length, 1);
assert.match(kam.events[0].holdReasons.join(), /神楽以外/);
const holds = [...tak.events, ...kam.events, ...result.events];
const next = run(holds, [candidate]);
assert.equal(next.summary.published.length, 0);
assert.deepEqual(next.events, holds);
const located = { ...candidate, id: "located", auto: true, status: "published", lat: 35, lng: 133 };
const unlocated = { ...located, id: "unlocated", name: "位置未確認神楽", lat: undefined };
const manual = { ...unlocated, id: "manual", auto: false };
const finalized = quarantineUnlocated([...holds, located, unlocated, manual]);
assert.equal(finalized.held.length, 1);
assert.equal(finalized.events.find((e) => e.id === "located").status, "published");
assert.equal(finalized.events.find((e) => e.id === "manual").status, "published");
assert.deepEqual(finalized.events.slice(0, holds.length), holds);
for (const lat of [NaN, Infinity, 91, null]) assert.equal(quarantineUnlocated([{ ...located, lat }]).held.length, 1);
const dir = mkdtempSync(join(tmpdir(), "collection-172-"));
try {
  const env = { ...process.env, EVENTS_FILE: join(dir, "events.json"), SUMMARY_FILE: join(dir, "summary.json"), REPORT_FILE: join(dir, "report.md") };
  writeFileSync(env.EVENTS_FILE, JSON.stringify([...holds, located, unlocated]));
  writeFileSync(env.SUMMARY_FILE, JSON.stringify({ published: 2, held: holds.length, needsAttention: true, items: { published: [located, unlocated], held: holds } }));
  writeFileSync(env.REPORT_FILE, "# Fixture collection report\n");
  const check = spawnSync(process.execPath, ["scripts/quarantine-collected.mjs"], { env, encoding: "utf8" });
  assert.equal(check.status, 0, check.stderr);
  assert.equal(json(env.SUMMARY_FILE).published, 1);
  assert.equal(json(env.SUMMARY_FILE).held, 24);
  assert.equal(json(env.EVENTS_FILE).filter((e) => e.status === "pending").length, 24);
  assert.match(readFileSync(env.REPORT_FILE, "utf8"), /位置未確認神楽/);
  assert.equal(spawnSync(process.execPath, ["scripts/quarantine-collected.mjs"], { env }).status, 0);
  assert.equal(json(env.SUMMARY_FILE).held, 24);
} finally { rmSync(dir, { recursive: true, force: true }); }
assert.match(readFileSync(".github/workflows/collect.yml", "utf8"), /geocode\.mjs[\s\S]*quarantine-collected\.mjs[\s\S]*npm test/);
console.log("Issue #172 fixture collection: 21 volume holds + 1 name hold + 1 disputed event held; unlocated candidate quarantined; valid candidate preserved.");
