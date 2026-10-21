// ValueCommerce affiliate read-only connectivity check.
// No credentials, order data, or amounts are written to disk or logged.
import { pathToFileURL } from "node:url";

const TOKEN_URL = "https://api.valuecommerce.com/auth/v1/affiliate/token/?grant_type=client_credentials";
const REPORT_URL = "https://api.valuecommerce.com/report/v3/affiliate/transaction/";

async function getJSON(fetchImpl, url, auth) {
  let response;
  try {
    response = await fetchImpl(url, {
      method: "GET",
      redirect: "error",
      headers: { Authorization: "Bearer " + auth, Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error("接続失敗・タイムアウト（詳細・認証情報は非表示）");
  }
  if (!response.ok) throw new Error("API応答エラー HTTP " + response.status);
  try {
    const body = await response.json();
    if (!body || typeof body !== "object" || body.error || !body.resultSet) {
      throw new Error("invalid");
    }
    return body.resultSet;
  } catch {
    throw new Error("APIレスポンス形式の検証失敗（内容は非表示）");
  }
}

export async function verifyValueCommerce({
  clientKey,
  clientSecret,
  fetchImpl = globalThis.fetch,
  now = new Date(),
} = {}) {
  if (!clientKey || !clientSecret) throw new Error("GitHub Secretsが未設定です");
  // Both secrets must remain in memory; never print or write them.
  const signature = Buffer.from(clientKey + "|" + clientSecret, "utf8").toString("base64");
  const authSet = await getJSON(fetchImpl, TOKEN_URL, signature);
  const token = authSet.rowData?.bearer_token;
  if (typeof token !== "string" || token.length === 0) {
    throw new Error("トークン応答の形式不一致（内容は非表示）");
  }

  // JST date, no previous-day/future data and no unlimited pagination.
  const dateJST = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const reportUrl = new URL(REPORT_URL);
  reportUrl.searchParams.set("criteria", "o");
  reportUrl.searchParams.set("from_date", dateJST);
  reportUrl.searchParams.set("to_date", dateJST);
  reportUrl.searchParams.set("approval_status", "p,a,c,i");
  reportUrl.searchParams.set("limit", "1"); // one record maximum; discarded immediately
  reportUrl.searchParams.set("via_ad", "true");
  reportUrl.searchParams.set("via_vpc", "false");
  const reportSet = await getJSON(fetchImpl, reportUrl.toString(), token);
  if (!Array.isArray(reportSet.rowData) && reportSet.rowData !== undefined) {
    throw new Error("注文応答の形式不一致（内容は非表示）");
  }
  // Intentionally return only boolean connectivity. Never return records or amounts.
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyValueCommerce({
    clientKey: process.env.VALUECOMMERCE_CLIENT_KEY,
    clientSecret: process.env.VALUECOMMERCE_CLIENT_SECRET,
  }).then(() => {
    console.log("ValueCommerce認証と注文APIの接続確認が完了しました。注文情報・金額は非表示です。");
  }).catch((error) => {
    // Deliberately log only our fixed, non-sensitive error messages.
    const allowed = [
      "GitHub Secretsが未設定です",
      "接続失敗・タイムアウト（詳細・認証情報は非表示）",
      "APIレスポンス形式の検証失敗（内容は非表示）",
      "トークン応答の形式不一致（内容は非表示）",
      "注文応答の形式不一致（内容は非表示）",
    ];
    const message = allowed.includes(error.message) || /^API応答エラー HTTP [0-9]{3}$/.test(error.message)
      ? error.message : "接続確認に失敗しました（詳細は非表示）";
    console.error(message);
    process.exitCode = 1;
  });
}
