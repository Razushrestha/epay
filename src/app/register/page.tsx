import type { Metadata } from "next";
import { Caveat } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { RegisterForm } from "@/components/auth/RegisterForm";

const script = Caveat({ subsets: ["latin"], weight: ["600", "700"] });

export const metadata: Metadata = {
  title: "Create account — Nexlo",
  description: "Create a Nexlo account to bid, buy and sell.",
};

const features = [
  { label: "Shop With Confidence", icon: <path d="M6 7h15l-1.5 9h-12L6 7Zm0 0-1-3H2M9 20a1 1 0 1 0 0-2 1 1 0 0 0 0 2Zm8 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" /> },
  { label: "Safe & Secure Transactions", icon: <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.4 7.5 9.5 4.4-1.1 7.5-4.9 7.5-9.5V6L12 3Zm-2.6 9.2 2 2 3.6-4" /> },
  { label: "Global Marketplace", icon: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.6 2.6 3.9 5.6 3.9 9s-1.3 6.4-3.9 9c-2.6-2.6-3.9-5.6-3.9-9s1.3-6.4 3.9-9Z" /></> },
  { label: "Millions of Happy Users", icon: <><circle cx="9" cy="8.5" r="3" /><path d="M3 19.5c.4-3.2 2.8-5 6-5s5.6 1.8 6 5" /><circle cx="17" cy="9.5" r="2.2" /><path d="M16.5 14.4c2 .2 3.6 1.6 3.9 3.8" /></> },
];

const floats = [
  { src: "/auth/reg-shoe.jpg", alt: "Sneaker", className: "right-[8%] top-[7%] h-[92px] w-[92px] rotate-6" },
  { src: "/auth/reg-bag.jpg", alt: "Bag", className: "right-[28%] top-[16%] h-[72px] w-[72px] -rotate-6" },
  { src: "/auth/reg-headphones.jpg", alt: "Headphones", className: "right-[10%] top-[30%] h-[78px] w-[78px] rotate-3" },
  { src: "/auth/reg-laptop.jpg", alt: "Laptop", className: "right-[22%] top-[46%] h-[86px] w-[100px] -rotate-3" },
];

export default function RegisterPage() {
  return (
    <main className="auth-lock grid h-dvh overflow-hidden bg-[#f3f7fc] lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-[#e7f2fb] lg:block">
        <Image
          src="/auth/register-people.jpg"
          alt=""
          fill
          priority
          sizes="50vw"
          className="object-cover object-[center_18%]"
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-[#f4f8fc] from-0% via-[#f4f8fc]/80 via-[42%] to-transparent to-[68%]" />

        {floats.map((item) => (
          <span
            key={item.src}
            className={`absolute z-10 overflow-hidden rounded-2xl bg-white shadow-[0_12px_30px_-12px_rgba(15,40,80,0.45)] ${item.className}`}
          >
            <Image src={item.src} alt={item.alt} fill className="object-cover" sizes="100px" />
          </span>
        ))}

        <div className="relative z-10 flex h-full flex-col px-10 pt-7 xl:px-12">
          <Link href="/" aria-label="Nexlo home" className="w-fit">
            <Image src="/logo-transparent.png" alt="Nexlo — Find What Comes Next." width={808} height={256} priority className="h-12 w-auto" />
          </Link>
          <h2 className="mt-6 max-w-[340px] text-[38px] font-extrabold leading-[1.05] tracking-tight text-[#0f1c3f] xl:text-[42px]">
            Join Nexlo and{" "}
            <span className="bg-gradient-to-r from-[#12c4b0] to-[#2f6bff] bg-clip-text text-transparent">
              be part of something bigger.
            </span>
          </h2>
          <p className="mt-3 max-w-[340px] text-[13.5px] leading-relaxed text-[#4b566b]">
            Create your account, explore amazing products, connect with people and get access to exclusive offers — all in one place.
          </p>
          <ul className="mt-5 flex max-w-[460px]">
            {features.map((f) => (
              <li key={f.label} className="flex flex-1 flex-col items-center px-1 text-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2f6bff" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  {f.icon}
                </svg>
                <span className="mt-1 text-[11px] font-semibold leading-tight text-[#0f1c3f]">{f.label}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[120px]">
          <svg viewBox="0 0 760 120" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
            <defs>
              <linearGradient id="regWave" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#123a8a" />
                <stop offset="0.55" stopColor="#0b6ea8" />
                <stop offset="1" stopColor="#12c4b0" />
              </linearGradient>
            </defs>
            <path d="M0 48 C 140 8, 260 8, 380 46 S 600 96, 760 40 L760 120 L0 120 Z" fill="url(#regWave)" />
          </svg>
          <p className={`${script.className} absolute bottom-7 left-10 text-[32px] leading-none text-white xl:text-[36px]`}>
            Better Choices. A Brighter Tomorrow.
          </p>
        </div>
      </section>

      <section className="relative flex h-full min-h-0 flex-col overflow-hidden">
        <header className="flex shrink-0 items-center justify-between px-5 py-3.5 sm:px-8 lg:justify-end">
          <Link href="/" aria-label="Nexlo home" className="lg:hidden">
            <Image src="/logo-transparent.png" alt="Nexlo" width={808} height={256} className="h-10 w-auto" />
          </Link>
          <p className="flex items-center gap-2 text-[13px] text-[#4b566b]">
            <span className="hidden sm:inline">Already have an account?</span>
            <Link href="/login" className="font-semibold text-[#2f6bff] hover:underline">
              Sign in →
            </Link>
          </p>
        </header>
        <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-4 sm:px-8">
          <RegisterForm />
        </div>
      </section>
    </main>
  );
}
