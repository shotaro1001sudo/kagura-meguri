// テストをまとめて動かす。
//   npm test              … 全部(GitHub の自動チェック・毎日の公開・コミットの前)
//   npm run test:quick    … 速いテスト(サイトを直している最中)。時間のかかる統合テスト(収集・git・メール・設定の切り替え)を飛ばす
//
// 開催データのテスト(管理者用ページが公開の前にも動かすもの)と、サイト本体のテスト(tests/run.mjs)を、同時に動かす。
// サイト本体のテストは、テスト用のサイト(dist-test)を先に1回だけ組み立ててから、いくつかのグループに分けて同時に動かす
// (分け方は tests/run.mjs の SECONDS と groupOf)。グループの数は TEST_GROUPS で変えられる(既定は CPU の数に合わせて 2〜5)。
// 結果は、終わったものから順ではなく、決まった順(開催データ → サイト本体)にまとめて出す。どれか1つでも落ちたら失敗。
import { spawn } from "node:child_process";
import { cpus } from "node:os";
import { DATA_TESTS } from "../scripts/admin/publish.mjs";

const quick = process.argv.includes("--quick");
const env = { ...process.env, ...(quick ? { TEST_QUICK: "1" } : {}) };
const groups = Number(process.env.TEST_GROUPS) || Math.max(2, Math.min(5, cpus().length - 3));
const started = Date.now();

const runOne = (file, label = file, extra = {}) => new Promise((resolve) => {
  const t = Date.now();
  const p = spawn(process.execPath, [file], { env: { ...env, ...extra }, stdio: ["ignore", "pipe", "pipe"] });
  let out = "";
  p.stdout.on("data", (d) => { out += d; });
  p.stderr.on("data", (d) => { out += d; });
  p.on("close", (code) => resolve({ file: label, code, out, sec: ((Date.now() - t) / 1000).toFixed(1) }));
});

const site = (async () => {
  const prep = await runOne("tests/run.mjs", "tests/run.mjs(テスト用サイトの組み立て)", { TEST_PREPARE: "1" });
  if (prep.code !== 0) return [prep];
  return [prep, ...await Promise.all(Array.from({ length: groups }, (_, i) =>
    runOne("tests/run.mjs", `tests/run.mjs グループ${i + 1}/${groups}`, { TEST_OUT_READY: "1", TEST_GROUP: String(i + 1), TEST_GROUPS: String(groups) })))];
})();
const results = [...await Promise.all(DATA_TESTS.map((f) => runOne(f))), ...await site];

let pass = 0;
for (const r of results) {
  console.log(`\n===== ${r.file}(${r.sec} 秒)${r.code === 0 ? "" : " ✗ 失敗"} =====`);
  process.stdout.write(r.out.endsWith("\n") ? r.out : r.out + "\n");
  pass += Number(r.out.match(/結果: (\d+) 件成功/)?.[1] ?? 0);
}
const failed = results.filter((r) => r.code !== 0);
console.log(`\n${quick ? "速いテスト(統合テストは省略)" : "全部のテスト"}: ${((Date.now() - started) / 1000).toFixed(1)} 秒(サイト本体 ${pass} 件、${groups} グループで同時に実行)`);
if (failed.length) {
  console.log(`失敗したファイル: ${failed.map((r) => r.file).join(", ")}`);
  process.exit(1);
}
console.log("すべて成功しました");
