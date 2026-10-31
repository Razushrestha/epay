export function AuthenticityBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-[#e8f8ee] px-2 py-0.5 text-[11px] font-bold text-[#159947] ${className}`.trim()}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden>
        <path d="m5 12 5 5L20 7" />
      </svg>
      Authentic
    </span>
  );
}
