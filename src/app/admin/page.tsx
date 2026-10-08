"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { accountApi } from "@/lib/account-api";

type Kyc = { public_id: string; doc_type: string; status: string; email: string; display_name: string | null };
type Person = { public_id: string; email: string | null; display_name: string | null; status: string; seller_level: string };
type Appeal = { public_id: string; message: string; email: string; display_name: string | null };

export default function AdminPage() {
  const router = useRouter();
  const [staff, setStaff] = useState<boolean | null>(null);
  const [kyc, setKyc] = useState<Kyc[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [query, setQuery] = useState("");
  const [reason, setReason] = useState("Policy review");
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const status = await accountApi<{ youAreStaff: boolean; staffExists: boolean }>("/api/v1/admin/status");
    setStaff(status.youAreStaff);
    if (!status.youAreStaff) return;
    const [docs, users, notes] = await Promise.all([
      accountApi<{ data: Kyc[] }>("/api/v1/admin/kyc"),
      accountApi<{ data: Person[] }>(`/api/v1/admin/users?q=${encodeURIComponent(query)}`),
      accountApi<{ data: Appeal[] }>("/api/v1/admin/appeals"),
    ]);
    setKyc(docs.data);
    setPeople(users.data);
    setAppeals(notes.data);
  }

  useEffect(() => {
    refresh().catch(() => router.push("/login"));
  }, [router]);

  if (staff === null) return <main className="page-shell py-10">Loading staff tools…</main>;
  if (!staff) {
    return (
      <main className="page-shell max-w-[560px] py-10">
        <h1 className="text-[22px] font-bold">Staff tools</h1>
        <p className="mt-2 text-[14px] text-[#667085]">Identity reviews, restrictions, and appeals are limited to staff. On this local setup the first signed-in person can claim that role.</p>
        {error ? <p className="mt-3 text-[13px] text-red-600">{error}</p> : null}
        <button
          type="button"
          className="mt-4 h-10 rounded-full bg-[#2f6bff] px-5 text-[14px] font-semibold text-white"
          onClick={async () => {
            try {
              await accountApi("/api/v1/admin/claim", { method: "POST", body: "{}" });
              await refresh();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not claim staff access");
            }
          }}
        >
          Claim staff access
        </button>
      </main>
    );
  }

  return (
    <main className="page-shell space-y-8 py-6">
      <h1 className="text-[24px] font-bold text-[#121826]">Staff</h1>
      <section>
        <h2 className="text-[16px] font-bold">Identity reviews</h2>
        <ul className="mt-3 space-y-2">
          {kyc.map((item) => (
            <li key={item.public_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-3 text-[13px]">
              <span>{item.display_name || item.email} · {item.doc_type} · {item.status}</span>
              {item.status === "pending" ? (
                <span className="flex gap-2">
                  <button type="button" className="text-[#0f8f86]" onClick={() => accountApi(`/api/v1/admin/kyc/${item.public_id}`, { method: "POST", body: JSON.stringify({ decision: "approved" }) }).then(refresh)}>Approve</button>
                  <button type="button" className="text-red-600" onClick={() => {
                    const why = window.prompt("Reason for rejection") ?? "";
                    if (!why.trim()) return;
                    accountApi(`/api/v1/admin/kyc/${item.public_id}`, { method: "POST", body: JSON.stringify({ decision: "rejected", reason: why }) }).then(refresh);
                  }}>Reject</button>
                </span>
              ) : null}
            </li>
          ))}
          {kyc.length === 0 ? <li className="text-[13px] text-[#667085]">No documents yet.</li> : null}
        </ul>
      </section>
      <section>
        <h2 className="text-[16px] font-bold">Restrict, suspend, or restore</h2>
        <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); refresh(); }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search email or name" className="h-10 flex-1 rounded-lg border px-3" />
          <button className="h-10 rounded-full border px-4">Search</button>
        </form>
        <input value={reason} onChange={(e) => setReason(e.target.value)} className="mt-2 h-10 w-full rounded-lg border px-3" placeholder="Reason" />
        <ul className="mt-3 space-y-2">
          {people.map((person) => (
            <li key={person.public_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-3 text-[13px]">
              <span>{person.display_name || person.email} · {person.status} · {person.seller_level}</span>
              <span className="flex gap-2">
                {(["restrict", "suspend", "restore"] as const).map((action) => (
                  <button key={action} type="button" className="capitalize text-[#2f6bff]" onClick={() => accountApi("/api/v1/admin/actions", { method: "POST", body: JSON.stringify({ userId: person.public_id, action, reason, until: action === "restrict" ? new Date(Date.now() + 7 * 86400000).toISOString() : null }) }).then(refresh)}>{action}</button>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-[16px] font-bold">Appeals</h2>
        <ul className="mt-3 space-y-2">
          {appeals.map((item) => (
            <li key={item.public_id} className="rounded-xl border px-3 py-3 text-[13px]">
              <p>{item.display_name || item.email}: {item.message}</p>
              <span className="mt-2 flex gap-3">
                <button type="button" className="text-[#0f8f86]" onClick={() => accountApi(`/api/v1/admin/appeals/${item.public_id}`, { method: "POST", body: JSON.stringify({ decision: "overturned", resolution: "Appeal accepted" }) }).then(refresh)}>Overturn</button>
                <button type="button" className="text-red-600" onClick={() => accountApi(`/api/v1/admin/appeals/${item.public_id}`, { method: "POST", body: JSON.stringify({ decision: "upheld", resolution: "Original action stands" }) }).then(refresh)}>Uphold</button>
              </span>
            </li>
          ))}
          {appeals.length === 0 ? <li className="text-[13px] text-[#667085]">No open appeals.</li> : null}
        </ul>
      </section>
    </main>
  );
}
