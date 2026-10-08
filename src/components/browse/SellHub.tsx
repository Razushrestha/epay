import Image from "next/image";
import Link from "next/link";

const search = (q: string) => `/search?q=${encodeURIComponent(q)}`;

const start = [
  { name: "How to create a listing", href: "/sell#list" },
  { name: "Join our growth program", href: search("seller growth") },
  { name: "Selling limits", href: search("selling limits") },
];

const business = [
  { name: "Seller center", href: search("seller center") },
  { name: "Seller updates", href: search("seller updates") },
  { name: "Seller customer service", href: search("seller support") },
  { name: "Nexlo managed payments", href: search("payments") },
  { name: "Nexlo stores", href: search("stores") },
  { name: "Nexlo fees", href: search("seller fees") },
];

export function SellHub() {
  return (
    <section className="overflow-hidden rounded-[22px] border border-[#ececec] bg-white p-5 shadow-[0_8px_30px_-24px_rgba(0,0,0,0.35)] sm:p-6 lg:p-7">
      <div className="grid items-stretch gap-6 lg:grid-cols-[1.05fr_1.15fr]">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          <div>
            <h2 className="border-b border-[#e6e6e6] pb-2 text-[15px] font-bold text-[#191919]">Start selling</h2>
            <ul className="mt-3 space-y-3">
              {start.map((item) => (
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
              Run your business with confidence
            </h2>
            <ul className="mt-3 space-y-3">
              {business.map((item) => (
                <li key={item.name}>
                  <Link href={item.href} className="text-[14px] leading-snug text-[#333] hover:text-[#3665f3] hover:underline">
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="relative flex min-h-[280px] flex-col justify-center overflow-hidden rounded-[22px] bg-[#2ec8c4] px-7 py-8 text-[#08343a] sm:px-8">
          <h2 className="max-w-[200px] text-[36px] font-extrabold leading-[1.02] tracking-tight">
            Start selling on Nexlo
          </h2>
          <p className="mt-2 max-w-[200px] text-[16px] font-semibold leading-snug">
            All the resources you need to succeed as a seller.
          </p>
          <Link
            href="/sell#list"
            className="mt-6 inline-flex w-fit items-center rounded-full border border-[#08343a] px-5 py-2 text-[14px] font-semibold text-[#08343a] hover:bg-black/5"
          >
            Become a seller
          </Link>

          <div className="pointer-events-none absolute bottom-3 right-2 hidden h-[210px] w-[330px] sm:block">
            <span className="absolute left-0 top-2 h-[160px] w-[130px] overflow-hidden rounded-[16px] shadow-md">
              <Image src="/categories/sell-jacket.jpg" alt="" fill className="object-cover" sizes="130px" />
            </span>
            <span className="absolute right-[88px] top-6 h-[140px] w-[130px] overflow-hidden rounded-[16px] shadow-md">
              <Image src="/categories/sell-box.jpg" alt="" fill className="object-cover" sizes="130px" />
            </span>
            <span className="absolute bottom-1 right-0 h-[130px] w-[120px] overflow-hidden rounded-[16px] shadow-md">
              <Image src="/categories/sell-package.jpg" alt="" fill className="object-cover" sizes="120px" />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
