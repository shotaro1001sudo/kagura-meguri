// 神楽の好み診断(PLAN-004 改訂 2026-11-09)。編集上の提案で、性格・適性の判定ではない。
// 回答はブラウザのメモリ内だけで計算し、保存・送信しない。推薦の根拠は data/kagura-info.json の出典つき本文。
export const QUIZ_CHECKED = '2026-11-09';
const choice = (id, label, weights = {}) => ({ id, label, weights });
const unknown = choice('unknown', 'まだ分からない');
const preference = (id, text, choices, extra = {}) => ({ id, text, type: 'preference', choices: [...choices, unknown], ...extra });

// 好みの軸。label は結果の「好みの傾向」、type は回答の傾向の呼び名(人の性格ではなく、観かたの好み)
export const features = {
  dynamic:   { label: '速く勇ましい舞', type: '迫力派', note: '速い囃子にのった、勇ましい舞を味わいたい' },
  classic:   { label: '古式ゆかしい舞', type: '古式派', note: '古い形を伝える舞を、落ち着いて味わいたい' },
  drama:     { label: '神話の物語', type: '物語派', note: '神話の筋を、芝居のように追いかけたい' },
  spectacle: { label: '面や衣装の華やかさ', type: '華やかさ派', note: '面や衣装の色や形を、じっくり見たい' },
  monster:   { label: '大蛇や鬼の登場', type: '大立ち回り派', note: '大蛇や鬼が出てくる、見せ場のある舞台が見たい' },
  rite:      { label: '祭りや神事の空気', type: '祭り派', note: '神社や集落の祭りの中で、神楽に出会いたい' },
  allnight:  { label: '夜を通して舞う神楽', type: '夜神楽派', note: '夜を通して舞う神楽に、腰をすえて付き合いたい' },
  yudate:    { label: '湯立て', type: '湯立て派', note: '釜の湯を使う、湯立ての神事を見てみたい' },
  laugh:     { label: '笑いや曲芸', type: '笑い・曲芸派', note: '掛け合いや曲芸で、客席がわく場面を楽しみたい' },
  together:  { label: '観客も加わる場面', type: '参加派', note: '餅まきや湯しぶきなど、客席も加わる場面を楽しみたい' },
  music:     { label: '囃子や歌の響き', type: '囃子派', note: '太鼓や笛、神楽歌の響きに耳をすませたい' },
  easy:      { label: '気軽に観られる公演', type: '気軽派', note: 'まずは短い時間で、気軽に観てみたい' },
};

export const questions = [
  preference('scene', '神楽の舞台で、いちばん見てみたい場面は？', [
    choice('monster', '大蛇や鬼が、舞台いっぱいに暴れる場面', { monster: 1 }),
    choice('drama', '神話の物語が、芝居のように進む場面', { drama: 1 }),
    choice('yudate', '釜の湯がたぎる、湯立ての場面', { yudate: 1 }),
    choice('laugh', '掛け合いや曲芸で、客席がわく場面', { laugh: 1 }),
  ]),
  preference('tempo', '舞のテンポは、どちらが好み？', [
    choice('fast', '太鼓が速く、激しく勇ましい舞', { dynamic: 1 }),
    choice('slow', 'ゆったりとした、古式ゆかしい舞', { classic: 1 }),
    choice('both', 'どちらも見てみたい', { dynamic: 0.5, classic: 0.5 }),
  ]),
  preference('focus', '目が離せなくなりそうなのは？', [
    choice('visual', '豪華な衣装や、表情ゆたかな面', { spectacle: 1 }),
    choice('music', '太鼓や笛、神楽歌の響き', { music: 1 }),
    choice('place', '神社や集落の、祭りの空気', { rite: 1 }),
  ]),
  preference('time', '観る時間は、どのくらいがいい？', [
    choice('short', 'まずは1時間ほどで、気軽に観たい', { easy: 1 }),
    choice('night', '夜通しの祭りにも、いつか行ってみたい', { allnight: 1 }),
  ]),
  preference('audience', '客席では、どう楽しみたい？', [
    choice('join', '餅まきや湯しぶきなど、参加して楽しみたい', { together: 1 }),
    choice('cheer', '笑ったり驚いたり、にぎやかに楽しみたい', { laugh: 0.5, dynamic: 0.5 }),
    choice('quiet', '静かに、舞台にじっくり見入りたい', { classic: 0.5, drama: 0.5 }),
  ]),
  preference('after', '観終わったあと、心に残っていてほしいのは？', [
    choice('thrill', '胸が熱くなるような迫力', { dynamic: 0.5, monster: 0.5 }),
    choice('story', '誰かに話したくなる物語', { drama: 1 }),
    choice('beauty', '目に焼きつく、色や姿の美しさ', { spectacle: 1 }),
    choice('culture', 'その土地の祭りに触れた実感', { rite: 1 }),
  ]),
  // 結果の補足だけに使い、推薦の順位は変えない
  preference('help', '初めて観るとき、あるとうれしい案内は？', [
    choice('highlights', '見どころの案内'),
    choice('synopsis', 'あらすじ'),
    choice('history', '地域の歴史'),
    choice('watch', 'まずはそのまま観たい'),
  ], { explanationOnly: true }),
  { id: 'region', type: 'region', text: '観に行けそうな地域は？(任意)', choices: [choice('unknown', 'まだ決めていない'), choice('all', '全国から探す')] },
  { id: 'date', type: 'date', text: 'いつ観に行きたい？(任意)', choices: [choice('unknown', 'まだ決めていない'), choice('weekend', '今週末'), choice('month', '今月'), choice('next', '来月'), choice('specified', '日付を指定する')] },
];

// 種類ごとの「特徴」と、その根拠(kagura-info.json のフィールド)。根拠のない特徴は加えない。
// 重みは機械的に決める: 根拠が tagline / intro(紹介の中心)なら 2、features / programs / viewing / history なら 1。
export const traditions = [
  { kind: '石見神楽', evidence: [['dynamic', 'tagline'], ['spectacle', 'tagline'], ['drama', 'intro~1'], ['music', 'intro~1'], ['monster', 'programs.1.text'], ['together', 'programs.3.text'], ['easy', 'viewing.0']] },
  { kind: '広島神楽', evidence: [['spectacle', 'tagline'], ['easy', 'intro~1'], ['dynamic', 'features.0'], ['classic', 'features.2'], ['drama', 'programs.1.text'], ['monster', 'programs.0.text']] },
  { kind: '高千穂神楽', evidence: [['allnight', 'tagline'], ['easy', 'intro~1'], ['rite', 'features.3'], ['classic', 'programs.2.text'], ['together', 'viewing.2']] },
  { kind: '備中神楽', evidence: [['drama', 'tagline'], ['dynamic', 'intro~1'], ['rite', 'intro~1'], ['laugh', 'features.1'], ['classic', 'programs.0.text'], ['easy', 'features.2']] },
  { kind: '庄内神楽', evidence: [['dynamic', 'intro~2'], ['music', 'intro~2'], ['easy', 'intro~3'], ['monster', 'features.2']] },
  { kind: '御嶽神楽', evidence: [['dynamic', 'tagline'], ['drama', 'intro~1'], ['together', 'intro~3'], ['music', 'features.1'], ['rite', 'features.2']] },
  { kind: '土佐の神楽', evidence: [['rite', 'tagline'], ['laugh', 'features.0'], ['monster', 'features.1'], ['classic', 'features.2'], ['dynamic', 'programs.0.text'], ['drama', 'history.0']] },
  { kind: '伊勢大神楽', evidence: [['laugh', 'tagline'], ['rite', 'features.0']] },
  { kind: '花祭', evidence: [['allnight', 'tagline'], ['yudate', 'tagline'], ['monster', 'tagline'], ['rite', 'intro~2'], ['spectacle', 'features.0'], ['together', 'features.2']] },
  { kind: '遠山の霜月祭', evidence: [['yudate', 'tagline'], ['spectacle', 'tagline'], ['allnight', 'intro~2'], ['rite', 'intro~0'], ['dynamic', 'programs.1.text']] },
  { kind: '保呂羽山の霜月神楽', evidence: [['allnight', 'tagline'], ['yudate', 'tagline'], ['together', 'features.2'], ['classic', 'history.0'], ['rite', 'features.1']] },
  { kind: '銀鏡神楽', evidence: [['allnight', 'tagline'], ['rite', 'tagline'], ['spectacle', 'features.1']] },
  { kind: '鎌倉神楽', evidence: [['yudate', 'tagline'], ['rite', 'intro~1'], ['together', 'intro~2'], ['music', 'features.0']] },
  { kind: '海南神社面神楽', evidence: [['spectacle', 'tagline'], ['yudate', 'features.0'], ['monster', 'features.1'], ['drama', 'features.1']] },
  { kind: '相模里神楽', evidence: [['drama', 'tagline'], ['spectacle', 'tagline'], ['music', 'features.0'], ['easy', 'viewing.0']] },
  { kind: '秩父神楽', evidence: [['drama', 'tagline'], ['classic', 'history.0'], ['rite', 'features.1']] },
  { kind: '鷲宮催馬楽神楽', evidence: [['classic', 'tagline'], ['music', 'intro~1'], ['rite', 'features.1']] },
  { kind: '鶴岡八幡宮の御神楽', evidence: [['classic', 'tagline'], ['music', 'intro~1'], ['rite', 'intro~0']] },
  { kind: '春日若宮おん祭', evidence: [['rite', 'tagline'], ['classic', 'features.0']] },
];
export const evidenceWeight = (path) => (/^(tagline|intro)(~\d+)?$/.test(path) ? 2 : 1);
/** 根拠の本文。path は kagura-info.json のフィールド(例 features.0)。intro~1 は紹介文の2文目、tagline は「地域 ・ 」のあとの部分 */
export function evidenceText(info, path) {
  const [base, n] = path.split('~');
  const text = base.split('.').reduce((v, k) => v?.[k], info);
  if (typeof text !== 'string') return '';
  if (base === 'tagline') return text.split(' ・ ').pop().trim();
  if (n === undefined) return text;
  return text.split(/(?<=。)/).map(s => s.trim()).filter(Boolean)[+n] || '';
}

// ブラウザにも同じ関数を埋め込み、採点・期限判定の別実装を作らない(build.mjs が toString で埋め込む)。
export function quizEngine(questions, traditions) {
  const dims = [...new Set(questions.flatMap(q => q.choices.flatMap(c => Object.keys(c.weights || {}))))];
  // 種類の特徴の強さ: 同じ特徴に根拠が複数あっても、強いほう1つだけ(根拠の数で有利にならない)
  function profile(t) {
    const p = {};
    for (const e of t.evidence) p[e.feature] = Math.max(p[e.feature] || 0, e.weight);
    return p;
  }
  const norm = v => Math.sqrt(Object.values(v).reduce((n, x) => n + x * x, 0));
  const profiles = traditions.map(profile);
  function scoreAnswers(answers) {
    if (!Array.isArray(answers) || answers.length !== questions.length) return null;
    const prefs = {}, reasons = {};
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]; if (q.type !== 'preference') continue;
      const c = q.choices.find(c => c.id === answers[i]); if (!c) return null;
      if (q.explanationOnly) continue;
      for (const [f, w] of Object.entries(c.weights || {})) { prefs[f] = (prefs[f] || 0) + w; (reasons[f] ??= []).push(c.label); }
    }
    const top = dims.filter(f => prefs[f] > 0).sort((a, b) => prefs[b] - prefs[a] || dims.indexOf(a) - dims.indexOf(b));
    const u = norm(prefs);
    // 好みの近さ = 回答の傾向と、種類の特徴の向きの近さ(コサイン)。特徴の数が多い種類ほど有利、にならない
    const all = traditions.map((t, order) => {
      const p = profiles[order], dot = Object.keys(prefs).reduce((n, f) => n + prefs[f] * (p[f] || 0), 0);
      const matched = t.evidence.filter(e => prefs[e.feature] > 0 && p[e.feature] === e.weight)
        .filter((e, i, a) => a.findIndex(x => x.feature === e.feature) === i)
        .sort((a, b) => top.indexOf(a.feature) - top.indexOf(b.feature)); // 理由は、回答で強く選んだ好みの順
      return { ...t, order, matched, score: u && dot ? dot / (u * norm(p)) : 0 };
    }).filter(t => t.score > 0).sort((a, b) => Math.abs(b.score - a.score) > 1e-9 ? b.score - a.score : a.order - b.order);
    const tied = all.some((t, i) => i > 0 && i < 3 && Math.abs(t.score - all[i - 1].score) < 1e-9);
    return { prefs, reasons, top, ranked: all.slice(0, 3), all, tied };
  }
  const stamp = s => Date.parse(s + ':00Z'); // JST壁時計を比較用の同じ軸へ置く。OS timezone非依存。
  function upcoming(e, now) {
    if (e.timeUnknown) return (e.end || e.start).slice(0, 10) >= now.slice(0, 10);
    return (e.end ? stamp(e.end) : stamp(e.start) + 3 * 3600e3) >= stamp(now);
  }
  function range(mode, date, now) {
    if (mode === 'specified') return validDate(date) ? [date, date] : null;
    const d = new Date(now.slice(0, 10) + 'T00:00:00Z'), iso = x => x.toISOString().slice(0, 10);
    if (mode === 'weekend') { // 土日。日曜なら今日だけ
      const dow = d.getUTCDay();
      if (dow === 0) return [iso(d), iso(d)];
      d.setUTCDate(d.getUTCDate() + 6 - dow); const sat = iso(d); d.setUTCDate(d.getUTCDate() + 1); return [sat, iso(d)];
    }
    if (mode !== 'month' && mode !== 'next') return null;
    if (mode === 'next') d.setUTCMonth(d.getUTCMonth() + 1, 1); else d.setUTCDate(1);
    const start = iso(d); d.setUTCMonth(d.getUTCMonth() + 1, 0); return [start, iso(d)];
  }
  function validDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !Number.isNaN(Date.parse(s + 'T00:00:00Z')) && new Date(s + 'T00:00:00Z').toISOString().slice(0, 10) === s; }
  function duration(e, budget) {
    // 開催時間枠と必要観覧時間は別。長時間・複数回・日またぎは適合を断定しない。
    if (e.timeUnknown || !e.end || e.sessions?.length || e.start.slice(0, 10) !== e.end.slice(0, 10)) return '所要時間は要確認';
    const minutes = (stamp(e.end) - stamp(e.start)) / 60000;
    if (minutes <= 0) return '所要時間は要確認';
    if (budget === 'short' || budget === 'half') return minutes <= (budget === 'short' ? 120 : 240) ? `掲載時間枠は${minutes}分(観覧方法は要確認)` : '希望より長い開催時間枠です。途中観覧の可否は要確認';
    return `掲載時間枠は${minutes}分(必要な観覧時間とは限りません)`;
  }
  // 地域: 都道府県名、または「地方:中国」のような地方まとめ。regions は [[地方, [県...]], ...]
  function inRegion(pref, region, regions) {
    if (!region || region === 'all' || region === 'unknown') return true;
    if (region.startsWith('地方:')) return (regions.find(([r]) => r === region.slice(3))?.[1] || []).includes(pref);
    return pref === region;
  }
  function selectEvents(events, kinds, conditions, now, regions = []) {
    const dates = range(conditions.date, conditions.day, now), seen = new Set();
    return events.filter(e => {
      if (seen.has(e.id) || !kinds.includes(e.kind) || !upcoming(e, now)) return false; seen.add(e.id);
      return inRegion(e.prefecture, conditions.region, regions) && (!dates || (e.start.slice(0, 10) <= dates[1] && (e.end || e.start).slice(0, 10) >= dates[0]));
    }).sort((a, b) => a.start.localeCompare(b.start) || a.id.localeCompare(b.id));
  }
  return { dims, profile, scoreAnswers, upcoming, range, validDate, duration, inRegion, selectEvents };
}
