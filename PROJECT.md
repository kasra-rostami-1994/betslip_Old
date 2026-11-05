# Betslip — Project Handoff (for an AI coding agent)

Read this whole file before making any change. It is written so a new agent (e.g. Claude in Cowork / Claude Code) can continue work without re-deriving the architecture or asking the owner to re-explain it. The owner communicates in **Persian**; the UI, all commit-style change summaries, and replies to the owner should be in Persian. Code, identifiers and comments in the codebase are a mix of English code with Persian comments/strings — keep that convention.

## 1. What this is

A personal sports-betting tracker ("Betslip") for one person (and now a small multi-user base) who places accumulator bets on **sportsbet.io** (stakes in USDT). The site:
- Lets the owner paste a bet slip's text (copied from sportsbet.io) or enter bets manually, and tracks each leg against live football results pulled from several public APIs.
- Colors each leg/bet by how it's trending (green=correct & finished, blue=live & on track, orange=live & borderline, red=wrong, gray=not started).
- Has a risk view (which live games threaten which bets), full statistics with time-range analysis and charts, a trash/archive system, daily automatic backups, a Telegram bot + push notifications, and the beginnings of a social layer (public profiles, leaderboard, score).
- Is hosted at **kasrarostami.ir** (personal site built with GitHub + Vercel). Betslip itself is deployed as its own Vercel project, reachable either as a subdomain (`betslip.kasrarostami.ir`, via a CNAME) or as a path (`kasrarostami.ir/betslip`, via `rewrites` in the main site's `vercel.json`/`next.config.js`). Both have been used across this project's history — check which one is currently wired up before assuming.

Current version: **2.0.0** ("Betslip Update 14"). The owner's convention: every shipped change gets a version bump and a one-line summary in the format `Betslip Update : x.y.z - Short Comma Separated List Of Changes (Betslip Update N)`, and a zip of the whole project named `Betslip Update N`. Keep following this convention unless the owner says otherwise.

## 2. Stack & hosting

- **No build step.** Plain HTML/CSS/vanilla JS on the client, plain Node.js serverless functions on the server (Vercel's `api/*.js` convention — each file exports `module.exports = async (req, res) => {...}`, not Express).
- **Database: Upstash Redis**, connected via Vercel's integration, accessed over its REST API (no Redis client library — a tiny `fetch`-based wrapper in `_lib.js`). The owner asked whether a separate database (MongoDB) was needed for the social features; the answer given and implemented was **no** — Redis hashes are enough at this scale, and it's deliberately kept inside the Vercel+Upstash setup.
- **Hosting: Vercel**, deployed from a **GitHub repo**. The owner has no local dev environment — every change ships as a zip they copy/paste (or re-upload) into GitHub via the web UI, so **always produce complete, ready-to-paste file contents, never diffs/patches the owner has to apply by hand.**
- **Live football results**: ESPN's undocumented public scoreboard API, Sofascore's undocumented API, football-data.org (needs free API key), API-Football (needs free API key, rate-limited so only called as a last resort and cached), TheSportsDB (free public key). All merged/voted on in `api/live.js`.
- **Telegram**: a bot (BotFather token) with a webhook (`api/telegram.js`) for on-demand commands, plus a separate polling/cron endpoint (`api/notify.js`) for push notifications, triggered externally (GitHub Actions workflow and/or cron-job.org) because Vercel's own cron on the Hobby plan is too coarse.
- **Font**: Yekan (Persian typeface), self-hosted as `public/fonts/Yekan.woff2` (MIT-licensed `typeface-yekan` npm package), loaded via `@font-face` in `app.css`.

## 3. Repository layout (current, after the v2.0.0 rewrite)

```
betslip/
├── vercel.json              # functions maxDuration config
├── package.json             # {"version": "2.0.0", node >=20, no real deps}
├── README.md                 # short ops notes (env vars, telegram setup, scoring formula)
├── .github/workflows/notify.yml   # optional: pings /api/notify every 5 min
├── api/                      # Vercel serverless functions
│   ├── _lib.js                # Redis REST client, auth/session helpers, profile helpers
│   ├── _core.js                # ⚠️ MUST stay byte-identical to public/core.js (see §5)
│   ├── _tg.js                  # shared Telegram helpers (send, analyze bets, matching)
│   ├── auth.js                 # POST /api/auth — signup/login/logout/change-password
│   ├── data.js                  # GET/PUT /api/data — per-bet diff sync (see §6)
│   ├── share.js                 # GET /api/share?t=TOKEN — public read of one shared bet
│   ├── profile.js               # GET/PUT /api/profile — profile, public profile, leaderboard
│   ├── settings.js               # GET/PUT /api/settings — Telegram config per user
│   ├── live.js                   # GET /api/live — merged live results from 5 sources
│   ├── notify.js                  # GET /api/notify — push-notification engine (cron-driven)
│   └── telegram.js                 # POST /api/telegram — bot webhook (on-demand commands)
└── public/                    # static site, no bundler — index.html loads these in order:
    ├── index.html               # shell; computes BASE, injects <script> tags for the rest
    ├── app.css                   # all styling (minimal/modern design, light+dark via CSS vars)
    ├── core.js                    # ⚠️ shared logic, identical to api/_core.js (UMD wrapper)
    ├── parse.js                    # sportsbet.io text-paste parser + bet-type picker list (CT)
    ├── store.js                     # network layer: api(), diff-based save/flush, live fetch
    ├── stats.js                      # statistics engine + inline SVG chart renderers
    ├── ui.js                          # all view-rendering functions (HTML-string based, no framework)
    ├── dlg.js                          # all <dialog> modals + their event bindings
    ├── app.js                          # router (hash-based), action dispatch table, boot/scheduler
    ├── sw.js                            # service worker (offline cache for static assets only)
    ├── manifest.webmanifest              # PWA manifest
    ├── icon-192.png / icon-512.png        # generated placeholder PWA icons
    └── fonts/Yekan.woff2, OFL-Yekan.txt    # self-hosted font + its license
```

There is **no build/bundle step** — `public/*.js` files are loaded as plain `<script>` tags in the order listed in `index.html`'s inline bootstrap script. They share one global scope (not modules), so load order matters and every top-level `const`/function name is effectively global across those files.

## 4. Deploying a change

1. Vercel project settings: **Root Directory** empty, **Framework Preset: Other**, Output Directory `public`.
2. Env vars (Vercel → Settings → Environment Variables):
   - `INVITE_CODE` — required for signup to be gated (set before anyone else can register).
   - `FOOTBALL_DATA_KEY`, `APIFOOTBALL_KEY` — optional, enable those two result sources.
   - `APIF_CACHE_SEC` — optional, default 600 (API-Football is heavily rate-limited on the free plan).
   - `CRON_SECRET` — required for `/api/notify` to accept scheduled (non-user) calls.
   - `SITE_BASE` — set to `https://kasrarostami.ir/betslip` (or whatever) **only if** the site is mounted on a subpath; omit if it's a subdomain.
   - `TIMEZONE` — default `Europe/Istanbul`, used for formatting times in Telegram messages.
   - Upstash Redis vars (`KV_REST_API_URL`/`KV_REST_API_TOKEN` or `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN`) — set automatically when you connect the Upstash integration in Vercel's Storage tab.
3. Because this ships via the GitHub web UI, when handing the owner a change: tell them to **delete and replace the whole repo content** for structural changes (like the v2.0.0 rewrite), or name the exact files to replace for smaller changes.
4. After any deploy that touches `CRON_SECRET`, `INVITE_CODE`, or other env vars, a **Redeploy** is required (Vercel doesn't hot-reload functions on env var changes mid-deploy in this setup's observed behavior).
5. Telegram webhook must be re-armed via the in-app "فعال‌سازی دستورات ربات" button (calls `settings.js` with `hook:true`, which calls Telegram's `setWebhook`) any time the base URL changes.

## 5. The shared Core module — critical invariant

`public/core.js` and `api/_core.js` **must be kept byte-identical**. It's a UMD module (works as both a `<script>` global `Core` object and a CommonJS `module.exports`) so the exact same bet-evaluation logic runs on the client (for instant UI feedback) and on the server (for the Telegram bot and notifier, which must agree with what the website shows). If you change one, copy the change to the other immediately. It currently exports: `fold, same, mt, chk, ev, pt1, pickTxt, lbl, fac, OCL, SN, gk, cons, betState, pts, settled, summary`.

Key functions inside it:
- `fold(name)` / `same(a,b)` / `mt(leg, liveEvent)` — fuzzy team-name matching (strips "FC", diacritics, etc.; also recognizes a hand-picked alias list like `crvena zvezda ↔ red star`, and filters out youth/reserve teams via a regex so e.g. "Viktoria Plzen U19" never matches a senior-team leg).
- `chk(pick, h, a)` — evaluates one pick code against a score. Returns `[matches, goalsNeededToFlip, monotonicDirection, asianOutcome]`.
- `ev(pick, liveState)` — turns `chk()`'s result plus the game's live/finished status into one of five UI colors: `g` (green, correct&done), `b` (blue, live&on-track), `o` (orange, live&close), `r` (red, wrong), `n` (gray, not started). Handles combo picks joined with `&` (all must hold).
- `cons(leg, liveEvents, now)` — resolves one leg's "current state": manual override (`leg.ov`) > saved final result (`leg.fin`) > majority vote across live sources that matched by team name. **Results are always 90-minute regulation time** unless the pick is `Q1`/`Q2` (qualification/progression bets, which use the actual match winner including ET/penalties) — this was an explicit, deliberate requirement from the owner (cup matches where regular-time result is what was bet on, not who advances).
- `betState(bet, liveEvents, now)` — full per-bet rollup: color counts, risk score, `finLoss` flag (true once a leg is both lost AND the match is over — this triggers auto-archiving), `cls` (one of `wr`/`near`/`ok`/`wait`/`won`/`lost` used for the active-tab filter pills).
- `pts(bet)` / `summary(records)` — the scoring formula for the leaderboard: **won bet = 10×ln(odds) points, lost bet = −5 points**. Owner said this formula is arbitrary and fine to tune later; it lives only in this one function.

### Pick-code reference (used throughout parsing, manual entry, evaluation, and display)

| Code | Meaning | Notes |
|---|---|---|
| `1` / `2` / `X` | home win / away win / draw | |
| `1X` / `X2` / `12` | double chance | |
| `O2.5` / `U3.5` | total goals over/under | half lines (x.5) exact; **also supports integer and quarter lines** (`O2.0`, `O2.25`) with proper half-win/half-loss/push settlement as of Update 11 |
| `HO1.5` / `HU1.5` / `AO0.5` / `AU0.5` | home/away team's own goals over/under | |
| `BY` / `BN` | both teams score / not both teams score | |
| `T3` | exact total goals = 3 | |
| `S2-1` | exact scoreline | |
| `AH1-1.5` / `AH2+0.5` | Asian handicap for home(1)/away(2), supports quarter handicaps | |
| `Q1` / `Q2` | home/away **progresses** (cup qualification) — uses full-time result incl. ET/pens, not 90-min | only addable via the manual game-by-game form, not the text parser |
| `A&B` (e.g. `1&O2.5`) | combo — every sub-pick must hold | |

## 6. Data model & sync protocol (why bets used to "disappear overnight" — now fixed)

**Root cause of the historical data-loss bug**: the pre-2.0 backend stored *all* of a user's bets as one giant JSON blob under one Redis key. Any two overlapping save requests (two tabs, a slow retry, a backgrounded tab finally flushing) could let a stale full snapshot overwrite a newer one, silently dropping bets added in between.

**Fix in `api/data.js` (current, v2.0)**:
- Each bet/trash record is stored as **its own field in a Redis hash**: `HSET betslip:b:<username> <betId> <json>`. There is no single blob to race over.
- The client (`store.js`) never does a full save — it computes a diff against its last-known snapshot (`SNAP`) and sends only `{up: [...changed records], rm: [...deleted ids]}` via `PUT /api/data`.
- Every write carries an `upd` timestamp. The server (`data.js`) compares it against the stored record's `upd` and **silently discards a write that's older than what's already there** — tested and confirmed this prevents the stale-overwrite class of bug.
- `store.js` also force-flushes synchronously on `pagehide`/tab-hide (not just the normal 500ms debounce), retries with backoff on failure, shows a sync-status dot in the header, and periodically `pull()`s + merges server-side changes back in (for multi-device use).
- A daily automatic server-side backup (`betslip:bak:<user>:<date>`, 14-day TTL) is taken on first save of each day; restorable (merge-only, never overwrites) from the profile menu.
- Manual JSON export/import still exists as a last resort.
- First load after this rewrite auto-migrates a user's old single-blob (`betslip:d:<user>`) into the new per-bet hash, once (`betslip:mig:<user>` guard key), non-destructively (old key is left alone).

### Record shapes (plain JS objects, no formal schema file — this *is* the schema)

**Bet** (one accumulator ticket):
```js
{
  id: "rid",                 // client-generated, see store.js rid()
  name: "multi 24",
  stake: 0.5, odds: 120.01, win: 60.0, cash: null,   // numbers; cash = sportsbet.io cash-out offer, optional
  tags: ["ریسکی"], note: "یادداشت",
  vis: "private" | "link" | "public",   // default from profile.dvis
  share: "24-hex-chars" | undefined,     // present iff vis != "private"; also the /api/share token
  created: 169..., upd: 169...,          // ms epoch; upd drives the stale-write check
  arch: 169...|undefined,                // set when archived (manually or auto)
  sett: 169...|undefined,                // settlement time, shown in history
  res: "won"|"lost"|"open"|undefined,
  auto: 1|undefined,                     // set if auto-archived due to a finished, lost leg
  keep: 1|undefined,                     // set after an "un-archive"; suppresses re-auto-archiving
  del: 169...|undefined,                 // presence = sits in trash; 30-day TTL enforced client-side
  legs: [ { home, away, pick, odds,
            lg: "league name"|undefined,       // filled in once a live match provides it
            fin: { h, a, w, t, lg }|undefined, // saved final result (90-min) once the match ends
            ov:  { h, a, m, f, w }|undefined,  // manual override: f=1 means "final", else "live" with minute m
            map: { h, a }|undefined            // manual team-name→live-event binding when auto-match fails
          }, ... ]
}
```
**Profile** (`betslip:prof` hash, one field per username): `{ u, name, bio, pub: bool, dvis: "private"|"link"|"public", joined, score, stats: {n, won, lost, roi}, upd }`.

**Sessions**: `betslip:sess:<token>` → username, 30-day TTL, bearer token in `Authorization: Bearer <token>` header (no cookies).

**Telegram config** (`betslip:tgc:<user>`): `{ token, chat, on, st, gl, en, sum, hs (webhook secret), base }`.

## 7. Server endpoints (all in `api/`, plain Node request handlers, not Express — no router library)

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/api/auth` | POST | none/session | `action`: `signup`\|`login`\|`logout`\|`passwd`. Rate-limited (15/15min per IP). `signup` needs `INVITE_CODE` to match if that env var is set. |
| `/api/data` | GET/PUT | Bearer | GET returns all records (triggers one-time legacy migration). PUT takes `{up, rm}` diffs. `?backup=YYYY-MM-DD` reads a daily backup. |
| `/api/share` | GET | none | `?t=token` → public-safe view of one bet (name/odds/legs only, never stake/cash/note/tags). |
| `/api/profile` | GET/PUT | mixed | `?board=1` → leaderboard (public profiles only). `?u=username` → that user's public profile + public bets. No query + Bearer → own profile (GET/PUT). |
| `/api/settings` | GET/PUT | Bearer | Telegram config. PUT with `hook:true` registers the Telegram webhook + bot command list. PUT with `test:true` sends a test message. |
| `/api/live` | GET | none | Merges ESPN (general + ~30 per-league queries), Sofascore, football-data.org, API-Football (`?apif=1` only), TheSportsDB. `?q=searchterm` → debug mode, returns raw matching events from all sources. |
| `/api/notify` | GET | CRON_SECRET or Bearer | The push-notification engine. Cron mode (`Authorization: Bearer CRON_SECRET` or `?key=`) loops every opted-in user. User mode (`?me=1`) runs once for the calling user — used by the in-app "run test" button. `?auto=1` is the quiet client-side ping (every ~55s while the tab is open and a live/soon game exists) that keeps notifications flowing without waiting on the external cron. Has a per-user idle-skip (`betslip:nx:<user>`) so it doesn't re-fetch `/api/live` for users with nothing live/soon — reduces Redis+API load. |
| `/api/telegram` | POST | webhook secret token | The bot. See §9. |

## 8. Client architecture (`public/*.js`, load order matters, no modules/bundler)

- **`store.js`**: `S` = the in-memory state singleton (`bets`, `trash`, `LV` live events, `prof`, `tg` config, `tok`/`me` from localStorage). `api(path, opts)` wraps fetch with the bearer token and 401-handling. `save()`/`flush()` = the diff-sync described in §6. `liveFetch()` only calls `/api/live` when there's something un-resolved to watch (`needLive()`), and escalates to `?apif=1` only if a leg stays unmatched after the cheap sources (`needMore` flag) — this bounds API-Football usage.
- **`stats.js`**: pure functions over `S.bets`, no DOM. `statRows(range)`/`legRows(range)` filter by time window; `kpis()` computes win-rate/ROI/streaks/drawdown; `lineChart()`/`barChart()` render inline `<svg>` (no chart library — kept dependency-free since there's no bundler). Persian-calendar month bucketing via `Intl` with `ca-persian`.
- **`ui.js`**: `U` = UI-state singleton (active tab, sort, filters, selection set for bulk actions, open/collapsed bet ids persisted to localStorage). One `v<Tab>()` function per view (`vBets`, `vRisk`, `vHist`, `vStats`, `vBoard`, `vMe`, `vUser`, `vShare`, `vTrash`), each returning an HTML string assigned to `#view`. `render()` is the single re-render entrypoint; `renderList()` is a cheaper partial re-render for the bets/history list only (used after small state changes to avoid re-rendering the whole page).
- **`dlg.js`**: all `<dialog>` modal markup (built once in `mountDialogs()`) and their internal logic — login/signup form, the bet editor (3 input modes: paste text / game-by-game form / line-based manual), manual result entry, cash-out calculator, manual game-matching picker, Telegram settings, backup browser.
- **`app.js`**: hash-based router (`#/bets`, `#/risk`, `#/hist`, `#/stats`, `#/board`, `#/me`, `#/u/<name>`; `?s=token` and `?u=name` query params handle shared-bet and public-profile deep links without a hash). `ACT` = a flat `{actionName: handler}` dispatch table; all clicks are delegated through one `document.addEventListener('click', ...)` reading `data-a="actionName"` attributes — **this is the pattern to extend**, don't add new one-off event listeners, add a new key to `ACT` and a `data-a="..."` attribute instead. The results-polling scheduler (`sched()`) adapts its interval (30s when something's live/imminent, 5min otherwise, paused when the tab is hidden) and also drives the quiet Telegram auto-notify ping.
- **No CSS framework** — `app.css` uses CSS custom properties for theming (auto light/dark via `prefers-color-scheme`), RTL-first (`dir="rtl"` on `<html>`), and includes safe-area insets for mobile PWA use.

## 9. Telegram bot (`api/telegram.js` webhook + `api/notify.js` cron)

Commands (all re-use `api/_core.js` so results match the website exactly): `/bets`, `/bet N|name`, `/live`, `/risk`, `/summary`, `/history [page]`, `/hbet N|name`, `/stats`, `/status` (shows last cron run + diagnostics), `/start`/`/help`. Inline keyboards let the owner tap a number instead of typing. The webhook is locked to one `chat_id` per user via a per-user secret token (`cfg.hs`), checked against Telegram's `X-Telegram-Bot-Api-Secret-Token` header — it will silently ignore messages from any other chat.

`notify.js` push types (each independently toggleable per user): kickoff, goal (with scorer/minute from ESPN when available, and VAR-disallowed-goal detection), full-time (flags if it went to ET), bet won/lost transitions, and a periodic full status digest (configurable 15/30/60 min or off) sent only while something is live or starting soon.

**Known-uncertain area, flagged for the next agent**: the owner reported automatic push notifications not firing reliably even after fixes in Updates 9 and 13. The v2.0 rewrite added idle-skipping and a lock, which *could* explain apparent "it's not running" symptoms if misread, but this was never confirmed against a real deployment+Telegram account from this side — **treat it as still open** until the owner confirms `/status` shows recent, successful cron runs with `sent > 0` during a live match.

## 10. Testing status — be honest with the owner about this

Every piece of this project was built and iterated **entirely inside a sandboxed container with no access to the owner's actual Vercel deployment, GitHub repo, or Telegram account.** Verification so far:
- `node --check` syntax validation on every file before every delivery.
- Unit tests (plain Node scripts, not committed to the repo) of `core.js`'s evaluation logic against hand-built score/time scenarios (regulation-time cutoffs, Asian quarter lines, combo picks, qualification bets, postponed/cancelled matches, youth-team false-matches).
- An end-to-end **jsdom** simulation (also not committed) that loads the real `public/*.js` files into a fake browser, drives the UI via real `click()`/`value=` DOM events (not by reaching into internal state), and confirmed: add-bet-via-paste → saves to a mocked server → renders correctly after expanding the card → live result matches and displays → edit flow → forced-save-on-tab-hide all work.
- A standalone test of `api/data.js`'s migration and stale-write-rejection logic against an in-memory Redis mock.
- **Never run against real Upstash Redis, real Vercel, real Telegram, or a real browser rendering the Yekan font.** The owner has been told this after every major delivery and asked to verify post-deploy. Keep doing that — don't claim something "works" beyond what was actually executed.

## 11. Feature/update history (condensed — for context on *why* things are the way they are)

1. Started as a single static `bet-dashboard.html` artifact (no backend) that parsed pasted bet-slip text and polled ESPN for live scores client-side with `localStorage` for manual overrides.
2. Rebuilt as a real Vercel+Upstash platform: accounts, server-stored bets, share links, archive/history, basic stats.
3. Progressively added: more live-result sources (Sofascore, football-data.org, API-Football, TheSportsDB) merged with majority-vote + source-name display; manual game-by-game bet entry with a full pick-code picker; 90-minute-regulation-time rule + qualification (`Q1`/`Q2`) exception; risk view (which live games threaten which active bets, sorted by severity, unstarted games pushed to the bottom); bet editing; bulk archive/delete; trash with 30-day recovery; auto-archiving of bets with a confirmed, finished losing leg (and hiding games that only appear in auto-archived bets from the risk view); tags & notes; cash-out calculator; monthly P/L chart + per-league stats; Telegram bot + push notifications (iteratively debugged — see §9); JSON export; parser hardening for live-in-progress score annotations in pasted text and for footer-line format variants.
4. **v2.0.0 ("Update 14")**: the big rewrite covered by this document — new UI/UX (Yekan font, minimal redesign), full statistics overhaul with time-range + chart analysis, per-bet diff-sync data layer (fixes data loss), daily auto-backups, user profiles with public/private/link-only bet visibility, a leaderboard/scoring system (foundation for the "see other users' stats" feature the owner wants to build out later), and `/history`+`/hbet`+`/status` Telegram commands.

## 12. Open items / explicitly requested next steps (from the owner, not yet done)

- Confirm real-world Telegram auto-notify reliability (see §9) — top priority, the owner has flagged this twice.
- Previously discussed but not yet built: trash-bin *undo toast* instead of requiring a trip to the trash tab; expanding the social layer (the owner wants, eventually, to let users compare stats with each other beyond the current read-only public profile/leaderboard — current `vis`/`profile` model is meant as the foundation for that, not the final feature); possibly a proper design-system pass per the frontend-design skill if one is ever run against this.
- The owner's house style for talking to them about this project: Persian language, concise but complete, be upfront about what was/wasn't actually tested, end feature-shipping replies with a one-line version/changelog summary, package deliverables as a zip named `Betslip Update N`.
