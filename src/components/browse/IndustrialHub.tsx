import Image from "next/image";
import Link from "next/link";

const search = (q: string) => `/search?q=${encodeURIComponent(q)}`;

const popular = [
  { name: "Heavy equipment", href: search("heavy equipment") },
  { name: "Light industrial tools", href: search("industrial tools") },
  { name: "Healthcare", href: search("healthcare equipment") },
  { name: "Electronic equipment and supplies", href: search("electronic equipment") },
  { name: "Motors and industrial automation", href: search("industrial automation") },
  { name: "CNC, metalworking and manufacturing", href: search("cnc metalworking") },
  { name: "Restaurant and food service", href: search("restaurant equipment") },
  { name: "Test, measurement and inspection", href: search("test equipment") },
  { name: "HVAC and refrigeration", href: search("hvac") },
];

const more = [
  { name: "Packing and shipping", href: search("packing and shipping") },
  { name: "Office supplies and equipment", href: search("office supplies") },
  { name: "Printing and graphic arts", href: search("printing") },
  { name: "Maintenance and safety", href: search("safety equipment") },
  { name: "Retail and services", href: search("retail equipment") },
  { name: "Building materials", href: search("building materials") },
  { name: "Agriculture and forestry", href: search("agriculture") },
];

export function IndustrialHub() {
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

        <div className="relative flex min-h-[300px] flex-col justify-center overflow-hidden rounded-[22px] bg-[#ff7a14] px-7 py-8 text-[#1a1200] sm:px-8">
          <h2 className="max-w-[200px] text-[36px] font-extrabold leading-[1.02] tracking-tight">
            Industrial equipment
          </h2>
          <p className="mt-2 max-w-[160px] text-[17px] font-semibold leading-snug">
            Reliable tools for your work.
          </p>
          <Link
            href={search("industrial equipment")}
            className="mt-6 inline-flex w-fit items-center rounded-full border border-[#1a1200] px-5 py-2 text-[14px] font-semibold text-[#1a1200] hover:bg-black/5"
          >
            Explore now
          </Link>

          <div className="pointer-events-none absolute bottom-3 right-2 hidden h-[220px] w-[340px] sm:block">
            <span className="absolute left-0 top-4 h-[150px] w-[140px] overflow-hidden rounded-[16px] bg-white shadow-md">
              <Image src="/categories/industrial-drills.jpg" alt="" fill className="object-cover" sizes="140px" />
            </span>
            <span className="absolute right-[100px] top-8 h-[140px] w-[130px] overflow-hidden rounded-[16px] shadow-md">
              <Image src="/categories/industrial-pallet.jpg" alt="" fill className="object-cover" sizes="130px" />
            </span>
            <span className="absolute bottom-1 right-0 h-[160px] w-[130px] overflow-hidden rounded-[16px] shadow-md">
              <Image src="/categories/industrial-worker.jpg" alt="" fill className="object-cover object-top" sizes="130px" />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
