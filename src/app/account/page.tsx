"use client";

import Link from "next/link";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { accountApi, apiBase, cacheProfile, digitsCode, getToken, setToken } from "@/lib/account-api";
import { passwordPolicyError } from "@/lib/password";
import { AccountChrome, AccountSection, fullName, initials } from "@/components/account/AccountChrome";
import { StatusPill, money } from "@/components/commerce/BuyShell";
import { FeedbackBoard } from "@/components/account/FeedbackBoard";
import { MessagesInbox } from "@/components/account/MessagesInbox";
import { SellerHub } from "@/components/account/SellerHub";
import { ReturnsBoard } from "@/components/account/ReturnsBoard";
import { TicketsBoard } from "@/components/account/TicketsBoard";
import { RecentlyViewed } from "@/components/browse/RecentlyViewed";
import { CollectionsBoard } from "@/components/account/CollectionsBoard";
import { FollowedSellers } from "@/components/account/FollowedSellers";
import { PasskeyManager } from "@/components/account/PasskeyManager";

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
  standing?: {
    status: string;
    action: string | null;
    kind: string | null;
    reason: string | null;
    untilAt: string | null;
    limits: { canBuy: boolean; canSell: boolean; canBid: boolean };
    canAppeal: boolean;
  } | null;
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

type Session = {
  public_id: string;
  user_agent: string;
  ip?: string | null;
  created_at: string;
  last_seen_at?: string;
  current: boolean;
};

function browserLabel(userAgent: string) {
  const ua = userAgent || "Unknown device";
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Safari\//.test(ua)
          ? "Safari"
          : ua.slice(0, 48);
  const os = /Windows/i.test(ua)
    ? "Windows"
    : /Android/i.test(ua)
      ? "Android"
      : /iPhone|iPad|iOS/i.test(ua)
        ? "iOS"
        : /Mac OS|Macintosh/i.test(ua)
          ? "macOS"
          : /Linux/i.test(ua)
            ? "Linux"
            : "";
  return os ? `${browser} on ${os}` : browser;
}

function displayIp(ip?: string | null) {
  const value = String(ip || "").replace(/^::ffff:/, "").trim();
  return value || "Unknown IP";
}

function formatSessionTime(value?: string) {
  if (!value) return "Unknown time";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function aliasTab(raw: string | null, pathname?: string | null) {
  const fromPath = pathname?.endsWith("/security")
    ? "security"
    : pathname?.endsWith("/profile")
      ? "account"
      : pathname?.endsWith("/addresses")
        ? "preferences"
        : pathname?.endsWith("/selling")
          ? "selling"
          : pathname?.endsWith("/standing")
            ? "standing"
            : null;
  const tab = raw ?? fromPath ?? "account";
  if (tab === "profile") return "account";
  if (tab === "addresses") return "preferences";
  return tab;
}

function splitFullName(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts.at(-1) ?? "" };
}

function joinedName(first?: string | null, last?: string | null, fallback = "") {
  return `${first ?? ""} ${last ?? ""}`.trim() || fallback;
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

function wardLabel(ward?: string | null) {
  const value = String(ward || "").trim();
  if (!value) return "";
  return /^\d+$/.test(value) ? `Ward ${value}` : value;
}

function formatAddress(item: Address) {
  return [item.full_name, item.line1, item.line2, [item.city, wardLabel(item.region), item.postal_code].filter(Boolean).join(" "), item.country]
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

function kycStatusLabel(status?: string | null) {
  if (status === "pending") return "Pending Review";
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Requires Additional Documents";
  return "Not submitted";
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
  allowRevoke = true,
}: {
  sessions: Session[];
  setSessions?: (value: Session[] | ((list: Session[]) => Session[])) => void;
  allowRevoke?: boolean;
}) {
  if (!sessions.length) {
    return <p className="text-[13.5px] text-[#5b6780]">No active sessions found.</p>;
  }
  return (
    <ul className="space-y-2">
      {sessions.map((item) => (
        <li key={item.public_id} className="flex items-start justify-between gap-3 rounded-xl border border-[#e7eef6] px-3 py-2 text-[13px]">
          <span>
            <span className="block font-medium text-[#0f1c3f]">
              {browserLabel(item.user_agent)}
              {item.current ? " · This device" : ""}
            </span>
            <span className="mt-0.5 block text-[#5b6780]">IP {displayIp(item.ip)}</span>
            <span className="block text-[#5b6780]">Signed in {formatSessionTime(item.created_at)}</span>
          </span>
          {allowRevoke && setSessions && !item.current ? (
            <button
              type="button"
              className="shrink-0 font-medium text-red-600 hover:underline"
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
          <div key={String(label)} className="rounded-2xl bg-[#f4f8fd] p-4">
            <p className="text-[12px] text-[#7a8496]">{label}</p>
            <p className="mt-1 text-[18px] font-extrabold capitalize text-[#0f1c3f]">{value}</p>
          </div>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2 text-[13px]">
        <Link href="/orders" className="h-9 rounded-full border px-4 leading-9">Orders</Link>
        <Link href="/resolution" className="h-9 rounded-full border px-4 leading-9">Resolution Center</Link>
        <Link href="/account?tab=tickets" className="h-9 rounded-full border px-4 leading-9">Support</Link>
      </div>
    </section>
  );
}

function AccountScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const tab = aliasTab(params.get("tab"), pathname);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [secret, setSecret] = useState("");
  const [otpUri, setOtpUri] = useState("");
  const [code, setCode] = useState("");
  const [secPanel, setSecPanel] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [appSignIn, setAppSignIn] = useState(false);
  const [appeal, setAppeal] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    fullName: "",
    displayName: "",
    country: "",
    bio: "",
    legalName: "",
    username: "",
    phone: "",
  });
  const [address, setAddress] = useState({
    fullName: "",
    phone: "",
    line1: "",
    line2: "",
    city: "",
    region: "",
    postalCode: "",
    country: "Nepal",
    defaultShipping: false,
    defaultBilling: false,
  });
  const [addressSlot, setAddressSlot] = useState<string | null>(null);
  const [phoneDraft, setPhoneDraft] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneStep, setPhoneStep] = useState<"edit" | "code">("edit");
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [clearAvatar, setClearAvatar] = useState(false);
  const [kycApplyOpen, setKycApplyOpen] = useState(false);
  const [kycForm, setKycForm] = useState({
    sellerType: "individual",
    fullName: "",
    legalName: "",
    pan: "",
    docType: "citizenship",
    docNumber: "",
  });

  function resetAvatarEditor() {
    setAvatarFile(null);
    setAvatarPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setClearAvatar(false);
  }

  function onAvatarFile(file: File | undefined) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      setError("Use a JPG or PNG image.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Photo must be 2 MB or smaller.");
      return;
    }
    setAvatarPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return URL.createObjectURL(file);
    });
    setAvatarFile(file);
    setClearAvatar(false);
    setError(null);
  }

  function openPhoneEditor(section: "phone" | "contact") {
    const closing = editing === section;
    setEditing(closing ? null : section);
    if (closing || !user) return;
    setPhoneDraft(user.phone ?? "");
    setPhoneCode("");
    setPhoneStep("edit");
    setError(null);
  }

  async function requestPhoneChange(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!user?.emailVerified) {
      setError("Verify your email before changing your phone number.");
      return;
    }
    setPhoneBusy(true);
    try {
      const body = await accountApi<{
        data: { sent?: boolean; deliveryError?: string; destinationMasked?: string; devCode?: string };
      }>("/api/v1/account/phone/start", {
        method: "POST",
        body: JSON.stringify({ phone: phoneDraft }),
      });
      const filled = digitsCode(body.data?.devCode);
      if (filled) setPhoneCode(filled);
      setPhoneStep("code");
      if (filled && body.data?.sent === false) {
        setNotice("Email is not sending from this computer yet. The code is filled in. Confirm it to save the new number.");
      } else {
        setNotice(`We emailed a confirmation code to ${body.data?.destinationMasked ?? "your email"}. Enter it to save the new number.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the phone change.");
    } finally {
      setPhoneBusy(false);
    }
  }

  async function confirmPhoneChange(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPhoneBusy(true);
    try {
      const body = await accountApi<{ user: User }>("/api/v1/account/phone/confirm", {
        method: "POST",
        body: JSON.stringify({ phone: phoneDraft, code: phoneCode }),
      });
      setUser(body.user);
      setEditing(null);
      setPhoneStep("edit");
      setPhoneCode("");
      setNotice("Phone number updated. Confirm the new number with Verify when you can.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the phone number.");
    } finally {
      setPhoneBusy(false);
    }
  }

  async function load() {
    const body = await accountApi<{ user: User }>("/api/v1/account");
    setUser(body.user);
    cacheProfile(body.user);
    setForm({
      firstName: body.user.firstName ?? "",
      lastName: body.user.lastName ?? "",
      fullName: joinedName(body.user.firstName, body.user.lastName, body.user.displayName ?? ""),
      displayName: body.user.displayName ?? "",
      country: body.user.country ?? "",
      bio: body.user.bio ?? "",
      legalName: body.user.business?.legalName ?? "",
      username: body.user.username ?? "",
      phone: body.user.phone ?? "",
    });
  }

  useEffect(() => {
    load().catch(() => router.push("/login"));
  }, [router]);

  useEffect(() => {
    if (pathname?.endsWith("/profile")) setEditing("profile");
  }, [pathname]);

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
      const changingPassword = Boolean(currentPassword || newPassword);
      if (changingPassword) {
        if (!currentPassword || !newPassword) throw new Error("Enter your current password and a new password.");
        const policy = passwordPolicyError(newPassword);
        if (policy) throw new Error(policy);
      }
      if (avatarFile) {
        const token = getToken();
        const payload = new FormData();
        payload.append("photo", avatarFile);
        const res = await fetch(`${apiBase}/api/v1/account/profile/avatar`, {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: payload,
        });
        const text = await res.text();
        const uploaded = text ? (JSON.parse(text) as { error?: string; user?: User }) : {};
        if (!res.ok) throw new Error(uploaded.error ?? "Could not upload the photo.");
        if (uploaded.user) setUser(uploaded.user);
      }
      const names = splitFullName(form.fullName || `${form.firstName} ${form.lastName}`);
      const body = await accountApi<{ user: User }>("/api/v1/account/profile", {
        method: "PATCH",
        body: JSON.stringify({
          ...form,
          ...names,
          displayName: form.displayName.trim() || form.fullName.trim() || `${names.firstName} ${names.lastName}`.trim(),
          phone: form.phone.trim() || undefined,
          ...extra,
          clearAvatar: !avatarFile && clearAvatar ? true : undefined,
          accountType: user.accountType,
          business: user.accountType === "business" ? { legalName: form.legalName, registrationCountry: form.country } : undefined,
        }),
      });
      setUser(body.user);
      cacheProfile(body.user);
      if (changingPassword) {
        await accountApi("/api/v1/account/password", {
          method: "POST",
          body: JSON.stringify({ currentPassword, password: newPassword }),
        });
        setCurrentPassword("");
        setNewPassword("");
      }
      resetAvatarEditor();
      setEditing(null);
      setNotice("Profile updated successfully");
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
              {avatarPreview || (user.avatarUrl && !clearAvatar) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarPreview || user.avatarUrl || ""}
                  alt=""
                  className="h-[84px] w-[84px] rounded-full object-cover ring-4 ring-white"
                />
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
                onClick={() => {
                  if (editing === "profile") {
                    resetAvatarEditor();
                    setEditing(null);
                    return;
                  }
                  setEditing("profile");
                }}
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
                <div className="flex items-center gap-4 sm:col-span-2">
                  <label className="relative h-16 w-16 shrink-0 cursor-pointer">
                    {avatarPreview || (user.avatarUrl && !clearAvatar) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatarPreview || user.avatarUrl || ""}
                        alt=""
                        className="h-16 w-16 rounded-full object-cover ring-2 ring-white"
                      />
                    ) : (
                      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#eef3fb] text-[16px] font-extrabold text-[#3665f3]">
                        {initials(user)}
                      </span>
                    )}
                    <span className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#3665f3] text-white shadow-sm">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                        <path d="M4 8h3l2-3h6l2 3h3v11H4V8Z" />
                        <circle cx="12" cy="13" r="3.2" />
                      </svg>
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={(e) => onAvatarFile(e.target.files?.[0])}
                    />
                  </label>
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-semibold text-[#0f1c3f]">Profile photo</p>
                    <p className="text-[12.5px] text-[#6b7587]">JPG or PNG, under 2 MB.</p>
                    <div className="mt-1.5 flex flex-wrap gap-3">
                      <label className="cursor-pointer text-[13px] font-medium text-[#3665f3] hover:underline">
                        Upload photo
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          className="sr-only"
                          onChange={(e) => onAvatarFile(e.target.files?.[0])}
                        />
                      </label>
                      {avatarPreview || (user.avatarUrl && !clearAvatar) ? (
                        <button
                          type="button"
                          className="text-[13px] font-medium text-red-600 hover:underline"
                          onClick={() => {
                            setAvatarFile(null);
                            setAvatarPreview((current) => {
                              if (current) URL.revokeObjectURL(current);
                              return null;
                            });
                            setClearAvatar(true);
                          }}
                        >
                          Remove
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
                <input
                  value={form.fullName}
                  onChange={(e) => {
                    const fullName = e.target.value;
                    const names = splitFullName(fullName);
                    setForm({ ...form, fullName, firstName: names.firstName, lastName: names.lastName });
                  }}
                  placeholder="Full name"
                  aria-label="Full name"
                  className="h-10 rounded-full border border-[#e5e7eb] px-4 sm:col-span-2"
                />
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="Phone number"
                  aria-label="Phone number"
                  autoComplete="tel"
                  className="h-10 rounded-full border border-[#e5e7eb] px-4"
                />
                <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="Display name" className="h-10 rounded-full border border-[#e5e7eb] px-4" />
                <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="Country" className="h-10 rounded-full border border-[#e5e7eb] px-4" />
                <p className="text-[12.5px] text-[#6b7587] sm:col-span-2">Optional password change. Use your current password — no email code is sent.</p>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Current password"
                  aria-label="Current password"
                  autoComplete="current-password"
                  className="h-10 rounded-full border border-[#e5e7eb] px-4"
                />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password"
                  aria-label="New password"
                  autoComplete="new-password"
                  className="h-10 rounded-full border border-[#e5e7eb] px-4"
                />
                <button className="h-10 rounded-full bg-[#3665f3] px-5 text-[14px] font-semibold text-white sm:col-span-2">Save Changes</button>
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
                  <EditBtn onClick={() => openPhoneEditor("contact")} />
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
                  <p className="text-[12.5px] text-[#6b7587]">
                    Email stays on this account. To change the phone number, use the form in Phone number. We send a code to your email first.
                  </p>
                ) : null}
              </div>
            </InfoRow>

            <InfoRow
              icon={<PersonIcon />}
              title="Phone number"
              hint="Your verified phone number."
              action={<EditBtn onClick={() => openPhoneEditor("phone")} />}
            >
              {editing === "phone" || editing === "contact" ? (
                <form
                  className="max-w-sm space-y-2"
                  onSubmit={phoneStep === "code" ? confirmPhoneChange : requestPhoneChange}
                >
                  {!user.emailVerified ? (
                    <p className="text-[12.5px] text-[#b45309]">
                      Verify your email before changing this number.{" "}
                      <Link href="/verify" className="font-medium text-[#3665f3] hover:underline">
                        Verify email
                      </Link>
                    </p>
                  ) : (
                    <p className="text-[12.5px] text-[#6b7587]">
                      {phoneStep === "code"
                        ? "Enter the 6-digit code we sent to your email."
                        : "Changing this number requires a code sent to your verified email."}
                    </p>
                  )}
                  <input
                    value={phoneDraft}
                    onChange={(e) => setPhoneDraft(e.target.value)}
                    placeholder="+977..."
                    autoComplete="tel"
                    disabled={phoneStep === "code" || phoneBusy}
                    className="h-9 w-full rounded-full border px-3"
                  />
                  {phoneStep === "code" ? (
                    <input
                      value={phoneCode}
                      onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="Email code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      className="h-9 w-full rounded-full border px-3 tracking-[0.18em]"
                    />
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={phoneBusy || (phoneStep === "edit" && !user.emailVerified)}
                      className="h-9 rounded-full bg-[#3665f3] px-4 text-[13px] font-semibold text-white disabled:opacity-60"
                    >
                      {phoneBusy ? "Please wait…" : phoneStep === "code" ? "Save number" : "Email me a code"}
                    </button>
                    {phoneStep === "code" ? (
                      <button
                        type="button"
                        className="h-9 rounded-full px-3 text-[13px] text-[#3665f3]"
                        onClick={() => {
                          setPhoneStep("edit");
                          setPhoneCode("");
                        }}
                      >
                        Back
                      </button>
                    ) : null}
                  </div>
                </form>
              ) : (
                <p className="flex flex-wrap items-center gap-2">
                  {user.phone ? maskPhone(user.phone) : "Not added"}
                  {user.phone && user.phoneVerified ? <Verified /> : null}
                </p>
              )}
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
        <AccountSection
          title="Payment information"
          body="Pay at checkout with eSewa or Khalti. Funds stay in escrow until delivery. No card numbers are stored on Nexlo."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="nexlo-card p-5">
              <p className="text-[16px] font-bold text-[#0f1c3f]">eSewa</p>
              <p className="mt-1 text-[13px] leading-relaxed text-[#6b7587]">Pay with your eSewa wallet at checkout.</p>
            </div>
            <div className="nexlo-card p-5">
              <p className="text-[16px] font-bold text-[#0f1c3f]">Khalti</p>
              <p className="mt-1 text-[13px] leading-relaxed text-[#6b7587]">Wallet, card, or bank through Khalti.</p>
            </div>
          </div>
          <div className="nexlo-card mt-4 p-5">
            <p className="text-[16px] font-bold text-[#0f1c3f]">Seller payouts</p>
            <p className="mt-1 text-[13px] text-[#6b7587]">Bank, eSewa, or Khalti accounts live under Selling.</p>
            <Link href="/account/selling" className="mt-3 inline-block text-[13px] font-semibold text-[#3665f3] hover:underline">
              Open Selling →
            </Link>
          </div>
          <div className="nexlo-card mt-4 p-5">
            <NotificationPrefs />
          </div>
        </AccountSection>
      )}

      {tab === "donations" && (
        <AccountSection
          title="Donation preferences"
          body="Optionally round up at checkout. The extra amount goes to the charity you pick, not to Nexlo or the seller."
        >
          <DonationPrefs />
        </AccountSection>
      )}

      {tab === "preferences" && (
        <section className="nexlo-card px-6 py-6 sm:px-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-[28px] font-bold tracking-tight text-[#0f1c3f]">Addresses</h1>
              <p className="mt-1 text-[14px] text-[#6b7587]">Save shipping and billing addresses. The default shipping address fills in at checkout.</p>
            </div>
            <button
              type="button"
              className="h-10 rounded-full bg-[#3665f3] px-5 text-[14px] font-semibold text-white"
              onClick={() => {
                setAddressSlot("new");
                setAddress({
                  fullName: name,
                  phone: user.phone || "",
                  line1: "",
                  line2: "",
                  city: "",
                  region: "",
                  postalCode: "",
                  country: user.country || "Nepal",
                  defaultShipping: addresses.length === 0,
                  defaultBilling: false,
                });
              }}
            >
              Add New Address
            </button>
          </div>

          {addressSlot ? (
            <form
              className="mt-5 grid max-w-[560px] gap-2 sm:grid-cols-2"
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null);
                try {
                  const payload = {
                    fullName: address.fullName,
                    phone: address.phone,
                    line1: address.line1,
                    line2: address.line2,
                    city: address.city,
                    region: address.region,
                    postalCode: address.postalCode,
                    country: address.country || "Nepal",
                    defaultShipping: address.defaultShipping,
                    defaultBilling: address.defaultBilling,
                  };
                  if (addressSlot !== "new") {
                    await accountApi(`/api/v1/account/addresses/${addressSlot}`, {
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
              <input value={address.fullName} onChange={(e) => setAddress({ ...address, fullName: e.target.value })} placeholder="Full name" aria-label="Full name" required className="h-10 rounded-full border px-4 sm:col-span-2" />
              <input value={address.phone} onChange={(e) => setAddress({ ...address, phone: e.target.value })} placeholder="Phone" aria-label="Phone" required className="h-10 rounded-full border px-4 sm:col-span-2" />
              <input value={address.line1} onChange={(e) => setAddress({ ...address, line1: e.target.value })} placeholder="Street address" aria-label="Street address" required className="h-10 rounded-full border px-4 sm:col-span-2" />
              <input value={address.line2} onChange={(e) => setAddress({ ...address, line2: e.target.value })} placeholder="Landmark" aria-label="Landmark" className="h-10 rounded-full border px-4 sm:col-span-2" />
              <input value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} placeholder="City" aria-label="City" required className="h-10 rounded-full border px-4" />
              <input value={address.region} onChange={(e) => setAddress({ ...address, region: e.target.value })} placeholder="Ward" aria-label="Ward" required className="h-10 rounded-full border px-4" />
              <label className="flex items-center gap-2 text-[13.5px] text-[#0f1c3f] sm:col-span-2">
                <input type="checkbox" checked={address.defaultShipping} onChange={(e) => setAddress({ ...address, defaultShipping: e.target.checked })} className="accent-[#3665f3]" />
                Set as Default Shipping Address
              </label>
              <label className="flex items-center gap-2 text-[13.5px] text-[#0f1c3f] sm:col-span-2">
                <input type="checkbox" checked={address.defaultBilling} onChange={(e) => setAddress({ ...address, defaultBilling: e.target.checked })} className="accent-[#3665f3]" />
                Set as Default Billing Address
              </label>
              <div className="flex gap-2 sm:col-span-2">
                <button className="h-10 rounded-full bg-[#3665f3] px-5 text-[14px] font-semibold text-white">Save</button>
                <button type="button" className="h-10 rounded-full px-4 text-[14px] text-[#5b6780]" onClick={() => setAddressSlot(null)}>
                  Cancel
                </button>
              </div>
            </form>
          ) : null}

          <ul className="mt-5 space-y-3">
            {addresses.length === 0 && !addressSlot ? (
              <li className="text-[14px] text-[#6b7587]">No addresses yet. Add a shipping address to use at checkout.</li>
            ) : null}
            {addresses.map((item) => (
              <li key={item.public_id} className="rounded-2xl border border-[#e7eef6] px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[#0f1c3f]">{item.full_name}</p>
                    <p className="mt-1 text-[13.5px] text-[#3a4a66]">{item.line1}</p>
                    {item.line2 ? <p className="text-[13.5px] text-[#3a4a66]">{item.line2}</p> : null}
                    <p className="text-[13.5px] text-[#3a4a66]">
                      {item.city}
                      {item.region ? `, ${wardLabel(item.region)}` : ""}
                    </p>
                    {item.phone ? <p className="text-[13.5px] text-[#3a4a66]">{item.phone}</p> : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {item.is_default_shipping ? (
                        <span className="rounded-full bg-[#d1fae5] px-2 py-0.5 text-[11px] font-semibold text-[#0d9488]">Default shipping</span>
                      ) : null}
                      {item.is_default_billing ? (
                        <span className="rounded-full bg-[#eaf1ff] px-2 py-0.5 text-[11px] font-semibold text-[#3665f3]">Default billing</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!item.is_default_shipping ? (
                      <button
                        type="button"
                        className="h-9 rounded-full border px-3 text-[13px] font-medium text-[#3665f3]"
                        onClick={async () => {
                          await accountApi(`/api/v1/account/addresses/${item.public_id}`, {
                            method: "PATCH",
                            body: JSON.stringify({ defaultShipping: true }),
                          });
                          const body = await accountApi<{ data: Address[] }>("/api/v1/account/addresses");
                          setAddresses(body.data);
                        }}
                      >
                        Set default shipping
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="h-9 rounded-full border px-3 text-[13px] font-medium text-[#3665f3]"
                      onClick={() => {
                        setAddressSlot(item.public_id);
                        setAddress({
                          fullName: item.full_name,
                          phone: item.phone || "",
                          line1: item.line1,
                          line2: item.line2 || "",
                          city: item.city,
                          region: item.region || "",
                          postalCode: item.postal_code || "",
                          country: item.country || "Nepal",
                          defaultShipping: item.is_default_shipping,
                          defaultBilling: item.is_default_billing,
                        });
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="h-9 rounded-full px-3 text-[13px] font-medium text-red-600"
                      onClick={async () => {
                        await accountApi(`/api/v1/account/addresses/${item.public_id}`, { method: "DELETE" });
                        setAddresses((list) => list.filter((row) => row.public_id !== item.public_id));
                        if (addressSlot === item.public_id) setAddressSlot(null);
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
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
              <PasskeyManager />
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
                <p className="text-[12.5px] text-[#6b7587]">Enter your current password to choose a new one. No email code is required.</p>
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
                  const body = await accountApi<{ data: { secret?: string; uri?: string; devCode?: string } }>("/api/v1/account/2fa/start", { method: "POST", body: JSON.stringify({ method: "authenticator" }) });
                  setSecret(body.data.secret ?? "");
                  setOtpUri(body.data.uri ?? "");
                  setNotice("Scan the QR code with Google Authenticator or Authy, then enter the 6-digit code.");
                }}>Use authenticator app</button>
                <button type="button" className="h-9 rounded-full border px-4 text-[13px]" onClick={async () => {
                  const body = await accountApi<{ data: { devCode?: string } }>("/api/v1/account/2fa/start", { method: "POST", body: JSON.stringify({ method: "otp" }) });
                  setOtpUri("");
                  setSecret("");
                  setNotice(body.data.devCode ? `Your code is ${body.data.devCode}` : "Enter the code we sent.");
                }}>Use email or phone code</button>
              </div>
              {otpUri ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt="Authenticator QR code"
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(otpUri)}`}
                  width={180}
                  height={180}
                  className="mt-3 rounded-xl border border-[#e3e8f0] bg-white p-2"
                />
              ) : null}
              {secret ? <p className="mt-3 break-all rounded-lg bg-[#f6f8fb] px-3 py-2 font-mono text-[13px]">{secret}</p> : null}
              <form className="mt-3 flex max-w-md gap-2" onSubmit={async (e) => {
                e.preventDefault();
                setError(null);
                try {
                  await accountApi("/api/v1/account/2fa/confirm", { method: "POST", body: JSON.stringify({ code }) });
                  setNotice("Two-factor is on.");
                  setSecret("");
                  setOtpUri("");
                  setCode("");
                  await load();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "That code is not valid");
                }
              }}>
                <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit code" inputMode="numeric" autoComplete="one-time-code" className="h-10 flex-1 rounded-full border px-4" />
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
              title="Active Sessions"
              description="Review browsers currently signed in to your account. Revoke a session to sign that device out immediately."
              action="View"
              open={secPanel === "devices"}
              onToggle={() => setSecPanel(secPanel === "devices" ? null : "devices")}
            >
              <SessionList sessions={sessions} setSessions={setSessions} />
            </SecurityField>

            <SecurityField
              title="Devices you trust"
              description="Review the devices you've decided to trust."
              action="View"
              open={secPanel === "trusted"}
              onToggle={() => setSecPanel(secPanel === "trusted" ? null : "trusted")}
            >
              <p className="text-[13.5px] text-[#5b6780]">You have not marked any extra devices as trusted.</p>
            </SecurityField>

            <SecurityField
              title="Sign in activity"
              description="View your sign in history."
              action="View"
              open={secPanel === "activity"}
              onToggle={() => setSecPanel(secPanel === "activity" ? null : "activity")}
            >
              <SessionList sessions={sessions} allowRevoke={false} />
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

          <div className="mt-6 rounded-2xl border border-[#e7eef6] p-5">
            <h2 className="text-[16px] font-bold text-[#0f1c3f]">Seller application</h2>
            <p className="mt-1 text-[13px] text-[#667085]">
              Status: <strong>{kycStatusLabel(user.kyc?.status)}</strong>
              {user.kyc?.reason ? ` — ${user.kyc.reason}` : ""}
            </p>
            {user.kyc?.status === "pending" ? (
              <p className="mt-3 rounded-xl bg-[#fff8eb] px-4 py-3 text-[13.5px] leading-relaxed text-[#8a5a00]">
                Your application is <strong>Pending Review</strong>. We review citizenship or passport photos within 1–3 business days and email you when a decision is ready.
              </p>
            ) : null}
            {user.kyc?.status === "approved" ? (
              <p className="mt-3 text-[14px] text-[#0f1c3f]">This account can buy and sell.</p>
            ) : null}
            {user.kyc?.status === "rejected" ? (
              <div className="mt-3 rounded-xl bg-[#fff5f5] px-4 py-3 text-[13.5px] leading-relaxed text-[#b42318]">
                <p>
                  Status: <strong>Requires Additional Documents</strong>
                </p>
                {user.kyc.reason ? (
                  <p className="mt-2">
                    Rejection reason: <span className="font-medium">{user.kyc.reason}</span>
                  </p>
                ) : null}
                <p className="mt-2 text-[#0f1c3f]">Please re-upload clear photos of your citizenship or passport and submit again.</p>
              </div>
            ) : null}

            {!user.kyc || user.kyc.status === "rejected" ? (
              !kycApplyOpen ? (
                <button
                  type="button"
                  className="mt-4 h-10 rounded-full bg-[#3665f3] px-5 text-[14px] font-semibold text-white"
                  onClick={() => {
                    setKycForm({
                      sellerType: user.accountType === "business" ? "business" : "individual",
                      fullName: fullName(user),
                      legalName: user.business?.legalName || "",
                      pan: user.business?.taxId || "",
                      docType: "citizenship",
                      docNumber: "",
                    });
                    setKycApplyOpen(true);
                  }}
                >
                  {user.kyc?.status === "rejected" ? "Re-upload documents" : "Apply as Seller"}
                </button>
              ) : (
                <form
                  className="mt-4 grid max-w-[560px] gap-3"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setError(null);
                    const data = new FormData(e.currentTarget);
                    const front = data.get("front");
                    const back = data.get("back");
                    if (!(front instanceof File) || !front.size) {
                      setError("Upload a clear photo of the front of your ID.");
                      return;
                    }
                    if (kycForm.docType === "citizenship" && (!(back instanceof File) || !back.size)) {
                      setError("Upload the back of your Nepali citizenship card.");
                      return;
                    }
                    try {
                      await accountApi("/api/v1/account/kyc", {
                        method: "POST",
                        body: JSON.stringify({
                          sellerType: kycForm.sellerType,
                          fullName: kycForm.fullName,
                          legalName: kycForm.sellerType === "business" ? kycForm.legalName : kycForm.fullName,
                          pan: kycForm.pan,
                          docType: kycForm.docType,
                          docNumber: kycForm.docNumber,
                          front: await fileToDataUrl(front),
                          back: back instanceof File && back.size ? await fileToDataUrl(back) : undefined,
                        }),
                      });
                      setKycApplyOpen(false);
                      setNotice("Application submitted. Status: Pending Review. We review documents within 1–3 business days.");
                      await load();
                    } catch (err) {
                      setError(err instanceof Error ? err.message : "Could not submit application");
                    }
                  }}
                >
                  <fieldset className="flex gap-4 text-[14px] text-[#0f1c3f]">
                    <legend className="sr-only">Account type</legend>
                    {(["individual", "business"] as const).map((type) => (
                      <label key={type} className="flex items-center gap-2 capitalize">
                        <input
                          type="radio"
                          name="sellerType"
                          value={type}
                          checked={kycForm.sellerType === type}
                          onChange={() => setKycForm({ ...kycForm, sellerType: type })}
                          className="accent-[#3665f3]"
                        />
                        {type}
                      </label>
                    ))}
                  </fieldset>
                  {kycForm.sellerType === "business" ? (
                    <input
                      value={kycForm.legalName}
                      onChange={(e) => setKycForm({ ...kycForm, legalName: e.target.value })}
                      placeholder="Business legal name"
                      aria-label="Business legal name"
                      required
                      className="h-10 rounded-full border px-4"
                    />
                  ) : (
                    <input
                      value={kycForm.fullName}
                      onChange={(e) => setKycForm({ ...kycForm, fullName: e.target.value })}
                      placeholder="Full name"
                      aria-label="Full name"
                      required
                      className="h-10 rounded-full border px-4"
                    />
                  )}
                  <input
                    value={kycForm.pan}
                    onChange={(e) => setKycForm({ ...kycForm, pan: e.target.value })}
                    placeholder="PAN number"
                    aria-label="PAN number"
                    required
                    className="h-10 rounded-full border px-4"
                  />
                  <select
                    value={kycForm.docType}
                    onChange={(e) => setKycForm({ ...kycForm, docType: e.target.value })}
                    aria-label="ID type"
                    className="h-10 rounded-full border px-4"
                  >
                    <option value="citizenship">Nepali Citizenship</option>
                    <option value="passport">Passport</option>
                  </select>
                  <input
                    value={kycForm.docNumber}
                    onChange={(e) => setKycForm({ ...kycForm, docNumber: e.target.value })}
                    placeholder={kycForm.docType === "passport" ? "Passport number" : "Citizenship number"}
                    aria-label={kycForm.docType === "passport" ? "Passport number" : "Citizenship number"}
                    required
                    className="h-10 rounded-full border px-4"
                  />
                  <label className="block text-[13px] text-[#0f1c3f]">
                    {kycForm.docType === "passport" ? "Passport photo" : "Citizenship (Front)"}
                    <input name="front" type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" required aria-label="Citizenship front" className="mt-1 block text-[13px]" />
                  </label>
                  {kycForm.docType === "citizenship" ? (
                    <label className="block text-[13px] text-[#0f1c3f]">
                      Citizenship (Back)
                      <input name="back" type="file" accept="image/jpeg,image/png,.jpg,.jpeg,.png" required aria-label="Citizenship back" className="mt-1 block text-[13px]" />
                    </label>
                  ) : null}
                  <div className="flex gap-2">
                    <button className="h-10 rounded-full bg-[#3665f3] px-5 text-[14px] font-semibold text-white">Submit application</button>
                    <button type="button" className="h-10 rounded-full px-4 text-[14px] text-[#5b6780]" onClick={() => setKycApplyOpen(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              )
            ) : null}
          </div>

          {user.kyc?.status === "approved" || user.isSeller ? (
            <>
              <div className="mt-6"><SellerHub /></div>
              <SellingOrders />
              <PendingOffers />
            </>
          ) : null}

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

      {tab === "collections" && <CollectionsBoard />}

      {tab === "following" && <FollowedSellers />}

      {tab === "standing" && (
        <Standing user={user} appeal={appeal} setAppeal={setAppeal} onDone={() => load()} />
      )}

      {tab === "activity" && (
        <AccountSection title="Activity" body="Bids, Best Offers, saved searches, and account standing.">
          <BiddingActivity />
          <PendingOffers />
          <SavedSearchList />
          <RecentlyViewed compact />
        </AccountSection>
      )}
    </AccountChrome>
  );
}

function DonationPrefs() {
  const [enabled, setEnabled] = useState(false);
  const [charityId, setCharityId] = useState<number | "">("");
  const [charities, setCharities] = useState<{ id: number; name: string; blurb: string }[]>([]);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    accountApi<{ prefs: { enabled: boolean; charity_id: number | null }; charities: { id: number; name: string; blurb: string }[] }>(
      "/api/v1/account/donations",
    )
      .then((body) => {
        setEnabled(Boolean(body.prefs?.enabled));
        setCharities(body.charities || []);
        setCharityId(body.prefs?.charity_id || body.charities?.[0]?.id || "");
      })
      .catch(() => undefined);
  }, []);

  return (
    <form
      className="nexlo-card space-y-4 p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        try {
          await accountApi("/api/v1/account/donations", {
            method: "PUT",
            body: JSON.stringify({ enabled, charityId }),
          });
          setSaved(enabled ? "Round-up is on. You can still skip it on an order at checkout." : "Round-up is off.");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Could not save");
        }
      }}
    >
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        <span>
          <span className="block text-[16px] font-bold text-[#0f1c3f]">Round up at checkout</span>
          <span className="mt-1 block max-w-md text-[13px] leading-relaxed text-[#6b7587]">
            We round the order total up to the next NPR 10. That spare change goes to your chosen charity.
          </span>
        </span>
      </label>
      <label className="block text-[13.5px] font-semibold text-[#0f1c3f]">
        Charity
        <select
          value={charityId}
          onChange={(e) => setCharityId(Number(e.target.value))}
          className="nexlo-field mt-1.5"
        >
          {charities.map((charity) => (
            <option key={charity.id} value={charity.id}>
              {charity.name}
            </option>
          ))}
        </select>
      </label>
      {charities.find((row) => row.id === charityId)?.blurb ? (
        <p className="text-[13px] leading-relaxed text-[#6b7587]">{charities.find((row) => row.id === charityId)?.blurb}</p>
      ) : null}
      <button type="submit" className="nexlo-btn nexlo-btn-blue">
        Save
      </button>
      {saved ? <p className="text-[13px] text-[#12a37e]">{saved}</p> : null}
      {error ? <p className="nexlo-alert nexlo-alert-error">{error}</p> : null}
    </form>
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
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        await accountApi("/api/v1/notifications/preferences", { method: "PATCH", body: JSON.stringify({ email, sms, inApp: true, quietHours: quiet }) });
        setSaved("Notification preferences saved.");
      }}
    >
      <h2 className="text-[16px] font-bold text-[#0f1c3f]">Notification preferences</h2>
      <label className="flex items-center gap-2 text-[14px] text-[#0f1c3f]">
        <input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} /> Email alerts
      </label>
      <label className="flex items-center gap-2 text-[14px] text-[#0f1c3f]">
        <input type="checkbox" checked={sms} onChange={(e) => setSms(e.target.checked)} /> SMS for critical events
      </label>
      <label className="block text-[14px] text-[#0f1c3f]">
        Quiet hours
        <input
          value={quiet}
          onChange={(e) => setQuiet(e.target.value)}
          placeholder="22:00-07:00"
          className="nexlo-field mt-1 max-w-xs"
        />
      </label>
      <button type="submit" className="nexlo-btn nexlo-btn-blue">
        Save
      </button>
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
  const [rows, setRows] = useState<{ id: number; title: string; amount: number; status: string; awaitingYou?: boolean; youAreSeller?: boolean }[]>([]);
  const [counter, setCounter] = useState("");
  async function loadOffers() {
    const body = await accountApi<{ data: typeof rows }>("/api/v1/offers");
    setRows(body.data);
  }
  useEffect(() => {
    loadOffers().catch(() => undefined);
  }, []);
  return (
    <section className="nexlo-card mt-4 p-5">
      <h2 className="text-[16px] font-bold text-[#0f1c3f]">Best Offers</h2>
      <ul className="mt-3 space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="rounded-2xl bg-[#f7f9fc] px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] font-semibold text-[#0f1c3f]">
                {row.title} · {money(row.amount)}
              </p>
              <StatusPill status={row.awaitingYou ? "your move" : row.status} />
            </div>
            {row.awaitingYou ? (
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="h-9 rounded-full bg-[#12a37e] px-4 text-[13px] font-semibold text-white"
                  onClick={async () => {
                    await accountApi(`/api/v1/offers/${row.id}/decide`, { method: "POST", body: JSON.stringify({ action: "accept" }) });
                    if (row.youAreSeller) await loadOffers();
                    else window.location.href = "/orders";
                  }}
                >
                  Accept
                </button>
                <button
                  type="button"
                  className="nexlo-btn-ghost h-9 px-4"
                  onClick={async () => {
                    await accountApi(`/api/v1/offers/${row.id}/decide`, { method: "POST", body: JSON.stringify({ action: "decline" }) });
                    await loadOffers();
                  }}
                >
                  Decline
                </button>
                <input value={counter} onChange={(e) => setCounter(e.target.value)} placeholder="Counter" className="nexlo-field h-9 w-28" />
                <button
                  type="button"
                  className="nexlo-btn-ghost h-9 px-4"
                  onClick={async () => {
                    await accountApi(`/api/v1/offers/${row.id}/decide`, { method: "POST", body: JSON.stringify({ action: "counter", amount: Number(counter) }) });
                    setCounter("");
                    await loadOffers();
                  }}
                >
                  Counter
                </button>
              </div>
            ) : null}
          </li>
        ))}
        {rows.length === 0 ? <li className="text-[13px] text-[#8a94a6]">No offers yet.</li> : null}
      </ul>
    </section>
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
    <section className="nexlo-card mt-4 p-5">
      <h2 className="text-[16px] font-bold text-[#0f1c3f]">Saved searches</h2>
      <ul className="mt-3 space-y-2">
        {rows.map((row) => {
          const params = new URLSearchParams();
          Object.entries(row.query_params || {}).forEach(([key, value]) => {
            if (value) params.set(key, String(value));
          });
          return (
            <li key={row.id} className="flex items-center justify-between gap-3 rounded-2xl bg-[#f7f9fc] px-4 py-3">
              <Link href={`/search?${params}`} className="text-[13px] font-semibold text-[#3665f3] hover:underline">
                {row.name}
              </Link>
              <button
                type="button"
                className="text-[12.5px] font-semibold text-[#e5484d]"
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
        {rows.length === 0 ? <li className="text-[13px] text-[#8a94a6]">Save a search from the results page to get alerts.</li> : null}
      </ul>
    </section>
  );
}

function BiddingActivity() {
  const [bids, setBids] = useState<{ id: number; title: string; amount: number; listing_id: number; listing_status: string; can_retract?: boolean }[]>([]);
  const [chances, setChances] = useState<{ id: number; title: string; amount: number; listing_id: number }[]>([]);
  async function loadBids() {
    const b = await accountApi<{ bids: typeof bids; secondChance: typeof chances }>("/api/v1/auctions");
    setBids(b.bids || []);
    setChances(b.secondChance || []);
  }
  useEffect(() => {
    loadBids().catch(() => undefined);
  }, []);
  return (
    <section className="nexlo-card mt-4 p-5">
      <h2 className="text-[16px] font-bold text-[#0f1c3f]">Bids & second-chance offers</h2>
      <ul className="mt-3 space-y-2">
        {chances.map((row) => (
          <li key={`sc-${row.id}`} className="rounded-2xl bg-[#f7f9fc] px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] font-semibold text-[#0f1c3f]">
                Second chance on {row.title} · {money(row.amount)}
              </p>
              <StatusPill status="pending" />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="h-9 rounded-full bg-[#12a37e] px-4 text-[13px] font-semibold text-white"
                onClick={async () => {
                  await accountApi("/api/v1/auctions/second-chance", { method: "POST", body: JSON.stringify({ offerId: row.id, accept: true }) });
                  window.location.href = "/orders";
                }}
              >
                Accept
              </button>
              <button
                type="button"
                className="text-[13px] font-semibold text-[#e53238]"
                onClick={async () => {
                  await accountApi("/api/v1/auctions/second-chance", { method: "POST", body: JSON.stringify({ offerId: row.id, accept: false }) });
                  setChances((current) => current.filter((item) => item.id !== row.id));
                }}
              >
                Decline
              </button>
            </div>
          </li>
        ))}
        {bids.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#f7f9fc] px-4 py-3">
            <div>
              <Link href={`/listing/${row.listing_id}`} className="text-[13px] font-semibold text-[#3665f3] hover:underline">
                {row.title}
              </Link>
              <p className="mt-0.5 text-[12.5px] text-[#6b7587]">
                {money(row.amount)} · {row.listing_status.replace(/_/g, " ")}
              </p>
            </div>
            {row.can_retract ? (
              <button
                type="button"
                className="text-[12.5px] font-semibold text-[#e53238]"
                onClick={async () => {
                  await accountApi(`/api/v1/auctions/${row.listing_id}/retract`, { method: "POST", body: "{}" });
                  await loadBids();
                }}
              >
                Retract
              </button>
            ) : null}
          </li>
        ))}
        {bids.length === 0 && chances.length === 0 ? <li className="text-[13px] text-[#8a94a6]">No bids yet.</li> : null}
      </ul>
    </section>
  );
}

function Standing({ user, appeal, setAppeal, onDone }: { user: User; appeal: string; setAppeal: (v: string) => void; onDone: () => void }) {
  const [rows, setRows] = useState<{ public_id: string; message: string; status: string; reason: string | null; evidence_url?: string | null }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const standing = user.standing;
  const restricted = Boolean(standing?.canAppeal) || user.status === "restricted" || user.status === "suspended";
  useEffect(() => {
    accountApi<{ data: { public_id: string; message: string; status: string; reason: string | null; evidence_url?: string | null }[] }>("/api/v1/account/appeals").then((b) => setRows(b.data)).catch(() => undefined);
  }, []);
  const until = standing?.untilAt ? new Date(standing.untilAt).toLocaleString() : null;
  return (
    <section className="nexlo-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-[22px] font-extrabold text-[#0f1c3f]">Account standing</h1>
          <p className="mt-1 text-[13px] text-[#6b7587]">Warnings, temporary suspensions, and appeals.</p>
        </div>
        <StatusPill status={standing?.kind || user.status} />
      </div>

      {restricted ? (
        <div className="mt-4 rounded-2xl bg-[#fff5f5] px-4 py-3 text-[13.5px] leading-relaxed text-[#b42318]">
          <p className="font-semibold text-[#0f1c3f]">{standing?.kind || (user.status === "restricted" ? "Temporary Suspension" : "Restriction")}</p>
          {standing?.reason ? <p className="mt-1">Reason: {standing.reason}</p> : null}
          {until ? <p className="mt-1">Until {until}</p> : null}
          <p className="mt-2 text-[#0f1c3f]">
            {standing?.limits.canBuy && standing?.limits.canSell
              ? "This is a warning. Marketplace access stays on, but further issues can lead to a suspension."
              : "Feature limits: you cannot buy, sell, or place bids until this is lifted."}
          </p>
        </div>
      ) : (
        <p className="mt-4 text-[14px] text-[#0f1c3f]">This account is in good standing.</p>
      )}

      {restricted ? (
        <form
          className="mt-4 grid max-w-[560px] gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            const data = new FormData(e.currentTarget);
            const file = data.get("evidence");
            try {
              await accountApi("/api/v1/account/appeals", {
                method: "POST",
                body: JSON.stringify({
                  message: appeal,
                  evidence: file instanceof File && file.size ? await fileToDataUrl(file) : undefined,
                }),
              });
              setAppeal("");
              const body = await accountApi<{ data: typeof rows }>("/api/v1/account/appeals");
              setRows(body.data);
              onDone();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not submit appeal");
            }
          }}
        >
          {error ? <p className="text-[13px] text-[#b42318]">{error}</p> : null}
          <textarea
            value={appeal}
            onChange={(e) => setAppeal(e.target.value)}
            aria-label="Appeal explanation"
            placeholder="Explain why this restriction should be lifted"
            required
            className="nexlo-field h-auto min-h-24 rounded-2xl py-3"
          />
          <label className="block text-[13px] text-[#0f1c3f]">
            Evidence (photo or PDF)
            <input name="evidence" type="file" accept="image/*,.pdf" aria-label="Appeal evidence" className="mt-1 block text-[13px]" />
          </label>
          <button type="submit" className="nexlo-btn nexlo-btn-blue w-fit">
            Submit appeal
          </button>
        </form>
      ) : null}
      {rows.length ? (
        <ul className="mt-4 space-y-2">
          {rows.map((row) => (
            <li key={row.public_id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#f7f9fc] px-4 py-3">
              <p className="text-[13px] text-[#0f1c3f]">
                {row.message}
                {row.reason ? <span className="block text-[#6b7587]">Action: {row.reason}</span> : null}
              </p>
              <StatusPill status={row.status} />
            </li>
          ))}
        </ul>
      ) : null}
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
