import { useState } from "react";
import { STATIONS } from "./constants/data";
import { BottomNav } from "./components/nav/BottomNav";
import { IdleView, SearchingView, ResultView } from "./components/route";
import type { TabId, RouteView, SelectedStation, RecentSearch, Station, ExitInfo } from "./types";

// ─────────────────────────────────────────────
// Placeholder for non-Route tabs
// ─────────────────────────────────────────────

function PlaceholderTab({ icon, en, ko }: { icon: string; en: string; ko: string }) {
  return (
    <div className= "flex flex-col items-center justify-center h-full gap-3 text-gray-300" >
    <span className="text-5xl" > { icon } </span>
      < p className = "text-lg font-black text-gray-400" > { en } </p>
        < p className = "text-sm text-gray-300" > { ko } </p>
          < p className = "text-xs text-gray-200 mt-2" > Coming Soon </p>
            </div>
  );
}

// ─────────────────────────────────────────────
// App
// ─────────────────────────────────────────────

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>("route");
  const [view, setView] = useState<RouteView>("idle");
  const [origin, setOrigin] = useState<SelectedStation | null>(null);
  const [destination, setDestination] = useState<SelectedStation | null>(null);

  // ── handlers ────────────────────────────────

  const handleSearchFocus = () => setView("searching");

  const handleStationSelect = (station: Station, exit: ExitInfo) => {
    const selected: SelectedStation = {
      id: station.id,
      name: station.name,
      ko: station.ko,
      line: station.line,
      exit: exit.num,
    };

    setDestination(selected);

    // Demo: pick a random different station as the origin
    const others = STATIONS.filter((s) => s.id !== station.id);
    const rand = others[Math.floor(Math.random() * others.length)];
    const randEx = rand.exits.find((e) => e.elev) ?? rand.exits[0];
    setOrigin({ id: rand.id, name: rand.name, ko: rand.ko, line: rand.line, exit: randEx.num });

    setView("result");
  };

  const handleRecentSelect = (r: RecentSearch) => {
    setOrigin(r.from);
    setDestination(r.to);
    setView("result");
  };

  const handleReSearch = () => setView("searching");

  const handleTabChange = (tab: TabId) => {
    setActiveTab(tab);
    if (tab === "route") setView("idle");
  };

  const handleSearchClose = () => setView(destination ? "result" : "idle");

  // ── render ───────────────────────────────────

  return (
    <div
      className= "flex flex-col bg-app-bg relative overflow-hidden"
  style = {{ maxWidth: 390, margin: "0 auto", height: "100vh", fontFamily: "'Inter', system-ui, sans-serif" }
}
    >
  {/* ── Main content area ── */ }
  < div className = "flex-1 overflow-hidden relative" style = {{ paddingBottom: "56px" }}>

    { activeTab === "route" && (
      <>
      { view === "idle" && (
        <IdleView
                onSearchFocus={ handleSearchFocus }
onRecentSelect = { handleRecentSelect }
  />
            )}
{
  view === "result" && origin && destination && (
    <ResultView
                from={ origin }
  to = { destination }
  onReSearch = { handleReSearch }
    />
            )
}
{/* SearchingView is an overlay — always mounted when view === "searching" */ }
{
  view === "searching" && (
    <SearchingView
                onClose={ handleSearchClose }
  onSelect = { handleStationSelect }
    />
            )
}
</>
        )}

{ activeTab === "station" && <PlaceholderTab icon="🚉" en = "Station Info" ko = "역 정보" />}
{ activeTab === "help" && <PlaceholderTab icon="❓" en = "Help"         ko = "도움말" />}
{ activeTab === "settings" && <PlaceholderTab icon="⚙️" en = "Settings"     ko = "설정" />}
</div>

{/* ── Bottom navigation (always fixed) ── */ }
<div className="absolute bottom-0 left-0 right-0" >
  <BottomNav active={ activeTab } onChange = { handleTabChange } />
    </div>
    </div>
  );
}
