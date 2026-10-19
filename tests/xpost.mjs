// X への自動投稿: 選び方・文面・署名のテスト(外部へは送らない)
import { pickEvents, composeText, weightedLength, oauthHeader } from "../scripts/lib/x-post.mjs";

export function xpostTests({ ok, section }) {
  section("X投稿: 選び方・文面・署名");
  const ev = (id, start, extra = {}) => ({ id, name: id, start, prefecture: "島根県", city: "益田市", kagura: "石見神楽", status: "published", ...extra });
  const events = [ev("a", "2026-11-05T10:00"), ev("b", "2026-11-20T10:00"), ev("c", "2026-11-03T10:00"), ev("d", "2026-11-08T10:00", { status: "pending" }), ev("e", "2026-11-09T10:00"), ev("f", "2026-11-10T10:00"), ev("g", "2026-11-12T10:00")];
  const got = pickEvents(events, [{ id: "e" }], "2026-11-01", 5).map((x) => x.id);
  ok(got.join() === "a,f,g", "開催の3〜14日前だけ・掲載中だけ・投稿済みを除き、近い順に選ぶ", got.join());
  ok(pickEvents(events, [], "2026-11-01").length === 2, "1回の投稿は、最大2件");
  const t = composeText(ev("x", "2026-11-15T13:30", { name: "長".repeat(200) }), "https://kagurameguri.jp");
  ok(weightedLength(t) <= 280 && t.includes("11/15(日) 13:30〜") && t.includes("https://kagurameguri.jp/events/x.html"), "文面は280字(全角2・URL23)に収まり、日時とURLを含む", String(weightedLength(t)));
  const h = oauthHeader({ method: "POST", url: "https://api.x.com/2/tweets", keys: { apiKey: "a", apiSecret: "b", accessToken: "c", accessSecret: "d" }, nonce: "n", timestamp: 1 });
  ok(h.startsWith("OAuth ") && h.includes('oauth_signature="ipLCkEcwtFgz%2BYAT9CrjN4Z8OpI%3D"'), "OAuth署名が、固定の入力で一定");
}
