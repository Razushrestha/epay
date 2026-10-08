import Image from "next/image";
import Link from "next/link";

const search = (q: string) => `/search?q=${encodeURIComponent(q)}`;

const popular = [
  { name: "Women's clothing", href: search("women clothing") },
  { name: "Women's shoes", href: search("women shoes") },
  { name: "Women's accessories", href: search("women accessories") },
  { name: "Men's clothing", href: search("men clothing") },
  { name: "Men's shoes", href: search("men shoes") },
  { name: "Men's accessories", href: search("men accessories") },
  { name: "Kids and baby", href: search("kids and baby") },
];

const more = [
  { name: "Luxury on Nexlo", href: search("luxury fashion") },
  { name: "Watches", href: search("watches") },
  { name: "Fine jewelry", href: search("fine jewelry") },
  { name: "Bags and handbags", href: search("handbags") },
  { name: "Collectible sneakers", href: search("sneakers") },
  { name: "Women's sunglasses", href: search("women sunglasses") },
  { name: "Men's sunglasses", href: search("men sunglasses") },
  { name: "Men's wallets", href: search("wallets") },
];

export function FashionHub() {
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

        <div className="relative flex min-h-[280px] flex-col justify-center overflow-hidden rounded-[22px] bg-[#f3f3f3] px-7 py-8 text-[#111] sm:px-8">
          <h2 className="text-[40px] font-extrabold leading-none tracking-tight">Fashion</h2>
          <p className="mt-2 max-w-[180px] text-[18px] font-semibold leading-snug">
            Style that sets you apart.
          </p>
          <Link
            href={search("fashion")}
            className="mt-6 inline-flex w-fit items-center rounded-full border border-[#1a1a1a] px-5 py-2 text-[14px] font-semibold text-[#111] hover:bg-black/5"
          >
            Explore now
          </Link>

          <div className="pointer-events-none absolute bottom-4 right-3 hidden h-[210px] w-[340px] sm:block">
            <span className="absolute bottom-0 left-0 h-[176px] w-[150px] overflow-hidden rounded-[16px] shadow-md">
              <Image src="/categories/fashion-person.jpg" alt="" fill className="object-cover object-top" sizes="150px" />
            </span>
            <span className="absolute right-16 top-1 h-[128px] w-[118px] overflow-hidden rounded-[16px] bg-white shadow-md">
              <Image src="/categories/fashion-bag.jpg" alt="" fill className="object-cover" sizes="118px" />
            </span>
            <span className="absolute bottom-1 right-0 h-[140px] w-[128px] overflow-hidden rounded-[16px] shadow-md">
              <Image src="/categories/fashion-shoes.jpg" alt="" fill className="object-cover" sizes="128px" />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
