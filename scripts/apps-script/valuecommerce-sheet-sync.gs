/**
 * 神楽めぐり｜バリューコマース成果→非公開Google Sheetsの無料枠内同期
 *
 * 設置先: 既存の統合Googleスプレッドシート > 拡張機能 > Apps Script
 * ※このソースにAPIキーを貼り付けないこと。
 * Project Settings > Script properties に VC_CLIENT_KEY, VC_CLIENT_SECRET を本人が登録。
 * 実際のAPI接続はユーザーが dailyValueCommerceSync() を初回手動実行した時だけ。
 * 日次自動化はその成功後、ユーザーが createDailyTrigger() を手動実行して有効化。
 *
 * Apps Script 自体は標準のCloudプロジェクト新規作成や請求先登録を必要としない。
 * 既存のGitHub Actionsサービスアカウント方式とは別経路。公開GitHubへ注文データを保存しない。
 */
const VC_SYNC = Object.freeze({
  TOKEN_URL: "https://api.valuecommerce.com/auth/v1/affiliate/token/?grant_type=client_credentials",
  REPORT_URL: "https://api.valuecommerce.com/report/v3/affiliate/transaction/",
  SITE_ID: "3784232", // 神楽めぐりのバリューコマースサイトID
  TAB: "11_VC月次成果",
  SOURCE: "https://pub-docs.valuecommerce.ne.jp/docs/as-78-order-report-api/",
  MONTHS: 25,
  LIMIT: 1000,
  MAX_PAGES: 8,
});

/** 実行日時の日本時間 YYYY-MM-DD を返す。 */
function vcJstDate_(date) {
  return Utilities.formatDate(date, "Asia/Tokyo", "yyyy-MM-dd");
}

/** 当月が offset=0、前月が1。UTC構築で日本時間への意図しないずれを避ける。 */
function vcMonthWindow_(today, offset) {
  const a = today.split("-").map(Number);
  const first = new Date(Date.UTC(a[0], a[1] - 1 - offset, 1));
  const year = first.getUTCFullYear(), month = first.getUTCMonth() + 1;
  const from = Utilities.formatDate(first, "UTC", "yyyy-MM-dd");
  const end = new Date(Date.UTC(year, month, 0));
  const monthEnd = Utilities.formatDate(end, "UTC", "yyyy-MM-dd");
  return { month: from.slice(0, 7), from: from, to: monthEnd < today ? monthEnd : today };
}

function vcFetchJSON_(url, options) {
  // muteHttpExceptions: APIから機密を含むレスポンス本文をログに出さない。
  const opt = Object.assign({method: "get",muteHttpExceptions: true,followRedirects: false}, options);
  let response;
  try {
    response = UrlFetchApp.fetch(url, opt);
  } catch (_) { throw new Error("APIへの通信に失敗しました（詳細は非表示）"); }
  const status = response.getResponseCode();
  if (status !== 200) throw new Error("APIがHTTP " + status + "を返しました");
  let data;
  try { data = JSON.parse(response.getContentText("UTF-8")); }
  catch (_) { throw new Error("API JSONを読み取れません"); }
  if (!data || data.error || !data.resultSet) throw new Error("APIの応答形式が不正です");
  return data.resultSet;
}

function vcGetToken_(key, secret) {
  if (!key || !secret) throw new Error("VC_CLIENT_KEY / VC_CLIENT_SECRET が未設定です");
  const signature = Utilities.base64Encode(key + "|" + secret);
  const result = vcFetchJSON_(VC_SYNC.TOKEN_URL, {
    headers: {Authorization: "Bearer " + signature, Accept: "application/json"}
  });
  const token = result.rowData && result.rowData.bearer_token;
  if (typeof token !== "string" || !token) throw new Error("トークンの取得に失敗しました");
  return token;
}

function vcReadOrders_(token, period) {
  const map = new Map(); // 注文IDで重複排除。同一IDは更新日時が最新の状態を採用。
  let offset = 0;
  for (let page = 0; page < VC_SYNC.MAX_PAGES; page++) {
    const query = {
      criteria: "o", from_date: period.from, to_date: period.to,
      approval_status: "p,a,c,i", limit: VC_SYNC.LIMIT, offset: offset,
      via_ad: "true", via_vpc: "false",
      field: "transactionOid,affilId,orderDate,approvalStatus,affilPayment,updDate"
    };
    const qs = Object.keys(query).map(k=>encodeURIComponent(k)+"="+encodeURIComponent(query[k])).join("&");
    const result = vcFetchJSON_(VC_SYNC.REPORT_URL + "?" + qs, {
      headers: {Authorization: "Bearer " + token, Accept: "application/json"}
    });
    if (!Array.isArray(result.rowData)) throw new Error("注文レポート形式エラー");
    for (const r of result.rowData) {
      if (r.transactionOid == null || r.affilId == null) throw new Error("注文識別子が取得できません");
      const identity = String(r.affilId) + "|" + String(r.transactionOid);
      const old = map.get(identity);
      if (!old || String(r.updDate || "") >= String(old.updDate || "")) map.set(identity, r);
    }
    const next = result.responseInfo && result.responseInfo.nextOffset;
    if (Number(next) === -1 && next !== null && next !== undefined) return [...map.values()];
    if (!Number.isSafeInteger(Number(next)) || Number(next) <= offset)
      throw new Error("注文レポートのページ移動が不正です");
    offset = Number(next);
  }
  // APIの取りこぼしや上限超過時に不完全な合計を保存しない。
  throw new Error("指定した月のページ数上限を超えました。同期は保存されません");
}

function vcAggregate_(orders, period, checked) {
  const status = {P:{n:0,v:0},A:{n:0,v:0},C:{n:0,v:0},I:{n:0,v:0}};
  for (const order of orders) {
    if (String(order.affilId) !== VC_SYNC.SITE_ID) continue;
    if (typeof order.orderDate !== "string" || order.orderDate.slice(0,7) !== period.month)
      throw new Error("注文月が一致しません");
    const s = status[String(order.approvalStatus).toUpperCase()];
    if (!s) throw new Error("未知の注文ステータスです");
    const amount = order.affilPayment;
    if (!["number","string"].includes(typeof amount) || amount === "" || !Number.isFinite(Number(amount)))
      throw new Error("報酬額が不明です。0円には置き換えません");
    s.n++; s.v += Number(amount);
  }
  const count = status.P.n+status.A.n+status.C.n+status.I.n;
  return [period.month,status.P.n,status.P.v,status.A.n,status.A.v,status.C.n,status.C.v,
    status.I.n,status.I.v,count,status.A.v+status.I.v,checked,
    "API取得済み・入金未照合",VC_SYNC.SOURCE];
}

/** 実際のAPIへアクセスし非公開統合管理台帳の専用タブだけ更新する。 */
function dailyValueCommerceSync() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) throw new Error("別の同期処理が実行中です");
  try {
    const props = PropertiesService.getScriptProperties();
    const key = props.getProperty("VC_CLIENT_KEY"), secret = props.getProperty("VC_CLIENT_SECRET");
    if (!key || !secret) throw new Error("Script propertiesの認証情報が未登録です");
    const book = SpreadsheetApp.getActiveSpreadsheet();
    if (!book) throw new Error("統合Google Sheetsから起動してください");
    const sheet = book.getSheetByName(VC_SYNC.TAB);
    if (!sheet) throw new Error("11_VC月次成果タブが存在しません");
    const today = vcJstDate_(new Date());
    const currentDay = Number(today.slice(-2));
    // 毎回当月+過去2か月を更新、毎日過去3～24か月から1か月を巡回して過去の確定変化も補足。
    const offsets = [0,1,2,3 + ((currentDay-1) % 22)];
    const checked = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd HH:mm:ss");
    const token = vcGetToken_(key, secret);
    const updates = new Map();
    for (const off of offsets) {
      const period = vcMonthWindow_(today, off);
      updates.set(period.month, vcAggregate_(vcReadOrders_(token,period),period,checked));
    }
    // 取得が全件成功してから一括で書く。既存の確認済み月次集計を保持して新規月を追加。
    const prev = sheet.getRange(2, 1, VC_SYNC.MONTHS, 14).getValues();
    const keyed = new Map();
    for (const row of prev) {
      if (/^\d{4}-\d{2}$/.test(String(row[0]))) keyed.set(String(row[0]),row);
    }
    for (const [month,row] of updates) keyed.set(month,row);
    const matrix = [];
    for (let i=0;i<VC_SYNC.MONTHS;i++) {
      const window=vcMonthWindow_(today,i);
      matrix.push(keyed.get(window.month) || Array(14).fill(""));
    }
    sheet.getRange(2, 1, VC_SYNC.MONTHS, 14).setValues(matrix);
    // 成果額や注文件数、認証トークンをログへ出さない。
    console.log("ValueCommerce月次成果：同期完了。照合月数 " + offsets.length);
  } catch (_) {
    // 例外オブジェクトの文字列化は禁止。API・認証情報の漏えいを回避。
    console.error("ValueCommerce月次成果：同期失敗。認証・API応答・無料枠・Sheets権限を確認してください");
    throw new Error("ValueCommerce同期に失敗しました。設定・API・Sheetsを確認してください");
  } finally {
    lock.releaseLock();
  }
}

/** 初回手動同期に成功した後、ユーザーが1度だけ実行する。 */
function createDailyTrigger() {
  const existing = ScriptApp.getProjectTriggers()
    .filter(t=>t.getHandlerFunction()==="dailyValueCommerceSync");
  if (existing.length > 0) return; // 二重登録によるAPI過剰取得を避ける
  ScriptApp.newTrigger("dailyValueCommerceSync")
    .timeBased().atHour(6).everyDays(1).inTimezone("Asia/Tokyo").create();
}

/** 停止する場合はこの関数を手動実行する。 */
function stopDailyTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t=>t.getHandlerFunction()==="dailyValueCommerceSync")
    .forEach(t=>ScriptApp.deleteTrigger(t));
}
