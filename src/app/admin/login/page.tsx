import type { Metadata } from "next";
import { Caveat } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";

export const metadata: Metadata = {
  title: "Admin Login — Nexlo",
  description: "Sign in to the Nexlo admin portal.",
};

const script = Caveat({ subsets: ["latin"], weight: ["600", "700"] });

const features = [
  { label: "Manage Users", d: "M12 3 5 6.2v5.3c0 4.2 2.7 8 7 9.5 4.3-1.5 7-5.3 7-9.5V6.2L12 3Z" },
  { label: "Control Products", d: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" },
  { label: "View Analytics", d: "M4 19V9m6 10V5m6 14v-7m6 7V3" },
  { label: "System Settings", d: "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM4 12a8 8 0 0 1 .3-2.2l-2-1.2 2-3.4 2.3.6A8 8 0 0 1 9 4.3L9.2 2h5.6L15 4.3a8 8 0 0 1 2.4 1.5l2.3-.6 2 3.4-2 1.2A8 8 0 0 1 20 12a8 8 0 0 1-.3 2.2l2 1.2-2 3.4-2.3-.6A8 8 0 0 1 15 19.7L14.8 22H9.2L9 19.7a8 8 0 0 1-2.4-1.5l-2.3.6-2-3.4 2-1.2A8 8 0 0 1 4 12Z" },
];

function LaptopScene() {
  return (
    <div className="relative mx-auto mt-8 w-full max-w-[560px]">
      <div className="relative z-10 origin-bottom -rotate-[8deg] rounded-[18px] border-[10px] border-[#d7e4f4] bg-white shadow-[0_30px_60px_-24px_rgba(54,101,243,0.45)]">
        <div className="flex min-h-[220px] overflow-hidden rounded-[8px]">
          <aside className="w-[108px] shrink-0 bg-[#eef3ff] px-2.5 py-3">
            <div className="mb-3 flex items-center gap-1 px-1">
              <Image src="/logo-transparent.png" alt="" width={80} height={24} className="h-5 w-auto" />
            </div>
            {["Dashboard", "Users", "Products", "Orders", "Analytics", "Settings"].map((item, i) => (
              <p key={item} className={`rounded-md px-2 py-1 text-[8px] font-semibold ${i === 0 ? "bg-[#e8f0ff] text-[#3665f3]" : "text-[#8a94a6]"}`}>
                {item}
              </p>
            ))}
          </aside>
          <div className="flex-1 bg-white p-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-[#eef3ff] p-2">
                <p className="text-[7px] text-[#8a94a6]">Total Users</p>
                <p className="text-[13px] font-extrabold text-[#0f1c3f]">2,548</p>
                <p className="text-[7px] font-semibold text-[#16a34a]">↑ 12%</p>
              </div>
              <div className="rounded-lg bg-[#eef3ff] p-2">
                <p className="text-[7px] text-[#8a94a6]">Total Orders</p>
                <p className="text-[13px] font-extrabold text-[#0f1c3f]">1,248</p>
                <p className="text-[7px] font-semibold text-[#16a34a]">↑ 8%</p>
              </div>
            </div>
            <p className="mt-2 text-[8px] font-bold text-[#0f1c3f]">Sales Overview</p>
            <svg viewBox="0 0 180 48" className="mt-1 h-[48px] w-full" aria-hidden>
              <path d="M2 38 C 22 36, 32 18, 52 22 S 82 40, 102 20 S 142 8, 178 14" fill="none" stroke="#3665f3" strokeWidth="2.4" />
              <path d="M2 38 C 22 36, 32 18, 52 22 S 82 40, 102 20 S 142 8, 178 14 L178 48 L2 48 Z" fill="url(#salesFill)" opacity=".35" />
              <defs>
                <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#3665f3" />
                  <stop offset="1" stopColor="#3665f3" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </div>
      </div>
      <div className="relative z-10 mx-auto h-[14px] w-[92%] -translate-y-[2px] rounded-b-[16px] bg-[#c9d8ec]" />
      <div className="relative z-10 mx-auto h-[8px] w-[38%] rounded-b-md bg-[#b7c9e0]" />

      <svg viewBox="0 0 140 160" className="absolute -right-2 bottom-8 z-20 h-[150px] w-[130px]" aria-hidden>
        <ellipse cx="70" cy="148" rx="34" ry="8" fill="#cfe4d8" />
        <rect x="52" y="118" width="36" height="32" rx="8" fill="#eef6f2" stroke="#d5e6dc" />
        <path d="M70 118 C 40 90, 38 50, 58 28 C 48 62, 62 90, 70 118Z" fill="#3ecf8e" />
        <path d="M70 118 C 100 88, 108 46, 86 22 C 98 60, 82 92, 70 118Z" fill="#22c57a" />
        <path d="M70 118 C 78 70, 58 40, 70 14 C 82 42, 72 78, 70 118Z" fill="#16a34a" />
      </svg>

      <div className="absolute -right-4 bottom-16 z-30 w-[168px] rounded-2xl bg-white px-3.5 py-3 shadow-[0_18px_40px_-18px_rgba(15,40,80,0.45)] ring-1 ring-[#e7eef6]">
        <p className="flex items-center gap-1.5 text-[13px] font-extrabold text-[#0f1c3f]">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#eaf1ff] text-[#3665f3]">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M12 3 5 6.2v5.3c0 4.2 2.7 8 7 9.5 4.3-1.5 7-5.3 7-9.5V6.2L12 3Z" />
            </svg>
          </span>
          Secure & Reliable
        </p>
        <p className="mt-1 text-[11px] leading-snug text-[#8a94a6]">Your data is always protected with us.</p>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <main className="auth-lock relative grid min-h-dvh overflow-hidden bg-[#f3f8ff] lg:grid-cols-[1.05fr_minmax(420px,1fr)]">
      <div aria-hidden className="pointer-events-none absolute -left-24 top-[-80px] h-[420px] w-[420px] rounded-full bg-[#d7ecff] blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute bottom-[-80px] left-[12%] h-[380px] w-[380px] rounded-full bg-[#c8f3ea] blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-20 top-10 h-[360px] w-[360px] rounded-full bg-[#e4f0ff] blur-3xl" />

      <section className="relative hidden flex-col px-12 pb-8 pt-10 lg:flex xl:px-16">
        <Link href="/" className="w-fit" aria-label="Nexlo home">
          <Image src="/logo-transparent.png" alt="Nexlo — Find What Comes Next." width={808} height={256} priority className="h-12 w-auto" />
        </Link>
        <p className="mt-10 text-[15px] font-semibold text-[#3665f3]">Admin Portal —</p>
        <h2 className="mt-1 text-[44px] font-extrabold leading-[1.05] tracking-tight text-[#0f1c3f] xl:text-[52px]">
          Welcome Back,
          <br />
          <span className="text-[#12c2b0]">Admin!</span>
        </h2>
        <p className="mt-3 max-w-[380px] text-[14px] leading-relaxed text-[#6b7587]">
          Sign in to your admin account and get full control of your platform.
        </p>
        <ul className="mt-8 flex max-w-[460px] gap-2">
          {features.map((item) => (
            <li key={item.label} className="flex flex-1 flex-col items-center text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#3665f3] shadow-[0_10px_24px_-14px_rgba(54,101,243,0.8)]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={item.d} />
                </svg>
              </span>
              <span className="mt-2 text-[11px] font-semibold leading-snug text-[#3a4a66]">{item.label}</span>
            </li>
          ))}
        </ul>
        <div className="mt-auto">
          <LaptopScene />
          <p className={`${script.className} mt-2 text-[28px] leading-tight text-[#3665f3]`}>
            Better Insights.
            <br />
            <span className="text-[#12c2b0]">Bigger Growth.</span>
          </p>
        </div>
      </section>

      <section className="relative z-10 flex items-center justify-center px-4 py-8 sm:px-8">
        <div className="w-full max-w-[460px] rounded-[28px] bg-white px-7 py-8 shadow-[0_24px_80px_-28px_rgba(54,101,243,0.35)] ring-1 ring-[#e7eef8] sm:px-10 sm:py-10">
          <AdminLoginForm />
        </div>
      </section>
    </main>
  );
}
