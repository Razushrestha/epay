import Image from "next/image";
import Link from "next/link";

const search = (q: string) => `/search?q=${encodeURIComponent(q)}`;

const popular = [
  { name: "Computers, tablets and network hardware", href: search("computers tablets") },
  { name: "Cell phones and accessories", href: search("cell phones") },
  { name: "Cameras and photos", href: search("cameras") },
  { name: "Portable audio and headphones", href: search("headphones") },
  { name: "TV, video and home audio electronics", href: search("television") },
  { name: "Surveillance and smart home electronics", href: search("smart home") },
  { name: "Vehicle electronics and gps", href: search("vehicle electronics") },
  { name: "Nexlo refurbished", href: search("refurbished electronics") },
];

const more = [
  { name: "Apple", href: search("apple") },
  { name: "Samsung", href: search("samsung") },
  { name: "Tablets and e-readers", href: search("tablets") },
  { name: "Laptops and netbooks", href: search("laptops") },
  { name: "PC desktops and all-in-one computers", href: search("desktop computers") },
  { name: "Video game consoles", href: search("video games") },
  { name: "Smart watches", href: search("smartwatches") },
  { name: "Virtual reality", href: search("virtual reality") },
];

export function ElectronicsHub() {
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

        <div className="relative flex min-h-[280px] flex-col justify-center overflow-hidden rounded-[22px] bg-[#4c8dff] px-7 py-8 text-white sm:px-8">
          <h2 className="text-[34px] font-extrabold leading-none tracking-tight">Electronics</h2>
          <p className="mt-2 max-w-[220px] text-[18px] font-semibold leading-snug">
            Smart devices, always with you.
          </p>
          <Link
            href={search("electronics")}
            className="mt-6 inline-flex w-fit items-center rounded-full border border-[#1a2744] bg-transparent px-5 py-2 text-[14px] font-semibold text-[#10245c] hover:bg-white/30"
          >
            Explore now
          </Link>

          <div className="pointer-events-none absolute bottom-4 right-3 hidden h-[210px] w-[320px] sm:block">
            <span className="absolute bottom-0 left-0 h-[168px] w-[150px] overflow-hidden rounded-[16px] bg-white shadow-md">
              <Image src="/categories/elec-person.jpg" alt="" fill className="object-cover object-top" sizes="150px" />
            </span>
            <span className="absolute right-10 top-2 h-[118px] w-[110px] overflow-hidden rounded-[16px] bg-[#dbe7ff] shadow-md">
              <Image src="/categories/elec-phones.jpg" alt="" fill className="object-cover" sizes="110px" />
            </span>
            <span className="absolute bottom-2 right-0 h-[130px] w-[120px] overflow-hidden rounded-[16px] bg-white shadow-md">
              <Image src="/categories/elec-tablet.jpg" alt="" fill className="object-cover" sizes="120px" />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
