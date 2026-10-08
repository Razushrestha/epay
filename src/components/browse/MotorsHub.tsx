import Image from "next/image";
import Link from "next/link";

const search = (q: string) => `/search?q=${encodeURIComponent(q)}`;

const car = [
  { name: "Car and truck parts", href: search("car and truck parts") },
  { name: "Wheels, tires and parts", href: search("wheels and tires") },
  { name: "Engines and engine parts", href: search("engines") },
  { name: "Exterior parts", href: search("exterior parts") },
  { name: "Interior parts", href: search("interior parts") },
  { name: "Air intake", href: search("air intake") },
  { name: "Automotive tools and supplies", href: search("automotive tools") },
  { name: "My Garage", href: search("garage") },
];

const motorcycle = [
  { name: "Motorcycle parts", href: search("motorcycle parts") },
  { name: "Motorcycle body and frame", href: search("motorcycle frame") },
  { name: "Motorcycle engines and parts", href: search("motorcycle engines") },
  { name: "Motorcycle and powersports gear", href: search("powersports gear") },
  { name: "Motorcycle wheels and rims", href: search("motorcycle wheels") },
  { name: "ATV and UTV parts", href: search("atv parts") },
  { name: "RVs and campers", href: search("rvs and campers") },
  { name: "Boat parts", href: search("boat parts") },
];

export function MotorsHub() {
  return (
    <section className="overflow-hidden rounded-[22px] border border-[#ececec] bg-white p-5 shadow-[0_8px_30px_-24px_rgba(0,0,0,0.35)] sm:p-6 lg:p-7">
      <div className="grid items-stretch gap-6 lg:grid-cols-[1.05fr_1.15fr]">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
          <div>
            <h2 className="border-b border-[#e6e6e6] pb-2 text-[15px] font-bold text-[#191919]">Car</h2>
            <ul className="mt-3 space-y-3">
              {car.map((item) => (
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
              Motorcycle and more
            </h2>
            <ul className="mt-3 space-y-3">
              {motorcycle.map((item) => (
                <li key={item.name}>
                  <Link href={item.href} className="text-[14px] leading-snug text-[#333] hover:text-[#3665f3] hover:underline">
                    {item.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="relative flex min-h-[280px] flex-col justify-center overflow-hidden rounded-[22px] bg-[#1a1a1a] px-7 py-8 text-white sm:px-8">
          <h2 className="max-w-[220px] text-[34px] font-extrabold leading-[1.05] tracking-tight">
            Parts and accessories
          </h2>
          <p className="mt-2 max-w-[200px] text-[16px] font-medium leading-snug text-white/90">
            Essential gear for every ride.
          </p>
          <Link
            href={search("parts and accessories")}
            className="mt-6 inline-flex w-fit items-center rounded-full border border-white/80 px-5 py-2 text-[14px] font-semibold text-white hover:bg-white/10"
          >
            Explore now
          </Link>

          <div className="pointer-events-none absolute bottom-3 right-2 hidden h-[220px] w-[340px] sm:block">
            <span className="absolute inset-y-4 left-0 w-[150px] overflow-hidden rounded-[16px]">
              <Image src="/categories/motor-wheel.jpg" alt="" fill className="object-cover" sizes="150px" />
            </span>
            <span className="absolute right-[78px] top-6 h-[120px] w-[110px] overflow-hidden rounded-[16px] bg-white shadow-md">
              <Image src="/categories/motor-light.jpg" alt="" fill className="object-cover" sizes="110px" />
            </span>
            <span className="absolute bottom-4 right-0 h-[130px] w-[120px] overflow-hidden rounded-[16px] bg-white shadow-md">
              <Image src="/categories/motor-pistons.jpg" alt="" fill className="object-cover" sizes="120px" />
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
