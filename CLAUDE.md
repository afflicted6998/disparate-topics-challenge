# Disparate Topics Challenge — deployment runbook

Slot machine that draws 3 unaffiliated Wikipedia topics for a writing challenge
(The Den / Substack). Single static HTML app, no build step, no backend required.
Owner: Steve. Voice: get it live, don't over-engineer.

## Repo contents
- `index.html` — the entire app (Wikipedia API client-side, all rules inline)
- `museum/index.html` — West Annex: "The Museum of Needless Connection" (same live
  Wikipedia engine + separation checks re-skinned as an acquisitions committee /
  gallery / curator's desk; also mirrors the rules inline — search `OLD_ERA`)
- `tools/filters.mjs` — rules engine, SOURCE OF TRUTH (index.html AND
  museum/index.html mirror it; keep all three in sync)
- `tools/n8n-resident-essayist.json` — importable n8n workflow: webhook →
  Claude API → JSON reply, powers the museum's AI essay commission (Steve
  imports it on the Hostinger VPS n8n, adds his Anthropic key as a Header
  Auth credential, pastes the production URL into the museum bylaws or
  hardcodes it as `#essayistUrl`'s value=)
- `tools/test-filters.mjs` — 35 fixture rules audit (`node tools/test-filters.mjs`)
- `tools/smoke-test.mjs` — headless spin engine, offline + LIVE modes

## Step 1 — GATE: live smoke test (do this first, machine has open network)
```
node tools/test-filters.mjs
node tools/smoke-test.mjs --spins 50 --minsep 4     # LIVE Wikipedia, ~30-60s/spin
```
Already passed offline (50/50, 0 violations, exact BFS). The live run validates
real category shapes and API behavior. If any violation prints, fix the rule in
`tools/filters.mjs`, re-run tests, then mirror the exact same change into the
inline copy in `index.html` (search for `OLD_ERA`). Report violations to Steve
before deploying. If Wikipedia rate-limits, add `--spins 15` and note it.

## Step 2 — Git
```
git init && git add -A && git commit -m "Disparate Topics Challenge v1"
gh repo create disparate-topics-challenge --public --source=. --push
```
(Public repo required only if using GitHub Pages. Ask Steve for the repo name
preference; default above is fine.)

## Step 3 — Deploy (Steve chose the Hostinger VPS; Pages is the fallback)
### Option A: Hostinger VPS (Steve's preference)
The VPS already runs n8n (Hostinger KVM, Ubuntu). DISCOVER BEFORE CHANGING:
```
ssh <user>@<vps>
docker ps                          # n8n likely containerized, maybe behind traefik/caddy
systemctl status nginx caddy 2>/dev/null
ss -tlnp | grep -E ':80|:443'
```
- If a reverse proxy exists (traefik/caddy/nginx): add a vhost/site for a
  subdomain (ask Steve which domain — e.g. `spin.<his-domain>`) serving the
  repo's static files. `git clone` into `/var/www/dtc` (or a bind-mounted dir),
  point the proxy at it, TLS via existing certbot/caddy automation.
- If ports 80/443 are FREE: `apt install caddy`, Caddyfile:
  `spin.example.com { root * /var/www/dtc  file_server }` — Caddy handles TLS.
- DNS: A record for the subdomain → VPS IP (Steve does this in his registrar).
- Update path: `cd /var/www/dtc && git pull` (optionally a deploy webhook later).
- DO NOT touch the n8n container, its proxy rules, or its ports.

### Option B: GitHub Pages (zero-maintenance fallback)
`gh api` or Settings → Pages → deploy from main → done. URL:
`https://<user>.github.io/disparate-topics-challenge/`

## Step 4 — Google Sheet logging (manual, Steve's Google account, ~2 min)
Claude Code cannot do this part (browser auth). Steve:
1. New Google Sheet → Extensions → Apps Script → paste (also shown inside the app):
```
function doPost(e){
  var s = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var d = JSON.parse(e.postData.contents);
  s.appendRow([new Date(), d.t1, d.u1, d.t2, d.u2, d.t3, d.u3, d.minSep, d.mode]);
  return ContentService.createTextOutput('ok');
}
```
2. Deploy → New deployment → Web app → execute as Me, access: Anyone → copy URL.
3. Paste URL into the app's Settings panel. (Header row: timestamp, t1, u1, t2, u2, t3, u3, minSep, mode.)

STATUS (2026-07-03): done — deployed live at
https://afflicted6998.github.io/disparate-topics-challenge/. Steve chose to
hardcode the webhook URL as the default value of `#sheetUrl` in index.html so
ALL public visitors log to his one shared sheet automatically (no per-visitor
setup). If the webhook URL ever changes, update the `value=` attribute on the
`#sheetUrl` input in index.html and re-push.

## Step 5 — VERIFY after deploy
Open the public URL: badge must read "LIVE · EN.WIKIPEDIA" (demo badge means
CSP/network problem). Pull the lever twice; confirm a sheet row appears if
logging is wired.

## Later (only if sampled depth-3 checks prove leaky in practice)
Exact 4+ click verification via Six Degrees of Wikipedia:
- github.com/jwngr/sdow — precomputed SQLite of the full link graph (several GB;
  check current dump size vs VPS disk before committing).
- Run its search as a small HTTP service on the VPS; add a fetch-with-fallback
  in index.html's `checkSeparation` (try sdow endpoint, fall back to current
  client-side check). Keep same-origin or CORS-open on the subdomain.

## Rules the app enforces (context)
No living people; no politics/politicians/parties active in the last ~100 years
(pre-1900, ancient, medieval allowed — 1900–1926 is over-blocked by design since
century categories can't split it); no Nazis/9-11/abortion/genocide/terrorism/
covid (editable blocklist; wars allowed); no current events (recent-year titles,
year+event categories); 3,000+ words verified against full text (raised from
2,000 on 2026-07-03 — sampling showed ~40% of otherwise-eligible articles clear
2,000 words vs ~24% for 3,000; still a large absolute pool); no two topics
sharing a category; every pair ≥ minSep clicks apart in either link direction
(1–2 exact, 3 sampled client-side). "Don't pre-solve" is human-enforced via
per-reel respin buttons.
