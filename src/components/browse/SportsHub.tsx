import Image from "next/image";
import Link from "next/link";

const search = (q: string) => `/search?q=${encodeURIComponent(q)}`;

const popular = [
  { name: "Cycling", href: search("cycling") },
  { name: "Fishing", href: search("fishing") },
  { name: "Camping", href: search("camping") },
  { name: "Fitness, running and yoga", href: search("fitness") },
  { name: "Golf", href: search("golf") },
  { name: "Archery", href: search("archery") },
  { name: "Team sports", href: search("team sports") },
  { name: "Outdoor sports", href: search("outdoor sports") },
  { name: "Tennis", href: search("tennis") },
];

const more = [
  { name: "Tennis and racquet sports", href: search("racquet sports") },
  { name: "Electric scooters", href: search("electric scooters") },
  { name: "Electric bikes", href: search("electric bikes") },
  { name: "Watersports", href: search("watersports") },
  { name: "GPS and running watches", href: search("running watches") },
  { name: "Soccer", href: search("soccer") },
  { name: "Boxing and MMA", href: search("boxing") },
  { name: "Basketball", href: search("basketball") },
  { name: "Football", href: search("football") },
  { name: "Swimming", href: search("swimming") },
];

export function SportsHub() {
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

        <div className="relative flex min-h-[300px] flex-col justify-center overflow-hidden rounded-[22px] bg-[#2ad39a] px-7 py-8 text-[#10241c] sm:px-8">
          <h2 className="max-w-[180px] text-[36px] font-extrabold leading-[1.02] tracking-tight">
            Sport and leisure
          </h2>
          <p className="mt-2 max-w-[160px] text-[17px] font-semibold leading-snug">
            Unlimited activity and fun.
          </p>
          <Link
            href={search("sports")}
            className="mt-6 inline-flex w-fit items-center rounded-full border border-[#10241c] px-5 py-2 text-[14px] font-semibold text-[#10241c] hover:bg-black/5"
          >
            Explore now
          </Link>

          <div className="pointer-events-none absolute bottom-3 right-2 hidden h-[220px] w-[340px] sm:block">
            <span className="absolute left-0 top-2 h-[168px] w-[140px] overflow-hidden rounded-[16px] bg-white shadow-md">
              <Image src="/categories/sport-bike.jpg" alt="" fill className="object-cover" sizes="140px" />
            </span>
            <span className="absolute right-[100px] top-6 h-[140px] w-[120px] overflow-hidden rounded-[16px] bg-[#e8fff4] shadow-md">
              <Image src="/categories/sport-tennis.jpg" alt="" fill className="object-cover" sizes="120px" />
            </span>
            <span className="absolute bottom-1 right-0 h-[150px] w-[140px] overflow-hidden rounded-[16px] shadow-md">
              <Image src="/categories/sport-basket.jpg" alt="" fill className="object-cover" sizes="140px" />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
