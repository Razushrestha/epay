import type { Metadata } from "next";
import { Caveat } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import { ResetForm } from "@/components/auth/ResetForm";
import BrandLogo from "@/components/BrandLogo";

const script = Caveat({ subsets: ["latin"], weight: ["600", "700"] });

export const metadata: Metadata = {
  title: "Choose a new password | MeroAuction",
  description: "Set a new MeroAuction password from your reset link.",
};

export default function ResetPage() {
  return (
    <main className="auth-lock relative grid min-h-dvh overflow-y-auto bg-[#f3f8ff] lg:h-dvh lg:grid-cols-2 lg:overflow-hidden">
      <section className="relative hidden h-full min-h-0 flex-col overflow-hidden lg:flex">
        <div className="relative z-10 flex min-h-0 flex-1 flex-col px-10 pt-8 xl:px-14">
          <Link href="/" aria-label="MeroAuction home" className="w-fit">
            <BrandLogo className="text-[30px]" />
          </Link>
          <div className="mt-16 max-w-[380px]">
            <p className={`${script.className} text-[30px] leading-none text-[#12c4b0]`}>Almost there</p>
            <h2 className="mt-2 text-[40px] font-extrabold leading-[1.05] tracking-tight text-[#0f1c3f] xl:text-[48px]">
              Pick a new
              <br />
              <span className="bg-gradient-to-r from-[#12c4b0] to-[#3665f3] bg-clip-text text-transparent">password</span>
            </h2>
            <p className="mt-4 text-[14px] leading-relaxed text-[#4b566b]">
              This link signs out other devices after you save, so only you stay signed in.
            </p>
          </div>
        </div>
      </section>
      <section className="relative flex min-h-dvh flex-col overflow-y-auto lg:h-full lg:min-h-0">
        <header className="relative z-10 flex shrink-0 items-center justify-between px-5 py-4 sm:px-8 lg:hidden">
          <Link href="/" aria-label="MeroAuction home">
            <BrandLogo className="text-[26px]" />
          </Link>
        </header>
        <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center px-5 pb-6 sm:px-10">
          <Suspense fallback={<p className="text-[14px] text-[#6b7587]">Loading reset form…</p>}>
            <ResetForm />
          </Suspense>
        </div>
      </section>
    </main>
  );
}
