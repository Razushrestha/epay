"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { accountApi } from "@/lib/account-api";
import { canAccessNav, NAV_QUEUE_KEY, type AdminQueues } from "@/lib/staff-nav";
import { money } from "@/components/admin/admin-ui";
import BrandLogo from "@/components/BrandLogo";

type SearchHit = {
  users: { public_id: string; email: string | null; phone: string | null; status: string; name: string }[];
  orders: { id: number; order_number: string; status: string; total_amount: number; customer: string }[];
  listings: { id: number; title: string; status: string; moderation_status: string; price: number | null; seller: string }[];
};

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

const NAV = [
  { id: "dashboard", href: "/admin", label: "Dashboard" },
  { id: "users", href: "/admin/users", label: "Users" },
  { id: "products", href: "/admin/products", label: "Products" },
  { id: "catalog", href: "/admin/catalog", label: "Catalog" },
  { id: "orders", href: "/admin/orders", label: "Orders" },
  { id: "payouts", href: "/admin/payouts", label: "Payouts" },
  { id: "finance", href: "/admin/finance", label: "Finance" },
  { id: "disputes", href: "/admin/disputes", label: "Disputes" },
  { id: "kyc", href: "/admin/kyc", label: "KYC" },
  { id: "appeals", href: "/admin/appeals", label: "Appeals" },
  { id: "moderation", href: "/admin/moderation", label: "Moderation" },
  { id: "tickets", href: "/admin/tickets", label: "Tickets" },
  { id: "cms", href: "/admin/cms", label: "CMS" },
  { id: "trust", href: "/admin/trust", label: "Trust" },
  { id: "audit", href: "/admin/audit", label: "Audit log" },
  { id: "messages", href: "/admin/messages", label: "Messages" },
  { id: "reviews", href: "/admin/reviews", label: "Reviews" },
  { id: "analytics", href: "/admin/analytics", label: "Analytics" },
  { id: "roles", href: "/admin/roles", label: "Roles" },
  { id: "settings", href: "/admin/settings", label: "Settings" },
  { id: "uat", href: "/admin/uat", label: "Go-live UAT" },
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
  queues = {},
  queuesLive = false,
  onSignOut,
  children,
}: {
  user: ChromeUser;
  unreadMessages?: number;
  queues?: AdminQueues;
  queuesLive?: boolean;
  onSignOut: () => void;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchHits, setSearchHits] = useState<SearchHit | null>(null);
  const [searchBusy, setSearchBusy] = useState(false);
  const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.displayName || "Admin";
  const role = user.staffRole || "support";
  const navItems = useMemo(
    () => NAV.filter((item) => canAccessNav(role, item.id, true)),
    [role],
  );
  const mergedQueues: AdminQueues = {
    ...queues,
    messages: queues.messages ?? unreadMessages,
  };

  useEffect(() => {
    const q = searchQ.trim();
    if (q.length < 2) {
      setSearchHits(null);
      return;
    }
    const t = window.setTimeout(() => {
      setSearchBusy(true);
      accountApi<{ data: SearchHit }>(`/api/v1/admin/search?q=${encodeURIComponent(q)}`)
        .then((body) => {
          setSearchHits(body.data);
          setSearchOpen(true);
        })
        .catch(() => setSearchHits(null))
        .finally(() => setSearchBusy(false));
    }, 280);
    return () => window.clearTimeout(t);
  }, [searchQ]);

  function goSearch(href: string) {
    setSearchOpen(false);
    setSearchQ("");
    setSearchHits(null);
    router.push(href);
  }

  const hitCount =
    (searchHits?.users.length || 0) + (searchHits?.orders.length || 0) + (searchHits?.listings.length || 0);

  return (
    <div className="relative min-h-dvh overflow-x-clip bg-[#f4f8fd]">
      <div className="pointer-events-none absolute -left-24 bottom-0 h-[420px] w-[420px] rounded-full bg-[#d7ecff] opacity-70 blur-3xl" />
      <div className="pointer-events-none absolute -left-10 bottom-24 h-40 w-40 rounded-full bg-[#c8f3ea] opacity-50 blur-2xl" />

      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur">
        <div className="flex h-[60px] items-center gap-3 px-3 sm:h-[72px] sm:gap-4 sm:px-5 lg:px-7">
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full text-[#0f1c3f] hover:bg-[#f3f7fc] lg:hidden"
            aria-expanded={navOpen}
            aria-label={navOpen ? "Close admin menu" : "Open admin menu"}
            onClick={() => setNavOpen((v) => !v)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              {navOpen ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
          <Link href="/admin" className="shrink-0" aria-label="MeroAuction admin">
            <BrandLogo className="text-[26px]" />
          </Link>
          <div className="relative mx-auto hidden min-w-0 max-w-[560px] flex-1 md:block">
            <label className="flex h-11 items-center gap-2 rounded-full border border-[#e6eef6] bg-[#f7fafd] px-4">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8a94a6" strokeWidth="2" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                name="q"
                type="search"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                onFocus={() => searchHits && setSearchOpen(true)}
                placeholder="Search users, orders, listings…"
                className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[#9aa3b2]"
                autoComplete="off"
              />
              {searchBusy ? <span className="text-[11px] text-[#8a94a6]">…</span> : null}
            </label>
            {searchOpen && searchQ.trim().length >= 2 ? (
              <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-40 overflow-hidden rounded-2xl border border-[#e7eef6] bg-white shadow-[0_16px_40px_-20px_rgba(15,28,63,0.45)]">
                {!hitCount ? (
                  <p className="px-4 py-3 text-[13px] text-[#6b7587]">No matches for “{searchQ.trim()}”.</p>
                ) : (
                  <div className="max-h-[420px] overflow-y-auto p-2">
                    {searchHits?.users.length ? (
                      <div className="mb-2">
                        <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#8a94a6]">Users</p>
                        {searchHits.users.map((u) => (
                          <button
                            key={u.public_id}
                            type="button"
                            className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-[#f4f8fd]"
                            onClick={() => goSearch(`/admin/users?q=${encodeURIComponent(u.email || u.public_id)}`)}
                          >
                            <span>
                              <span className="block text-[13.5px] font-semibold text-[#0f1c3f]">{u.name}</span>
                              <span className="block text-[12px] text-[#8a94a6]">{u.email || u.phone}</span>
                            </span>
                            <span className="text-[11px] capitalize text-[#6b7587]">{u.status}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {searchHits?.orders.length ? (
                      <div className="mb-2">
                        <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#8a94a6]">Orders</p>
                        {searchHits.orders.map((o) => (
                          <button
                            key={o.id}
                            type="button"
                            className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-[#f4f8fd]"
                            onClick={() => goSearch(`/admin/orders?q=${encodeURIComponent(o.order_number)}`)}
                          >
                            <span>
                              <span className="block text-[13.5px] font-semibold text-[#0f1c3f]">#{o.order_number}</span>
                              <span className="block text-[12px] text-[#8a94a6]">{o.customer}</span>
                            </span>
                            <span className="text-[12px] font-semibold text-[#0f1c3f]">{money(o.total_amount)}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                    {searchHits?.listings.length ? (
                      <div>
                        <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#8a94a6]">Listings</p>
                        {searchHits.listings.map((l) => (
                          <button
                            key={l.id}
                            type="button"
                            className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-[#f4f8fd]"
                            onClick={() => goSearch(`/admin/products?q=${encodeURIComponent(l.title)}`)}
                          >
                            <span>
                              <span className="block text-[13.5px] font-semibold text-[#0f1c3f]">{l.title}</span>
                              <span className="block text-[12px] text-[#8a94a6]">{l.seller}</span>
                            </span>
                            <span className="text-[11px] capitalize text-[#6b7587]">{l.status}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ) : null}
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <NotificationBell variant="staff" queues={mergedQueues} live={queuesLive} />
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
                  <span className="block text-[11px] capitalize text-[#8a94a6]">{role.replace(/_/g, " ")}</span>
                </span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7587" strokeWidth="2.2" className="hidden sm:block"><path d="m6 9 6 6 6-6" /></svg>
              </button>
              {menuOpen ? (
                <div className="absolute right-0 mt-2 w-44 rounded-xl border border-[#e7eef6] bg-white py-1 shadow-lg">
                  <Link href="/" className="block px-3 py-2 text-[13px] text-[#0f1c3f] hover:bg-[#f4f8fd]" onClick={() => setMenuOpen(false)}>Storefront</Link>
                  <Link href="/account" className="block px-3 py-2 text-[13px] text-[#0f1c3f] hover:bg-[#f4f8fd]" onClick={() => setMenuOpen(false)}>Account</Link>
                  <button type="button" onClick={onSignOut} className="block w-full px-3 py-2 text-left text-[13px] text-[#0f1c3f] hover:bg-[#f4f8fd]">Sign out</button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <div className="relative mx-auto grid max-w-[1440px] gap-6 px-3 py-4 sm:px-4 lg:grid-cols-[228px_minmax(0,1fr)] lg:px-6 lg:py-5">
        {navOpen ? (
          <button
            type="button"
            aria-label="Close admin menu"
            className="fixed inset-0 z-20 bg-[#0f1c3f]/30 lg:hidden"
            onClick={() => setNavOpen(false)}
          />
        ) : null}
        <aside
          className={`relative flex-col ${
            navOpen
              ? "fixed inset-y-0 left-0 z-30 flex w-[min(100%,280px)] overflow-y-auto bg-[#f4f8fd] px-3 py-4 shadow-[8px_0_24px_-16px_rgba(15,28,63,0.35)] lg:static lg:w-auto lg:bg-transparent lg:px-0 lg:py-0 lg:shadow-none"
              : "hidden lg:flex"
          }`}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a")) setNavOpen(false);
          }}
        >
          <nav className="space-y-1">
            {navItems.map((item) => {
              const active =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname.startsWith(item.href) || (item.id === "products" && pathname.startsWith("/admin/catalog"));
              const queueKey = NAV_QUEUE_KEY[item.id];
              const badge = queueKey ? Number(mergedQueues[queueKey] || 0) : 0;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[14px] transition ${
                    active ? "bg-[#e8f0ff] font-semibold text-[#3665f3]" : "font-medium text-[#4b5873] hover:bg-white/80"
                  }`}
                >
                  <span className="flex-1">{item.label}</span>
                  {badge > 0 ? (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#3665f3] px-1.5 text-[11px] font-bold text-white">
                      {badge > 99 ? "99+" : badge}
                    </span>
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
              Take your business to the next level with MeroAuction.
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
