# CP Platform — Frontend Design System & Build Prompt

**Vibe target:** ranked matchmaking lobby (CS:GO / Valorant) × terminal-hacker aesthetic × fantasy sports draft-night tension.

---

## Part 1: Design & Aesthetic Concept

### Core Visual Language

**Color Palette (dark-mode only — this app should never have a light mode)**

| Token | Hex | Use |
|---|---|---|
| `--bg-void` | `#0A0A0F` | App background, near-black with a blue tint |
| `--bg-panel` | `#13131A` | Cards, panels, editor chrome |
| `--bg-panel-raised` | `#1C1C26` | Hovered/active panels |
| `--border-hairline` | `#2A2A38` | 1px dividers |
| `--accent-primary` | `#00FF9C` | "Ranked green" — CTAs, win states, live indicators |
| `--accent-danger` | `#FF3B5C` | Losses, timers under pressure, errors |
| `--accent-warn` | `#FFB800` | Warnings, pending states, TLE |
| `--accent-electric` | `#7B61FF` | Rank/ELO branding, secondary accent |
| `--text-primary` | `#F2F2F5` | Headlines |
| `--text-secondary` | `#8A8A9A` | Metadata, labels |
| `--text-mono` | `#C9D1D9` | Code text |

Rule of thumb: **green = you're winning/ready, red = pressure/danger, purple = identity/rank, everything else is desaturated near-black.** This restraint is what makes it read "esports HUD" instead of "children's app."

**Typography**
- Headlines / big numbers (ELO, timers): a tabular/monospaced display face — `JetBrains Mono` or `Space Mono` for numerals so digits don't jitter in width as they tick.
- UI labels: `Inter` or `Geist Sans`, uppercase, letter-spacing `0.05em`, small (11–12px) — gives that "HUD readout" feel.
- Code editor: `JetBrains Mono` / `Fira Code` with ligatures.

**Motion Philosophy**
- Nothing eases gently. Competitive UIs snap. Use `cubic-bezier(0.16, 1, 0.3, 1)` (expo-out) for entrances and short linear/steep curves for countdowns.
- Numbers should feel like they're being *clocked*, not fading in — use tick/odometer-style transitions for ELO and timers, not opacity fades.
- Glow, not gradient-soup. A single `box-shadow` bloom on the accent color communicates "live/active" better than a busy gradient background.

---

### 1. The Lobby / Dashboard

**Layout:** 3-zone grid, desktop-first but built as stacked flex sections so it collapses cleanly to RN's `View` stacks.

```
┌─────────────────────────────────────────────────────────┐
│  TOP BAR: logo · season timer · notifications · avatar   │
├───────────────┬───────────────────────┬──────────────────┤
│  RANK CARD    │   FIND MATCH (hero)   │   LEADERBOARD     │
│  (ELO, tier   │   massive pulsing     │   live ranks,     │
│   badge,      │   button + queue      │   scrollable,     │
│   win/loss)   │   mode selector       │   your row pinned │
├───────────────┴───────────────────────┴──────────────────┤
│  RECENT MATCHES strip (horizontal scroll of result chips) │
└─────────────────────────────────────────────────────────┘
```

- **Rank Card**: big monospace ELO number (e.g. `2147`), a tier badge (Bronze → Global Elite-style naming: e.g. "Silver II", "Master", "Grandmaster") rendered as an angular clipped-corner shape (`clip-path: polygon(...)`), a thin animated progress bar to next rank.
- **Find Match button**: this is the hero. Full-height in its column, black background, `border: 2px solid var(--accent-primary)`, huge uppercase label "FIND MATCH", with an idle `animate-pulse` glow (`box-shadow: 0 0 40px rgba(0,255,156,0.3)`), and a mode toggle chip row above it (1v1 Ranked / 1v1 Casual / Blitz 5-min).
- **Leaderboard**: dense table, monospace rank numbers, small country/avatar, ELO delta arrows (green ▲ / red ▼) that flash briefly on live updates via Kafka-driven websocket push.
- **Recent matches strip**: small rectangular chips, green left-border for win / red for loss, hover reveals opponent + problem name.

Tailwind sketch:
```jsx
<button className="group relative w-full h-full rounded-lg border-2 border-emerald-400
  bg-black uppercase tracking-widest font-mono text-3xl text-emerald-400
  shadow-[0_0_40px_rgba(0,255,156,0.25)]
  hover:shadow-[0_0_70px_rgba(0,255,156,0.5)] hover:scale-[1.02]
  transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]">
  <span className="absolute inset-0 rounded-lg animate-pulse bg-emerald-400/5" />
  Find Match
</button>
```

---

### 2. The Matchmaking Queue

This screen exists purely to build tension — treat it like a "searching for lobby" screen in a shooter.

- **Full-bleed takeover modal/screen**, background dims to near-black with a subtle animated scanline or radar-sweep SVG behind the content (low opacity, slow rotation — `animate-spin` at `duration: 8s`).
- **Center**: large monospace elapsed timer (`00:47`), ticking every second, color shifts from `text-secondary` → `text-warn` → `text-danger` the longer it runs (e.g. thresholds at 30s / 90s) to subtly pressure the user.
- **Below timer**: "Searching for opponent within ±150 ELO..." text that widens the range every N seconds (mirrors real matchmaking, gives system credibility).
- **Cancel button**: ghost/outline style, deliberately understated so it doesn't compete with the hero timer.
- **Match Found interrupt**: when the websocket event lands, don't transition softly — hard-cut with a full-screen flash (`bg-emerald-400` at 80% opacity for ~120ms, then fade) plus a screen-shake style CSS transform (`translateX` micro-jitter, 2–3 keyframes) and a slam-in modal:
  - Both players' avatars/handles slide in from opposite edges toward center ("VS" glyph between them).
  - ELO numbers count up/down rapidly (odometer effect) to show the stakes.
  - Auto-dismiss into the Battleground after ~2.5s, or an "Accept" button if you want a ready-check step.

```jsx
<div className="fixed inset-0 bg-emerald-400 animate-[flash_0.15s_ease-out]" />
```
```css
@keyframes flash { 0% { opacity: 0.9 } 100% { opacity: 0 } }
@keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-4px)} 75%{transform:translateX(4px)} }
```

---

### 3. The Battleground

The workhorse screen — needs to feel like a cockpit, not a form.

**Layout (desktop):**
```
┌───────────────────────────────────────────────────────────┐
│ HEADER: opponent handle+ELO | LIVE TIMER (center) | you    │
├────────────────────┬──────────────────────────────────────┤
│                     │  editor toolbar (lang select, run,   │
│  PROBLEM PANEL      │  submit)                              │
│  (scrollable,       ├──────────────────────────────────────┤
│  statement,         │                                       │
│  constraints,       │      CODE EDITOR (Monaco)             │
│  sample I/O)        │                                       │
│                     ├──────────────────────────────────────┤
│                     │  CONSOLE / TEST RESULTS (tabs:        │
│                     │  Output · Test Cases · Opponent feed) │
└────────────────────┴──────────────────────────────────────┘
```

- **Split-screen**: 40/60 or resizable pane (`react-resizable-panels`), problem left, editor+console right. On mobile/RN this collapses into a tab switcher (Problem / Code / Console) rather than a split — plan the component boundary now so it's a layout swap, not a rewrite.
- **Live timer**: top-center, huge monospace countdown, identical color-pressure logic as the queue screen (green → amber under 5min → red pulsing under 1min, with an actual `animate-pulse` at the very end).
- **Opponent presence**: subtle "live" indicator — not their code (no cheating vectors), just a status chip: "Opponent: Testing..." / "Opponent: Submitted ✅" driven by Kafka events over the websocket. This is your core tension mechanic — use it.
- **Console**: terminal-styled, black background, monospace, color-coded verdicts inline (`Accepted` green, `Wrong Answer` red, `TLE` amber, `Runtime Error` red), each test case as a collapsible row with expected vs actual diff.
- **Submit button**: distinct from "Run" — Run is neutral/outline, Submit is the danger-accent (red-orange) because it's irreversible, matching the "high stakes" framing.

```jsx
<div className="font-mono text-5xl tabular-nums tracking-tight
  text-emerald-400 data-[warn=true]:text-amber-400 data-[danger=true]:text-red-500
  data-[danger=true]:animate-pulse">
  04:12
</div>
```

---

### 4. The Aftermath

- **Full-screen verdict takeover**: giant "VICTORY" (green, slight scale-in bounce) or "DEFEAT" (red, harder/flatter entrance — no bounce, defeat shouldn't feel bouncy).
- **ELO delta animation**: your rank card reappears with the old ELO number, then a monospace odometer-rolls from old → new value over ~1.2s, arrow and color indicating direction, tier badge does a flip/glow if you ranked up.
- **Match summary**: time taken, opponent's result, head-to-head diff of approach (language used, attempts count) — small stat chips, not a wall of text.
- **CTAs**: "Rematch," "Find Next Match," "Review Solution" — Find Next Match reuses the hero button styling from the Lobby to pull the player straight back into the loop (this is the retention hook, treat it with the same visual weight as the original Find Match button).

---

## Part 2: GitHub Copilot Chat Prompt

Copy everything in the code block below into VS Code Copilot Chat (works well as an `@workspace` or agent-mode prompt).

```
Act as a senior React/React Native frontend architect. I'm building a competitive programming
matchmaking platform (backend already exists: Node.js, PostgreSQL/TypeORM, Kafka, sandboxed
code executors — you don't need to touch backend code). Generate the FRONTEND scaffolding
described below, using React + TypeScript + Tailwind CSS, structured so components can be
ported to React Native later with minimal rewrites (shared hooks/state logic, platform-specific
presentational components).

DESIGN SYSTEM TO IMPLEMENT:
- Dark-mode only. Background #0A0A0F, panels #13131A, hairline borders #2A2A38.
- Accent colors: primary/win = #00FF9C (emerald), danger/loss = #FF3B5C, warning = #FFB800,
  identity/rank = #7B61FF.
- Fonts: JetBrains Mono for numerals/code/timers (tabular-nums), Inter for UI labels
  (uppercase, tracking-wide, small).
- Motion: expo-out easing (cubic-bezier(0.16,1,0.3,1)) for entrances, odometer/tick-style
  transitions for numbers (ELO, timers) rather than opacity fades, pulsing glow via box-shadow
  on active/live elements.

SCREENS TO SCAFFOLD:

1. LobbyDashboard
   - RankCard (ELO number, tier badge, progress-to-next-rank bar)
   - FindMatchButton (hero CTA, pulsing glow idle animation, mode selector chips:
     Ranked 1v1 / Casual / Blitz)
   - LeaderboardPanel (virtualized list, live ELO delta arrows, "you" row pinned/highlighted)
   - RecentMatchesStrip (horizontal scroll, win/loss color-coded chips)

2. MatchmakingQueue
   - QueueTimer (ticking elapsed time, color escalates: secondary -> warn -> danger at
     configurable thresholds)
   - QueueStatusText (widening ELO search range message)
   - MatchFoundModal (slam-in entrance, opposing player cards sliding from edges,
     ELO odometer count, auto-transition after ~2.5s or manual Accept button)
   - Uses a WebSocket connection to listen for a `match_found` event

3. Battleground
   - BattlegroundHeader (both players' handles/ELO, centered LiveTimer with color-pressure
     states and pulsing animation under 1 minute)
   - ProblemPanel (scrollable statement, constraints, sample I/O — collapsible sections)
   - CodeEditorPane (Monaco editor wrapper, language selector, Run vs Submit buttons
     visually distinct — Run = neutral outline, Submit = danger-accent)
   - ConsolePanel (tabbed: Output / Test Cases / Opponent Status; verdict color coding:
     Accepted=green, Wrong Answer=red, TLE=amber, Runtime Error=red; collapsible per-test-case
     diff rows)
   - OpponentStatusChip (live "Testing... / Submitted" indicator driven by Kafka-sourced
     websocket events — no code content, just status)
   - Layout: resizable split-pane on desktop (40/60), tab-switcher layout on mobile/narrow
     viewports — implement as a single responsive component, not two separate ones

4. AftermathScreen
   - VerdictBanner (VICTORY bounce-in green / DEFEAT flat-in red, full-screen takeover)
   - EloDeltaAnimation (odometer roll from old ELO to new ELO over ~1.2s, directional
     arrow + color, tier-up flip/glow state)
   - MatchSummaryStats (time taken, language used, attempt count, opponent result — as chip
     row, not paragraph text)
   - CTARow (Rematch / Find Next Match / Review Solution — Find Next Match reuses
     FindMatchButton styling)

TECHNICAL REQUIREMENTS:

- File structure: organize under /src/screens/{Lobby,Queue,Battleground,Aftermath}/ with each
  screen's subcomponents colocated, plus /src/components/shared/ for cross-screen primitives
  (Button, Badge, GlowPanel, OdometerNumber, Timer).
- State management: 
  - Use a WebSocket context/provider (`RealtimeProvider`) wrapping the app, exposing typed
    events for `queue_status`, `match_found`, `opponent_status`, `elo_update`, `match_result`
    (mirroring Kafka topics on the backend) via a `useRealtimeEvent(eventName, handler)` hook.
  - Build a `useCountdownTimer(durationSeconds, onExpire)` hook for the Battleground timer and
    a `useElapsedTimer()` hook for the Queue screen, both returning formatted mm:ss and a
    `pressureLevel` ('normal' | 'warn' | 'danger') for styling.
  - Build a `useOdometerValue(targetValue, durationMs)` hook for animating ELO/number changes.
  - Code editor state: local component state for current code buffer + language, debounced
    "draft save" callback stub (I'll wire the actual persistence endpoint separately).
  - Keep all this in React Context + hooks (no Redux) — but structure state logic in
    plain hooks/functions decoupled from JSX so they're reusable in React Native screens later.
- Styling: Tailwind CSS only, define the color palette above as custom Tailwind theme tokens
  in tailwind.config, and add the JetBrains Mono / Inter fonts.
- Add basic TypeScript types/interfaces for: Player, MatchState, Problem, TestCaseResult,
  QueueState.
- Stub out API/WebSocket calls with clear TODO comments and mock data so components render
  and animate correctly in isolation before backend wiring.
- Do not implement actual Monaco editor logic beyond a wrapper component with props — assume
  I'll install @monaco-editor/react separately.

Generate the file tree first, then the code for each file, starting with the shared hooks and
Tailwind config, then shared components, then each screen in the order listed above.
```
