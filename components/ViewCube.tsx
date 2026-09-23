/**
 * A minimal navigation cube, like the one in the corner of a CAD viewport.
 * Decorative. Its compass ring turns slightly with the cursor (see lib/effects.ts).
 */
export default function ViewCube({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 140 140" fill="none" aria-hidden="true">
      <g data-viewcube-ring style={{ transformOrigin: "70px 74px", transformBox: "view-box" } as React.CSSProperties}>
        <ellipse cx="70" cy="74" rx="58" ry="30" stroke="var(--line-strong)" />
        <ellipse cx="70" cy="74" rx="50" ry="25" stroke="var(--line)" />
        <text x="70" y="41" textAnchor="middle" fontSize="9" fill="var(--text-2)" fontFamily="var(--font-mono)">N</text>
        <text x="133" y="77" textAnchor="middle" fontSize="9" fill="var(--text-3)" fontFamily="var(--font-mono)">E</text>
        <text x="70" y="115" textAnchor="middle" fontSize="9" fill="var(--text-3)" fontFamily="var(--font-mono)">S</text>
        <text x="7" y="77" textAnchor="middle" fontSize="9" fill="var(--text-3)" fontFamily="var(--font-mono)">W</text>
      </g>
      {/* Cube seen from the top */}
      <path d="M44 60l26-12 26 12-26 12z" fill="rgba(150,175,205,0.08)" stroke="var(--text-2)" />
      <path d="M44 60v22l26 12V72z" fill="rgba(150,175,205,0.03)" stroke="var(--line-strong)" />
      <path d="M96 60v22L70 94V72z" fill="rgba(150,175,205,0.05)" stroke="var(--line-strong)" />
      <text x="70" y="63" textAnchor="middle" fontSize="8" letterSpacing="1" fill="var(--text-1)" fontFamily="var(--font-mono)">TOP</text>
      <path d="M70 72v22" stroke="var(--accent)" strokeOpacity="0.5" />
      {/* Home */}
      <path d="M16 18l7-6 7 6v8H16z" stroke="var(--text-3)" />
    </svg>
  );
}
