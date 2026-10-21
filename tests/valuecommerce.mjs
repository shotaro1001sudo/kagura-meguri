import { verifyValueCommerce } from "../scripts/valuecommerce-report-check.mjs";

export async function valuecommerceTests({ ok, section }) {
  section("ValueCommerce API: 秘密情報をログに出さず読み取り専用で接続を確認");
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    const rowData = url.includes("/auth/") ?
      { bearer_token: "unit-test-token" } :
      [{ transactionOid: 1001, approvalStatus: "P", affilPayment: 500 }];
    return { ok: true, status: 200, json: async () => ({ resultSet: { rowData } }) };
  };
  const success = await verifyValueCommerce({
    clientKey: "test-key", clientSecret: "test-secret",
    fetchImpl, now: new Date("2026-10-21T00:00:00Z"),
  });
  ok(success === true && calls.length === 2, "認証1回・注文API1回のみで終了し、注文内容を返さない");
  ok(calls[0].url.startsWith("https://api.valuecommerce.com/auth/v1/affiliate/token/") &&
     calls[0].options.headers.Authorization === "Bearer " + Buffer.from("test-key|test-secret").toString("base64"),
     "認証署名を環境変数由来の値から生成する");
  const r = new URL(calls[1].url);
  ok(r.pathname === "/report/v3/affiliate/transaction/" &&
     r.searchParams.get("limit") === "1" &&
     r.searchParams.get("approval_status") === "p,a,c,i" &&
     r.searchParams.get("from_date") === "2026-10-21" &&
     r.searchParams.get("to_date") === "2026-10-21",
     "JST基準の当日・最大1件・全注文ステータスで照会");
  ok(calls[1].options.headers.Authorization === "Bearer unit-test-token" &&
     calls.every(x => x.options.redirect === "error"), "短命トークンを使用しリダイレクトを拒否");
  let missing = false;
  try { await verifyValueCommerce({ clientKey: "", clientSecret: "" }); }
  catch (e) { missing = e.message === "GitHub Secretsが未設定です"; }
  ok(missing, "認証キーがない場合はAPIを呼ばず停止");
  let denied = false;
  try {
    await verifyValueCommerce({
      clientKey: "x", clientSecret: "y",
      fetchImpl: async () => ({ ok: false, status: 401 }),
    });
  } catch (e) { denied = e.message === "API応答エラー HTTP 401"; }
  ok(denied, "認証エラー時にレスポンス本文・署名をログに出さない");
}
