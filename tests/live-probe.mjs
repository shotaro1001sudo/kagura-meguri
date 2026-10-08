import * as sel from "../scripts/adapters/selectors.mjs";
const UA="Mozilla/5.0 (test; KaguraMeguri dev)";
const html=async u=>await (await fetch(u,{headers:{"user-agent":UA}})).text();
const aki={url:"https://akitakata-kankou.jp/event/",prefecture:"広島県",city:"安芸高田市",filter:"神楽",selectors:{item:"a.x-evbox",name:".n-c",date:".ev-date",place:".n-s",link:"self"}};
console.log(JSON.stringify(sel.parse(await html(aki.url),aki),null,1));
const tak={url:"https://takachiho-kanko.info/kagura/yokagura/schedule/",prefecture:"宮崎県",city:"高千穂町",namePrefix:"高千穂の夜神楽 ",selectors:{item:"td.list_item",name:"li:nth-child(2)",date:"li:nth-child(1)",place:"li:nth-child(3)"}};
const r=sel.parse(await html(tak.url),tak); console.log(r.length, JSON.stringify(r.slice(0,2),null,1));