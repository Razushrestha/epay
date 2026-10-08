import Image from "next/image";
import Link from "next/link";

const search = (q: string) => `/search?q=${encodeURIComponent(q)}`;

const popular = [
  { name: "Collectibles", href: search("collectibles") },
  { name: "Art", href: search("art") },
  { name: "Action figures", href: search("action figures") },
  { name: "Sports trading cards", href: search("sports trading cards") },
  { name: "Collectible card games", href: search("card games") },
  { name: "Sports memorabilia", href: search("sports memorabilia") },
  { name: "Toys and hobbies", href: search("toys") },
  { name: "Entertainment memorabilia", href: search("entertainment memorabilia") },
  { name: "Antiques", href: search("antiques") },
];

const more = [
  { name: "Pokémon TCG", href: search("pokemon cards") },
  { name: "LEGO", href: search("lego") },
  { name: "Funko pop!", href: search("funko") },
  { name: "Star Wars", href: search("star wars") },
  { name: "Marvel", href: search("marvel") },
  { name: "One piece CCG", href: search("one piece cards") },
  { name: "Hot Wheels", href: search("hot wheels") },
  { name: "Comics", href: search("comics") },
  { name: "Coins and paper money", href: search("coins") },
  { name: "Non-sport trading cards", href: search("trading cards") },
];

export function CollectiblesHub() {
  return (
    <section className="overflow-hidden rounded-[22px] border border-[#ececec] bg-white p-5 shadow-[0_8px_30px_-24px_rgba(0,0,0,0.35)] sm:p-6 lg:p-7">
      <div className="grid items-stretch gap-6 lg:grid-cols-[1.05fr_1.15fr]">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          <div>
            <h2 className="border-b border-[#e6e6e6] pb-2 text-[15px] font-bold text-[#191919]">
              Most popular categories
            </h2>
            <ul className="mt-3 space-y-3">
              {popular.map((item) => (
                <li key={item.name}>
                  <Link href={item.href} className="text-[14px] leading-snug text-[#333] hover:text-[#3665f3] hover:underline">
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="border-b border-[#e6e6e6] pb-2 text-[15px] font-bold text-[#191919]">
              More categories
            </h2>
            <ul className="mt-3 space-y-3">
              {more.map((item) => (
                <li key={item.name}>
                  <Link href={item.href} className="text-[14px] leading-snug text-[#333] hover:text-[#3665f3] hover:underline">
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="relative flex min-h-[300px] flex-col justify-center overflow-hidden rounded-[22px] bg-[#f5b400] px-7 py-8 text-[#1a1200] sm:px-8">
          <h2 className="text-[36px] font-extrabold leading-none tracking-tight">Collectibles</h2>
          <p className="mt-2 max-w-[180px] text-[18px] font-semibold leading-snug">
            Unique items for true enthusiasts.
          </p>
          <Link
            href={search("collectibles")}
            className="mt-6 inline-flex w-fit items-center rounded-full border border-[#1a1200] px-5 py-2 text-[14px] font-semibold text-[#1a1200] hover:bg-black/5"
          >
            Explore now
          </Link>

          <div className="pointer-events-none absolute bottom-3 right-2 hidden h-[220px] w-[340px] sm:block">
            <span className="absolute left-0 top-4 h-[150px] w-[130px] overflow-hidden rounded-[16px] bg-white shadow-md">
              <Image src="/categories/collect-ball.jpg" alt="" fill className="object-cover" sizes="130px" />
            </span>
            <span className="absolute bottom-2 right-[108px] h-[128px] w-[150px] overflow-hidden rounded-[16px] shadow-md">
              <Image src="/categories/collect-box.jpg" alt="" fill className="object-cover" sizes="150px" />
            </span>
            <span className="absolute bottom-1 right-0 h-[168px] w-[140px] overflow-hidden rounded-[16px] shadow-md">
              <Image src="/categories/collect-person.jpg" alt="" fill className="object-cover object-top" sizes="140px" />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
