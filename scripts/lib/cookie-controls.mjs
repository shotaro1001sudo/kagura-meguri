/** Reopen the native CMP; consent choices remain entirely in the vendor popup. */
export function cookieControls(en=false) {
 return `<div id="cookie-controls" class="cookie-settings"><button id="cookie-settings-open" type="button" aria-describedby="cookie-settings-status">${en?'Cookie settings':'Cookie設定'}</button><span id="cookie-settings-status" role="status" aria-live="polite" aria-atomic="true"></span><noscript><span>${en?'JavaScript is required to open cookie settings.':'Cookie設定を開くにはJavaScriptが必要です。'}</span></noscript></div>`;
}
