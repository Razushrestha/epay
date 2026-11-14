/**
 * Text wordmark for the site. Size it with a `text-*` class (responsive variants work).
 * To switch to an image logo later, change only this component.
 */
export default function BrandLogo({ className = "text-[26px]" }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="MeroAuction"
      className={`inline-flex select-none items-baseline whitespace-nowrap font-extrabold leading-none tracking-tight ${className}`}
    >
      <span className="text-[#0f1c3f]">Mero</span>
      <span className="text-[#12c2b0]">Auction</span>
    </span>
  );
}
