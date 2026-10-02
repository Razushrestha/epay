import Image from "next/image";
import Link from "next/link";

/** Box sizes follow the reference: small squares, a wide shoe, a tall bag, a wide camera, a tall phone. */
const tiles = [
  {
    src: "/promo/earbuds.png",
    alt: "Earbuds",
    box: "col-start-1 row-start-1 bg-[#8eb6ff]/55",
  },
  {
    src: "/promo/sneaker.png",
    alt: "Sneaker",
    box: "col-start-2 row-start-1 bg-[#b9a8ff]/50",
  },
  {
    src: "/promo/backpack.png",
    alt: "Backpack",
    box: "col-start-3 row-start-1 row-span-2 bg-[#5c4ee0]/75",
  },
  {
    src: "/promo/watch.png",
    alt: "Watch",
    box: "col-start-4 row-start-1 bg-[#e7b6ff]/55",
  },
  {
    src: "/promo/camera.png",
    alt: "Camera",
    box: "col-start-1 col-span-2 row-start-2 bg-[#6f97ff]/50",
  },
  {
    src: "/promo/phone.png",
    alt: "Phone",
    box: "col-start-4 row-start-2 bg-[#f0a8ea]/50",
  },
];

export function PromoBanner() {
  return (
    <section className="page-shell pt-6">
      <div className="promo-bg flex min-h-[280px] items-center overflow-hidden rounded-[22px] lg:h-[300px]">
        <div className="flex w-[38%] shrink-0 flex-col justify-center px-8 text-white sm:px-12">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/75">
            Trending now
          </p>
          <h2 className="mt-2 text-[32px] font-bold leading-[1.08] tracking-tight sm:text-[36px]">
            Shop the world.
            <br />
            Ship for free.
          </h2>
          <p className="mt-3 max-w-[300px] text-[13px] leading-relaxed text-white/85">
            From global brands to unique finds, enjoy free shipping on millions of items.
          </p>
          <Link
            href="/deals"
            className="mt-5 inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-[9px] text-[13.5px] font-semibold text-[#1a1a1a] hover:bg-[#f4f4f4]"
          >
            Explore now
            <span aria-hidden>→</span>
          </Link>
        </div>

        <div className="hidden flex-1 items-center justify-center pr-8 lg:flex">
          <div className="grid grid-cols-[118px_196px_146px_118px] grid-rows-[112px_128px] gap-[10px]">
            {tiles.map((tile) => (
              <span
                key={tile.src}
                className={`flex items-center justify-center overflow-hidden rounded-[16px] ${tile.box}`}
              >
                <Image
                  src={tile.src}
                  alt={tile.alt}
                  width={400}
                  height={320}
                  className="h-[88%] w-[88%] object-contain drop-shadow-[0_8px_14px_rgba(20,10,60,0.28)]"
                />
              </span>
            ))}
          </div>
        </div>

        <div className="grid flex-1 grid-cols-3 gap-2 p-4 lg:hidden">
          {tiles.map((tile) => (
            <span
              key={tile.src}
              className="flex h-[84px] items-center justify-center overflow-hidden rounded-xl bg-white/20 p-2"
            >
              <Image src={tile.src} alt={tile.alt} width={140} height={100} className="h-full w-full object-contain" />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
