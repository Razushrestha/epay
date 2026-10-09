"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { NotificationBell } from "@/components/notifications/NotificationBell";

type ChromeUser = {
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  avatarUrl: string | null;
  staffRole?: string | null;
};

function initials(user: ChromeUser) {
  const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.displayName || user.email || "A";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function Icon({ d, paths }: { d?: string; paths?: ReactNode }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {d ? <path d={d} /> : paths}
    </svg>
  );
}

const NAV = [
  { id: "dashboard", href: "/admin", label: "Dashboard", icon: "M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" },
  { id: "users", href: "/admin/users", label: "Users", icon: "M16 19c0-2.8-2.2-5-6-5s-6 2.2-6 5M10 11a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4ZM20 19v-2.4c0-1.7-1-3.2-2.6-3.8M16.4 5.2a3.2 3.2 0 0 1 0 6.1" },
  { id: "products", href: "/admin/products", label: "Products", icon: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" },
  { id: "orders", href: "/admin/orders", label: "Orders", icon: "M7 4h10l2 4H5l2-4Zm-2 4h14v12H5V8Zm4 4h6" },
  { id: "payouts", href: "/admin/payouts", label: "Payouts", icon: "M4 7h16v10H4V7Zm0 4h16M8 15h4" },
  { id: "finance", href: "/admin/finance", label: "Finance", icon: "M4 19V8l8-4 8 4v11H4Zm4-2h2m4 0h2m4 0h2" },
  { id: "disputes", href: "/admin/disputes", label: "Disputes", icon: "M12 3 4 7v5c0 5 3.5 9 8 10 4.5-1 8-5 8-10V7l-8-4Z" },
  { id: "moderation", href: "/admin/moderation", label: "Moderation", icon: "M4 5h16v4H4V5Zm0 7h10v7H4v-7Zm12 0h4v7h-4v-7Z" },
  { id: "tickets", href: "/admin/tickets", label: "Tickets", icon: "M4 7h16v3l-1.5 1.5L20 13v4H4v-4l1.5-1.5L4 10V7Z" },
  { id: "cms", href: "/admin/cms", label: "CMS", icon: "M4 5h16v14H4V5Zm4 4h8M8 13h5" },
  { id: "trust", href: "/admin/trust", label: "Trust", icon: "M12 3 5 6.2v5.3c0 4.2 2.7 8 7 9.5 4.3-1.5 7-5.3 7-9.5V6.2L12 3Z" },
  { id: "audit", href: "/admin/audit", label: "Audit log", icon: "M8 4h8v4H8V4ZM5 10h14v10H5V10Zm4 3h6" },
  { id: "messages", href: "/admin/messages", label: "Messages", icon: "M4 6h16v10H8l-4 4V6Z" },
  { id: "reviews", href: "/admin/reviews", label: "Reviews", icon: "M12 3.6 14.4 9l6 .5-4.6 3.9 1.5 5.8L12 16.6 6.7 19.2 8.2 13.4 3.6 9.5 9.6 9 12 3.6Z" },
  { id: "analytics", href: "/admin/analytics", label: "Analytics", icon: "M4 19V9m6 10V5m6 14v-7m6 7V3" },
  { id: "roles", href: "/admin/roles", label: "Roles", icon: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM2 19c.6-3 2.8-5 6-5s5.4 2 6 5M14 19c.4-2 1.6-3.5 4-4.2 2.2.6 3.6 2 4 4.2" },
  { id: "settings", href: "/admin/settings", label: "Settings", icon: "M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7ZM4 12a8 8 0 0 1 .3-2.2l-2-1.2 2-3.4 2.3.6A8 8 0 0 1 9 4.3L9.2 2h5.6L15 4.3a8 8 0 0 1 2.4 1.5l2.3-.6 2 3.4-2 1.2A8 8 0 0 1 20 12a8 8 0 0 1-.3 2.2l2 1.2-2 3.4-2.3-.6A8 8 0 0 1 15 19.7L14.8 22H9.2L9 19.7a8 8 0 0 1-2.4-1.5l-2.3.6-2-3.4 2-1.2A8 8 0 0 1 4 12Z" },
];

function Rocket() {
  return (
    <svg viewBox="0 0 90 90" className="h-[86px] w-[86px]" aria-hidden>
      <ellipse cx="46" cy="78" rx="18" ry="6" fill="#cfe4ff" />
      <path d="M45 8c14 16 16 36 10 52-8 3-18 3-26 0C23 44 27 24 45 8Z" fill="url(#rkBody)" />
      <circle cx="46" cy="32" r="7" fill="#d9ecff" stroke="#7eb6ff" strokeWidth="2" />
      <path d="M29 48c-8 4-14 14-14 14 10 0 16-4 20-9Z" fill="#3665f3" />
      <path d="M61 48c8 4 14 14 14 14-10 0-16-4-20-9Z" fill="#3665f3" />
      <path d="M40 62c2 10 6 16 6 16s4-6 6-16c-4 2-8 2-12 0Z" fill="#7ee7d6" />
      <path d="M42 66c2 7 4 11 4 11s2-4 4-11" fill="#3665f3" opacity=".35" />
      <defs>
        <linearGradient id="rkBody" x1="30" y1="10" x2="60" y2="70">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#d7e8ff" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function AdminChrome({
  user,
  unreadMessages = 0,
  onSignOut,
  children,
}: {
  user: ChromeUser;
  unreadMessages?: number;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.displayName || "Admin";

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#f4f8fd]">
      <div className="pointer-events-none absolute -left-24 bottom-0 h-[420px] w-[420px] rounded-full bg-[#d7ecff] opacity-70 blur-3xl" />
      <div className="pointer-events-none absolute -left-10 bottom-24 h-40 w-40 rounded-full bg-[#c8f3ea] opacity-50 blur-2xl" />

      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur">
        <div className="flex h-[72px] items-center gap-4 px-5 lg:px-7">
          <Link href="/admin" className="shrink-0" aria-label="Nexlo admin">
            <Image src="/logo-transparent.png" alt="Nexlo" width={808} height={256} className="h-10 w-auto" priority />
          </Link>
          <form action="/admin" method="get" className="mx-auto hidden min-w-0 max-w-[560px] flex-1 md:block">
            <label className="flex h-11 items-center gap-2 rounded-full border border-[#e6eef6] bg-[#f7fafd] px-4">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a94a6" strokeWidth="2" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input name="q" type="search" placeholder="Search for anything..." className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[#9aa3b2]" />
            </label>
          </form>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <NotificationBell />
            <button type="button" className="hidden items-center gap-1.5 rounded-full px-2 py-1 text-[13px] text-[#3a4a66] hover:bg-[#f3f7fc] sm:flex">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
                <circle cx="12" cy="12" r="9" />
                <path d="M3 12h18M12 3c2.6 2.6 3.9 5.6 3.9 9s-1.3 6.4-3.9 9c-2.6-2.6-3.9-5.6-3.9-9S9.4 5.6 12 3Z" />
              </svg>
              Nepal (NPR)
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7587" strokeWidth="2.2"><path d="m6 9 6 6 6-6" /></svg>
            </button>
            <div className="relative">
              <button type="button" onClick={() => setMenuOpen((v) => !v)} className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 hover:bg-[#f3f7fc]">
                {user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={user.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#dbe7ff] text-[12px] font-bold text-[#3665f3]">{initials(user)}</span>
                )}
                <span className="hidden text-left sm:block">
                  <span className="block text-[13.5px] font-semibold leading-tight text-[#0f1c3f]">{name}</span>
                  <span className="block text-[11px] capitalize text-[#8a94a6]">{(user.staffRole || "super_admin").replace(/_/g, " ")}</span>
                </span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7587" strokeWidth="2.2" className="hidden sm:block"><path d="m6 9 6 6 6-6" /></svg>
              </button>
              {menuOpen ? (
                <div className="absolute right-0 mt-2 w-44 rounded-xl border border-[#e7eef6] bg-white py-1 shadow-lg">
                  <Link href="/" className="block px-3 py-2 text-[13px] text-[#0f1c3f] hover:bg-[#f7f7f7]" onClick={() => setMenuOpen(false)}>Storefront</Link>
                  <Link href="/account" className="block px-3 py-2 text-[13px] text-[#0f1c3f] hover:bg-[#f7f7f7]" onClick={() => setMenuOpen(false)}>Account</Link>
                  <button type="button" onClick={onSignOut} className="block w-full px-3 py-2 text-left text-[13px] text-[#0f1c3f] hover:bg-[#f7f7f7]">Sign out</button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <div className="relative mx-auto grid max-w-[1440px] gap-6 px-4 py-5 lg:grid-cols-[228px_minmax(0,1fr)] lg:px-6">
        <aside className="relative flex flex-col">
          <nav className="space-y-1">
            {NAV.map((item) => {
              const active =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href) || (item.id === "products" && pathname.startsWith("/admin/catalog"));
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[14px] transition ${
                    active ? "bg-[#e8f0ff] font-semibold text-[#3665f3]" : "font-medium text-[#4b5873] hover:bg-white/80"
                  }`}
                >
                  <Icon d={item.icon} />
                  <span className="flex-1">{item.label}</span>
                  {item.id === "messages" && unreadMessages > 0 ? (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#3665f3] px-1.5 text-[11px] font-bold text-white">{unreadMessages}</span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          <div className="relative mt-10 overflow-hidden rounded-[22px] bg-white/80 p-4 shadow-[0_8px_30px_rgba(54,101,243,0.06)] ring-1 ring-[#e7eef6]">
            <div className="absolute -right-2 -top-2">
              <Rocket />
            </div>
            <p className="relative z-10 pt-10 text-[16px] font-extrabold text-[#0f1c3f]">Grow Faster</p>
            <p className="relative z-10 mt-1 max-w-[150px] text-[12px] leading-relaxed text-[#5b6780]">
              Take your business to the next level with Nexlo.
            </p>
            <Link href="/sell/create" className="relative z-10 mt-4 inline-flex h-9 items-center rounded-full bg-[#3665f3] px-4 text-[13px] font-semibold text-white shadow-[0_6px_16px_rgba(54,101,243,0.28)]">
              Upgrade Now →
            </Link>
          </div>
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
