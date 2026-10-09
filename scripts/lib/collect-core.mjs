// 自動収集の「判断」の部分(通信・ファイルの読み書きは、collect.mjs が行う)。
// ここは、入力から出力が決まる純粋な関数だけにして、細かくテストできるようにしている。
//
// 方針:
//  - 自動で掲載してよいのは、規約確認済みの収集元から取得し、1件ずつの自動検査に通ったものだけ
//  - 検査に通らない・件数が異常なものは、掲載せず「保留(pending)」にして、報告する
//  - 取得元から消えた・日程が変わったものは、自動で取り下げる(古い誤情報を残さない)
//  - 運営者が登録した情報(auto でないもの)は、決して書き換えない
import { PREFECTURES, clean, hash } from "./util.mjs";

export const DEFAULTS = {
  autoPublish: true,        // 検査に通ったものを、自動で掲載する(false なら、すべて保留)
  maxNewPerSource: 15,      // 1回の収集で、1つの収集元から増える上限。超えたら、ページの異常を疑い、全部を保留にする
  horizonDays: 400,         // これより先の日付は、読み取りの誤りとみなす
  withdrawAfterMisses: 2,   // 取得元から、この回数、続けて消えたら、取り下げる
  minHealthyRatio: 0.5,     // 取得件数が、前回までの(将来の)件数の、この割合を下回ったら、ページの異常とみなし、取り下げをしない
};

const DT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const HTTP_URL = /^https?:\/\/[^\s"'<>]+$/;
// ナビゲーションの文字などを、開催名として、誤って拾ったとき
const JUNK_NAME = /^(もっと見る|一覧|お知らせ|詳細|詳しくはこちら|more|MORE|PDF|ダウンロード|\d+)$/;

const dayMs = (d) => Date.parse(`${d}T00:00:00Z`);
export const today = (now) => new Date(now.getTime() + 9 * 3600e3).toISOString().slice(0, 10); // 日本時間の日付

// 名称のゆれ(空白・全角半角・記号・「第54回」の空白など)をそろえる
export const normName = (s) => String(s ?? "").normalize("NFKC").toLowerCase().replace(/[\s　・、。,.()\[\]{}「」『』〈〉《》<>~〜～\-‐ー_／/:：!！?？"'“”]/g, "");
/** 同じ開催か: 同じ都道府県・同じ日・名称が(ゆれを除いて)同じ、または、一方がもう一方を含む(4字以上) */
export function sameEvent(a, b) {
  if (a.prefecture !== b.prefecture || String(a.start).slice(0, 10) !== String(b.start).slice(0, 10)) return false;
  const x = normName(a.name), y = normName(b.name);
  return x === y || (Math.min(x.length, y.length) >= 4 && (x.includes(y) || y.includes(x)));
}

/** 1件の候補の検査。理由の配列を返す(空なら、合格) */
export function guardEvent(ev, { now, horizonDays = DEFAULTS.horizonDays, nameHint = null }) {
  const r = [];
  const name = ev.name ?? "";
  // 収集元の一覧に、神楽ではない催しも混ざる場合に備え、名称に神楽らしい語がないものは、保留にして、人が確認する
  if (nameHint && !nameHint.test(name)) r.push("名称に、神楽に関する語が見当たらない(神楽以外の催しの疑い)");
  if (name.length < 2 || name.length > 100) r.push(`名称の長さが不自然(${name.length}字)`);
  if (/[<>\u0000-\u001f]/.test(name) || JUNK_NAME.test(name)) r.push("名称が、開催名として不自然");
  if (!ev.kagura) r.push("神楽の種類が不明");
  if (!PREFECTURES.includes(ev.prefecture)) r.push(`都道府県が不明(${ev.prefecture || "空"})`);
  if (!ev.city && !ev.venue && !ev.address) r.push("場所(市区町村・会場)が不明");
  if ((ev.city ?? "").length > 40 || (ev.venue ?? "").length > 100) r.push("場所の文字が長すぎる(読み取りの誤りの疑い)");
  if (!DT.test(ev.start ?? "") || Number.isNaN(Date.parse(`${ev.start}:00Z`))) r.push(`開始日時の形式が不正(${ev.start})`);
  else {
    const d = ev.start.slice(0, 10), t = today(now);
    if (d < t) r.push("すでに終わった日付");
    if (dayMs(d) - dayMs(t) > horizonDays * 864e5) r.push(`${horizonDays}日より先の日付(読み取りの誤りの疑い)`);
    if (ev.end) {
      if (!DT.test(ev.end) || ev.end < ev.start) r.push("終了日時が不正");
      else if (Date.parse(`${ev.end}:00Z`) - Date.parse(`${ev.start}:00Z`) > 3 * 864e5) r.push("開催期間が3日を超える(複数日をまとめた記載の疑い)");
    }
  }
  if (!HTTP_URL.test(ev.url ?? "")) r.push("公式情報のURLが不正");
  return r;
}

const key = (e) => `${e.name}|${e.start}|${e.prefecture}`;
const nameHint = (s) => { try { return s.nameHint ? new RegExp(s.nameHint) : null; } catch { return null; } };

/** 候補(取得したもの)から、掲載・保留・取り下げを決める。events は、変更しない(新しい配列を返す) */
export function reconcile({ events, candidates, source, now, rejectedIds = new Set(), cfg = {} }) {
  const c = { ...DEFAULTS, ...cfg };
  const day = today(now), stamp = day;
  const out = events.map((e) => ({ ...e }));
  const sum = { fetched: candidates.length, published: [], held: [], withdrawn: [], unchanged: 0, duplicates: 0, rejected: 0, past: 0, notes: [] };
  const mine = () => out.filter((e) => e.auto && e.sourceId === source.id);

  // --- 候補を、掲載するもの・保留にするもの、に分ける ---
  const cands = [];
  const candIds = new Set();
  for (const it of candidates) {
    const ev = {
      id: `${source.id}-${hash(clean(it.name), it.start)}`,
      name: clean(it.name), kagura: source.kagura || "", prefecture: it.prefecture || source.prefecture || "", city: it.city || "", venue: it.venue || "",
      ...(it.address ? { address: it.address } : {}), start: it.start, ...(it.end ? { end: it.end } : {}), ...(it.timeUnknown ? { timeUnknown: true } : {}),
      fee: "", url: it.url || source.url, description: "",
    };
    candIds.add(ev.id);
    cands.push(ev);
  }
  const fresh = [];
  for (const ev of cands) {
    if (rejectedIds.has(ev.id)) { sum.rejected++; continue; }
    const existing = out.find((e) => e.id === ev.id);
    if (existing) {
      if (existing.auto) {
        existing.lastSeen = stamp; existing.misses = 0;
        // 一度、取り下げたものが、取得元に戻ってきたら、検査し直して、再掲載する
        if (existing.status === "withdrawn") {
          const why = guardEvent({ ...existing }, { now, horizonDays: c.horizonDays, nameHint: nameHint(source) });
          if (!why.length && c.autoPublish) { existing.status = "published"; delete existing.withdrawnReason; sum.published.push({ ...existing, note: "再掲載" }); }
          else sum.unchanged++;
        } else sum.unchanged++;
      } else sum.duplicates++;
      continue;
    }
    // 同じ開催(名称のゆれ・時刻の有無を除いて)が、すでにあれば、重複。運営者の登録を、優先する
    if (out.some((e) => e.status !== "withdrawn" && (key(e) === key(ev) || sameEvent(e, ev))) || fresh.some((f) => sameEvent(f.ev, ev))) { sum.duplicates++; continue; }
    const why = guardEvent({ ...ev, kagura: ev.kagura }, { now, horizonDays: c.horizonDays, nameHint: nameHint(source) });
    if (why.length === 1 && why[0] === "すでに終わった日付") { sum.past++; continue; }
    fresh.push({ ev, why });
  }

  // --- 件数の異常(ページの構造が変わって、大量に拾った可能性) ---
  const anomaly = fresh.length > c.maxNewPerSource;
  if (anomaly) sum.notes.push(`新規が ${fresh.length} 件(上限 ${c.maxNewPerSource} 件)。ページの異常を疑い、すべて保留にしました`);

  for (const { ev, why } of fresh) {
    // 日程が変わったもの: 同じ収集元・同じ名称で、日付だけ違う、まだ取得元に残っていないもの
    const moved = mine().find((e) => e.name === ev.name && e.start !== ev.start && !candIds.has(e.id) && e.status !== "withdrawn");
    const reasons = [...why, ...(anomaly ? ["一度の新規が多すぎる"] : []), ...(!c.autoPublish ? ["自動掲載が、オフになっている"] : [])];
    const rec = { ...ev, auto: true, sourceId: source.id, source: source.name, sourceUrl: source.url, firstSeen: stamp, lastSeen: stamp, misses: 0, status: reasons.length ? "pending" : "published", ...(reasons.length ? { holdReasons: reasons } : {}) };
    out.push(rec);
    (reasons.length ? sum.held : sum.published).push({ ...rec, ...(moved ? { note: `日程の変更(旧 ${moved.start.slice(0, 10)})` } : {}) });
    if (moved) { moved.status = "withdrawn"; moved.withdrawnReason = `日程が変わったため(新しい日程: ${ev.start.slice(0, 10)})`; sum.withdrawn.push({ ...moved }); }
  }

  // --- 取得元から消えたもの(将来の開催だけ。続けて消えたら、取り下げる) ---
  const futureKnown = mine().filter((e) => e.status !== "withdrawn" && e.start.slice(0, 10) >= day && !sum.withdrawn.some((w) => w.id === e.id));
  const missing = futureKnown.filter((e) => !candIds.has(e.id));
  const stillSeen = futureKnown.length - missing.length;
  // 1件も取得できなかった(ページの崩れ・取得の失敗)ときは、「全部が消えた」と信じない
  const healthy = candidates.length > 0 && (futureKnown.length <= 2 || stillSeen >= futureKnown.length * c.minHealthyRatio);
  if (missing.length && !healthy) sum.notes.push(`取得元から ${missing.length}/${futureKnown.length} 件が消えました。ページの構造が変わった可能性があるため、取り下げはしていません`);
  else for (const e of missing) {
    e.misses = (e.misses ?? 0) + 1;
    if (e.misses >= c.withdrawAfterMisses) { e.status = "withdrawn"; e.withdrawnReason = `取得元のページから、${e.misses}回続けて消えたため`; sum.withdrawn.push({ ...e }); }
    else sum.notes.push(`「${e.name}」(${e.start.slice(0, 10)})が、取得元から消えました(${e.misses}/${c.withdrawAfterMisses}回目。次も消えたら、取り下げます)`);
  }
  return { events: out, summary: sum };
}
