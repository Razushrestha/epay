import Image from "next/image";
import Link from "next/link";

const search = (q: string) => `/search?q=${encodeURIComponent(q)}`;

const popular = [
  { name: "Beauty", href: search("beauty") },
  { name: "Makeup", href: search("makeup") },
  { name: "Health", href: search("health") },
  { name: "Fragrances for men", href: search("men fragrance") },
  { name: "Fragrances for women", href: search("women fragrance") },
  { name: "Manicure and pedicure", href: search("manicure") },
  { name: "Hair products", href: search("hair products") },
  { name: "Skin care", href: search("skin care") },
  { name: "Orthopedic products", href: search("orthopedic") },
];

const more = [
  { name: "Vitamins and food supplements", href: search("vitamins") },
  { name: "Shaving and waxing", href: search("shaving") },
  { name: "Bath and personal hygiene", href: search("bath") },
  { name: "Oral hygiene", href: search("oral hygiene") },
  { name: "Massagers", href: search("massagers") },
  { name: "Vision care", href: search("vision care") },
  { name: "Sun protection", href: search("sunscreen") },
  { name: "K-beauty", href: search("k-beauty") },
  { name: "Dyson", href: search("dyson") },
];

export function BeautyHub() {
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

        <div className="relative flex min-h-[300px] flex-col justify-center overflow-hidden rounded-[22px] bg-[#7b5cff] px-7 py-8 text-white sm:px-8">
          <h2 className="max-w-[180px] text-[36px] font-extrabold leading-[1.02] tracking-tight">
            Health and beauty
          </h2>
          <p className="mt-2 max-w-[170px] text-[17px] font-semibold leading-snug">
            Wellness and beauty every day.
          </p>
          <Link
            href={search("health and beauty")}
            className="mt-6 inline-flex w-fit items-center rounded-full border border-white/90 px-5 py-2 text-[14px] font-semibold text-white hover:bg-white/10"
          >
            Explore now
          </Link>

          <div className="pointer-events-none absolute bottom-3 right-2 hidden h-[220px] w-[340px] sm:block">
            <span className="absolute left-0 top-4 h-[160px] w-[140px] overflow-hidden rounded-[16px] shadow-md">
              <Image src="/categories/beauty-mirror.jpg" alt="" fill className="object-cover" sizes="140px" />
            </span>
            <span className="absolute right-[96px] top-2 h-[150px] w-[128px] overflow-hidden rounded-[16px] bg-white shadow-md">
              <Image src="/categories/beauty-perfume.jpg" alt="" fill className="object-cover" sizes="128px" />
            </span>
            <span className="absolute bottom-1 right-0 h-[140px] w-[130px] overflow-hidden rounded-[16px] shadow-md">
              <Image src="/categories/beauty-lipstick.jpg" alt="" fill className="object-cover" sizes="130px" />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
