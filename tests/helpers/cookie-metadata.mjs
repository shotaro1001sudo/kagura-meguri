// Deliberately whitelist metadata. Never persist value, cookieLine or request headers.
export function cookieMetadata(c={}) {
 return Object.fromEntries(['name','domain','path','expires','session','secure','httpOnly','sameSite'].filter(k=>c[k]!==undefined).map(k=>[k,c[k]]));
}
