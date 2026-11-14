import Link from "next/link";

/** Tile sizes follow the original layout: small squares, two wide tiles, one tall tile. */
const tiles = [
  { glyph: "🪙", label: "Coins", box: "col-start-1 row-start-1 bg-[#8eb6ff]/55" },
  { glyph: "✉️", label: "Stamps", box: "col-start-2 row-start-1 bg-[#b9a8ff]/50" },
  { glyph: "🏺", label: "Antiques", box: "col-start-3 row-start-1 row-span-2 bg-[#5c4ee0]/75" },
  { glyph: "🏅", label: "Medals", box: "col-start-4 row-start-1 bg-[#e7b6ff]/55" },
  { glyph: "🃏", label: "Trading cards", box: "col-start-1 col-span-2 row-start-2 bg-[#6f97ff]/50" },
  { glyph: "💎", label: "Limited editions", box: "col-start-4 row-start-2 bg-[#f0a8ea]/50" },
];

export function PromoBanner() {
  return (
    <section className="page-shell pt-6">
      <div className="promo-bg flex min-h-[240px] flex-col overflow-hidden rounded-[22px] sm:min-h-[280px] lg:h-[300px] lg:flex-row lg:items-center">
        <div className="flex w-full shrink-0 flex-col justify-center px-5 py-6 text-white sm:px-10 lg:w-[38%] lg:px-12 lg:py-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75">
            Collectors&apos; marketplace
          </p>
          <h2 className="mt-2 text-[32px] font-bold leading-[1.08] tracking-tight sm:text-[36px]">
            Collect rare finds.
            <br />
            Bid with confidence.
          </h2>
          <p className="mt-3 max-w-[300px] text-[13px] leading-relaxed text-white/85">
            Coins, stamps, medals, antiques and more, from verified sellers with escrow on every purchase.
          </p>
          <Link
            href="/search"
            className="mt-5 inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-[9px] text-[13.5px] font-semibold text-[#0f1c3f] hover:bg-[#eef4ff]"
          >
            Explore now
            <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="hidden flex-1 items-center justify-center pr-8 lg:flex">
          <div className="grid grid-cols-[118px_196px_146px_118px] grid-rows-[112px_128px] gap-[10px]">
            {tiles.map((tile) => (
              <span
                key={tile.label}
                aria-label={tile.label}
                className={`flex items-center justify-center overflow-hidden rounded-[16px] text-[56px] drop-shadow-[0_8px_14px_rgba(20,10,60,0.28)] ${tile.box}`}
              >
                {tile.glyph}
              </span>
            ))}
          </div>
        </div>

        <div className="grid flex-1 grid-cols-3 gap-2 p-4 lg:hidden">
          {tiles.map((tile) => (
            <span
              key={tile.label}
              aria-label={tile.label}
              className="flex h-[84px] items-center justify-center overflow-hidden rounded-xl bg-white/20 p-2 text-[40px]"
            >
              {tile.glyph}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
