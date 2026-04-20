import { LINE_COLORS, STEP_COLORS } from "../../constants/data";
import { ExitBadge } from "../common/ExitBadge";
import LineBadge from "../common/LineBadge";
import { BiLabel } from "../common/BiLabel";
import type { RouteSegment } from "../../types";

interface TimelineCardProps {
  segment: RouteSegment;
}

export function TimelineCard({ segment }: TimelineCardProps) {
  const { station, transfer, steps } = segment;
  const lineColor = LINE_COLORS[String(station.line)] ?? "#888";

  return (
    <div
      className= "rounded-2xl overflow-hidden border border-gray-100 shadow-sm"
  style = {{ borderLeft: `4px solid ${lineColor}` }
}
    >
  {/* Card header */ }
  < div className = "flex items-center gap-3 px-3 py-2.5 bg-white border-b border-gray-50" >
    <LineBadge line={ station.line } />
      < div className = "flex-1" >
        <div className="flex items-center gap-1.5 flex-wrap" >
          <span className="text-sm font-black text-gray-900" > { station.name } </span>
{
  transfer && (
    <span className="text-xs bg-orange-100 text-orange-600 font-bold px-1.5 py-0.5 rounded" >
      Transfer · 환승
        </span>
            )
}
{ station.exit > 0 && <ExitBadge num={ station.exit } size = "lg" />}
</div>
  < p className = "text-xs text-gray-400" > { station.ko } </p>
    </div>
    </div>

{/* Step timeline */ }
<div className="bg-gray-50 px-3 py-2 flex flex-col gap-2" >
{
  steps.map((step, i) => (
    <div key= { i } className = "flex items-start gap-3" >
    {/* Icon + connector line */ }
    < div className = "flex flex-col items-center flex-shrink-0 w-8" >
    <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${STEP_COLORS[step.type] ?? "bg-gray-100"}`}
  >
  { step.icon }
  </div>
{
  i < steps.length - 1 && (
    <div className="w-0.5 h-4 bg-gray-200 mt-1" />
              )
}
</div>

{/* Text */ }
<div className="pt-0.5 min-w-0" >
  <BiLabel
                en={ step.en }
ko = { step.ko }
enClass = "text-xs font-semibold text-gray-800"
koClass = "text-xs text-gray-400"
  />
{
  step.detail && (
    <p className="text-xs text-gray-500 mt-0.5 font-mono bg-white rounded px-1.5 py-0.5 inline-block border border-gray-100">
      { step.detail }
      </p>
              )
}
  </div>
  </div>
        ))}
</div>
  </div>
  );
}
