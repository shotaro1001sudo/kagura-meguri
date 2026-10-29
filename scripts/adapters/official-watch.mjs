// Review-only sources: collect change signals without publishing guessed dates.
export function parse() { return []; }
export function urls(source) { return [...new Set([source.url, ...(source.watchUrls ?? [])])]; }
