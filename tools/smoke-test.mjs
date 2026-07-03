// Disparate Topics Challenge — headless smoke test
//
//   node smoke-test.mjs --offline --spins 50        (synthetic corpus, exact BFS — runs anywhere)
//   node smoke-test.mjs --spins 10 --minsep 4       (LIVE Wikipedia — run on a machine with open network)
//
// Live mode is polite to the API (delays + maxlag). ~30–60s per spin.

import { evaluate, MIN_WORDS, DEFAULT_BLOCKLIST } from "./filters.mjs";

const arg = (name, dflt) => {
  const i = process.argv.indexOf("--" + name);
  return i > -1 ? (process.argv[i + 1] ?? true) : dflt;
};
const OFFLINE = process.argv.includes("--offline");
const SPINS = parseInt(arg("spins", 50), 10);
const MINSEP = parseInt(arg("minsep", 4), 10);
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* ---------------- seeded RNG (reproducible offline runs) ---------------- */
let seed = 42;
const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const pick = a => a[Math.floor(rnd() * a.length)];

/* ---------------- OFFLINE: synthetic corpus + link graph ---------------- */
const DOMAINS = ["Botany","Naval history","Mycology","Folklore","Metallurgy","Astronomy",
  "Cuisine","Cartography","Entomology","Music theory","Geology","Textiles"];

function buildCorpus(n = 400) {
  const corpus = [];
  for (let i = 0; i < n; i++) {
    const dom = DOMAINS[i % DOMAINS.length];
    const roll = rnd();
    let page = { title: `${dom} topic ${i}`, length: 40000,
      categories: [{ title: `Category:${dom}` }], words: 2200 + Math.floor(rnd() * 4000) };
    if (roll < 0.10) { page.categories.push({ title: "Category:Living people" }); page.tag = "living"; }
    else if (roll < 0.16) { page.categories.push({ title: "Category:21st-century American politicians" }); page.tag = "modern politics"; }
    else if (roll < 0.20) { page.length = 4000; page.tag = "stub"; }
    else if (roll < 0.24) { page.title = `${2016 + (i % 10)} ${dom} Championship`; page.tag = "current event"; }
    else if (roll < 0.27) { page.categories.push({ title: "Category:Nazi Germany" }); page.tag = "blocklist"; }
    else if (roll < 0.29) { page.pageprops = { disambiguation: "" }; page.tag = "disambig"; }
    else if (roll < 0.32) { page.words = 900; page.tag = "short prose"; }        // passes byte proxy, fails word check
    else if (roll < 0.34) { page.categories.push({ title: "Category:2nd-century BC Roman politicians" }); page.tag = "ancient politics (should pass)"; }
    corpus.push(page);
  }
  // directed link graph: dense inside a domain, hubs bridging domains
  const links = new Map(corpus.map(p => [p.title, new Set()]));
  const byDomain = d => corpus.filter(p => p.categories[0].title === "Category:" + d);
  for (const p of corpus) {
    const dom = p.categories[0].title.slice(9);
    const sibs = byDomain(dom);
    for (let k = 0; k < 6; k++) links.get(p.title).add(pick(sibs).title);   // intra-domain, dist 1–2
  }
  const hubs = corpus.slice(0, 8);                                           // "List of…"-style hubs
  for (const h of hubs) for (let k = 0; k < 60; k++) links.get(h.title).add(pick(corpus).title);
  for (const p of corpus) if (rnd() < 0.15) links.get(pick(corpus).title).add(p.title); // stray cross-links
  return { corpus, links };
}

function bfsDist(links, from, to, cap = 8) {
  if (from === to) return 0;
  let frontier = [from]; const seen = new Set([from]);
  for (let d = 1; d <= cap; d++) {
    const next = [];
    for (const t of frontier) for (const n of (links.get(t) || [])) {
      if (n === to) return d;
      if (!seen.has(n)) { seen.add(n); next.push(n); }
    }
    frontier = next; if (!frontier.length) break;
  }
  return Infinity;
}
const pairDist = (links, a, b) => Math.min(bfsDist(links, a, b), bfsDist(links, b, a));

/* ---------------- LIVE: Wikipedia API ---------------- */
const API = "https://en.wikipedia.org/w/api.php";
const UA = { headers: { "User-Agent": "DisparateTopicsChallenge-smoketest/1.0 (The Den; contact via substack)" } };
let apiCalls = 0;
async function wapi(params) {
  apiCalls++; await sleep(120);
  const q = new URLSearchParams({ action: "query", format: "json", maxlag: "5", ...params });
  const res = await fetch(API + "?" + q, UA);
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}
async function liveCandidates() {
  const r = await wapi({ list: "random", rnnamespace: 0, rnlimit: 20, rnfilterredir: "nonredirects" });
  const titles = r.query.random.map(x => x.title);
  const d = await wapi({ titles: titles.join("|"), prop: "info|categories|pageprops", cllimit: "max", clshow: "!hidden" });
  return Object.values(d.query.pages || {});
}
async function liveWords(title) {
  const d = await wapi({ titles: title, prop: "extracts", explaintext: 1, exsectionformat: "plain" });
  const text = Object.values(d.query.pages)[0].extract || "";
  return text.split(/\s+/).filter(Boolean).length;
}
async function liveLinks(title, dir, cap = 1500) {
  const prop = dir === "out" ? "links" : "linkshere", px = dir === "out" ? "pl" : "lh";
  let params = { titles: title, prop, [px + "limit"]: "max", [px + "namespace"]: "0" };
  if (dir === "in") params.lhshow = "!redirect";
  const set = new Set(); let cont = null;
  for (let i = 0; i < 3; i++) {
    const d = await wapi({ ...params, ...(cont || {}) });
    for (const p of Object.values(d.query?.pages || {})) for (const l of (p[prop] || [])) set.add(l.title);
    if (set.size >= cap || !d.continue) break;
    cont = d.continue;
  }
  return set;
}
const hit = (a, b) => { const s = a.size < b.size ? a : b, big = s === a ? b : a; for (const x of s) if (big.has(x)) return x; return null; };
async function liveSeparation(a, b) {
  const sharedCat = hit(a.cats, b.cats);
  if (sharedCat) return { pass: false, reason: "shared category " + sharedCat };
  const [aOut, bOut] = await Promise.all([liveLinks(a.title, "out"), liveLinks(b.title, "out")]);
  if (aOut.has(b.title) || bOut.has(a.title)) return { pass: false, reason: "1 click" };
  const [aIn, bIn] = await Promise.all([liveLinks(a.title, "in", 1000), liveLinks(b.title, "in", 1000)]);
  const v2 = hit(aOut, bIn) || hit(bOut, aIn);
  if (v2) return { pass: false, reason: "2 clicks via " + v2 };
  if (MINSEP <= 3) return { pass: true, reason: "≥3 exact" };
  // depth-3 sampled probe
  const sample = [...aOut].sort(() => Math.random() - .5).slice(0, 40);
  const frontier = new Set();
  for (let i = 0; i < sample.length; i += 20) {
    const d = await wapi({ titles: sample.slice(i, i + 20).join("|"), prop: "links", pllimit: "max", plnamespace: "0" });
    for (const p of Object.values(d.query?.pages || {})) for (const l of (p.links || [])) frontier.add(l.title);
  }
  const v3 = hit(frontier, bIn);
  if (v3) return { pass: false, reason: "3 clicks via " + v3 + " (sampled)" };
  return { pass: true, reason: "≥" + MINSEP + " (depth-3 sampled)" };
}

/* ---------------- spin engine (mirrors index.html flow) ---------------- */
async function run() {
  const rejects = {}; let respins = 0; const violations = []; const spins = [];
  const world = OFFLINE ? buildCorpus() : null;
  let livePool = [];

  const note = r => rejects[r] = (rejects[r] || 0) + 1;

  async function nextValidated(locked) {
    for (let t = 0; t < 200; t++) {
      let page;
      if (OFFLINE) page = pick(world.corpus);
      else {
        if (!livePool.length) livePool = await liveCandidates();
        page = livePool.shift(); if (!page) continue;
      }
      if (locked.some(l => l && l.title === page.title)) continue;
      const v = evaluate(page);
      if (!v.pass) { note(v.reason.split(":")[0]); continue; }
      const words = OFFLINE ? page.words : await liveWords(page.title);
      if (words < MIN_WORDS) { note("under " + MIN_WORDS + " words"); continue; }
      return { title: page.title, words,
        cats: new Set((page.categories || []).map(c => c.title.replace(/^Category:/, ""))) };
    }
    throw new Error("candidate drought");
  }

  for (let s = 1; s <= SPINS; s++) {
    const locked = [null, null, null];
    for (let i = 0; i < 3; i++) {
      for (let attempt = 0; attempt < 30; attempt++) {
        const cand = await nextValidated(locked);
        let ok = true;
        for (let j = 0; j < i; j++) {
          let res;
          if (OFFLINE) {
            const shared = hit(cand.cats, locked[j].cats);
            const d = pairDist(world.links, cand.title, locked[j].title);
            res = shared ? { pass: false, reason: "shared category" }
                : d < MINSEP ? { pass: false, reason: d + " clicks" } : { pass: true };
          } else res = await liveSeparation(cand, locked[j]);
          if (!res.pass) { respins++; note("separation: " + res.reason.split(" via")[0]); ok = false; break; }
        }
        if (ok) { locked[i] = cand; break; }
      }
      if (!locked[i]) throw new Error(`spin ${s}: reel ${i + 1} exhausted 30 respins`);
    }
    // ---- independent post-hoc verification of the final triple ----
    for (const t of locked) {
      const page = OFFLINE ? world.corpus.find(p => p.title === t.title) : null;
      if (OFFLINE && !evaluate(page).pass) violations.push(`spin ${s}: "${t.title}" fails filters (${evaluate(page).reason})`);
      if (t.words < MIN_WORDS) violations.push(`spin ${s}: "${t.title}" under ${MIN_WORDS} words`);
    }
    if (OFFLINE) {
      const pairs = [[0,1],[0,2],[1,2]];
      for (const [x, y] of pairs) {
        const d = pairDist(world.links, locked[x].title, locked[y].title);
        if (d < MINSEP) violations.push(`spin ${s}: "${locked[x].title}" ↔ "${locked[y].title}" only ${d} clicks apart`);
        if (hit(locked[x].cats, locked[y].cats)) violations.push(`spin ${s}: shared category between reel ${x+1} and ${y+1}`);
      }
    }
    spins.push(locked.map(l => l.title));
    if (!OFFLINE) console.log(`spin ${s}/${SPINS}: ${locked.map(l => l.title).join("  ·  ")}`);
  }

  console.log(`\n==== ${OFFLINE ? "OFFLINE (synthetic corpus, exact BFS)" : "LIVE (en.wikipedia)"} ====`);
  console.log(`spins completed : ${spins.length}/${SPINS}   min separation: ${MINSEP}`);
  console.log(`respins forced  : ${respins}`);
  console.log(`candidates rejected, by rule:`);
  Object.entries(rejects).sort((a,b)=>b[1]-a[1]).forEach(([k,v]) => console.log(`  ${String(v).padStart(4)}  ${k}`));
  if (!OFFLINE) console.log(`api calls       : ${apiCalls}`);
  console.log(`\nVIOLATIONS IN FINAL RESULTS: ${violations.length}`);
  violations.forEach(v => console.log("  ✗ " + v));
  console.log(violations.length ? "\nFAIL" : "\nPASS — every delivered triple obeys every rule");
  console.log("\nsample pulls:");
  spins.slice(0, 5).forEach((t, i) => console.log(`  ${i + 1}. ${t.join("  ·  ")}`));
  process.exit(violations.length ? 1 : 0);
}
run().catch(e => { console.error("ABORTED: " + e.message); process.exit(2); });
