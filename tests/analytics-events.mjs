import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

export function analyticsEventTests({ ok, section }) {
  section("分析品質: 同意・自己除外・導線・個人情報");
  const code = readFileSync("scripts/client/analytics-events.js", "utf8");
  const dom = new JSDOM(`<a id="detail" href="/events/test-1.html?private=secret">公演</a>
    <a id="official" data-official-link href="https://official.example/show?email=private">公式</a>
    <a id="calendar" href="https://calendar.google.com/?secret=x">予定</a>
    <div class="regions"><button data-p="広島県">県</button></div>
    <form id="finder"><input id="from" value="private"><input id="email" value="private@example.com"></form>`,
    {url:"https://kagurameguri.jp/events/test-1.html",runScripts:"outside-only"});
  const w = dom.window, sent = [];
  w.gtag = (...args) => sent.push(args);
  w.kaguraGa4Allowed = false;
  w.eval(code);
  const click = (selector) => {
    const el = w.document.querySelector(selector);
    el.addEventListener("click", event => event.preventDefault(), {once:true});
    el.dispatchEvent(new w.MouseEvent("click", {bubbles:true,cancelable:true}));
  };
  click("#detail");
  ok(sent.length === 0, "同意前の表示・クリックをキューに貯めない");
  w.kaguraGa4Allowed = true;
  w.dispatchEvent(new w.Event("kagura:analytics-ready"));
  w.dispatchEvent(new w.Event("kagura:analytics-ready"));
  w.eval(code);
  ok(sent.filter(x => x[1] === "view_event").length === 1, "後からの同意・二重実行でも公演表示は1回");
  click("#detail"); click("#official"); click("#calendar"); click("button");
  w.document.querySelector("#from").dispatchEvent(new w.Event("change",{bubbles:true}));
  w.document.querySelector("#email").dispatchEvent(new w.Event("change",{bubbles:true}));
  ok(sent.filter(x=>x[1]==="select_event").length===1 && sent.filter(x=>x[1]==="official_link_click").length===1,
    "公演遷移と公式情報を別計測しGoogleカレンダーは混同しない");
  ok(sent.filter(x=>x[1]==="filter_events").length===2, "地方/県と日付の操作種類を計測");
  ok(!JSON.stringify(sent).includes("private") && !JSON.stringify(sent).includes("secret"),
    "入力値・リンククエリをイベントに入れない");
  w.kaguraGa4Allowed = false;
  const count=sent.length; click("#detail");
  ok(sent.length===count, "同意撤回後は導線計測しない");
  dom.window.close();
}
