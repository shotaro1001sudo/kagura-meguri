// 投稿フォーム・お問い合わせフォーム(静的サイト用)
// 送信先は config.json の form.endpoint(Web3Forms / Formspree など)。未設定の間は、入力内容を入れた
// メールの作成画面を開く(= 受け取れる状態で公開できる)。迷惑投稿は、ハニーポット・送信間隔・送信先側の対策で抑える。
import { PREFECTURES } from "./util.mjs";

const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const field = (id, label, { type = "text", required = false, max = 100, hint = "", placeholder = "", extra = "", autocomplete = "off" } = {}) =>
  `<div class="f"><label for="${id}">${label}${required ? '<em class="req">必須</em>' : '<em class="opt">任意</em>'}</label>` +
  `<input id="${id}" name="${id}" type="${type}" maxlength="${max}" autocomplete="${autocomplete}"${required ? " required" : ""}${placeholder ? ` placeholder="${esc(placeholder)}"` : ""} ${extra}>` +
  `${hint ? `<small class="hint" id="${id}-h">${hint}</small>` : ""}<small class="err" id="${id}-e" role="alert"></small></div>`;

const area = (id, label, { required = false, max = 400, hint = "", rows = 5 } = {}) =>
  `<div class="f"><label for="${id}">${label}${required ? '<em class="req">必須</em>' : '<em class="opt">任意</em>'}</label>` +
  `<textarea id="${id}" name="${id}" rows="${rows}" maxlength="${max}"${required ? " required" : ""}></textarea>` +
  `${hint ? `<small class="hint">${hint}</small>` : ""}<small class="err" id="${id}-e" role="alert"></small></div>`;

const select = (id, label, options, { required = false, first = "選択してください" } = {}) =>
  `<div class="f"><label for="${id}">${label}${required ? '<em class="req">必須</em>' : '<em class="opt">任意</em>'}</label>` +
  `<select id="${id}" name="${id}"${required ? " required" : ""}><option value="">${first}</option>${options.map((o) => `<option>${esc(o)}</option>`).join("")}</select>` +
  `<small class="err" id="${id}-e" role="alert"></small></div>`;

const guard = (cfg) => `
<div class="hp" aria-hidden="true"><label>この欄は空のままにしてください<input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>
<input type="hidden" name="_t" value="">`;

const consent = (cfg) => `<div class="f consent"><label><input type="checkbox" id="agree" name="agree" required> <span><a href="/privacy.html" target="_blank" rel="noopener">プライバシーポリシー</a>に同意します</span></label><small class="err" id="agree-e" role="alert"></small></div>`;

export function submitForm(cfg) {
  const [u, d] = (cfg.operator.contact || "").split("@");
  return `<form class="form" id="submit-form" data-form="submit" data-u="${esc(u)}" data-d="${esc(d)}" novalidate>
<p class="meta">掲載をご希望の神楽の開催情報を、お送りください。内容を確認のうえ、掲載します(すべての投稿を掲載するとは限りません)。</p>
<fieldset><legend>開催の情報</legend>
${field("name", "神楽・イベントの名称", { required: true, max: 80, placeholder: "例: 第54回 高宮神楽まつり" })}
${field("kagura", "神楽の種類", { required: true, max: 40, placeholder: "例: 石見神楽、高千穂神楽、備中神楽" })}
${select("prefecture", "都道府県", PREFECTURES, { required: true })}
${field("city", "市区町村", { required: true, max: 40, placeholder: "例: 益田市" })}
${field("venue", "会場名", { required: true, max: 80, placeholder: "例: 〇〇神社 神楽殿" })}
${field("address", "番地までの住所", { max: 100, hint: "地図に正しく表示するために使います。分かる範囲で結構です。" })}
${field("date", "開催日", { type: "date", required: true, max: 10 })}
${field("time_start", "開始時刻", { type: "time", max: 5 })}
${field("time_end", "終了時刻", { type: "time", max: 5 })}
${field("fee", "料金", { max: 80, placeholder: "例: 無料、1,000円" })}
${field("url", "公式情報のURL", { type: "url", max: 300, placeholder: "https://", hint: "主催者の公式ページ、または自治体・観光協会のページ。https:// で始まるものに限ります。" })}
${area("description", "ひとこと説明", { max: 300, hint: "300字まで。写真や文章の転載はご遠慮ください。", rows: 4 })}
</fieldset>
<fieldset><legend>投稿された方について</legend>
${select("role", "ご関係", ["主催者・出演者", "神社・保存会の関係者", "自治体・観光協会の担当者", "観覧した方・その他"], { required: true })}
${field("sender", "お名前または団体名", { required: true, max: 60, autocomplete: "name" })}
${field("email", "ご連絡先のメールアドレス", { type: "email", required: true, max: 120, autocomplete: "email", hint: "確認のご連絡にだけ使います。サイトには表示しません。" })}
</fieldset>
${guard(cfg)}
${consent(cfg)}
<button class="btn" type="submit" id="send">送信する</button>
<p class="status" id="status" role="status" aria-live="polite"></p>
</form>
<noscript><p class="empty">このフォームの送信には、JavaScriptが必要です。お手数ですが、JavaScriptを有効にしてください。</p></noscript>`;
}

export function contactForm(cfg) {
  const [u, d] = (cfg.operator.contact || "").split("@");
  return `<form class="form" id="contact-form" data-form="contact" data-u="${esc(u)}" data-d="${esc(d)}" novalidate>
${select("topic", "ご用件", ["掲載内容の訂正", "掲載の削除依頼", "サイトの不具合", "広告・取材などのご相談", "その他"], { required: true })}
${field("sender", "お名前", { required: true, max: 60, autocomplete: "name" })}
${field("email", "メールアドレス", { type: "email", required: true, max: 120, autocomplete: "email" })}
${field("target", "対象のページのURL", { type: "url", max: 300, placeholder: "https://", hint: "訂正・削除のご依頼は、該当のページのURLをお書きください。" })}
${area("message", "内容", { required: true, max: 1500, rows: 7 })}
${guard(cfg)}
${consent(cfg)}
<button class="btn" type="submit" id="send">送信する</button>
<p class="status" id="status" role="status" aria-live="polite"></p>
</form>
<noscript><p class="empty">このフォームの送信には、JavaScriptが必要です。お手数ですが、JavaScriptを有効にしてください。</p></noscript>`;
}

// ブラウザ側の処理(インライン。CSPのハッシュで許可される)。設定値は data 属性ではなく、ここに埋め込む
export function formScript(cfg) {
  const f = cfg.form ?? {};
  const ready = !!f.endpoint && (!/web3forms/i.test(f.endpoint) || !!f.accessKey);
  const conf = JSON.stringify({ endpoint: ready ? f.endpoint : "", accessKey: ready ? f.accessKey || "" : "", site: cfg.siteName }).replace(/</g, "\\u003c");
  return `(function(){
var C=${conf};
var form=document.querySelector('form[data-form]');if(!form)return;
var kind=form.dataset.form,btn=document.getElementById('send'),st=document.getElementById('status');
var t0=Date.now();form.querySelector('input[name=_t]').value=String(t0);
var $=function(id){return document.getElementById(id)};
var val=function(id){var e=$(id);return e?e.value.trim():''};
function err(id,m){var e=$(id+'-e');if(e)e.textContent=m||'';var i=$(id);if(i)i.setAttribute('aria-invalid',m?'true':'false')}
function check(){
  var ok=true;
  form.querySelectorAll('[required]').forEach(function(el){
    var m='';
    if(el.type==='checkbox'){if(!el.checked)m='同意が必要です'}
    else if(!el.value.trim())m='入力してください';
    err(el.id,m);if(m&&ok){ok=false;el.focus()}else if(m)ok=false;
  });
  var em=$('email');if(em&&em.value&&!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(em.value.trim())){err('email','メールアドレスの形式を確認してください');ok=false}
  ['url','target'].forEach(function(id){var u=$(id);if(u&&u.value.trim()&&!/^https:\\/\\/[^\\s]+$/.test(u.value.trim())){err(id,'https:// で始まるURLを入力してください');ok=false}});
  var tm=$('time_start'),te=$('time_end');if(tm&&te&&tm.value&&te.value&&te.value<tm.value){err('time_end','終了時刻は、開始時刻より後にしてください');ok=false}
  return ok;
}
function lines(){
  var L=[];
  form.querySelectorAll('input,select,textarea').forEach(function(el){
    if(!el.id||el.type==='hidden'||el.type==='checkbox'||el.name==='website')return;
    var lab=form.querySelector('label[for='+el.id+']');
    var name=lab?lab.firstChild.textContent:el.id;
    if(el.value.trim())L.push('■'+name+': '+el.value.trim());
  });
  return L;
}
function jsonBlock(){
  var d=val('date'),s=val('time_start'),e=val('time_end');
  var o={id:'',name:val('name'),kagura:val('kagura'),prefecture:val('prefecture'),city:val('city'),venue:val('venue'),address:val('address'),
    start:d?d+'T'+(s||'00:00'):'',end:(d&&e)?d+'T'+e:undefined,timeUnknown:s?undefined:true,fee:val('fee'),url:val('url'),description:val('description'),status:'pending'};
  return JSON.stringify(o,null,1);
}
function say(m,bad){st.textContent=m;st.className='status'+(bad?' bad':' ok')}
function mailto(){
  var to=(form.dataset.u||'')+'@'+(form.dataset.d||'');
  var subject=kind==='submit'?'開催情報の掲載依頼: '+val('name'):'お問い合わせ: '+val('topic');
  var body=lines().join('\\n')+(kind==='submit'?'\\n\\n【events.json 用】\\n'+jsonBlock():'');
  if(body.length>1700)body=body.slice(0,1700)+'\\n…(長いため省略。続きは別途お送りします)';
  location.href='mailto:'+to+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(body);
}
form.addEventListener('submit',function(ev){
  ev.preventDefault();
  if(form.querySelector('input[name=website]').value.trim()){say('送信しました。ありがとうございました。');return}   // ハニーポット: ボットには成功したように見せて、送らない
  if(Date.now()-t0<3000){say('少し時間をおいてから、もう一度お試しください。',true);return}  // 速すぎる送信はボットとみなす
  if(!check()){say('入力内容をご確認ください。',true);return}
  var last=+(sessionStorage.getItem('lastSend')||0);
  if(Date.now()-last<30000){say('連続での送信はできません。30秒ほどあけてください。',true);return}
  if(!C.endpoint){say('メールの作成画面を開きます。メールを送信して、投稿を完了してください。');mailto();return}
  btn.disabled=true;say('送信しています…');
  var payload={access_key:C.accessKey||undefined,subject:(kind==='submit'?'【'+C.site+'】開催情報の掲載依頼: '+val('name'):'【'+C.site+'】お問い合わせ: '+val('topic')),
    from_name:val('sender'),email:val('email'),message:lines().join('\\n')+(kind==='submit'?'\\n\\n【events.json 用】\\n'+jsonBlock():'')};
  var ctl=new AbortController(),to=setTimeout(function(){ctl.abort()},15000);
  fetch(C.endpoint,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(payload),signal:ctl.signal,referrerPolicy:'no-referrer',credentials:'omit'})
    .then(function(r){return r.json().catch(function(){return{}}).then(function(j){if(!r.ok||j.success===false||j.ok===false)throw 0;return j})})
    .then(function(){sessionStorage.setItem('lastSend',String(Date.now()));form.reset();say('送信しました。ありがとうございます。内容を確認のうえ、ご連絡します。')})
    .catch(function(){say('送信できませんでした。時間をおいて再度お試しいただくか、メールでお送りください。',true);var b=document.createElement('button');b.type='button';b.className='btn ghost';b.textContent='メールで送る';b.onclick=mailto;st.appendChild(document.createElement('br'));st.appendChild(b)})
    .finally(function(){clearTimeout(to);btn.disabled=false});
});
})();`;
}
