import Link from "next/link";

export function PageHero({
  eyebrow,
  title,
  body,
  cta,
  href,
}: {
  eyebrow: string;
  title: string;
  body: string;
  cta?: string;
  href?: string;
}) {
  return (
    <section className="page-shell pt-3">
      <div className="hero-bg relative overflow-hidden rounded-[16px] px-6 py-8 sm:px-10 sm:py-10">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#0f1c3f]">{eyebrow}</p>
        <h1 className="mt-2 max-w-[680px] text-[32px] font-bold leading-[1.08] tracking-tight text-[#0f1c3f] sm:text-[40px]">
          {title}
        </h1>
        <p className="mt-3 max-w-[540px] text-[14px] leading-relaxed text-[#333]">{body}</p>
        {cta && href ? (
          <Link href={href} className="nexlo-btn mt-5">
            {cta}
            <span aria-hidden>→</span>
          </Link>
        ) : null}
      </div>
    </section>
  );
}
