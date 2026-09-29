// DashboardLayout.jsx
// Layout skeleton: "Command Deck" architecture.
//
//  lg+ (height-locked, nothing stretches, nothing leaves dead space)
//
//  ┌───────────────────────────────┬──────────────┐
//  │  MATCHMAKING (hero strip)     │              │
//  ├───────────────┬───────────────┤  RECENTLY    │
//  │  LOBBIES      │  LIVE MATCHES │  PLAYED      │
//  │  (scrolls)    │  (scrolls)    │  (tall rail, │
//  │               │               │   scrolls)   │
//  ├───────────────┴───────────────┴──────────────┤
//  │  TOPICS (dense wrap, capped, scrolls)        │
//  └──────────────────────────────────────────────┘
//
//  < lg: single column, every list panel gets a fixed height.

/* Shared panel shell: header never scrolls, body always does. */
function Panel({ title, action, className = "", bodyClassName = "", children }) {
  return (
    <section
      className={`flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-zinc-900/60 backdrop-blur ${className}`}
    >
      <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
        <h2 className="text-sm font-semibold tracking-wide text-zinc-100">{title}</h2>
        {action}
      </header>
      <div className={`min-h-0 flex-1 overflow-y-auto ${bodyClassName}`}>{children}</div>
    </section>
  );
}

export default function DashboardLayout() {
  return (
    <div className="mx-auto w-full max-w-[1400px] p-6">
      {/* Height-locked on desktop so the three rows divide the viewport predictably.
          min/max clamps keep it sane on very short or very tall screens. */}
      <div
        className="
          grid gap-4
          lg:h-[calc(100dvh-3rem)] lg:min-h-[720px] lg:max-h-[940px]
          lg:grid-cols-12 lg:grid-rows-[auto_minmax(0,1fr)_auto]
        "
      >
        {/* 1. MATCHMAKING ACTIONS — hero strip, top-left, 8 cols */}
        <section
          className="
            relative overflow-hidden rounded-xl border border-white/10 bg-zinc-900/80 p-5
            lg:col-span-8 lg:row-start-1
          "
        >
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
            {/* Left: mode toggles + the big button */}
            <div className="flex flex-col gap-4">
              <div className="inline-flex w-fit gap-1 rounded-lg bg-black/40 p-1">
                {/* <!-- Mode Toggle: Ranked / Casual / Blitz --> */}
              </div>
              <div className="h-24 md:h-28">
                {/* <!-- Find Match Button (w-full h-full) --> */}
              </div>
            </div>

            {/* Right: secondary actions, stacked on desktop, side by side on mobile */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-1 md:grid-rows-2">
              {/* <!-- Join Lobby Button --> */}
              {/* <!-- Create Custom Match Button --> */}
            </div>
          </div>
        </section>

        {/* 2. PUBLIC LOBBIES — row 2, left half of the 8-col stack */}
        <Panel
          title="Public lobbies"
          className="max-lg:h-[360px] lg:col-span-4 lg:row-start-2"
          bodyClassName="p-2"
        >
          {/* <!-- Public Lobbies List Items --> */}
        </Panel>

        {/* 3. LIVE MATCHES — row 2, right half of the 8-col stack */}
        <Panel
          title="Live matches"
          className="max-lg:h-[360px] lg:col-span-4 lg:col-start-5 lg:row-start-2"
          bodyClassName="p-2"
        >
          {/* <!-- Live Matches List Items --> */}
        </Panel>

        {/* 4. RECENTLY PLAYED — tall right rail spanning rows 1–2.
            Stretches to the combined height of hero + lists, so the
            columns end flush at the same line. */}
        <Panel
          title="Recently played"
          className="
            max-lg:h-[420px]
            lg:col-span-4 lg:col-start-9 lg:row-span-2 lg:row-start-1
          "
          bodyClassName="p-2"
        >
          {/* <!-- Recently Played List Items --> */}
        </Panel>

        {/* 5. TOPICS EXPLORER — full-width dock along the bottom.
            Height is capped: tags wrap densely, extra rows scroll. */}
        <section
          className="
            flex min-h-0 flex-col overflow-hidden rounded-xl border border-white/10 bg-zinc-900/60
            lg:col-span-12 lg:row-start-3
          "
        >
          <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
            <h2 className="text-sm font-semibold tracking-wide text-zinc-100">Topics</h2>
            {/* <!-- Optional: topic search input --> */}
          </header>
          <div className="max-h-[132px] overflow-y-auto p-3">
            <div className="flex flex-wrap gap-2">
              {/* <!-- Topic Tag Chips --> */}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
