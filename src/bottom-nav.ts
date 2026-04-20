import { NAV_TABS } from "../../constants/data";
import type { TabId } from "../../types";

interface BottomNavProps {
  active: TabId;
  onChange: (tab: TabId) => void;
}

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <div className= "flex border-t border-[#2C2C2C] bg-app-surface" style = {{ height: "56px" }
}>
{
  NAV_TABS.map((t) => {
    const isActive = active === t.id;
    return (
      <button
            key= { t.id }
    onClick = {() => onChange(t.id)
  }
            className = {`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${isActive ? "text-blue-600" : "text-gray-400"
      }`}
  >
  <span className="text-lg leading-none" > { t.icon } </span>
    < span className = {`text-xs font-bold ${isActive ? "text-blue-600" : "text-gray-400"}`}>
      { t.en }
      </span>
      </button>
        );
      })}
</div>
  );
}
