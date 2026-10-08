import * as cheerio from "cheerio"; import { readFileSync, readdirSync, statSync } from "node:fs"; import { join, relative } from "node:path";
const walk=d=>readdirSync(d).flatMap(f=>{const p=join(d,f);return statSync(p).isDirectory()?walk(p):[p]});
const rows=[];
for(const f of walk("dist").filter(x=>x.endsWith(".html"))){
  const $=cheerio.load(readFileSync(f,"utf8")); const t=$("title").text(), d=$('meta[name=description]').attr("content")||"";
  const body=$("main").clone(); body.find("script,style").remove(); const words=body.text().replace(/\s+/g,"").length;
  rows.push({page:"/"+relative("dist",f).replace(/\\/g,"/"),tl:t.length,dl:d.length,chars:words,links:$("main a[href^='/']").length,idx:/noindex/.test($('meta[name=robots]').attr("content")||"")?"noindex":"index",title:t});
}
rows.sort((a,b)=>a.page.localeCompare(b.page));
for(const r of rows) console.log(`${r.idx.padEnd(7)} T${String(r.tl).padStart(3)} D${String(r.dl).padStart(3)} 本文${String(r.chars).padStart(5)}字 内部リンク${String(r.links).padStart(3)}  ${r.page}\n          ${r.title}`);
