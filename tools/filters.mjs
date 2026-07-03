// Disparate Topics Challenge — rules engine (source of truth)
// Mirrored inline in index.html; keep in sync.

export const MIN_BYTES = 22500;
export const MIN_WORDS = 3000;

export const DEFAULT_BLOCKLIST = [
  "nazi","hitler","holocaust","september 11","abortion","terroris","genocide","covid"
];

// Pre-1900 (and BC) political history is allowed; Steve's rule bars politics
// active in the last ~100 years. Century categories can't split 1900–1926 from
// later, so all 20th/21st-century politics is rejected (documented trade-off).
export const OLD_ERA = /\bBC\b|\bancient\b|\bmedieval\b|\b(1st|2nd|3rd|[4-9]th|1[0-9]th)[- ]century/i;
export const POLITIC = /politic|election/i;
export const EVENTY  = /championship|competition|tournament|season|olympic|cup\b|world cup/i;
export const RECENT_YEAR = /\b20[0-2]\d\b/;

export function blockRx(terms = DEFAULT_BLOCKLIST) {
  const esc = terms.map(s => s.trim()).filter(Boolean)
    .map(s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return esc.length ? new RegExp(esc.join("|"), "i") : null;
}

/**
 * page: { title, length, categories: [{title:"Category:…"}], pageprops? }
 * returns { pass:boolean, reason:string }
 */
export function evaluate(page, blocklist = DEFAULT_BLOCKLIST) {
  const title = page.title || "";
  const cats = (page.categories || []).map(c => c.title.replace(/^Category:/, ""));
  const hay = title + " | " + cats.join(" | ");

  if (page.pageprops && "disambiguation" in page.pageprops)
    return { pass: false, reason: "disambiguation page" };
  if ((page.length || 0) < MIN_BYTES)
    return { pass: false, reason: "too short (proxy <" + MIN_BYTES + " bytes)" };
  if (/living people/i.test(hay))
    return { pass: false, reason: "living person" };
  const rx = blockRx(blocklist);
  if (rx && rx.test(hay))
    return { pass: false, reason: "blocklist: " + hay.match(rx)[0] };
  for (const c of cats) {
    if (POLITIC.test(c) && !OLD_ERA.test(c))
      return { pass: false, reason: "modern politics: " + c };
    if (/^Current /i.test(c))
      return { pass: false, reason: "current events: " + c };
    if (RECENT_YEAR.test(c) && EVENTY.test(c))
      return { pass: false, reason: "current event: " + c };
  }
  if (RECENT_YEAR.test(title))
    return { pass: false, reason: "recent-year title" };
  return { pass: true, reason: "ok" };
}

export const passesFilters = (page, bl) => evaluate(page, bl).pass;
