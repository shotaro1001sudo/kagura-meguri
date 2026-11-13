// 広告の報酬の自動の読み込み(バリューコマースの API・楽天の記録)と、売上への入り方のテスト。作業用のフォルダと、偽の API だけを使う
import { mkdtempSync, rmSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { loadEarnings, refreshVc, recordRakuten, earningsStatus, vcMonthsToFetch, monthWindow, vcAggregate, parseRakutenArg, RAKUTEN_STALE_DAYS } from "../scripts/admin/earnings.mjs";
import { deriveActuals, revenueOf } from "../scripts/admin/overview.mjs";

// 偽のバリューコマース: トークン → 注文(月ごと。2ページに分ける)
function fakeVc({ status = 200, orders = {}, badAt = null } = {}) {
  const calls = [];
  const res = (code, body) => ({ ok: code === 200, status: code, json: async () => body });
  const f = async (url, opt) => {
    calls.push({ url, auth: opt?.headers?.Authorization });
    if (url.includes("/auth/")) return status !== 200 ? res(status, {}) : res(200, { resultSet: { rowData: { bearer_token: "TOKEN" } } });
    const u = new URL(url), from = u.searchParams.get("from_date"), off = +u.searchParams.get("offset");
    if (badAt && from.startsWith(badAt)) return res(500, {});
    const rows = orders[from.slice(0, 7)] ?? [];
    const page = rows.slice(off, off + 1); // 1件ずつ返して、ページの続きを確かめる
    return res(200, { resultSet: { rowData: page, responseInfo: { nextOffset: off + 1 < rows.length ? off + 1 : -1 } } });
  };
  f.calls = calls;
  return f;
}
const ord = (id, month, st, yen, o = {}) => ({ transactionOid: id, affilId: "3784232", orderDate: `${month}-05T10:00:00`, approvalStatus: st, affilPayment: yen, updDate: "2026-11-01", ...o });

export function earningsTests({ ok, section }) {
  section("目標・収益: 広告の報酬の自動の読み込み(バリューコマース・楽天)");
  const root = mkdtempSync(join(tmpdir(), "kagura-earn-"));
  try {
    mkdirSync(join(root, "analytics"));
    const today = "2026-11-14";
    const local = { valuecommerce: { clientKey: "KEY", clientSecret: "SECRET" } };

    ok(JSON.stringify(monthWindow("2026-11", today)) === JSON.stringify({ month: "2026-11", from: "2026-11-01", to: "2026-11-14" }) && monthWindow("2026-02", today).to === "2026-02-28", "月の期間: 今月は今日まで、過ぎた月は月末まで");
    const first = vcMonthsToFetch(today, {});
    const all = Object.fromEntries(first.map((m) => [m, {}]));
    ok(first.length === 12 && first[0] === "2026-11" && first.at(-1) === "2025-12" && vcMonthsToFetch(today, all).length === 4 && vcMonthsToFetch(today, all).slice(0, 3).join() === "2026-11,2026-10,2026-09",
      "読み直す月: はじめは過去12か月。そのあとは今月と前の2か月と、古い月を1つ(巡回)");

    ok(refreshVc(root, { local: {}, today }) instanceof Promise, "キーがないときも、待てる形で返す");
    const orders = { "2026-11": [ord("1", "2026-11", "P", 300), ord("2", "2026-11", "A", 200), ord("2", "2026-11", "C", 999, { updDate: "2026-10-01" }), ord("3", "2026-11", "I", 100), ord("4", "2026-11", "C", 50), ord("9", "2026-11", "P", 7777, { affilId: "999" })],
      "2026-10": [ord("5", "2026-10", "A", 1000)] };
    const agg = vcAggregate(orders["2026-11"].filter((o) => o.updDate !== "2026-10-01"), monthWindow("2026-11", today), "3784232");
    ok(agg.orders === 4 && agg.pendingYen === 300 && agg.approvedYen === 200 && agg.rejectedYen === 50 && agg.billedYen === 100 && agg.confirmedYen === 300,
      "注文のまとめ: 保留・承認・否認・請求済に分ける。ほかのサイトの注文は数えない", JSON.stringify(agg));
    let threw = false; try { vcAggregate([ord("x", "2026-11", "P", "")], monthWindow("2026-11", today), "3784232"); } catch { threw = true; }
    ok(threw, "報酬額が読めない注文があれば、0円とみなさずに止める");

    return (async () => {
      const skip = await refreshVc(root, { local: {}, today });
      ok(skip.skipped && !existsSync(join(root, "analytics", "earnings.json")), "キーが未設定なら、読み込まない(ファイルも作らない)");

      const f = fakeVc({ orders });
      const r = await refreshVc(root, { local, sid: "3784232", today, fetchImpl: f, nowIso: "2026-11-14T03:00:00Z" });
      const e = loadEarnings(root);
      ok(r.ok && e.vc.months["2026-11"].rejectedYen === 50 && e.vc.months["2026-11"].pendingYen === 300 && e.vc.months["2026-11"].orders === 4 && e.vc.months["2026-10"].approvedYen === 1000 && Object.keys(e.vc.months).length === 12 && e.vc.fetchedAt === "2026-11-14T03:00:00Z" && e.vc.error === null,
        "バリューコマース: API で月ごとの件数と金額を読み、analytics/earnings.json に書く(ページの続きも読む。同じ注文は、いちばん新しい状態だけ)", r.text);
      ok(f.calls[0].auth === "Bearer " + Buffer.from("KEY|SECRET").toString("base64") && f.calls.slice(1).every((c) => c.auth === "Bearer TOKEN"), "認証: キーとシークレットでトークンを取り、注文はトークンで読む");
      const saved = readFileSync(join(root, "analytics", "earnings.json"), "utf8");
      ok(!/KEY|SECRET|TOKEN|transactionOid/.test(saved) && !/KEY|SECRET|TOKEN|\d{3}/.test(r.text), "キー・トークン・注文の中身は保存しない。画面に出す文に、金額を入れない");

      const bad = await refreshVc(root, { local, sid: "3784232", today, fetchImpl: fakeVc({ status: 401 }), nowIso: "2026-11-14T06:00:00Z" });
      const e2 = loadEarnings(root);
      ok(!bad.ok && /キーが違う/.test(bad.text) && e2.vc.months["2026-11"].pendingYen === 300 && e2.vc.fetchedAt === "2026-11-14T03:00:00Z" && e2.vc.errorAt === "2026-11-14T06:00:00Z",
        "キーが違うときは、前の額を残して、エラーだけを書く");
      const half = await refreshVc(root, { local, sid: "3784232", today, fetchImpl: fakeVc({ orders: { ...orders, "2026-11": [ord("1", "2026-11", "P", 5)] }, badAt: "2026-09" }), nowIso: "2026-11-14T07:00:00Z" });
      ok(!half.ok && loadEarnings(root).vc.months["2026-11"].pendingYen === 300, "途中の月で失敗したら、読めた月も書かない(合計が半端にならないように)");
      const st = earningsStatus(root, { local, today, nowMs: Date.parse("2026-11-14T08:00:00Z") });
      ok(st.vc.ready && /HTTP 500/.test(st.vc.error) && st.vc.errorAt === "2026-11-14T07:00:00Z" && !st.rakuten.problem && st.rakuten.fetchedAt === null && !("months" in st.vc), "画面用の状態: 準備・前回・エラーだけ(金額は actuals から)。楽天は、まだ一度も読んでいなければ「問題」にしない");

      // 楽天
      ok(JSON.stringify(parseRakutenArg("2026-11=1,234/0")) === JSON.stringify(["2026-11", { yen: 1234, confirmedYen: 0 }]) && parseRakutenArg("2026-10=500")[1].confirmedYen === null && parseRakutenArg("11月=5") === null && parseRakutenArg("2026-13=5") === null,
        "楽天のコマンドの書き方: 月=発生/確定(確定は省ける。桁区切りのカンマは読む)");
      ok(recordRakuten(root, { months: { "2026-12": { yen: 1 } }, today }).code === 400 && recordRakuten(root, { months: { "2026-11": { yen: -1 } }, today }).code === 400
        && recordRakuten(root, { months: { "2026-11": { yen: 10, confirmedYen: 20 } }, today }).code === 400 && recordRakuten(root, { months: { "2024-01": { yen: 1 } }, today }).code === 400 && recordRakuten(root, { error: "other" }).code === 400,
        "楽天の記録を確かめる: 先の月・負の額・確定が発生より大きい・12か月より前・知らないエラーは書かない");
      ok(recordRakuten(root, { months: { "2026-11": { yen: 480, confirmedYen: 0 }, "2026-10": { yen: 1200, confirmedYen: 1200 } }, today, nowIso: "2026-11-10T00:00:00Z" }).ok && loadEarnings(root).rakuten.months["2026-10"].confirmedYen === 1200 && loadEarnings(root).vc.months["2026-11"].pendingYen === 300,
        "楽天の報酬を、月ごとに書く(バリューコマースの記録は、そのまま)");
      recordRakuten(root, { error: "login", nowIso: "2026-11-17T00:00:00Z" });
      const st2 = earningsStatus(root, { local, today, nowMs: Date.parse("2026-11-17T01:00:00Z") });
      ok(st2.rakuten.problem && /ログイン/.test(st2.rakuten.error) && loadEarnings(root).rakuten.months["2026-11"].yen === 480, "ログインが切れていたら、前の額を残して「読めていない」を出す");
      recordRakuten(root, { months: { "2026-11": { yen: 600 } }, today, nowIso: "2026-11-18T00:00:00Z" });
      ok(!earningsStatus(root, { local, today, nowMs: Date.parse("2026-11-18T01:00:00Z") }).rakuten.problem && earningsStatus(root, { local, today, nowMs: Date.parse("2026-11-18T00:00:00Z") + (RAKUTEN_STALE_DAYS + 1) * 864e5 }).rakuten.problem,
        `読めたらエラーは消える。${RAKUTEN_STALE_DAYS}日より古いままなら「読めていない」`);

      // 売上への入り方
      const A = deriveActuals({ kpi: { updated: "2026-11-09", months: { "2026-11": { revenueVc: 1 } } } }, { vcMonths: { "2026-08": { orders: 1, pendingYen: 9, approvedYen: 0, billedYen: 0 } } }, loadEarnings(root));
      ok(A.months["2026-11"].revenueVc === 600 && A.months["2026-11"].conversionsVc === 4 && A.months["2026-11"].revenueRakuten === 600 && A.months["2026-10"].revenueVc === 1000 && A.updated === "2026-11-18",
        "実績: API で読んだバリューコマースの額は、週次の分析の値より新しいので上書きする。楽天の額も入る", JSON.stringify(A.months["2026-11"]));
      const rv = revenueOf(A, { "2026-11": { adsense: 0, direct: 5000 } }, "2026-11");
      const rv2 = revenueOf(A, { "2026-11": { rakuten: 700 } }, "2026-11");
      ok(rv.value === 600 + 600 + 0 + 5000 && rv.missing.length === 0 && rv2.parts.find((p) => p.key === "rakuten").value === 700,
        "売上: 楽天は自動の額を足す。手入力があれば、その月は手入力を優先する");

      // コマンド(予定タスクが使う)
      const cli = (args) => { try { return { out: execFileSync(process.execPath, ["scripts/admin/earnings.mjs", ...args], { encoding: "utf8", stdio: "pipe", env: { ...process.env } }), code: 0 }; } catch (err) { return { out: String(err.stderr), code: err.status }; } };
      const u = cli(["rakuten", "11月=5"]);
      ok(u.code === 1 && /書き方/.test(u.out) && cli([]).code === 1, "コマンド: 書き方が違えば、何も書かずに使い方を出す");
    })().finally(() => rmSync(root, { recursive: true, force: true }));
  } catch (err) { rmSync(root, { recursive: true, force: true }); throw err; }
}
