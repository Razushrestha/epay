"use client";

import Link from "next/link";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { accountApi, setToken } from "@/lib/account-api";
import { AccountChrome, fullName, initials } from "@/components/account/AccountChrome";
import { FeedbackBoard } from "@/components/account/FeedbackBoard";
import { MessagesInbox } from "@/components/account/MessagesInbox";
import { SellerHub } from "@/components/account/SellerHub";
import { ReturnsBoard } from "@/components/account/ReturnsBoard";
import { TicketsBoard } from "@/components/account/TicketsBoard";
import { RecentlyViewed } from "@/components/browse/RecentlyViewed";

type User = {
  id: string;
  username: string | null;
  email: string | null;
  phone: string | null;
  accountType: string;
  status: string;
  sellerLevel: string;
  isSeller: boolean;
  isStaff: boolean;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  country: string | null;
  bio: string | null;
  avatarUrl: string | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  twoFactor: string | null;
  business: { legalName: string; registrationCountry: string | null; taxId: string | null } | null;
  feedback: { positive: number; neutral: number; negative: number };
  kyc: { status: string; reason: string | null } | null;
  social?: string[];
  createdAt?: string | null;
};

type Address = {
  public_id: string;
  label: string | null;
  full_name: string;
  phone?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  postal_code?: string | null;
  country: string;
  is_default_shipping: boolean;
  is_default_billing: boolean;
};

const ADDRESS_SLOTS = [
  {
    key: "registration",
    title: "Registration address, email and phone number",
    hint: "Your main contact address. It's important to keep it up to date and accurate.",
  },
  {
    key: "shipping",
    title: "Shipping address",
    hint: "Your main shipping address for purchases. This is where you'd like to receive items you purchase.",
  },
  {
    key: "ship_from",
    title: "Ship from address",
    hint: "Your main address where you ship packages from.",
  },
  {
    key: "return",
    title: "Return address",
    hint: "Your main return addresses where buyers can return their items to.",
  },
  {
    key: "pickup",
    title: "Payment and pick up address",
    hint: "Your preferred address for pickup orders.",
  },
] as const;

type Session = { public_id: string; user_agent: string; created_at: string; current: boolean };

function aliasTab(raw: string | null) {
  const tab = raw ?? "account";
  if (tab === "profile") return "account";
  if (tab === "addresses") return "preferences";
  if (tab === "standing") return "activity";
  return tab;
}

function maskEmail(email: string) {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  if (user.length <= 2) return `${user[0] ?? ""}**@${domain}`;
  return `${user[0]}${"*".repeat(2)}${user.slice(-1)}@${domain}`;
}

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const last2 = digits.slice(-2);
  const cc = phone.startsWith("+") ? (phone.match(/^\+\d{1,3}/)?.[0] ?? "") : "";
  return `${cc} xxxxxxxx${last2}`;
}

function findSlotAddress(list: Address[], key: string) {
  const labeled = list.find((item) => item.label === key);
  if (labeled) return labeled;
  if (key === "shipping") return list.find((item) => item.is_default_shipping) ?? null;
  if (key === "pickup") return list.find((item) => item.is_default_billing) ?? null;
  if (key === "registration") return list.find((item) => !item.label) ?? null;
  return null;
}

function formatAddress(item: Address) {
  return [item.full_name, item.line1, item.line2, [item.city, item.region, item.postal_code].filter(Boolean).join(" "), item.country]
    .filter(Boolean)
    .join(", ");
}

function fallbackUsername(user: User) {
  if (user.username) return user.username;
  const base = (user.email?.split("@")[0] || user.firstName || "user").replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase();
  return `${base}-${user.id.slice(-4)}`;
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.readAsDataURL(file);
  });
}

function Verified() {
  return (
    <span className="rounded-full bg-[#e7fbf4] px-2 py-0.5 text-[11px] font-semibold text-[#12a37e]">Verified</span>
  );
}

function EditBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-[13px] font-medium text-[#3665f3] hover:underline">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
      </svg>
      Edit
    </button>
  );
}

function InfoRow({
  icon,
  title,
  hint,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  hint: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="grid gap-3 border-b border-[#eef2f7] px-5 py-5 last:border-b-0 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto] sm:items-start">
      <div className="flex gap-3">
        <span className="mt-0.5 text-[#3665f3]">{icon}</span>
        <div>
          <p className="text-[14.5px] font-semibold text-[#0f1c3f]">{title}</p>
          <p className="mt-0.5 text-[12.5px] text-[#7a8496]">{hint}</p>
        </div>
      </div>
      <div className="text-[14px] text-[#0f1c3f]">{children}</div>
      <div className="flex shrink-0 items-center justify-end gap-3">{action}</div>
    </div>
  );
}

function SecurityField({
  title,
  description,
  action,
  open,
  onToggle,
  children,
}: {
  title: string;
  description: string;
  action: string;
  open?: boolean;
  onToggle: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="border-b border-[#e8edf3] py-5">
      <div className="grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)_auto] sm:items-start">
        <p className="text-[15px] font-semibold text-[#0f1c3f]">{title}</p>
        <p className="text-[14px] leading-relaxed text-[#5b6780]">{description}</p>
        <button type="button" onClick={onToggle} className="justify-self-start text-[14px] font-medium text-[#3665f3] hover:underline sm:justify-self-end">
          {action}
        </button>
      </div>
      {open && children ? <div className="mt-4 sm:ml-[200px] sm:mr-16">{children}</div> : null}
    </div>
  );
}

function SessionList({
  sessions,
  setSessions,
}: {
  sessions: Session[];
  setSessions: (value: Session[] | ((list: Session[]) => Session[])) => void;
}) {
  if (!sessions.length) {
    return <p className="text-[13.5px] text-[#5b6780]">No active devices found.</p>;
  }
  return (
    <ul className="space-y-2">
      {sessions.map((item) => (
        <li key={item.public_id} className="flex items-center justify-between gap-3 rounded-xl border border-[#e7eef6] px-3 py-2 text-[13px]">
          <span>
            {item.user_agent.slice(0, 80)} {item.current ? "· This device" : ""}
          </span>
          {!item.current ? (
            <button
              type="button"
              className="text-red-600"
              onClick={() =>
                accountApi(`/api/v1/account/sessions/${item.public_id}`, { method: "DELETE" }).then(() =>
                  setSessions((list) => list.filter((row) => row.public_id !== item.public_id)),
                )
              }
            >
              Revoke
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function PersonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20c.5-3.6 3.2-5.5 7-5.5s6.5 1.9 7 5.5" />
    </svg>
  );
}

function AccountDashboard({ user, levelLabel }: { user: User; levelLabel: Record<string, string> }) {
  const [counts, setCounts] = useState({ orders: 0, returns: 0, tickets: 0 });
  useEffect(() => {
    Promise.all([
      accountApi<{ data: unknown[] }>("/api/v1/orders").then((b) => b.data.length).catch(() => 0),
      accountApi<{ data: unknown[] }>("/api/v1/returns").then((b) => b.data.length).catch(() => 0),
      accountApi<{ data: unknown[] }>("/api/v1/tickets").then((b) => b.data.length).catch(() => 0),
    ]).then(([orders, returns, tickets]) => setCounts({ orders, returns, tickets }));
  }, []);
  return (
    <section className="nexlo-card p-6">
      <h1 className="text-[22px] font-extrabold text-[#0f1c3f]">Dashboard</h1>
      <p className="mt-1 text-[14px] text-[#6b7587]">Orders, returns, and support on this account.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[
          ["Status", user.status],
          ["Seller level", levelLabel[user.sellerLevel] ?? user.sellerLevel],
          ["Two-factor", user.twoFactor ? "On" : "Off"],
          ["Orders", counts.orders],
          ["Returns", counts.returns],
          ["Tickets", counts.tickets],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl bg-[#f7f7f7] p-4">
            <p className="text-[12px] text-[#7a8496]">{label}</p>
            <p className="mt-1 text-[18px] font-extrabold capitalize text-[#0f1c3f]">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-[13px]">
        <Link href="/orders" className="h-9 rounded-full border px-4 leading-9">Orders</Link>
        <Link href="/account?tab=returns" className="h-9 rounded-full border px-4 leading-9">Returns</Link>
        <Link href="/account?tab=tickets" className="h-9 rounded-full border px-4 leading-9">Support</Link>
      </div>
    </section>
  );
}

function AccountScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = aliasTab(params.get("tab"));
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [secPanel, setSecPanel] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [appSignIn, setAppSignIn] = useState(false);
  const [appeal, setAppeal] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", displayName: "", country: "", bio: "", legalName: "", username: "" });
  const [address, setAddress] = useState({
    fullName: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    region: "",
    postalCode: "",
    country: "Nepal",
  });
  const [addressSlot, setAddressSlot] = useState<string | null>(null);

  async function load() {
    const body = await accountApi<{ user: User }>("/api/v1/account");
    setUser(body.user);
    setForm({
      firstName: body.user.firstName ?? "",
      lastName: body.user.lastName ?? "",
      displayName: body.user.displayName ?? "",
      country: body.user.country ?? "",
      bio: body.user.bio ?? "",
      legalName: body.user.business?.legalName ?? "",
      username: body.user.username ?? "",
    });
  }

  useEffect(() => {
    load().catch(() => router.push("/login"));
  }, [router]);

  useEffect(() => {
    if (tab === "preferences" || tab === "account") {
      accountApi<{ data: Address[] }>("/api/v1/account/addresses").then((b) => setAddresses(b.data)).catch(() => undefined);
    }
    if (tab === "security") {
      accountApi<{ data: Session[] }>("/api/v1/account/sessions").then((b) => setSessions(b.data)).catch(() => undefined);
    }
  }, [tab]);

  async function saveProfile(extra: Record<string, unknown> = {}) {
    if (!user) return;
    setError(null);
    try {
      const body = await accountApi<{ user: User }>("/api/v1/account/profile", {
        method: "PATCH",
        body: JSON.stringify({
          ...form,
          ...extra,
          accountType: user.accountType,
          business: user.accountType === "business" ? { legalName: form.legalName, registrationCountry: form.country } : undefined,
        }),
      });
      setUser(body.user);
      setEditing(null);
      setNotice("Profile saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
    }
  }

  if (!user) {
    return <main className="flex min-h-dvh items-center justify-center bg-[#f3f7fc] text-[14px] text-[#667085]">Loading your account…</main>;
  }

  const name = fullName(user);
  const defaultAddress = addresses.find((a) => a.is_default_shipping) ?? addresses[0];
  const levelLabel: Record<string, string> = {
    new: "New",
    standard: "Standard",
    above_standard: "Above standard",
    top_rated: "Top rated",
  };

  return (
    <AccountChrome
      user={user}
      tab={tab}
      onSignOut={() => {
        setToken(null);
        router.push("/");
      }}
    >
      {error ? <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p> : null}
      {notice ? <p className="mb-4 rounded-xl bg-[#eaf1ff] px-4 py-3 text-[13px] text-[#2a4fa8]">{notice}</p> : null}

      {tab === "account" && (
        <>
          <section className="hero-bg relative overflow-hidden rounded-[16px] px-5 py-6 sm:px-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.avatarUrl} alt="" className="h-[84px] w-[84px] rounded-full object-cover ring-4 ring-white" />
              ) : (
                <span className="flex h-[84px] w-[84px] items-center justify-center rounded-full bg-white text-[22px] font-extrabold text-[#3665f3] ring-4 ring-white">
                  {initials(user)}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[14px] text-[#5b6780]">Welcome back,</p>
                <h1 className="mt-0.5 flex flex-wrap items-center gap-2 text-[28px] font-extrabold tracking-tight text-[#0f1c3f]">
                  {name}
                  {user.emailVerified ? (
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#3665f3] text-white" title="Verified">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
                        <path d="m5 12.5 4.5 4.5L19 7.5" />
                      </svg>
                    </span>
                  ) : null}
                </h1>
                <p className="mt-1 text-[13.5px] text-[#6b7587]">Manage your account information and preferences.</p>
              </div>
              <button
                type="button"
                onClick={() => setEditing(editing === "profile" ? null : "profile")}
                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-[#d7e3f4] bg-white px-4 text-[13.5px] font-semibold text-[#3665f3] shadow-sm hover:bg-[#f7fbff]"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
                </svg>
                Edit Profile
              </button>
            </div>
            {editing === "profile" ? (
              <form
                className="mt-5 grid gap-3 rounded-2xl bg-white/80 p-4 sm:grid-cols-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  saveProfile();
                }}
              >
                <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="First name" className="h-10 rounded-full border border-[#e5e7eb] px-4" />
                <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Last name" className="h-10 rounded-full border border-[#e5e7eb] px-4" />
                <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="Display name" className="h-10 rounded-full border border-[#e5e7eb] px-4 sm:col-span-2" />
                <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="Country" className="h-10 rounded-full border border-[#e5e7eb] px-4" />
                <button className="h-10 rounded-full bg-[#3665f3] px-5 text-[14px] font-semibold text-white">Save profile</button>
              </form>
            ) : null}
          </section>

          <section className="mt-5 overflow-hidden nexlo-card">
            <div className="flex items-start gap-3 px-5 pt-5">
              <span className="text-[#3665f3]"><PersonIcon /></span>
              <div>
                <h2 className="text-[16px] font-extrabold text-[#0f1c3f]">Personal info</h2>
                <p className="text-[13px] text-[#7a8496]">Your basic information and contact details.</p>
              </div>
            </div>

            <InfoRow icon={<PersonIcon />} title="Username" hint="Your unique username for logging in." action={<EditBtn onClick={() => setEditing(editing === "username" ? null : "username")} />}>
              {editing === "username" ? (
                <form className="flex max-w-sm gap-2" onSubmit={(e) => { e.preventDefault(); saveProfile({ username: form.username }); }}>
                  <input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="h-9 flex-1 rounded-full border px-3" />
                  <button className="h-9 rounded-full bg-[#3665f3] px-3 text-[13px] font-semibold text-white">Save</button>
                </form>
              ) : (
                fallbackUsername(user)
              )}
            </InfoRow>

            <InfoRow icon={<PersonIcon />} title="Account type" hint="Your current account type.">
              <span className="rounded-full bg-[#e7fbf4] px-2.5 py-0.5 text-[12.5px] font-semibold capitalize text-[#12a37e]">
                {user.accountType === "business" ? "Business" : "Individual"}
              </span>
            </InfoRow>

            <InfoRow
              icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
                  <rect x="3" y="5" width="18" height="14" rx="2.5" />
                  <path d="m3.5 7 8.5 6 8.5-6" />
                </svg>
              }
              title="Contact info"
              hint="Email address and phone number."
              action={
                <span className="flex items-center gap-3">
                  {!user.emailVerified || !user.phoneVerified ? (
                    <Link href="/verify" className="text-[13px] font-medium text-[#3665f3] hover:underline">Verify</Link>
                  ) : null}
                  <EditBtn onClick={() => setEditing(editing === "contact" ? null : "contact")} />
                </span>
              }
            >
              <div className="space-y-1.5">
                {user.email ? (
                  <p className="flex flex-wrap items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8a94a6" strokeWidth="1.7" aria-hidden><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m3.5 7 8.5 6 8.5-6" /></svg>
                    {maskEmail(user.email)}
                    {user.emailVerified ? <Verified /> : <span className="text-[12px] text-[#b45309]">Unverified</span>}
                  </p>
                ) : <p className="text-[#7a8496]">No email on file</p>}
                {user.phone ? (
                  <p className="flex flex-wrap items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8a94a6" strokeWidth="1.7" aria-hidden><path d="M7 3h4l1 4-2 2a12 12 0 0 0 5 5l2-2 4 1v4a2 2 0 0 1-2 2A16 16 0 0 1 3 7a2 2 0 0 1 2-2Z" /></svg>
                    {maskPhone(user.phone)}
                    {user.phoneVerified ? <Verified /> : <span className="text-[12px] text-[#b45309]">Unverified</span>}
                  </p>
                ) : <p className="text-[#7a8496]">No phone on file</p>}
                {editing === "contact" ? (
                  <p className="text-[12.5px] text-[#6b7587]">Email and phone are set at registration. Use Verify to confirm them.</p>
                ) : null}
              </div>
            </InfoRow>

            <InfoRow
              icon={<PersonIcon />}
              title="Phone number"
              hint="Your verified phone number."
              action={<EditBtn onClick={() => setEditing(editing === "phone" ? null : "phone")} />}
            >
              <p className="flex flex-wrap items-center gap-2">
                {user.phone ? maskPhone(user.phone) : "Not added"}
                {user.phone && user.phoneVerified ? <Verified /> : null}
              </p>
            </InfoRow>

            <InfoRow
              icon={<PersonIcon />}
              title="Personal info"
              hint="Your name and address."
              action={<EditBtn onClick={() => setEditing(editing === "personal" ? null : "personal")} />}
            >
              {editing === "personal" ? (
                <form className="max-w-sm space-y-2" onSubmit={(e) => { e.preventDefault(); saveProfile(); }}>
                  <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="First name" className="h-9 w-full rounded-full border px-3" />
                  <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Last name" className="h-9 w-full rounded-full border px-3" />
                  <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="Country" className="h-9 w-full rounded-full border px-3" />
                  <button className="h-9 rounded-full bg-[#3665f3] px-4 text-[13px] font-semibold text-white">Save</button>
                </form>
              ) : (
                <div>
                  <p className="font-semibold">Owner name, address</p>
                  <p>{name}</p>
                  {defaultAddress ? (
                    <>
                      <p>{defaultAddress.line1}</p>
                      <p>{defaultAddress.city}{defaultAddress.country ? `, ${defaultAddress.country}` : ""}</p>
                    </>
                  ) : (
                    <p>{user.country || "No address saved yet"}</p>
                  )}
                </div>
              )}
            </InfoRow>
          </section>
        </>
      )}

      {tab === "dashboard" && <AccountDashboard user={user} levelLabel={levelLabel} />}

      {tab === "tickets" && <TicketsBoard />}

      {tab === "messages" && <MessagesInbox />}

      {tab === "payment" && (
        <section className="nexlo-card p-8">
          <h1 className="text-[22px] font-extrabold text-[#0f1c3f]">Payment information</h1>
          <p className="mt-2 text-[14px] text-[#6b7587]">Checkout uses eSewa and Khalti. Seller payout accounts live under Selling.</p>
          <NotificationPrefs />
        </section>
      )}

      {tab === "donations" && (
        <section className="nexlo-card p-8">
          <h1 className="text-[22px] font-extrabold text-[#0f1c3f]">Donation preferences</h1>
          <p className="mt-2 text-[14px] text-[#6b7587]">Choose whether rounding up at checkout supports a charity. This setting is coming next.</p>
        </section>
      )}

      {tab === "preferences" && (
        <section className="nexlo-card px-6 py-6 sm:px-8">
          <h1 className="text-[28px] font-bold tracking-tight text-[#0f1c3f]">Addresses</h1>
          <div className="mt-2">
            {ADDRESS_SLOTS.map((slot) => {
              const saved = findSlotAddress(addresses, slot.key);
              const open = addressSlot === slot.key;
              return (
                <div key={slot.key} className="border-b border-[#e8edf3] py-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="text-[16px] font-bold text-[#0f1c3f]">{slot.title}</h2>
                      <p className="mt-1 max-w-[560px] text-[14px] leading-relaxed text-[#6b7587]">{slot.hint}</p>
                      {saved && !open ? (
                        <p className="mt-2 text-[13.5px] text-[#3a4a66]">{formatAddress(saved)}</p>
                      ) : null}
                      {slot.key === "registration" && !open ? (
                        <p className="mt-1 text-[13px] text-[#6b7587]">
                          {user.email ?? "No email"} · {user.phone ?? "No phone"}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (open) {
                          setAddressSlot(null);
                          return;
                        }
                        setAddressSlot(slot.key);
                        setAddress({
                          fullName: saved?.full_name || name,
                          phone: saved?.phone || user.phone || "",
                          line1: saved?.line1 || "",
                          line2: saved?.line2 || "",
                          city: saved?.city || "",
                          region: saved?.region || "",
                          postalCode: saved?.postal_code || "",
                          country: saved?.country || user.country || "Nepal",
                        });
                      }}
                      className="h-9 shrink-0 rounded-full border border-[#3665f3] px-5 text-[14px] font-semibold text-[#3665f3] hover:bg-[#f5f8ff]"
                    >
                      {saved ? "Edit" : "Add"}
                    </button>
                  </div>
                  {open ? (
                    <form
                      className="mt-4 grid max-w-[560px] gap-2 sm:grid-cols-2"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        setError(null);
                        try {
                          const payload = {
                            ...address,
                            label: slot.key,
                            defaultShipping: slot.key === "shipping",
                            defaultBilling: slot.key === "pickup",
                          };
                          if (saved) {
                            await accountApi(`/api/v1/account/addresses/${saved.public_id}`, {
                              method: "PATCH",
                              body: JSON.stringify(payload),
                            });
                          } else {
                            await accountApi("/api/v1/account/addresses", {
                              method: "POST",
                              body: JSON.stringify(payload),
                            });
                          }
                          const body = await accountApi<{ data: Address[] }>("/api/v1/account/addresses");
                          setAddresses(body.data);
                          setAddressSlot(null);
                          setNotice("Address saved.");
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "Could not save address");
                        }
                      }}
                    >
                      <input value={address.fullName} onChange={(e) => setAddress({ ...address, fullName: e.target.value })} placeholder="Full name" required className="h-10 rounded-full border px-4" />
                      <input value={address.phone} onChange={(e) => setAddress({ ...address, phone: e.target.value })} placeholder="Phone" className="h-10 rounded-full border px-4" />
                      <input value={address.line1} onChange={(e) => setAddress({ ...address, line1: e.target.value })} placeholder="Street address" required className="h-10 rounded-full border px-4 sm:col-span-2" />
                      <input value={address.line2} onChange={(e) => setAddress({ ...address, line2: e.target.value })} placeholder="Apartment, suite (optional)" className="h-10 rounded-full border px-4 sm:col-span-2" />
                      <input value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} placeholder="City" required className="h-10 rounded-full border px-4" />
                      <input value={address.region} onChange={(e) => setAddress({ ...address, region: e.target.value })} placeholder="State / region" className="h-10 rounded-full border px-4" />
                      <input value={address.postalCode} onChange={(e) => setAddress({ ...address, postalCode: e.target.value })} placeholder="Postal code" className="h-10 rounded-full border px-4" />
                      <input value={address.country} onChange={(e) => setAddress({ ...address, country: e.target.value })} placeholder="Country" className="h-10 rounded-full border px-4" />
                      <div className="flex gap-2 sm:col-span-2">
                        <button className="h-10 rounded-full bg-[#3665f3] px-5 text-[14px] font-semibold text-white">Save</button>
                        {saved ? (
                          <button
                            type="button"
                            className="h-10 rounded-full px-4 text-[14px] text-red-600"
                            onClick={async () => {
                              await accountApi(`/api/v1/account/addresses/${saved.public_id}`, { method: "DELETE" });
                              setAddresses((list) => list.filter((row) => row.public_id !== saved.public_id));
                              setAddressSlot(null);
                            }}
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    </form>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {tab === "security" && (
        <section className="nexlo-card px-6 py-6 sm:px-8">
          <h1 className="text-[26px] font-bold tracking-tight text-[#0f1c3f]">Sign in and security</h1>
          <div className="mt-4">
            <SecurityField
              title="Passkeys"
              description="Sign in across devices with your face, fingerprint, or PIN using a passkey stored in your password manager."
              action="Edit"
              open={secPanel === "passkeys"}
              onToggle={() => setSecPanel(secPanel === "passkeys" ? null : "passkeys")}
            >
              <p className="text-[13.5px] text-[#5b6780]">No passkeys are saved on this account yet. Passkey sign-in will be enabled after we finish the Nexlo app rollout.</p>
            </SecurityField>

            <SecurityField
              title="Password"
              description="Create a password or modify your existing one."
              action="Edit"
              open={secPanel === "password"}
              onToggle={() => setSecPanel(secPanel === "password" ? null : "password")}
            >
              <form
                className="max-w-md space-y-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setError(null);
                  try {
                    await accountApi("/api/v1/account/password", {
                      method: "POST",
                      body: JSON.stringify({ currentPassword, password: newPassword }),
                    });
                    setCurrentPassword("");
                    setNewPassword("");
                    setSecPanel(null);
                    setNotice("Password updated.");
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Could not update password");
                  }
                }}
              >
                <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="Current password" className="h-10 w-full rounded-full border px-4" required />
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="New password" minLength={8} className="h-10 w-full rounded-full border px-4" required />
                <button className="h-10 rounded-full bg-[#3665f3] px-5 text-[14px] font-semibold text-white">Save password</button>
              </form>
            </SecurityField>

            <SecurityField
              title="2 step verification"
              description="Protect your account by adding an extra layer of security."
              action="Edit"
              open={secPanel === "twofactor"}
              onToggle={() => setSecPanel(secPanel === "twofactor" ? null : "twofactor")}
            >
              <p className="text-[14px] text-[#0f1c3f]">Status: <strong>{user.twoFactor ?? "Off"}</strong></p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className="h-9 rounded-full border px-4 text-[13px]" onClick={async () => {
                  const body = await accountApi<{ data: { secret?: string; devCode?: string } }>("/api/v1/account/2fa/start", { method: "POST", body: JSON.stringify({ method: "authenticator" }) });
                  setSecret(body.data.secret ?? "");
                  setNotice("Add this key to an authenticator app, then enter the 6-digit code.");
                }}>Use authenticator app</button>
                <button type="button" className="h-9 rounded-full border px-4 text-[13px]" onClick={async () => {
                  const body = await accountApi<{ data: { devCode?: string } }>("/api/v1/account/2fa/start", { method: "POST", body: JSON.stringify({ method: "otp" }) });
                  setNotice(body.data.devCode ? `Your code is ${body.data.devCode}` : "Enter the code we sent.");
                }}>Use email or phone code</button>
              </div>
              {secret ? <p className="mt-3 break-all rounded-lg bg-[#f6f8fb] px-3 py-2 font-mono text-[13px]">{secret}</p> : null}
              <form className="mt-3 flex max-w-md gap-2" onSubmit={async (e) => {
                e.preventDefault();
                await accountApi("/api/v1/account/2fa/confirm", { method: "POST", body: JSON.stringify({ code }) });
                setNotice("Two-factor is on.");
                await load();
              }}>
                <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" className="h-10 flex-1 rounded-full border px-4" />
                <button className="h-10 rounded-full bg-[#3665f3] px-4 text-[14px] font-semibold text-white">Confirm</button>
              </form>
            </SecurityField>

            <SecurityField
              title="Sign in with your Nexlo app"
              description="Use the Nexlo app to sign in on other devices without a password."
              action={appSignIn ? "Turn off" : "Turn on"}
              onToggle={() => setAppSignIn((v) => !v)}
            />

            <SecurityField
              title="Devices you trust"
              description="Review the devices you've decided to trust."
              action="View"
              open={secPanel === "devices"}
              onToggle={() => setSecPanel(secPanel === "devices" ? null : "devices")}
            >
              <SessionList sessions={sessions} setSessions={setSessions} />
            </SecurityField>

            <SecurityField
              title="Sign in activity"
              description="View your sign in history."
              action="View"
              open={secPanel === "activity"}
              onToggle={() => setSecPanel(secPanel === "activity" ? null : "activity")}
            >
              <SessionList sessions={sessions} setSessions={setSessions} />
            </SecurityField>

            <SecurityField
              title="Social sign in"
              description="Link your social account for faster sign in and checkout."
              action="Edit"
              open={secPanel === "social"}
              onToggle={() => setSecPanel(secPanel === "social" ? null : "social")}
            >
              <ul className="space-y-3">
                {["Google", "Facebook", "Apple"].map((provider) => {
                  const linked = (user.social ?? []).some((p) => p.toLowerCase() === provider.toLowerCase());
                  return (
                    <li key={provider} className="flex items-center justify-between gap-4 text-[14px]">
                      <span className="w-28 text-[#0f1c3f]">{provider}</span>
                      <span className="flex-1 text-[#5b6780]">{linked ? "Linked" : "Unlinked"}</span>
                      <Link href="/login" className="text-[14px] text-[#3665f3] hover:underline">{linked ? "Manage" : "Edit"}</Link>
                    </li>
                  );
                })}
              </ul>
            </SecurityField>

            <SecurityField
              title="Sign in preferences"
              description="Manage your general sign in preferences."
              action="View"
              open={secPanel === "prefs"}
              onToggle={() => setSecPanel(secPanel === "prefs" ? null : "prefs")}
            >
              <p className="text-[13.5px] text-[#5b6780]">Stay signed in on this browser after you close the tab. You can change this on the sign-in page with Remember me.</p>
            </SecurityField>

            <SecurityField
              title="Third-party app access"
              description="View or edit the third-party apps with access to your Nexlo account."
              action="View"
              open={secPanel === "apps"}
              onToggle={() => setSecPanel(secPanel === "apps" ? null : "apps")}
            >
              <p className="text-[13.5px] text-[#5b6780]">No third-party apps currently have access to this account.</p>
            </SecurityField>
          </div>
        </section>
      )}

      {tab === "feedback" && <FeedbackBoard user={user} />}

      {tab === "returns" && <ReturnsBoard userId={user.id} />}

      {tab === "selling" && (
        <section className="nexlo-card p-6">
          <h1 className="text-[22px] font-extrabold text-[#0f1c3f]">Selling</h1>
          <p className="mt-1 text-[14px]">Seller level: <strong>{levelLabel[user.sellerLevel] ?? user.sellerLevel}</strong></p>
          <p className="mt-1 text-[13px] text-[#667085]">Positive {user.feedback.positive} · Neutral {user.feedback.neutral} · Negative {user.feedback.negative}</p>
          <div className="mt-6"><SellerHub /></div>
          <SellingOrders />
          <PendingOffers />
          {!user.isSeller ? (
            <button type="button" className="mt-4 h-10 rounded-full bg-[#3665f3] px-5 text-[14px] font-semibold text-white" onClick={async () => {
              const body = await accountApi<{ data: { twoFactorRequired: boolean } }>("/api/v1/account/seller", { method: "POST", body: "{}" });
              setNotice(body.data.twoFactorRequired ? "You can sell after two-factor is turned on." : "Seller tools are on.");
              await load();
            }}>Start selling</button>
          ) : <p className="mt-3 text-[14px]">This account can buy and sell.</p>}
          <h2 className="mt-8 text-[16px] font-bold">Identity check</h2>
          <p className="mt-1 text-[13px] text-[#667085]">Status: {user.kyc?.status ?? "not submitted"}{user.kyc?.reason ? ` — ${user.kyc.reason}` : ""}.</p>
          <form className="mt-3 space-y-2" onSubmit={async (e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            const front = data.get("front");
            const addressProof = data.get("address");
            if (!(front instanceof File) || !(addressProof instanceof File)) return;
            await accountApi("/api/v1/account/kyc", {
              method: "POST",
              body: JSON.stringify({
                docType: "citizenship",
                front: await fileToDataUrl(front),
                addressProof: await fileToDataUrl(addressProof),
              }),
            });
            setNotice("Documents submitted for review.");
            await load();
          }}>
            <label className="block text-[13px]">ID photo<input name="front" type="file" accept="image/*,.pdf" required className="mt-1 block" /></label>
            <label className="block text-[13px]">Address proof<input name="address" type="file" accept="image/*,.pdf" required className="mt-1 block" /></label>
            <button className="h-10 rounded-full bg-[#121826] px-5 text-[14px] font-semibold text-white">Submit for review</button>
          </form>
          <h2 className="mt-8 text-[16px] font-bold">Leave feedback for a seller</h2>
          <form className="mt-2 flex flex-wrap gap-2" onSubmit={async (e) => {
            e.preventDefault();
            const rating = new FormData(e.currentTarget).get("rating");
            await accountApi("/api/v1/account/feedback", { method: "POST", body: JSON.stringify({ sellerId, rating }) });
            setNotice("Feedback saved.");
          }}>
            <input value={sellerId} onChange={(e) => setSellerId(e.target.value)} placeholder="Seller email or phone" className="h-10 flex-1 rounded-full border px-4" />
            <select name="rating" className="h-10 rounded-full border px-3">
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="negative">Negative</option>
            </select>
            <button className="h-10 rounded-full border px-4 text-[14px]">Save</button>
          </form>
        </section>
      )}

      {tab === "activity" && (
        <>
          <Standing user={user} appeal={appeal} setAppeal={setAppeal} onDone={() => load()} />
          <BiddingActivity />
          <SavedSearchList />
          <RecentlyViewed compact />
        </>
      )}
    </AccountChrome>
  );
}

function NotificationPrefs() {
  const [email, setEmail] = useState(true);
  const [sms, setSms] = useState(false);
  const [quiet, setQuiet] = useState("22:00-07:00");
  const [saved, setSaved] = useState<string | null>(null);
  useEffect(() => {
    accountApi<{ data: { email_enabled: boolean; sms_enabled: boolean; quiet_hours?: string | null } }>("/api/v1/notifications/preferences")
      .then((b) => {
        setEmail(b.data.email_enabled !== false);
        setSms(Boolean(b.data.sms_enabled));
        if (b.data.quiet_hours) setQuiet(b.data.quiet_hours);
      })
      .catch(() => undefined);
  }, []);
  return (
    <form
      className="mt-6 space-y-2"
      onSubmit={async (e) => {
        e.preventDefault();
        await accountApi("/api/v1/notifications/preferences", { method: "PATCH", body: JSON.stringify({ email, sms, inApp: true, quietHours: quiet }) });
        setSaved("Notification preferences saved.");
      }}
    >
      <h2 className="text-[16px] font-bold">Notification preferences</h2>
      <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} /> Email alerts</label>
      <label className="flex items-center gap-2 text-[14px]"><input type="checkbox" checked={sms} onChange={(e) => setSms(e.target.checked)} /> SMS for critical events</label>
      <label className="block text-[14px]">Quiet hours
        <input value={quiet} onChange={(e) => setQuiet(e.target.value)} placeholder="22:00-07:00" className="mt-1 block h-10 w-full max-w-xs rounded-full border border-[#e7e7e7] px-4 text-[13px]" />
      </label>
      <button className="h-10 rounded-full bg-[#3665f3] px-5 text-[14px] font-semibold text-white">Save</button>
      {saved ? <p className="text-[13px] text-[#12a37e]">{saved}</p> : null}
    </form>
  );
}

function SellingOrders() {
  const [rows, setRows] = useState<{ id: number; order_number: string; status: string; total_amount: number; product: string }[]>([]);
  useEffect(() => {
    accountApi<{ data: typeof rows }>("/api/v1/orders/selling").then((b) => setRows(b.data)).catch(() => undefined);
  }, []);
  return (
    <div className="mt-8">
      <h2 className="text-[16px] font-bold">Orders to fulfil</h2>
      <ul className="mt-2 space-y-2 text-[13px]">
        {rows.map((row) => (
          <li key={row.id} className="rounded-xl border px-3 py-2">
            <Link href={`/orders/${row.order_number}`} className="font-semibold text-[#3665f3]">{row.order_number}</Link>
            <span className="ml-2 capitalize text-[#6b7587]">{row.status.replace(/_/g, " ")}</span>
            <span className="block">{row.product}</span>
            {["paid", "processing"].includes(row.status) ? (
              <Link href={`/orders/${row.order_number}`} className="mt-1 block text-[12px] font-semibold text-[#12a37e]">Mark shipped →</Link>
            ) : null}
            {row.status === "shipped" ? (
              <p className="mt-1 text-[12px] text-[#6b7587]">Waiting for the buyer to confirm received.</p>
            ) : null}
            {row.status === "completed" ? (
              <p className="mt-1 text-[12px] text-[#12a37e]">Escrow released. Request payout from your wallet.</p>
            ) : null}
            <button type="button" className="mt-1 text-[12px] text-[#3665f3]" onClick={async () => {
              const body = await accountApi<{ html: string }>(`/api/v1/seller/label/${row.order_number}`);
              const w = window.open("", "_blank");
              if (w) { w.document.write(body.html); w.document.close(); }
            }}>Print packing slip</button>
          </li>
        ))}
        {rows.length === 0 ? <li className="text-[#8a94a6]">No selling orders yet.</li> : null}
      </ul>
    </div>
  );
}

function PendingOffers() {
  const [rows, setRows] = useState<{ id: number; title: string; amount: number; status: string; buyer_id: number }[]>([]);
  const [counter, setCounter] = useState("");
  useEffect(() => {
    accountApi<{ data: typeof rows }>("/api/v1/offers").then((b) => setRows(b.data)).catch(() => undefined);
  }, []);
  return (
    <div className="mt-8">
      <h2 className="text-[16px] font-bold">Best Offers</h2>
      <ul className="mt-2 space-y-2 text-[13px]">
        {rows.map((row) => (
          <li key={row.id} className="rounded-xl border px-3 py-2">
            <p>{row.title} · NPR {Number(row.amount).toLocaleString()} · {row.status}</p>
            {row.status === "pending" ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className="rounded-full bg-[#12a37e] px-3 py-1 text-white" onClick={async () => {
                  await accountApi(`/api/v1/offers/${row.id}/decide`, { method: "POST", body: JSON.stringify({ action: "accept" }) });
                  const body = await accountApi<{ data: typeof rows }>("/api/v1/offers");
                  setRows(body.data);
                }}>Accept</button>
                <button type="button" className="rounded-full border px-3 py-1" onClick={async () => {
                  await accountApi(`/api/v1/offers/${row.id}/decide`, { method: "POST", body: JSON.stringify({ action: "decline" }) });
                  const body = await accountApi<{ data: typeof rows }>("/api/v1/offers");
                  setRows(body.data);
                }}>Decline</button>
                <input value={counter} onChange={(e) => setCounter(e.target.value)} placeholder="Counter" className="h-8 w-24 rounded-full border px-3" />
                <button type="button" className="rounded-full border px-3 py-1" onClick={async () => {
                  await accountApi(`/api/v1/offers/${row.id}/decide`, { method: "POST", body: JSON.stringify({ action: "counter", amount: Number(counter) }) });
                  const body = await accountApi<{ data: typeof rows }>("/api/v1/offers");
                  setRows(body.data);
                }}>Counter</button>
              </div>
            ) : null}
          </li>
        ))}
        {rows.length === 0 ? <li className="text-[#8a94a6]">No offers yet.</li> : null}
      </ul>
    </div>
  );
}

function SavedSearchList() {
  const [rows, setRows] = useState<{ id: number; name: string; query_params: Record<string, string> }[]>([]);
  async function loadSaved() {
    const body = await accountApi<{ data: typeof rows }>("/api/v1/listings/saved-searches");
    setRows(body.data || []);
  }
  useEffect(() => {
    loadSaved().catch(() => undefined);
  }, []);
  return (
    <section className="mt-4 nexlo-card p-6">
      <h2 className="text-[16px] font-bold">Saved searches</h2>
      <ul className="mt-3 space-y-2 text-[13px]">
        {rows.map((row) => {
          const params = new URLSearchParams();
          Object.entries(row.query_params || {}).forEach(([key, value]) => {
            if (value) params.set(key, String(value));
          });
          return (
            <li key={row.id} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2">
              <Link href={`/search?${params}`} className="font-semibold text-[#3665f3]">{row.name}</Link>
              <button
                type="button"
                className="text-red-600"
                onClick={async () => {
                  await accountApi(`/api/v1/listings/saved-searches/${row.id}`, { method: "DELETE" });
                  await loadSaved();
                }}
              >
                Remove
              </button>
            </li>
          );
        })}
        {rows.length === 0 ? <li className="text-[#8a94a6]">Save a search from the results page to get alerts.</li> : null}
      </ul>
    </section>
  );
}

function BiddingActivity() {
  const [bids, setBids] = useState<{ id: number; title: string; amount: number; listing_id: number; listing_status: string }[]>([]);
  const [chances, setChances] = useState<{ id: number; title: string; amount: number; listing_id: number }[]>([]);
  useEffect(() => {
    accountApi<{ bids: typeof bids; secondChance: typeof chances }>("/api/v1/auctions")
      .then((b) => {
        setBids(b.bids || []);
        setChances(b.secondChance || []);
      })
      .catch(() => undefined);
  }, []);
  return (
    <section className="mt-4 nexlo-card p-6">
      <h2 className="text-[16px] font-bold">Bids & second-chance offers</h2>
      <ul className="mt-3 space-y-2 text-[13px]">
        {chances.map((row) => (
          <li key={`sc-${row.id}`} className="rounded-xl border px-3 py-2">
            Second chance on {row.title} · NPR {Number(row.amount).toLocaleString()}
            <button
              type="button"
              className="ml-2 text-[#3665f3]"
              onClick={async () => {
                await accountApi("/api/v1/auctions/second-chance", { method: "POST", body: JSON.stringify({ offerId: row.id, accept: true }) });
                window.location.href = "/orders";
              }}
            >
              Accept
            </button>
          </li>
        ))}
        {bids.map((row) => (
          <li key={row.id} className="rounded-xl border px-3 py-2">
            <Link href={`/listing/${row.listing_id}`} className="font-semibold text-[#3665f3]">{row.title}</Link>
            <span className="ml-2">NPR {Number(row.amount).toLocaleString()} · {row.listing_status}</span>
          </li>
        ))}
        {bids.length === 0 && chances.length === 0 ? <li className="text-[#8a94a6]">No bids yet.</li> : null}
      </ul>
    </section>
  );
}

function Standing({ user, appeal, setAppeal, onDone }: { user: User; appeal: string; setAppeal: (v: string) => void; onDone: () => void }) {
  const [rows, setRows] = useState<{ public_id: string; message: string; status: string; reason: string | null }[]>([]);
  useEffect(() => {
    accountApi<{ data: { public_id: string; message: string; status: string; reason: string | null }[] }>("/api/v1/account/appeals").then((b) => setRows(b.data)).catch(() => undefined);
  }, []);
  return (
    <section className="nexlo-card p-6">
      <h1 className="text-[22px] font-extrabold text-[#0f1c3f]">Activity</h1>
      <p className="mt-1 text-[14px]">Current status: <strong className="capitalize">{user.status}</strong></p>
      <p className="mt-1 text-[13px] text-[#667085]">If staff restrict or suspend the account, you can appeal.</p>
      {user.status === "restricted" || user.status === "suspended" ? (
        <form className="mt-4 space-y-2" onSubmit={async (e) => {
          e.preventDefault();
          await accountApi("/api/v1/account/appeals", { method: "POST", body: JSON.stringify({ message: appeal }) });
          setAppeal("");
          const body = await accountApi<{ data: typeof rows }>("/api/v1/account/appeals");
          setRows(body.data);
          onDone();
        }}>
          <textarea value={appeal} onChange={(e) => setAppeal(e.target.value)} placeholder="Why should this be reviewed?" className="min-h-24 w-full rounded-xl border px-3 py-2" />
          <button className="h-10 rounded-full bg-[#3665f3] px-5 text-[14px] font-semibold text-white">Submit appeal</button>
        </form>
      ) : null}
      <ul className="mt-4 space-y-2 text-[13px]">
        {rows.map((row) => (
          <li key={row.public_id} className="rounded-xl border px-3 py-2">
            <span className="capitalize">{row.status}</span> — {row.message}
            {row.reason ? <span className="block text-[#667085]">Action: {row.reason}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<main className="flex min-h-dvh items-center justify-center bg-[#f3f7fc]">Loading your account…</main>}>
      <AccountScreen />
    </Suspense>
  );
}
