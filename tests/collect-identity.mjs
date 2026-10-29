// 収集元の表記ゆれ・時刻補完を、掲載消失と取り違えないための回帰検証。
import { reconcile } from "../scripts/lib/collect-core.mjs";

export function collectionIdentityTests({ ok, section }, reconcileImpl = reconcile) {
  section("自動収集: 意味上の同一公演と生存確認の整合");
  const source = { id: "identity-test", name: "公式テスト協会", url: "https://example.com/events", kagura: "安芸高田神楽", prefecture: "広島県" };
  const now = new Date("2026-10-12T00:00:00Z");
  const later = (n) => new Date(now.getTime() + n * 7 * 864e5);
  const candidate = { name: "第10回 高宮神楽まつり", start: "2026-11-23T00:00", timeUnknown: true, prefecture: "広島県", city: "安芸高田市", venue: "広場", url: "https://example.com/events/1" };
  const run = (events, candidates, n = 1, extra = {}) => reconcileImpl({ events, candidates, source, now: later(n), ...extra });
  const seed = run([], [candidate], 0).events[0];
  const enriched = { ...seed, start: "2026-11-23T20:30", timeUnknown: undefined, fee: "一般1,200円", description: "公式確認で手動補完", checked: "2026-10-13" };
  const known = { ...candidate, start: enriched.start, timeUnknown: undefined };
  const original = JSON.stringify(enriched);

  // 実際の不具合: 00:00由来のIDを持つ補完済み公演に、公式が20:30を追加。
  let r = run([enriched], [known], 1);
  r = run(r.events, [known], 2);
  ok(r.events.length === 1 && r.events[0].id === enriched.id, "公式の時刻補完後も既存IDを保持し、重複登録しない");
  ok(r.events[0].status === "published" && r.events[0].misses === 0 && r.summary.withdrawn.length === 0, "2回続けて公式に残る公演を、消失として取り下げない");
  ok(r.events[0].lastSeen === "2026-10-26", "IDが変わった候補でも、同じ収集元の最終取得日を更新する");
  ok(r.events[0].start === enriched.start && r.events[0].fee === enriched.fee && r.events[0].description === enriched.description && r.events[0].checked === enriched.checked, "生存確認は手動補完の時刻・料金・説明・確認日を上書きしない");
  ok(r.summary.notes.length === 0, "掲載時刻と公式の補完時刻が同じなら、不要な確認依頼を出さない");
  ok(JSON.stringify(enriched) === original, "入力の公演オブジェクトを変更しない");

  const renamed = { ...candidate, name: "第１０回高宮神楽まつり" };
  r = run([enriched], [renamed], 1); r = run(r.events, [renamed], 2);
  ok(r.events[0].status === "published" && r.events[0].misses === 0 && r.events[0].lastSeen === "2026-10-26", "名称の空白・全角差によるID変更も生存確認へ反映する");
  ok(r.events[0].start === enriched.start && r.summary.notes.length === 0, "取得元の時刻未確認を、手動補完と矛盾した情報と扱わない");

  r = run([seed], [known], 1);
  ok(r.events[0].timeUnknown === true && r.events[0].start === seed.start && r.events[0].misses === 0, "公式に時刻が加わった場合は掲載を保ち、未確認時刻を勝手に確定しない");
  ok(r.summary.notes.some(n => n.includes("公式候補と掲載時刻") && n.includes("20:30") && n.includes(known.url)), "公式の時刻追加を既存レポートの要確認事項へ出す");
  const conflict = { ...known, start: "2026-11-23T21:00" };
  r = run([enriched], [conflict, conflict], 1);
  ok(r.events[0].start === enriched.start && r.events[0].status === "published" && r.events[0].misses === 0, "既知の開始時刻が食い違っても、自動上書きや誤った取り下げをしない");
  ok(r.summary.notes.filter(n => n.includes("公式候補と掲載時刻")).length === 1, "同一公演の同じ時刻差は1回のレポート内で重複させない");
  const knownSeed = run([], [known], 0).events[0];
  r = run([{ ...knownSeed, start: "2026-11-23T21:00" }], [known], 1);
  ok(r.summary.notes.some(n => n.includes("公式候補と掲載時刻")) && r.events[0].start.endsWith("21:00"), "IDが一致しても手動補完との時刻差を報告し、掲載値を保持する");
  r = run([{ ...knownSeed, end: "2026-11-23T22:00" }], [{ ...known, end: "2026-11-23T22:30" }], 1);
  ok(r.summary.notes.some(n => n.includes("22:30")) && r.events[0].end.endsWith("22:00"), "双方に終了時刻があり食い違う場合も、既存値を保持して報告する");

  const manual = { ...enriched, id: "manual", auto: undefined, sourceId: undefined };
  const foreign = { ...enriched, id: "foreign", sourceId: "other-source" };
  const othersBefore = JSON.stringify([manual, foreign]);
  r = run([manual, foreign, enriched], [known], 1);
  ok(r.events[2].lastSeen === "2026-10-19" && r.events[2].misses === 0, "手動・他の収集元の重複が先に並んでも、自分の収集元の公演を生存確認する");
  ok(JSON.stringify(r.events.slice(0,2)) === othersBefore, "手動登録と他の収集元の最終取得日・掲載内容は変更しない");
  r = run([manual, foreign], [known], 1);
  ok(JSON.stringify(r.events) === othersBefore && r.summary.duplicates === 1, "自分の収集元に一致がないときは、手動・他の収集元を変更しない");

  const ambiguous = [{ ...seed, id: "ambiguous-a", misses: 1 }, { ...seed, id: "ambiguous-b", misses: 1 }];
  r = run(ambiguous, [known], 1); r = run(r.events, [known], 2);
  ok(JSON.stringify(r.events) === JSON.stringify(ambiguous), "1候補が同じ収集元の複数公演に一致したら、取得日を偽って更新せず取り下げも保留する");
  ok(r.summary.notes.some(n => n.includes("複数の既存公演に一致")), "曖昧な同一公演判定を既存レポートに残す");
  r = run([enriched], [{ ...known, url: "javascript:alert(1)" }], 1);
  ok(r.events[0].lastSeen === enriched.lastSeen && r.events[0].misses === enriched.misses && r.events[0].status === "published", "検査不合格の候補は生存確認にせず、確認待ちとして取り下げを保留する");
  ok(r.summary.notes.some(n => n.includes("URLが不正")), "候補を生存確認できない理由を報告する");
  r = run([enriched], [known], 1, { rejectedIds: new Set([knownSeed.id]) });
  ok(r.summary.rejected === 1 && r.events[0].lastSeen === enriched.lastSeen, "却下済み候補からは生存確認しない");
  r = run([{ ...seed, status: "pending", holdReasons: ["人の確認待ち"] }], [known], 1);
  ok(r.events[0].status === "pending" && r.events[0].holdReasons[0] === "人の確認待ち" && r.summary.published.length === 0, "保留公演は一致しても自動承認しない");

  // 生存確認と、真の消失・日程変更・収集元異常を混同しない。
  const b = { ...candidate, name: "神楽B", start: "2026-11-29T19:00", timeUnknown: undefined, url: "https://example.com/events/b" };
  const c = { ...candidate, name: "神楽C", start: "2026-12-05T19:00", timeUnknown: undefined, url: "https://example.com/events/c" };
  const three = run([], [candidate,b,c], 0).events;
  r = run(three, [known,b], 1); r = run(r.events, [known,b], 2);
  ok(r.events.find(e=>e.id===three[0].id).status === "published" && r.events.find(e=>e.name==="神楽B").status === "published", "3件中2件が残る場合、IDの変わった公演も生存件数へ数える");
  ok(r.events.find(e=>e.name==="神楽C").status === "withdrawn" && r.summary.withdrawn.length === 1, "本当に2回消えた別公演は従来どおり取り下げる");
  r = run(three, [known], 1); r = run(r.events, [known], 2);
  ok(r.events.every(e=>e.status==="published" && e.misses===0) && r.summary.notes.some(n=>n.includes("ページの構造")), "半数未満の取得は従来どおりページ異常扱いとし、まとめて取り下げない");
  r = run(three, [], 1);
  ok(r.events.every(e=>e.status==="published" && e.misses===0), "0件取得で取り下げない安全装置を維持する");
  r = run([seed], [{ ...candidate, start:"2026-12-01T00:00" }], 1);
  ok(r.events.find(e=>e.id===seed.id).status === "withdrawn" && r.summary.published.length===1, "日付そのものの変更は従来どおり旧日程を取り下げ、新日程を検査して掲載する");
  r = run([seed], [{ ...known, prefecture:"島根県", city:"益田市" }], 1);
  ok(r.events.find(e=>e.id===seed.id).lastSeen === seed.lastSeen, "県が違う候補を、既存公演が残っている証拠にしない");
}
