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
      <div className="hero-bg relative overflow-hidden rounded-[20px] px-6 py-8 sm:px-10 sm:py-11">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/40" />
        <div aria-hidden className="pointer-events-none absolute -bottom-20 right-24 h-40 w-40 rounded-full bg-[#08c4a6]/15" />
        <p className="nexlo-kicker relative">{eyebrow}</p>
        <h1 className="relative mt-2 max-w-[720px] text-[32px] font-extrabold leading-[1.08] tracking-tight text-[#0f1c3f] sm:text-[40px]">
          {title}
        </h1>
        <p className="relative mt-3 max-w-[560px] text-[14.5px] leading-relaxed text-[#4b5563]">{body}</p>
        {cta && href ? (
          <Link href={href} className="nexlo-btn nexlo-btn-blue relative mt-5">
            {cta}
            <span aria-hidden>→</span>
          </Link>
        ) : null}
      </div>
    </section>
  );
}
