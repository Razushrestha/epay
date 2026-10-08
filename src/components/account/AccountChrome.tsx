"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { NotificationBell } from "@/components/notifications/NotificationBell";

type ChromeUser = {
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  avatarUrl: string | null;
};

function initials(user: ChromeUser) {
  const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.displayName || user.email || "N";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function fullName(user: ChromeUser) {
  return `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.displayName || "Your account";
}

function Icon({ d, paths }: { d?: string; paths?: ReactNode }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {d ? <path d={d} /> : paths}
    </svg>
  );
}

const NAV = [
  { id: "dashboard", label: "Dashboard", href: "/account?tab=dashboard", icon: <Icon d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" /> },
  { id: "messages", label: "Messages", href: "/account?tab=messages", icon: <Icon d="M4 6h16v12H7l-3 3V6Z" /> },
  { id: "activity", label: "Activity", href: "/account?tab=activity", icon: <Icon d="M8 4h8v4H8V4Zm-3 6h14v10H5V10Zm5 3h4" /> },
  { id: "payment", label: "Payment Information", href: "/account?tab=payment", icon: <Icon d="M3 7.5A2.5 2.5 0 0 1 5.5 5h13A2.5 2.5 0 0 1 21 7.5v9A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5v-9ZM3 10h18" /> },
];

const PERSONAL_TABS = new Set(["account", "security", "preferences"]);

export function AccountChrome({
  user,
  tab,
  onSignOut,
  children,
}: {
  user: ChromeUser;
  tab: string;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [personalOpen, setPersonalOpen] = useState(PERSONAL_TABS.has(tab));
  const [prefsOpen, setPrefsOpen] = useState(tab === "preferences");
  const [sellingOpen, setSellingOpen] = useState(tab === "selling");
  const [donateOpen, setDonateOpen] = useState(tab === "donations");
  const name = fullName(user);

  return (
    <div className="min-h-dvh bg-[#f3f7fc]">
      <header className="sticky top-0 z-30 border-b border-[#e7eef6] bg-white">
        <div className="flex h-[68px] items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="shrink-0" aria-label="Nexlo home">
            <Image src="/logo-transparent.png" alt="Nexlo" width={808} height={256} className="h-10 w-auto" priority />
          </Link>

          <form action="/search" method="get" className="mx-auto hidden min-w-0 max-w-[520px] flex-1 md:block">
            <label className="flex h-10 items-center gap-2 rounded-full border border-[#e2e8f0] bg-[#f8fbff] px-4">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a94a6" strokeWidth="2" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input name="q" type="search" placeholder="Search for anything..." className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[#8a94a6]" />
            </label>
          </form>

          <div className="ml-auto flex items-center gap-3 sm:gap-4">
            <NotificationBell />
            <button type="button" className="hidden items-center gap-1.5 text-[13px] text-[#3a4a66] sm:flex">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3c2.6 2.6 3.9 5.6 3.9 9s-1.3 6.4-3.9 9c-2.6-2.6-3.9-5.6-3.9-9S9.4 5.6 12 3Z" />
              </svg>
              Nepal (NPR)
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-[#f3f7fc]"
              >
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#dbe7ff] text-[12px] font-bold text-[#2f6bff]">
                    {initials(user)}
                  </span>
                )}
                <span className="hidden text-[13.5px] font-semibold text-[#0f1c3f] sm:inline">{name}</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7587" strokeWidth="2.2" aria-hidden>
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {menuOpen ? (
                <div className="absolute right-0 mt-2 w-44 rounded-xl border border-[#e7eef6] bg-white py-1 shadow-lg">
                  <Link href="/account" className="block px-3 py-2 text-[13px] text-[#0f1c3f] hover:bg-[#f5f8fc]" onClick={() => setMenuOpen(false)}>
                    Account
                  </Link>
                  <button type="button" onClick={onSignOut} className="block w-full px-3 py-2 text-left text-[13px] text-[#0f1c3f] hover:bg-[#f5f8fc]">
                    Sign out
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1280px] gap-6 px-4 py-5 lg:grid-cols-[248px_minmax(0,1fr)] lg:px-6">
        <aside className="flex flex-col">
          <nav className="space-y-0.5">
            {NAV.slice(0, 2).map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] ${
                  tab === item.id ? "bg-[#eaf1ff] font-semibold text-[#2f6bff]" : "font-medium text-[#3a4a66] hover:bg-white"
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}

            <details open={personalOpen} onToggle={(e) => setPersonalOpen(e.currentTarget.open)}>
              <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium text-[#3a4a66] hover:bg-white [&::-webkit-details-marker]:hidden">
                <Icon paths={<><circle cx="12" cy="8" r="3.2" /><path d="M5 20c.5-3.6 3.2-5.5 7-5.5s6.5 1.9 7 5.5" /></>} />
                <span className="flex-1">Personal Info</span>
                <svg width="12" height="12" viewBox="0 0 24 24" className={`transition ${personalOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m6 9 6 6 6-6" /></svg>
              </summary>
              {[
                ["account", "Personal information"],
                ["security", "Sign-in and security"],
                ["preferences", "Addresses"],
              ].map(([id, label]) => (
                <Link
                  key={id}
                  href={`/account?tab=${id}`}
                  className={`ml-9 mt-0.5 block rounded-lg px-3 py-2 text-[13px] ${
                    tab === id ? "bg-[#edf1f5] font-semibold text-[#0f1c3f]" : "text-[#5b6780] hover:text-[#2f6bff]"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </details>

            {NAV.slice(2).map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] ${
                  tab === item.id ? "bg-[#eaf1ff] font-semibold text-[#2f6bff]" : "font-medium text-[#3a4a66] hover:bg-white"
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}

            <details open={prefsOpen} onToggle={(e) => setPrefsOpen(e.currentTarget.open)} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium text-[#3a4a66] hover:bg-white [&::-webkit-details-marker]:hidden">
                <Icon d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM4 12a8 8 0 0 1 .3-2.2l-2-1.2 2-3.4 2.3.6A8 8 0 0 1 9 4.3L9.2 2h5.6L15 4.3a8 8 0 0 1 2.4 1.5l2.3-.6 2 3.4-2 1.2A8 8 0 0 1 20 12a8 8 0 0 1-.3 2.2l2 1.2-2 3.4-2.3-.6A8 8 0 0 1 15 19.7L14.8 22H9.2L9 19.7a8 8 0 0 1-2.4-1.5l-2.3.6-2-3.4 2-1.2A8 8 0 0 1 4 12Z" />
                <span className="flex-1">Account Preferences</span>
                <svg width="12" height="12" viewBox="0 0 24 24" className={`transition ${prefsOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m6 9 6 6 6-6" /></svg>
              </summary>
              <Link href="/account?tab=preferences" className={`ml-9 mt-0.5 block rounded-lg px-3 py-2 text-[13px] ${tab === "preferences" ? "font-semibold text-[#2f6bff]" : "text-[#5b6780] hover:text-[#2f6bff]"}`}>
                Addresses
              </Link>
            </details>

            <details open={sellingOpen} onToggle={(e) => setSellingOpen(e.currentTarget.open)} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium text-[#3a4a66] hover:bg-white [&::-webkit-details-marker]:hidden">
                <Icon d="M12 2v4M8 6h8l1.5 4H6.5L8 6Zm-1.5 4h11v10H6.5V10Z" />
                <span className="flex-1">Selling</span>
                <svg width="12" height="12" viewBox="0 0 24 24" className={`transition ${sellingOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m6 9 6 6 6-6" /></svg>
              </summary>
              <Link href="/account?tab=selling" className={`ml-9 mt-0.5 block rounded-lg px-3 py-2 text-[13px] ${tab === "selling" ? "font-semibold text-[#2f6bff]" : "text-[#5b6780] hover:text-[#2f6bff]"}`}>
                Seller tools
              </Link>
              <Link href="/sell/listings" className="ml-9 block rounded-lg px-3 py-2 text-[13px] text-[#5b6780] hover:text-[#2f6bff]">
                Your listings
              </Link>
            </details>

            <Link
              href="/account?tab=feedback"
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] ${
                tab === "feedback" ? "bg-[#eaf1ff] font-semibold text-[#2f6bff]" : "font-medium text-[#3a4a66] hover:bg-white"
              }`}
            >
              <Icon d="M5 6h14v9H9l-4 3V6Z" />
              Feedback
            </Link>

            <details open={donateOpen} onToggle={(e) => setDonateOpen(e.currentTarget.open)} className="group">
              <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium text-[#3a4a66] hover:bg-white [&::-webkit-details-marker]:hidden">
                <Icon d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.6-7 10-7 10Z" />
                <span className="flex-1">Donation Preferences</span>
                <svg width="12" height="12" viewBox="0 0 24 24" className={`transition ${donateOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.2"><path d="m6 9 6 6 6-6" /></svg>
              </summary>
              <Link href="/account?tab=donations" className={`ml-9 mt-0.5 block rounded-lg px-3 py-2 text-[13px] ${tab === "donations" ? "font-semibold text-[#2f6bff]" : "text-[#5b6780] hover:text-[#2f6bff]"}`}>
                Charity settings
              </Link>
            </details>
          </nav>

          <div className="relative mt-8 overflow-hidden rounded-2xl bg-[#eaf6ff] p-4">
            {tab === "feedback" ? (
              <span className="relative z-10 mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#2f6bff] shadow-sm">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <path d="M12 3 5 6.2v5.3c0 4.2 2.7 8 7 9.5 4.3-1.5 7-5.3 7-9.5V6.2L12 3Z" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
              </span>
            ) : null}
            <p className="relative z-10 text-[15px] font-extrabold leading-snug text-[#0f1c3f]">
              {tab === "feedback" ? (
                <>
                  Your Voice
                  <br />
                  Matters!
                </>
              ) : (
                <>
                  Your Account,
                  <br />
                  Your Control
                </>
              )}
            </p>
            <p className="relative z-10 mt-1.5 max-w-[180px] text-[12px] leading-relaxed text-[#5b6780]">
              {tab === "feedback"
                ? "Help us improve and make Nexlo better for everyone."
                : "Keep your information safe and up to date."}
            </p>
            <svg viewBox="0 0 240 80" className="absolute inset-x-0 bottom-0 h-16 w-full" aria-hidden>
              <defs>
                <linearGradient id="acctWave" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0" stopColor="#7ee7d6" />
                  <stop offset="1" stopColor="#2f6bff" />
                </linearGradient>
              </defs>
              <path d="M0 40 C 50 10, 90 70, 140 40 S 200 10, 240 38 L240 80 L0 80 Z" fill="url(#acctWave)" opacity="0.55" />
            </svg>
          </div>
        </aside>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

export { initials, fullName };
