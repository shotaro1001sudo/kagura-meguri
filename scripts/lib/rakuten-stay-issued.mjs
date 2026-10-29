// Exact owner-issued URLs only. Never reuse an issued ID for another destination.
export function createRakutenStayResolver(rows) {
  const issued = new Map(), verified = new Set(), unverified = new Set();
  for (const row of rows) {
    const destination = new URL(row.destination), href = new URL(row.href);
    if (destination.origin !== 'https://kw.travel.rakuten.co.jp' || destination.pathname !== '/keyword/Search.do' ||
        destination.username || destination.password || destination.hash ||
        href.origin !== 'https://hb.afl.rakuten.co.jp' || !/^\/hgc\/[A-Za-z0-9.]+\/$/.test(href.pathname) ||
        href.username || href.password || href.hash || href.searchParams.getAll('pc').length !== 1 ||
        href.searchParams.get('pc') !== row.destination || typeof row.issuedAt !== 'string' || !Number.isFinite(Date.parse(row.issuedAt)) ||
        row.hasDate !== destination.searchParams.has('f_nen1') || issued.has(row.destination)) {
      throw new Error('Invalid or duplicate issued Rakuten stay mapping');
    }
    issued.set(row.destination, row.href);
  }
  return {
    resolve(destination, legacy) {
      if (issued.has(destination)) { verified.add(destination); return issued.get(destination); }
      unverified.add(destination);
      return legacy(destination); // Preserve existing behavior; do not certify this URL.
    },
    audit() { return { verified: [...verified].sort(), unverified: [...unverified].sort() }; }
  };
}
