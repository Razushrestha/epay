import Image from "next/image";
import Link from "next/link";

const search = (q: string) => `/search?q=${encodeURIComponent(q)}`;

const popular = [
  { name: "Home improvement", href: search("home improvement") },
  { name: "Yard, garden and outdoor living items", href: search("garden") },
  { name: "Workshop tools and equipment", href: search("workshop tools") },
  { name: "Kitchen, dining and bar", href: search("kitchen") },
  { name: "Home furniture", href: search("furniture") },
  { name: "Home appliances", href: search("appliances") },
  { name: "Lamps, lights and fans", href: search("lamps") },
  { name: "Small kitchen appliances", href: search("small appliances") },
];

const more = [
  { name: "Interior decoration", href: search("interior decoration") },
  { name: "Home organization", href: search("home organization") },
  { name: "Vacuum cleaners", href: search("vacuum") },
  { name: "Heating, cooling and air", href: search("heating cooling") },
  { name: "Pets", href: search("pets") },
  { name: "Outdoor power equipment", href: search("outdoor power") },
  { name: "Rugs and carpets", href: search("rugs") },
  { name: "Candles and home fragrance", href: search("candles") },
];

export function HomeGardenHub() {
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

        <div className="relative flex min-h-[300px] flex-col justify-center overflow-hidden rounded-[22px] bg-[#c6ef62] px-7 py-8 text-[#14210a] sm:px-8">
          <h2 className="max-w-[180px] text-[36px] font-extrabold leading-[1.02] tracking-tight">
            Home and garden
          </h2>
          <p className="mt-2 max-w-[170px] text-[17px] font-semibold leading-snug">
            Furnish, decorate, live better.
          </p>
          <Link
            href={search("home and garden")}
            className="mt-6 inline-flex w-fit items-center rounded-full border border-[#14210a] px-5 py-2 text-[14px] font-semibold text-[#14210a] hover:bg-black/5"
          >
            Explore now
          </Link>

          <div className="pointer-events-none absolute bottom-3 right-2 hidden h-[220px] w-[340px] sm:block">
            <span className="absolute left-0 top-6 h-[150px] w-[140px] overflow-hidden rounded-[16px] shadow-md">
              <Image src="/categories/home-pillow.jpg" alt="" fill className="object-cover" sizes="140px" />
            </span>
            <span className="absolute right-[96px] top-2 h-[160px] w-[130px] overflow-hidden rounded-[16px] shadow-md">
              <Image src="/categories/home-chair.jpg" alt="" fill className="object-cover" sizes="130px" />
            </span>
            <span className="absolute bottom-1 right-0 h-[140px] w-[130px] overflow-hidden rounded-[16px] bg-white shadow-md">
              <Image src="/categories/home-vacuum.jpg" alt="" fill className="object-cover" sizes="130px" />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
