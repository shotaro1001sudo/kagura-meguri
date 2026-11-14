// テストをまとめて動かす。
//   npm test              … 全部(GitHub の自動チェック・毎日の公開・コミットの前)
//   npm run test:quick    … 速いテスト(サイトを直している最中)。時間のかかる統合テスト(収集・git・メール・設定の切り替え)を飛ばす
//
// 開催データのテスト(管理者用ページが公開の前にも動かすもの)と、サイト本体のテスト(tests/run.mjs)を、同時に動かす。
// 結果は、終わったものから順ではなく、決まった順(開催データ → サイト本体)にまとめて出す。どれか1つでも落ちたら失敗。
import { spawn } from "node:child_process";
import { DATA_TESTS } from "../scripts/admin/publish.mjs";

const quick = process.argv.includes("--quick");
const env = { ...process.env, ...(quick ? { TEST_QUICK: "1" } : {}) };
const started = Date.now();

const runOne = (file) => new Promise((resolve) => {
  const t = Date.now();
  const p = spawn(process.execPath, [file], { env, stdio: ["ignore", "pipe", "pipe"] });
  let out = "";
  p.stdout.on("data", (d) => { out += d; });
  p.stderr.on("data", (d) => { out += d; });
  p.on("close", (code) => resolve({ file, code, out, sec: ((Date.now() - t) / 1000).toFixed(1) }));
});

const results = await Promise.all([...DATA_TESTS, "tests/run.mjs"].map(runOne));
for (const r of results) {
  console.log(`\n===== ${r.file}(${r.sec} 秒)${r.code === 0 ? "" : " ✗ 失敗"} =====`);
  process.stdout.write(r.out.endsWith("\n") ? r.out : r.out + "\n");
}
const failed = results.filter((r) => r.code !== 0);
console.log(`\n${quick ? "速いテスト(統合テストは省略)" : "全部のテスト"}: ${((Date.now() - started) / 1000).toFixed(1)} 秒`);
if (failed.length) {
  console.log(`失敗したファイル: ${failed.map((r) => r.file).join(", ")}`);
  process.exit(1);
}
console.log("すべて成功しました");
