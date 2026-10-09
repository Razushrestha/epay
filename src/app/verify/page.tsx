import type { Metadata } from "next";
import { Caveat } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { VerifyForm } from "@/components/auth/VerifyForm";

const script = Caveat({ subsets: ["latin"], weight: ["600", "700"] });

export const metadata: Metadata = {
  title: "Confirm it's you — Nexlo",
  description: "Enter the code we sent to finish creating your Nexlo account.",
};

const features = [
  {
    label: "Secure Account",
    icon: <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.4 7.5 9.5 4.4-1.1 7.5-4.9 7.5-9.5V6L12 3Zm-2.6 9.2 2 2 3.6-4" />,
  },
  {
    label: "Safe Transactions",
    icon: <path d="M13 2.5 5 13.5h6l-1 8 8-11h-6l1-8Z" />,
  },
  {
    label: "Better Experience",
    icon: (
      <>
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5 20c.5-3.6 3.2-5.5 7-5.5s6.5 1.9 7 5.5" />
      </>
    ),
  },
];

export default function VerifyPage() {
  return (
    <main className="auth-lock grid h-dvh overflow-hidden bg-[#f7f7f7] lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-[#1a2338] lg:block">
        <Image
          src="/auth/verify-scene.jpg"
          alt=""
          fill
          priority
          sizes="50vw"
          className="object-cover object-[center_30%]"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-[#0f1c3f]/55 via-[#0f1c3f]/25 to-[#0f1c3f]/70"
        />

        <div className="relative z-10 flex h-full flex-col px-10 pt-8 xl:px-14">
          <p className={`${script.className} text-[28px] leading-none text-[#7ef0d8] xl:text-[32px]`}>
            Your Next Purchase Starts Here
          </p>
          <h2 className="mt-4 max-w-[420px] text-[44px] font-extrabold leading-[1.05] tracking-tight text-white xl:text-[52px]">
            Confirm it&apos;s you
          </h2>
          <p className="mt-3 max-w-[380px] text-[14px] leading-relaxed text-white/85">
            For your security, we need to verify your email or phone number. This helps keep your account safe and ensures a smooth shopping experience.
          </p>

          <ul className="mt-8 flex max-w-[460px] gap-3">
            {features.map((f) => (
              <li
                key={f.label}
                className="flex flex-1 flex-col items-center rounded-2xl border border-white/25 bg-white/15 px-3 py-3.5 text-center shadow-[0_10px_30px_-16px_rgba(15,40,80,0.45)] backdrop-blur-md"
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  {f.icon}
                </svg>
                <span className="mt-2 text-[11.5px] font-semibold leading-snug text-white">{f.label}</span>
              </li>
            ))}
          </ul>

          <p className={`${script.className} mt-auto mb-8 text-[30px] leading-none text-white xl:text-[34px]`}>
            Shop Smarter. Live Better.
          </p>
        </div>
      </section>

      <section className="relative flex h-full min-h-0 flex-col overflow-hidden">
        <svg
          viewBox="0 0 600 180"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-28 w-full"
          aria-hidden
        >
          <path
            d="M0 110 C 140 60, 260 160, 400 110 S 540 40, 600 80 L600 180 L0 180 Z"
            fill="#dbe9fb"
            fillOpacity="0.55"
          />
        </svg>

        <header className="relative z-10 flex shrink-0 items-center justify-between px-5 py-4 sm:px-8 lg:justify-end">
          <Link href="/" aria-label="Nexlo home" className="lg:hidden">
            <Image src="/logo-transparent.png" alt="Nexlo" width={808} height={256} className="h-10 w-auto" />
          </Link>
          <p className="flex items-center gap-3 text-[13px] text-[#4b566b]">
            <span className="hidden sm:inline">Already have an account?</span>
            <Link
              href="/login"
              className="rounded-full border border-[#3665f3] bg-white/80 px-4 py-1.5 text-[13px] font-semibold text-[#3665f3] transition hover:bg-[#3665f3] hover:text-white"
            >
              Sign in
            </Link>
          </p>
        </header>

        <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-5 pb-6 sm:px-8">
          <VerifyForm />
        </div>
      </section>
    </main>
  );
}
