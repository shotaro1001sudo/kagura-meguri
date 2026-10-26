import * as cheerio from 'cheerio';
// Legacy visual assertions examine the post-consent DOM. Real inertness/activation is
// separately tested in valuecommerce-issued.mjs using native template.content in JSDOM.
export const renderedCheerio={...cheerio,load(html,...args){
  const $=cheerio.load(typeof html==='string'?html.replace(/<template>([\s\S]*?)<\/template>/g,'$1'):html,...args);
  $('[data-vc-ad]').removeAttr('hidden');return $;
}};
