import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { VerifyForm } from "@/components/auth/VerifyForm";

export const metadata: Metadata = {
  title: "Confirm it's you | Nexlo",
  description: "Enter the code we sent to finish creating your Nexlo account.",
};

const features = [
  {
    label: "Secure Account",
    icon: (
      <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.4 7.5 9.5 4.4-1.1 7.5-4.9 7.5-9.5V6L12 3Zm-2.6 9.2 2 2 3.6-4" />
    ),
  },
  {
    label: "Safe Transactions",
    icon: <path d="M13 2.5 5 13.5h6l-1 8 8-11h-6l1-8Z" />,
  },
  {
    label: "Fast Verification",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
  },
  {
    label: "Better Experience",
    icon: (
      <>
        <circle cx="9" cy="8.5" r="3.2" />
        <path d="M2.8 20c.4-3.5 3-5.5 6.2-5.5s5.8 2 6.2 5.5" />
        <circle cx="17.2" cy="9.5" r="2.5" />
        <path d="M17.5 14.3c2.2.2 3.8 1.8 4.1 4.2" />
      </>
    ),
  },
];

export default function VerifyPage() {
  return (
    <main className="auth-lock grid h-dvh overflow-hidden bg-[#f4f8fd] lg:grid-cols-2">
      <section className="relative hidden overflow-hidden bg-[#eef4fb] lg:block">
        <Image
          src="/auth/verify-scene.jpg"
          alt=""
          fill
          priority
          sizes="50vw"
          className="object-cover object-[center_38%]"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-[#f4f8fd] from-0% via-[#f4f8fd]/88 via-[38%] to-transparent to-[58%]"
        />

        <div className="relative z-10 flex h-full flex-col px-10 pt-7 xl:px-14 xl:pt-8">
          <Link href="/" aria-label="Nexlo home" className="w-fit">
            <Image
              src="/logo-transparent.png"
              alt="Nexlo: Find What Comes Next."
              width={808}
              height={256}
              priority
              className="h-12 w-auto"
            />
          </Link>

          <div className="mt-6 xl:mt-8">
            <h2 className="text-[40px] font-extrabold leading-[1.02] tracking-tight text-[#0f1c3f] xl:text-[46px]">
              You&apos;re almost there!
            </h2>
            <p className="mt-0.5 bg-gradient-to-r from-[#08c4a6] to-[#3665f3] bg-clip-text text-[36px] font-extrabold leading-[1.05] tracking-tight text-transparent xl:text-[42px]">
              Confirm it&apos;s you.
            </p>
            <p className="mt-3 max-w-[360px] text-[13.5px] leading-relaxed text-[#4b566b]">
              Enter the code we sent to your email or phone. This keeps your Nexlo account
              safe and gets you shopping in seconds.
            </p>
          </div>

          <ul className="mt-auto mb-5 flex w-full max-w-[560px] items-start rounded-2xl border border-white/70 bg-white/45 px-2 py-3 shadow-[0_10px_30px_-16px_rgba(15,40,80,0.45)] backdrop-blur-xl">
            {features.map((f, i) => (
              <li
                key={f.label}
                className={`flex flex-1 flex-col items-center px-1.5 text-center ${
                  i > 0 ? "border-l border-white/70" : ""
                }`}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#3665f3"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  {f.icon}
                </svg>
                <span className="mt-1.5 text-[11px] font-semibold leading-snug text-[#0f1c3f]">
                  {f.label}
                </span>
              </li>
            ))}
          </ul>
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
            <Image
              src="/logo-transparent.png"
              alt="Nexlo"
              width={808}
              height={256}
              className="h-10 w-auto"
            />
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

        <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-5 pb-4 sm:px-8">
          <VerifyForm />
        </div>
      </section>
    </main>
  );
}
