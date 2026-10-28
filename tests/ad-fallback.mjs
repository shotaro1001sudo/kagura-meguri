import {readFileSync} from 'node:fs';
import {JSDOM} from 'jsdom';
import {vcTag} from '../scripts/lib/valuecommerce.mjs';
export function adFallbackTests({ok,section}) {
  section('宿バナー: 画像失敗後の親枠復帰と同意境界');
  const vc=vcTag({kind:'banner',className:'stay-banner'});
  const d=new JSDOM(`<div class="aff"><a class="stay-banner" id="rak"><img src="https://example.invalid/banner"></a>${vc}</div><div class="aff" id="text-only">宿案内</div>`,{runScripts:'outside-only'});
  const w=d.window,doc=w.document,band=doc.querySelector('.aff'),rak=doc.querySelector('#rak'),slot=doc.querySelector('[data-vc-ad]');
  w.eval(readFileSync('scripts/client/valuecommerce-consent.js','utf8'));
  w.eval(readFileSync('scripts/client/ad-fallback.js','utf8'));
  const signal=()=>w.dispatchEvent(new w.Event('CookiebotOnConsentReady'));
  rak.querySelector('img').dispatchEvent(new w.Event('error'));
  ok(band.hidden&&slot.hidden,'初回画像失敗とCMP未準備で空枠を隠す');
  w.Cookiebot={hasResponse:false,consent:{marketing:false,method:null}};signal();
  const original=slot.querySelector('a');
  ok(!band.hidden&&!slot.hidden&&rak.hidden,'後から確認済み未選択になると生きているVC枠で親を復帰');
  w.Cookiebot={hasResponse:true,consent:{marketing:true,method:'explicit'}};signal();signal();
  ok(!band.hidden&&slot.querySelector('a')===original&&slot.querySelectorAll('img').length===1,'許可・繰り返し通知で元ノード保持し二重生成しない');
  w.Cookiebot.consent.marketing=false;signal();
  ok(band.hidden&&slot.hidden&&!slot.querySelector('a'),'拒否・撤回はVC要素を除去し空枠を再び隠す');
  // Even a late queued successful image notification cannot bypass refusal.
  slot.appendChild(original);original.querySelector('img').dispatchEvent(new w.Event('load'));
  ok(slot.hidden&&band.hidden,'拒否後の遅延loadでも非表示を維持');signal();
  w.Cookiebot.consent.marketing=true;signal();
  const img=slot.querySelector('img');img.dispatchEvent(new w.Event('error'));
  ok(band.hidden&&slot.hidden,'VC画像自体の失敗も空枠を隠す');signal();
  ok(band.hidden&&slot.hidden,'同意通知で失敗済み画像を再表示しない');
  img.dispatchEvent(new w.Event('load'));
  ok(!band.hidden&&!slot.hidden,'既に許可された画像の回復で親枠を復帰');
  w.Cookiebot.consent.marketing=false;signal();rak.querySelector('img').dispatchEvent(new w.Event('load'));
  ok(!band.hidden&&!rak.hidden&&slot.hidden,'楽天画像の回復はVC拒否を変えない');
  ok(!doc.querySelector('#text-only').hidden,'バナーを持たない宿案内は変更しない');w.close();
  const cached=new JSDOM('<div class="trip-band"><a class="stay-banner"><img src="https://example.invalid/cached"></a></div>',{runScripts:'outside-only'});
  const ci=cached.window.document.querySelector('img');Object.defineProperty(ci,'complete',{value:true});Object.defineProperty(ci,'naturalWidth',{value:0});
  cached.window.eval(readFileSync('scripts/client/ad-fallback.js','utf8'));
  ok(cached.window.document.querySelector('.trip-band').hidden,'初期化前に失敗済みの画像も検出');cached.window.close();
}
