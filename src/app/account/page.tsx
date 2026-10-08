"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { accountApi, setToken } from "@/lib/account-api";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

type User = {
  id: string;
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
  twoFactor: string | null;
  business: { legalName: string; registrationCountry: string | null; taxId: string | null } | null;
  feedback: { positive: number; neutral: number; negative: number };
  kyc: { status: string; reason: string | null } | null;
};

type Address = {
  public_id: string;
  label: string | null;
  full_name: string;
  line1: string;
  city: string;
  country: string;
  is_default_shipping: boolean;
  is_default_billing: boolean;
};

type Session = { public_id: string; user_agent: string; created_at: string; current: boolean };

const tabs = [
  ["profile", "Profile"],
  ["addresses", "Addresses"],
  ["security", "Security"],
  ["selling", "Selling"],
  ["standing", "Standing"],
] as const;

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.readAsDataURL(file);
  });
}

function AccountScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const tab = params.get("tab") ?? "profile";
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [appeal, setAppeal] = useState("");
  const [sellerId, setSellerId] = useState("");
  const [form, setForm] = useState({ firstName: "", lastName: "", displayName: "", country: "", bio: "", legalName: "" });
  const [address, setAddress] = useState({ fullName: "", line1: "", city: "", country: "Nepal" });

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
    });
  }

  useEffect(() => {
    load().catch(() => router.push("/login"));
  }, [router]);

  useEffect(() => {
    if (tab === "addresses") accountApi<{ data: Address[] }>("/api/v1/account/addresses").then((b) => setAddresses(b.data)).catch(() => undefined);
    if (tab === "security") accountApi<{ data: Session[] }>("/api/v1/account/sessions").then((b) => setSessions(b.data)).catch(() => undefined);
  }, [tab]);

  if (!user) return <main className="page-shell py-10 text-[14px] text-[#667085]">Loading your account…</main>;

  const levelLabel: Record<string, string> = {
    new: "New",
    standard: "Standard",
    above_standard: "Above standard",
    top_rated: "Top rated",
  };

  return (
    <main className="page-shell grid gap-8 py-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside>
        <p className="text-[13px] font-semibold text-[#2f6bff]">{user.displayName || "Your account"}</p>
        <p className="mt-1 text-[12px] text-[#667085]">{user.email || user.phone}</p>
        <p className="mt-2 text-[12px] capitalize text-[#374151]">{user.accountType} · {user.status}</p>
        <nav className="mt-4 flex flex-col gap-1">
          {tabs.map(([id, label]) => (
            <Link key={id} href={`/account?tab=${id}`} className={`rounded-lg px-3 py-2 text-[14px] ${tab === id ? "bg-[#eef3ff] font-semibold text-[#2f6bff]" : "text-[#374151] hover:bg-[#f6f8fb]"}`}>
              {label}
            </Link>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => {
            setToken(null);
            router.push("/");
          }}
          className="mt-4 text-[13px] text-[#667085] hover:underline"
        >
          Sign out
        </button>
      </aside>

      <section>
        {error ? <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-[13px] text-red-700">{error}</p> : null}
        {notice ? <p className="mb-3 rounded-lg bg-[#f2f7ff] px-3 py-2 text-[13px] text-[#2a4fa8]">{notice}</p> : null}

        {tab === "profile" && (
          <form
            className="max-w-[560px] space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              try {
                const body = await accountApi<{ user: User }>("/api/v1/account/profile", {
                  method: "PATCH",
                  body: JSON.stringify({
                    ...form,
                    accountType: user.accountType,
                    business: user.accountType === "business" ? { legalName: form.legalName, registrationCountry: form.country } : undefined,
                  }),
                });
                setUser(body.user);
                setNotice("Profile saved.");
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not save");
              }
            }}
          >
            <h1 className="text-[22px] font-bold text-[#121826]">Profile</h1>
            <p className="text-[13px] text-[#667085]">One account can buy and sell, as a person or a business. Same idea as an eBay account.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="First name" className="h-10 rounded-lg border border-[#e5e7eb] px-3" />
              <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Last name" className="h-10 rounded-lg border border-[#e5e7eb] px-3" />
            </div>
            <input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} placeholder="Display name" className="h-10 w-full rounded-lg border border-[#e5e7eb] px-3" />
            <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="Country" className="h-10 w-full rounded-lg border border-[#e5e7eb] px-3" />
            {user.accountType === "business" ? (
              <input value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} placeholder="Legal business name" className="h-10 w-full rounded-lg border border-[#e5e7eb] px-3" />
            ) : null}
            <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="About you" className="min-h-24 w-full rounded-lg border border-[#e5e7eb] px-3 py-2" />
            <button className="h-10 rounded-full bg-[#2f6bff] px-5 text-[14px] font-semibold text-white">Save profile</button>
          </form>
        )}

        {tab === "addresses" && (
          <div className="max-w-[640px]">
            <h1 className="text-[22px] font-bold text-[#121826]">Address book</h1>
            <ul className="mt-4 space-y-2">
              {addresses.map((item) => (
                <li key={item.public_id} className="flex items-start justify-between gap-3 rounded-xl border border-[#e7eef6] px-3 py-3 text-[13px]">
                  <span>
                    <span className="font-semibold">{item.full_name}</span> · {item.line1}, {item.city}, {item.country}
                    {item.is_default_shipping ? <span className="ml-2 text-[#2f6bff]">Default shipping</span> : null}
                    {item.is_default_billing ? <span className="ml-2 text-[#0f8f86]">Default billing</span> : null}
                  </span>
                  <span className="flex shrink-0 gap-2">
                    <button type="button" className="text-[#2f6bff]" onClick={() => accountApi(`/api/v1/account/addresses/${item.public_id}`, { method: "PATCH", body: JSON.stringify({ defaultShipping: true }) }).then(() => accountApi<{ data: Address[] }>("/api/v1/account/addresses").then((b) => setAddresses(b.data)))}>Ship</button>
                    <button type="button" className="text-red-600" onClick={() => accountApi(`/api/v1/account/addresses/${item.public_id}`, { method: "DELETE" }).then(() => setAddresses((list) => list.filter((row) => row.public_id !== item.public_id)))}>Remove</button>
                  </span>
                </li>
              ))}
            </ul>
            <form
              className="mt-4 grid gap-2 sm:grid-cols-2"
              onSubmit={async (e) => {
                e.preventDefault();
                await accountApi("/api/v1/account/addresses", { method: "POST", body: JSON.stringify({ ...address, defaultShipping: addresses.length === 0 }) });
                const body = await accountApi<{ data: Address[] }>("/api/v1/account/addresses");
                setAddresses(body.data);
                setAddress({ fullName: "", line1: "", city: "", country: "Nepal" });
              }}
            >
              <input value={address.fullName} onChange={(e) => setAddress({ ...address, fullName: e.target.value })} placeholder="Full name" className="h-10 rounded-lg border px-3" />
              <input value={address.line1} onChange={(e) => setAddress({ ...address, line1: e.target.value })} placeholder="Street" className="h-10 rounded-lg border px-3" />
              <input value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} placeholder="City" className="h-10 rounded-lg border px-3" />
              <input value={address.country} onChange={(e) => setAddress({ ...address, country: e.target.value })} placeholder="Country" className="h-10 rounded-lg border px-3" />
              <button className="h-10 rounded-full bg-[#2f6bff] px-5 text-[14px] font-semibold text-white sm:col-span-2">Add address</button>
            </form>
          </div>
        )}

        {tab === "security" && (
          <div className="max-w-[640px]">
            <h1 className="text-[22px] font-bold text-[#121826]">Security</h1>
            <p className="mt-1 text-[13px] text-[#667085]">Sellers and staff must use a second step: a text code or an authenticator app.</p>
            <p className="mt-3 text-[14px]">Two-factor: <strong>{user.twoFactor ?? "Off"}</strong></p>
            <div className="mt-3 flex gap-2">
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
            <form className="mt-3 flex gap-2" onSubmit={async (e) => {
              e.preventDefault();
              await accountApi("/api/v1/account/2fa/confirm", { method: "POST", body: JSON.stringify({ code }) });
              setNotice("Two-factor is on.");
              await load();
            }}>
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" className="h-10 flex-1 rounded-lg border px-3" />
              <button className="h-10 rounded-full bg-[#2f6bff] px-4 text-[14px] font-semibold text-white">Confirm</button>
            </form>
            <h2 className="mt-8 text-[16px] font-bold">Signed-in devices</h2>
            <ul className="mt-2 space-y-2">
              {sessions.map((item) => (
                <li key={item.public_id} className="flex items-center justify-between rounded-xl border px-3 py-2 text-[13px]">
                  <span>{item.user_agent.slice(0, 80)} {item.current ? "· This device" : ""}</span>
                  {!item.current ? <button type="button" className="text-red-600" onClick={() => accountApi(`/api/v1/account/sessions/${item.public_id}`, { method: "DELETE" }).then(() => setSessions((list) => list.filter((row) => row.public_id !== item.public_id)))}>Revoke</button> : null}
                </li>
              ))}
            </ul>
          </div>
        )}

        {tab === "selling" && (
          <div className="max-w-[640px]">
            <h1 className="text-[22px] font-bold text-[#121826]">Selling</h1>
            <p className="mt-1 text-[14px]">Seller level: <strong>{levelLabel[user.sellerLevel] ?? user.sellerLevel}</strong></p>
            <p className="mt-1 text-[13px] text-[#667085]">
              Positive {user.feedback.positive} · Neutral {user.feedback.neutral} · Negative {user.feedback.negative}
            </p>
            <p className="mt-1 text-[13px] text-[#667085]">New under 5 reviews. Standard after that. Above standard at 20 with 95% positive. Top rated at 50 with 98% positive.</p>
            {!user.isSeller ? (
              <button type="button" className="mt-4 h-10 rounded-full bg-[#2f6bff] px-5 text-[14px] font-semibold text-white" onClick={async () => {
                const body = await accountApi<{ data: { twoFactorRequired: boolean } }>("/api/v1/account/seller", { method: "POST", body: "{}" });
                setNotice(body.data.twoFactorRequired ? "You can sell after two-factor is turned on." : "Seller tools are on.");
                await load();
              }}>Start selling</button>
            ) : <p className="mt-3 text-[14px]">This account can buy and sell.</p>}
            <h2 className="mt-8 text-[16px] font-bold">Identity check</h2>
            <p className="mt-1 text-[13px] text-[#667085]">Upload an ID and a proof of address. Staff approve or reject it with a reason. Status: {user.kyc?.status ?? "not submitted"}{user.kyc?.reason ? ` — ${user.kyc.reason}` : ""}.</p>
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
              <input value={sellerId} onChange={(e) => setSellerId(e.target.value)} placeholder="Seller email or phone" className="h-10 flex-1 rounded-lg border px-3" />
              <select name="rating" className="h-10 rounded-lg border px-2">
                <option value="positive">Positive</option>
                <option value="neutral">Neutral</option>
                <option value="negative">Negative</option>
              </select>
              <button className="h-10 rounded-full border px-4 text-[14px]">Save</button>
            </form>
          </div>
        )}

        {tab === "standing" && (
          <Standing user={user} appeal={appeal} setAppeal={setAppeal} onDone={() => load()} />
        )}
      </section>
    </main>
  );
}

function Standing({ user, appeal, setAppeal, onDone }: { user: User; appeal: string; setAppeal: (v: string) => void; onDone: () => void }) {
  const [rows, setRows] = useState<{ public_id: string; message: string; status: string; reason: string | null }[]>([]);
  useEffect(() => {
    accountApi<{ data: { public_id: string; message: string; status: string; reason: string | null }[] }>("/api/v1/account/appeals").then((b) => setRows(b.data)).catch(() => undefined);
  }, []);
  return (
    <div className="max-w-[640px]">
      <h1 className="text-[22px] font-bold text-[#121826]">Account standing</h1>
      <p className="mt-1 text-[14px]">Current status: <strong className="capitalize">{user.status}</strong></p>
      <p className="mt-1 text-[13px] text-[#667085]">If staff restrict or suspend the account, you can appeal. They keep the reason and can set how long it lasts.</p>
      {user.status === "restricted" || user.status === "suspended" ? (
        <form className="mt-4 space-y-2" onSubmit={async (e) => {
          e.preventDefault();
          await accountApi("/api/v1/account/appeals", { method: "POST", body: JSON.stringify({ message: appeal }) });
          setAppeal("");
          const body = await accountApi<{ data: typeof rows }>("/api/v1/account/appeals");
          setRows(body.data);
          onDone();
        }}>
          <textarea value={appeal} onChange={(e) => setAppeal(e.target.value)} placeholder="Why should this be reviewed?" className="min-h-24 w-full rounded-lg border px-3 py-2" />
          <button className="h-10 rounded-full bg-[#2f6bff] px-5 text-[14px] font-semibold text-white">Submit appeal</button>
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
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<main className="page-shell py-10">Loading your account…</main>}>
      <AccountScreen />
    </Suspense>
  );
}
