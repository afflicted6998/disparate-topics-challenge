// Rules audit: realistic article fixtures with real-world category shapes.
// Runs against the FIXED engine, and also against the v1 (shipped) regexes
// to document exactly what the prototype would have gotten wrong.

import { evaluate } from "./filters.mjs";

const C = names => names.map(n => ({ title: "Category:" + n }));
const L = 60000; // comfortably long article

const FIXTURES = [
  // ---- must REJECT ----
  ["Taylor Swift", { title:"Taylor Swift", length:900000, categories:C(["Living people","1989 births","American singer-songwriters"]) }, false],
  ["Ronald Reagan", { title:"Ronald Reagan", length:L, categories:C(["1911 births","2004 deaths","Presidents of the United States","20th-century American politicians"]) }, false],
  ["Winston Churchill", { title:"Winston Churchill", length:L, categories:C(["Prime Ministers of the United Kingdom","20th-century British politicians","British Army personnel of World War I"]) }, false],
  ["Labour Party (UK)", { title:"Labour Party (UK)", length:L, categories:C(["Political parties in the United Kingdom","Labour parties","Socialist parties in the United Kingdom"]) }, false],
  ["Adolf Hitler", { title:"Adolf Hitler", length:L, categories:C(["1889 births","Nazi Party politicians"]) }, false],
  ["Schutzstaffel", { title:"Schutzstaffel", length:L, categories:C(["SS","Paramilitary organizations of Nazi Germany"]) }, false],
  ["September 11 attacks", { title:"September 11 attacks", length:L, categories:C(["Terrorist attacks in the United States","2001 in the United States"]) }, false],
  ["Abortion debate", { title:"Abortion debate", length:L, categories:C(["Abortion debate","Ethical controversies"]) }, false],
  ["Rwandan genocide", { title:"Rwandan genocide", length:L, categories:C(["Rwandan genocide","1994 in Rwanda"]) }, false],
  ["COVID-19 pandemic", { title:"COVID-19 pandemic", length:L, categories:C(["COVID-19 pandemic","Ongoing events"]) }, false],
  ["2022 FIFA World Cup", { title:"2022 FIFA World Cup", length:L, categories:C(["2022 FIFA World Cup","FIFA World Cup tournaments"]) }, false],
  ["2024 Summer Olympics", { title:"2024 Summer Olympics", length:L, categories:C(["2024 Summer Olympics","Olympic Games in France"]) }, false],
  ["2019-20 NBA season", { title:"2019–20 NBA season", length:L, categories:C(["2019–20 NBA season","National Basketball Association seasons"]) }, false],
  ["Elections in France", { title:"Elections in France", length:L, categories:C(["Elections in France","Politics of France"]) }, false],
  ["Village stub", { title:"Kozjak (village)", length:2400, categories:C(["Villages in North Macedonia"]) }, false],
  ["Disambiguation page", { title:"John Smith", length:20000, categories:C(["Human name disambiguation pages"]), pageprops:{disambiguation:""} }, false],
  ["Politics of Japan", { title:"Politics of Japan", length:L, categories:C(["Politics of Japan","Government of Japan"]) }, false],
  ["21st-c politician (dead)", { title:"Test Modern Politician", length:L, categories:C(["1950 births","2024 deaths","21st-century American politicians"]) }, false],

  // ---- must PASS ----
  ["Cato the Elder", { title:"Cato the Elder", length:L, categories:C(["234 BC births","2nd-century BC Roman politicians","Roman censors"]) }, true],
  ["Julius Caesar", { title:"Julius Caesar", length:L, categories:C(["1st-century BC Roman politicians","Roman dictators","Assassinated ancient Roman politicians"]) }, true],
  ["William Gladstone", { title:"William Ewart Gladstone", length:L, categories:C(["1809 births","1898 deaths","19th-century British politicians","Prime Ministers of the United Kingdom"]) }, true],
  ["1st-c AD politician", { title:"Test Ancient Politician", length:L, categories:C(["1st-century Roman politicians","Roman governors"]) }, true],
  ["Battle of Cannae", { title:"Battle of Cannae", length:L, categories:C(["Battles of the Second Punic War","216 BC","Hannibal"]) }, true],
  ["Battle of Hastings", { title:"Battle of Hastings", length:L, categories:C(["Battles of the Norman Conquest","1066 in England"]) }, true],
  ["Great Fire of London", { title:"Great Fire of London", length:L, categories:C(["1666 in England","Fires in London","17th-century fires"]) }, true],
  ["Miles Davis", { title:"Miles Davis", length:L, categories:C(["1926 births","1991 deaths","American jazz trumpeters"]) }, true],
  ["Photosynthesis", { title:"Photosynthesis", length:L, categories:C(["Photosynthesis","Plant physiology","Biochemistry"]) }, true],
  ["Bioluminescence", { title:"Bioluminescence", length:L, categories:C(["Bioluminescence","Luminescence"]) }, true],
  ["Antikythera mechanism", { title:"Antikythera mechanism", length:L, categories:C(["Ancient Greek astronomy","Archaeological discoveries in Greece","Astronomical clocks"]) }, true],
  ["Tulip mania", { title:"Tulip mania", length:L, categories:C(["Economic bubbles","1630s economic history","Dutch Golden Age"]) }, true],
  ["Norse mythology", { title:"Norse mythology", length:L, categories:C(["Norse mythology","Germanic paganism"]) }, true],
  ["Sourdough", { title:"Sourdough", length:L, categories:C(["Sourdough breads","Fermented foods"]) }, true],
  ["Dendrochronology", { title:"Dendrochronology", length:L, categories:C(["Dendrochronology","Dating methods","Incremental dating"]) }, true],
  ["Trepanning", { title:"Trepanning", length:L, categories:C(["History of neuroscience","Surgical procedures","Prehistoric medicine"]) }, true],
  ["1930 FIFA World Cup", { title:"1930 FIFA World Cup", length:L, categories:C(["1930 FIFA World Cup","FIFA World Cup tournaments"]) }, true], // historical, not current
];

// ---- v1 (shipped prototype) logic for comparison ----
const V1_OLD_ERA = /\bBC\b|\b([1-9]|1[0-8])th[- ]century/i;
const V1_BLOCK = /nazi|hitler|holocaust|september 11|abortion|terroris|genocide/i;
function v1(page){
  const title = page.title||"";
  const cats = (page.categories||[]).map(c=>c.title.replace(/^Category:/,""));
  const hay = title+" | "+cats.join(" | ");
  if(page.pageprops && "disambiguation" in page.pageprops) return false;
  if((page.length||0)<15000) return false;
  if(/living people/i.test(hay)) return false;
  if(V1_BLOCK.test(hay)) return false;
  for(const c of cats){
    if(/politic|election|political part/i.test(c) && !V1_OLD_ERA.test(c)) return false;
    if(/^Current /i.test(c)) return false;
    if(/\b20[0-2]\d\b/.test(c) && /championship|competition|tournament|season|olympic|cup\b|world cup|festival \d/i.test(c)) return false;
  }
  if(/\b20[0-2]\d\b/.test(title)) return false;
  return true;
}

let pass=0, fail=0; const v1Wrong=[];
for(const [name, page, expected] of FIXTURES){
  const r = evaluate(page);
  const ok = r.pass === expected;
  if(ok) pass++; else { fail++; console.log(`  ✗ FIXED ENGINE WRONG: ${name} — got ${r.pass} (${r.reason}), expected ${expected}`); }
  if(v1(page) !== expected) v1Wrong.push(`${name} — v1 says ${v1(page)}, rule says ${expected}`);
}
console.log(`\nFIXED ENGINE: ${pass}/${FIXTURES.length} fixtures correct, ${fail} wrong`);
console.log(`\nV1 (shipped prototype) rule violations found & now fixed: ${v1Wrong.length}`);
v1Wrong.forEach(w=>console.log("  • "+w));
process.exit(fail?1:0);
