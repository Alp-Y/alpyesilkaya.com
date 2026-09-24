import { UCS_ORIGIN, ucsGeometry } from "@/lib/workspace/ucs";

/**
 * The UCS (user coordinate system) icon. Rendered here for the default
 * ISO view; lib/workspace/ucs.ts keeps it in step with the ViewCube.
 * Its origin is also the origin of the hero's drawing coordinates.
 */
export default function UcsIcon({ className }: { className?: string }) {
  const g = ucsGeometry(45, 35.264);
  const colors = { x: "var(--axis-x)", y: "var(--axis-y)", z: "var(--text-2)" };
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true" data-ucs>
      {(["z", "y", "x"] as const).map((k) => (
        <g key={k} stroke={colors[k]} strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
          <line data-ucs-line={k} pathLength={1} x1={UCS_ORIGIN.x} y1={UCS_ORIGIN.y} x2={g[k].x2} y2={g[k].y2} />
          <path data-ucs-head={k} d={g[k].head} />
          <text
            data-ucs-label={k}
            x={g[k].label.x}
            y={g[k].label.y}
            fill={colors[k]}
            stroke="none"
            fontSize="8"
            textAnchor="middle"
            fontFamily="var(--font-mono)"
          >
            {k.toUpperCase()}
          </text>
        </g>
      ))}
      <rect x={UCS_ORIGIN.x - 3} y={UCS_ORIGIN.y - 3} width="6" height="6" stroke="var(--text-3)" strokeWidth="1" />
    </svg>
  );
}
