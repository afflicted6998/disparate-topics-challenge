# The Disparate Topics Challenge — Slot Machine
Pull the lever, get 3 genuinely unaffiliated Wikipedia topics, write 3,000+ words.
A citizen-science writing experiment from The Den.

**West Annex:** `museum/index.html` — **The Museum of Needless Connection**, a fusion
with the Museum of Needless Conviction. The same live Wikipedia engine becomes an
"acquisitions committee" that hangs three certified-unrelated artifacts on a gallery
wall; you're the guest curator who must connect them. Includes an exhibition-thesis
generator, a Certificate of Unrelatedness (real separation evidence), and a curator's
desk that drafts, autosaves, and promotes you as you approach 3,000 words.

**Resident Essayist (AI-generated essays):** the annex's desk can commission a
≤500-word factually-grounded essay tying the three acquired topics together, for
editing or filing straight into the permanent collection — where every filed
exhibition hangs as a framed pull-quote (click to read the full essay). Because
the site is static, the Claude API key must live server-side: import
`tools/n8n-resident-essayist.json` into the existing n8n instance, add an
Anthropic header-auth credential, activate, and paste the production webhook URL
into the museum's committee bylaws (or hardcode it as `#essayistUrl`'s `value=`).
Contract: `POST {topics:[a,b,c], maxWords:500}` → `{essay, quote}`, CORS open.
No n8n? Any keyholder works — a Google Apps Script proxy or Cloudflare Worker
speaking the same contract. Note: the permanent collection is per-visitor
(localStorage); a shared public essay wall would need a read/write store (the
n8n workflow is the natural place to add sheet logging + a GET feed later).

**Run it:** open `index.html` in any browser (or visit the hosted URL). No build, no backend.
**Test it:** `node tools/test-filters.mjs` · `node tools/smoke-test.mjs --offline --spins 50`
**Live smoke test:** `node tools/smoke-test.mjs --spins 50 --minsep 4`
**Deploy:** see `CLAUDE.md`.
