/** Small monogram: a pickbox with a crosshair — the CAD cursor, as a logo. */
export default function LogoMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="6.5" y="6.5" width="11" height="11" stroke="currentColor" strokeWidth="1.2" />
      <path d="M12 0v6.5M12 17.5V24M0 12h6.5M17.5 12H24" stroke="currentColor" strokeWidth="1.2" />
      <rect x="10.4" y="10.4" width="3.2" height="3.2" fill="var(--accent)" />
    </svg>
  );
}
