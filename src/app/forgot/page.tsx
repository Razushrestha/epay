import type { Metadata } from "next";
import { Caveat } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { ForgotForm } from "@/components/auth/ForgotForm";

const script = Caveat({ subsets: ["latin"], weight: ["600", "700"] });

export const metadata: Metadata = {
  title: "Reset your password — Nexlo",
  description: "Send a one-time code and choose a new Nexlo password.",
};

const features = [
  {
    label: "Secure & Safe",
    icon: <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.4 7.5 9.5 4.4-1.1 7.5-4.9 7.5-9.5V6L12 3Zm-2.6 9.2 2 2 3.6-4" />,
  },
  {
    label: "Quick Recovery",
    icon: <path d="M13 2.5 5 13.5h6l-1 8 8-11h-6l1-8Z" />,
  },
  {
    label: "Back to Your Account",
    icon: (
      <>
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5 20c.5-3.6 3.2-5.5 7-5.5s6.5 1.9 7 5.5" />
      </>
    ),
  },
];

export default function ForgotPage() {
  return (
    <main className="auth-lock relative grid h-dvh overflow-hidden bg-[#f3f8ff] lg:grid-cols-2">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-[-80px] h-[420px] w-[420px] rounded-full bg-[#dcecff] blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-[-120px] right-[8%] h-[360px] w-[360px] rounded-full bg-[#e7f7ff] blur-3xl"
      />

      <section className="relative hidden h-full min-h-0 flex-col overflow-hidden lg:flex">
        <div className="relative z-10 flex min-h-0 flex-1 flex-col px-10 pt-8 xl:px-14">
          <Link href="/" aria-label="Nexlo home" className="w-fit">
            <Image
              src="/logo-transparent.png"
              alt="Nexlo — Find What Comes Next."
              width={808}
              height={256}
              priority
              className="h-12 w-auto"
            />
          </Link>

          <div className="mt-8 flex min-h-0 flex-1 items-center gap-4 xl:mt-4 xl:gap-6">
            <div className="min-w-0 flex-[1.05]">
              <p className={`${script.className} text-[30px] leading-none text-[#12c4b0] xl:text-[34px]`}>
                No worries!
              </p>
              <h2 className="mt-2 text-[40px] font-extrabold leading-[1.05] tracking-tight text-[#0f1c3f] xl:text-[48px]">
                Reset your
                <br />
                <span className="bg-gradient-to-r from-[#12c4b0] to-[#3665f3] bg-clip-text text-transparent">
                  password
                </span>
              </h2>
              <p className="mt-4 max-w-[340px] text-[14px] leading-relaxed text-[#4b566b]">
                Enter your email or phone number and we&apos;ll send you a code to help you reset your password and get back to your account.
              </p>
              <ul className="mt-7 flex max-w-[380px] items-start">
                {features.map((f) => (
                  <li key={f.label} className="flex flex-1 flex-col items-center px-1 text-center">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[#cfe4f4] bg-white/80 text-[#3665f3] shadow-[0_8px_18px_-12px_rgba(54,101,243,0.7)]">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        {f.icon}
                      </svg>
                    </span>
                    <span className="mt-2 text-[11.5px] font-semibold leading-snug text-[#3a4a66]">{f.label}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative min-h-[240px] w-[44%] max-w-[360px] shrink-0">
              <div className="absolute left-1/2 top-[46%] h-[240px] w-[240px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#dff4ff] xl:h-[280px] xl:w-[280px]" />
              <Image
                src="/auth/reset-envelope.jpg"
                alt=""
                width={520}
                height={520}
                priority
                className="relative z-10 mx-auto h-auto w-full object-contain mix-blend-multiply"
              />
            </div>
          </div>
        </div>

        <div className="pointer-events-none relative z-10 h-[150px] shrink-0">
          <svg viewBox="0 0 760 150" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
            <defs>
              <linearGradient id="forgotWave" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#12c4b0" />
                <stop offset="0.45" stopColor="#0b6ea8" />
                <stop offset="1" stopColor="#123a8a" />
              </linearGradient>
            </defs>
            <path d="M0 58 C 150 8, 280 18, 400 62 S 620 130, 760 48 L760 150 L0 150 Z" fill="url(#forgotWave)" />
          </svg>
          <p className={`${script.className} absolute bottom-8 left-10 text-[32px] leading-none text-white xl:text-[36px]`}>
            We&apos;ve got you covered!
          </p>
        </div>
      </section>

      <section className="relative flex h-full min-h-0 flex-col overflow-hidden">
        <header className="relative z-10 flex shrink-0 items-center justify-between px-5 py-4 sm:px-8 lg:hidden">
          <Link href="/" aria-label="Nexlo home">
            <Image src="/logo-transparent.png" alt="Nexlo" width={808} height={256} className="h-10 w-auto" />
          </Link>
        </header>
        <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-5 pb-6 sm:px-10">
          <ForgotForm />
        </div>
      </section>
    </main>
  );
}
