"# VibeScan — UX Proposals



Each proposal is labelled:
- **🎨 Design** — pure visual / interaction, no backend change.
- **🔧 Backend-dependent** — needs a new query parameter or endpoint.
- **🚀 Stretch** — larger scope, separate story.

---

## 1. Scans list (Dashboard > Recent Scans, future /scans page)

Current: 5-column table, no filters, fixed ordering (newest first), 10 rows fixed.

### 1.1 Column-header click to sort 🎨
Make `Target · Type · Status · Findings · Submitted` clickable. Chevron indicator
shows current direction. Default `Submitted DESC`. Multi-column sort via shift-click
(show second chevron).

- Keep the URL in sync: `/dashboard?sort=submitted:desc,findings:asc`. Sorts survive
  refresh.

### 1.2 Status filter row 🎨
Replace any future dropdown with the existing `ToggleChipGroup`:
`pending · scanning · done · error · cancelled` — all visible, click to toggle,
multi-select. Counts next to each chip (`done · 42`).

### 1.3 Inline fuzzy search 🎨
Small `⌘K`-style input above the table: `\"ft… \"` narrows to rows containing `ft`
in target/CVE/scan-id. Debounced 150ms. Badge shows matches/total.

### 1.4 Row-level \"Quick actions\" on hover 🎨
On hover, right-align: `↗ Open · ⏹ Cancel · ⟳ Re-run · 📋 Copy ID`.
Keyboard access: `j/k` to move, `Enter` to open, `x` to cancel, `c` to copy.

### 1.5 Saved views 🚀
Let the user save a filter+sort combination with a name (`\"Critical builds — last 7d\"`).
Persist in `User.uiPreferences.scanSavedViews`. Render as pill-tabs above the table
(`All · Critical builds · My team`). Mirror in URL for shareability.

### 1.6 Bulk actions 🚀
Checkbox column + \"N selected\" bar → `Cancel · Re-run · Export CSV/JSONL`.
Important for teams that want to bulk-cancel after a bad commit.

### 1.7 Column visibility 🎨
Small icon-button `⚙` opening a `ToggleChipGroup` of optional columns:
`Project · Branch · Commit · Author · Delta count · Duration`. Persists via
localStorage keyed by userId.

---

## 2. Report findings table (Reports page, per scan)

Current: 6-column table, no filters, no deep-links to CVE.

### 2.1 CVE deep-link to NVD + GHSA + MITRE 🎨
Every CVE cell becomes **two links**: the CVE id itself → GitHub Advisory (fast,
well-written), and a tiny `nvd.nist.gov` glyph for the primary source.

```tsx
<a href={`https://nvd.nist.gov/vuln/detail/${cve}`} target=\"_blank\" rel=\"noopener noreferrer\">
  {cve}
</a>
<a href={`https://github.com/advisories?query=${cve}`} …>GH</a>
```

Open in new tab, `rel=\"noopener noreferrer\"`. Add `title=\"\"` with hover-preview of
the first 200 chars of the description — reduces context-switch cost.

### 2.2 Package deep-links (ecosystem-aware) 🎨
Given `packageName` + `ecosystem` from finding, link to:
- npm → `https://www.npmjs.com/package/<name>`
- pypi → `https://pypi.org/project/<name>`
- maven → `https://central.sonatype.com/artifact/<group>/<artifact>`
- go → `https://pkg.go.dev/<path>`
- Docker → `https://hub.docker.com/_/<image>`

```tsx
<a href={ecosystemUrl(ecosystem, packageName)} target=\"_blank\"
   className=\"text-foreground hover:text-accent hover:underline\">
  {packageName}
</a>
```

### 2.3 Severity filter 🎨
Reuse `ToggleChipGroup` from Dashboard. Active/inactive states retain counts.
We already have the component; this is mostly wiring + query/local filtering.

### 2.4 \"Show only fixable\" toggle 🎨
Single `SegmentedControl` above the table: `All · Fixable · Unfixable`. Fixable =
`fixedVersion` is not null. High-utility for devs triaging what to bump in
`package.json`.

### 2.5 Group-by package 🚀
Switch table into a tree view: `lodash@4.17.20 [3 CVEs]` collapsible, expanding
shows CVE children. Reduces \"same package, 8 CVEs = 8 rows\" noise. Toggle via
`SegmentedControl` `Flat · By package · By severity`.

### 2.6 Copy-as patch 🎨
Icon next to fixed version: `📋 package.json patch`. Click copies
`\"lodash\": \"^4.17.21\"` in the ecosystem-native format (package.json, requirements.txt,
go.mod, etc.). Power-user killer feature.

### 2.7 Keyboard-first filter 🎨
`/` focuses search, `Esc` clears, `1..5` toggles severity chips (1=critical),
`f` toggles fixable-only. All shortcuts listed in a `?`-overlay.

### 2.8 Annotations (team reviews) 🚀
Each row can have `✅ accepted · ⏸ snoozed · ❌ rejected` state with optional note.
Persist in `VulnAcceptance` (already in `schema.prisma`). Appears as a badge
column, also drives `ci-decision` output.

---

## 3. Webhooks list

Current: flat list, no delivery history visible from UI.

### 3.1 Delivery timeline drawer 🔧
Click a webhook row → right-side panel opens (`<Sheet>` already in repo) with:
- Tabs: `Overview · Deliveries · Payloads · Settings`
- Deliveries tab: table of last 100 `WebhookDelivery` rows with
  `status_code · duration_ms · event · attempt / 5 · timestamp` and a
  status dot (green/red/yellow).
- Click a row → payload viewer with the request body, HMAC header, response.
  Useful for CI-side debugging.

### 3.2 \"Test delivery\" button 🔧
Fires a `webhook.test` event with a synthetic payload to the URL. Shows live
result inline. Backend needs `POST /api/v1/webhooks/:id/test`.

### 3.3 Event-type editor 🎨
Replace \"events: scan_complete, report_ready, scan_failed\" display with a
`ToggleChipGroup` inline on each row — edit subscribed events without opening
a separate form.

### 3.4 Status summary tile 🎨
Above the list: `12 active · 97% success rate · 3 failing (7d)`. Red count
clickable → filters to failing webhooks.

### 3.5 Resend delivery 🔧
Action on each failed delivery: \"Retry now\". Bypasses the 5-attempt backoff, useful
after fixing the receiver.

---

## 4. API keys list

### 4.1 Usage graph per key 🔧
Sparkline of `apiCallCount` over last 30 days in each row. Shows which keys are
actually used (vs forgotten CI jobs).

### 4.2 Scopes display 🎨
After A-02 fix adds `scopes`, render them as tiny chips:
`sbom_submit · scan_read`. Click to edit (where spec allows), otherwise read-only.

### 4.3 \"Restrict by IP / CIDR\" modal 🔧
For enterprise users: each key can be tied to source-IP allow-list. Modal with
`CIDR` input, validated with Zod. Shown as an IP-badge in the row.

### 4.4 Expiration countdown 🎨
Key rows with `expiresAt < 14 days away` → amber badge \"Expires in 5d · renew\".
Inline \"Rotate\" action generates a new key with same name/scopes and keeps the old
one active for a grace period.

---

## 5. New Scan

Already in \"Quiet Terminal\" style with 3 tabs. Further polish:

### 5.1 GitHub repo autocomplete 🔧
If user has connected GitHub App, type-ahead showing repos they have access to.
Avoids typing `anchore/grype` (and typos like `anchor/grype`).

### 5.2 SBOM paste from clipboard 🎨
Textarea alternative next to URL — paste CycloneDX JSON directly. Client-side
validates with `ajv` against bundled schema, shows a green pill `Valid CycloneDX
1.5` before submit. Failure details inline per JSON pointer.

### 5.3 ZIP dropzone with progress 🎨
Drag-drop the actual zip, show filename + size + hash + scanner estimate
(`~ 45 s`). Upload with progress bar. Abort button.

### 5.4 Scan presets 🚀
Top right: \"Run like my last scan…\" — dropdown with 5 most recent configurations.
Repetitive CI-dev ergonomics.

---

## 6. Scan details (timeline)

Already has pipeline stages. Improvements:

### 6.1 Real-time stage duration 🎨
Each stage shows `queued · 2.1s · free-scan 14.6s · commercial 22.3s · delta
1.4s`. Accumulates total at the top. Motivates users to see the value of Pro's
parallel scanner.

### 6.2 Logs drawer 🔧
Expand a stage → ANSI-coloured streaming logs (like GitHub Actions). Needs
server-side tailing of worker stdout into `ScanStageLog` table.

### 6.3 \"Share this scan\" 🎨
Copy a signed URL (`/share/<token>`) that gives read-only access to anyone for
24 h. Stripe-like tokenization. Useful for pasting into Slack threads.

---

## 7. Global

### 7.1 Command palette ⌘K 🚀
A single `cmdk`-style overlay (no extra deps: can be built on existing Radix
Dialog). Items:
- Navigate — Dashboard / New scan / Webhooks / API keys / Settings / Pricing
- Search scans — type id prefix, recent scans fuzzy-matched
- Actions — `New scan`, `Create API key`, `Toggle theme`, `Log out`
- Help — Keyboard shortcuts, status page, docs

`/` focuses table search only; `⌘K` opens the global palette. Classic Vercel
pattern, huge ergonomics win.

### 7.2 Keyboard shortcuts overlay 🎨
Press `?` anywhere → translucent panel listing context-aware shortcuts.
Self-documenting, no help-docs needed.

Skeleton version (even before shortcuts are wired):
- `?` opens a `<Dialog>`
- list shortcuts by context (Dashboard table, Reports table, global)

### 7.3 Toast / inline confirmation
`useToast` already in repo. Use consistently: scan submit, webhook create, key
revoke — right now some show alerts, some change page. Standardize.

### 7.4 Empty states with clear CTAs 🎨
Already added for Dashboard \"No scans yet\". Do the same for Webhooks, API keys,
Reports (no findings = \"Clean! This scan has no findings.\").

### 7.5 Error boundaries per route 🎨
Wrap each route in an `<ErrorBoundary>` that renders a branded
`Something crashed — 5xx · [Reload] [Report to us]` card instead of a blank
screen. React Router v7 offers `errorElement`.

### 7.6 Skeleton loaders 🎨
Replace `\"Loading scans…\"` text with actual skeleton rows (same layout, shimmering
gray blocks). Perceived performance +2×.

Notes:
- Replace \"Loading…\" strings on Dashboard / Reports / Scans
- Tiny CSS + a `<Skeleton>` component (already in `ui/`)

### 7.11 External-link icon helper 🎨
Add a small external-link helper for consistent `target=\"_blank\"` + `rel=\"noopener noreferrer\"`
and a tiny glyph. Implement as a `<Link>` React component in `VibeUI.tsx`, then reuse
it for 2.1/2.2/3/etc.

### 7.7 i18n readiness 🚀
Currently all strings are hardcoded English. Adopt `react-i18next`. Settings
already has `language: en/ru` via SegmentedControl; wire it up. Russian translation
comes for free since you speak it.

### 7.8 Status/health indicator in sidebar 🔧
Already added \"SCANNERS ONLINE\" pulse. Make it live from
`GET /api/v1/system/health` — green if all services OK, amber if CVE DB is >24h
stale, red if a scanner is down. Clickable to status page.

### 7.9 Session-activity log (user side) 🔧
Settings > Activity: last 20 sessions — IP, user-agent, first-seen. Standard
enterprise-grade feature. Requires `SessionLog` model.

### 7.10 Accessibility pass 🎨
- Every severity chip already has text alternative ✓
- Every `<button>` has `aria-label` when icon-only — audit remaining ones
- `focus-visible:` ring using `--accent` color — uniform across all clickable
- `prefers-reduced-motion: reduce` → disable `animate-sweep`, `animate-ping`
- Color contrast: check `text-muted-foreground` on `card/60` meets WCAG AA
  (currently borderline in some light-mode states)

---

## 8. Deep linking cheat-sheet (reference)

| Target | URL template | Notes |
|---|---|---|
| CVE details (NVD) | `https://nvd.nist.gov/vuln/detail/{cve}` | Primary source, authoritative |
| CVE on GitHub Advisory | `https://github.com/advisories?query={cve}` | Better remediation advice |
| CVE on MITRE | `https://www.cve.org/CVERecord?id={cve}` | Deprecated but still cited |
| CVSS calculator | `https://www.first.org/cvss/calculator/3.1#{vector}` | Re-score with context |
| EPSS | `https://api.first.org/data/v1/epss?cve={cve}` | Probability of exploitation |
| KEV (known exploited) | `https://www.cisa.gov/known-exploited-vulnerabilities-catalog` | List, not per-CVE |
| npm pkg | `https://www.npmjs.com/package/{pkg}` | |
| npm version | `https://www.npmjs.com/package/{pkg}/v/{ver}` | |
| PyPI pkg | `https://pypi.org/project/{pkg}/{ver}/` | |
| Go module | `https://pkg.go.dev/{path}@{ver}` | |
| Maven Central | `https://central.sonatype.com/artifact/{grp}/{art}/{ver}` | |
| Docker Hub | `https://hub.docker.com/_/{image}` | |
| GitHub repo | `https://github.com/{owner}/{repo}` | also `/security/dependabot` |

Render as `<a target=\"_blank\" rel=\"noopener noreferrer nofollow\">` with a small
external-link icon (`<SquareArrowOutUpRight size={10}/>`).

---

## Prioritisation

| Batch | Items | Effort | Impact |
|---|---|---:|---|
| **Q-1 \"First impression\"** | 1.1, 1.2, 2.1, 2.2, 2.3, 2.4, 7.6, 7.4 | 1-2 days | Dashboard & Reports feel **alive** instantly |
| **Q-2 \"Power users\"** | 1.3, 1.4, 2.6, 2.7, 7.1, 7.2 | 2-3 days | CI/DevSecOps crowd retention |
| **Q-3 \"Team features\"** | 1.5, 1.6, 2.8, 3.1, 3.2, 3.5 | 4-5 days | Enterprise deals start making sense |
| **Q-4 \"Polish\"** | 7.3, 7.5, 7.10 | 1-2 days | Standards compliance |
| **Q-5 \"Growth\"** | 5.1, 5.2, 5.4, 6.3, 7.7 | 1-2 weeks | Shareability + conversion |

---

## What I can land today if greenlit

Small, reviewable commits on this branch:

1. **CVE + package deep-links in Reports table** (§2.1 + §2.2). Pure JSX change,
   10-15 LOC in `ReportsPage.tsx`. Makes the report **useful** instantly.
2. **Sortable column headers for Recent Scans on Dashboard** (§1.1). Client-side
   sorting; URL sync. ~40 LOC.
3. **Skeleton loaders** replacing \"Loading…\" strings on Dashboard / Reports / Scans. Tiny CSS + a `<Skeleton>` component already in `ui/`.
4. **Severity filter ToggleChipGroup on Reports** (§2.3) — we already built the
   component, just wire it.
5. **External-link icon helper** — a `<Link>` React component in `VibeUI.tsx`
   that renders target=_blank + rel=noopener + small glyph, used by 2.1/2.2/3/etc.
6. **Keyboard-shortcuts overlay skeleton** (§7.2) — `?` opens a `<Dialog>`,
   lists shortcuts by context. Even before shortcuts are wired, the overlay is
   the docs.
