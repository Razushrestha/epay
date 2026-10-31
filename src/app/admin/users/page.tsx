"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { accountApi } from "@/lib/account-api";
import { Empty, StatusPill, when } from "@/components/admin/admin-ui";

type Person = {
  public_id: string;
  email: string | null;
  phone: string | null;
  username: string | null;
  status: string;
  seller_level: string;
  is_seller: boolean;
  is_staff: boolean;
  created_at: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  country: string | null;
};

function UsersBoard() {
  const params = useSearchParams();
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [reason, setReason] = useState("Policy review");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [open, setOpen] = useState(params.get("new") === "1");
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", staff: false, seller: false });

  async function load(q = query) {
    const body = await accountApi<{ data: Person[] }>(`/api/v1/admin/users?q=${encodeURIComponent(q)}`);
    setPeople(body.data);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Could not load users"));
  }, []);

  async function act(person: Person, action: "warn" | "restrict" | "restore") {
    setError(null);
    if (reason.trim().length < 3) {
      setError("Enter a reason before applying a standing action.");
      return;
    }
    const body = await accountApi<{ data: { kind: string } }>("/api/v1/admin/actions", {
      method: "POST",
      body: JSON.stringify({
        userId: person.public_id,
        action,
        reason: reason.trim(),
        until: action === "restrict" ? new Date(Date.now() + 7 * 86400000).toISOString() : null,
      }),
    });
    setNotice(`${body.data.kind} applied to ${person.display_name || person.email}.`);
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold text-[#0f1c3f]">Users</h1>
          <p className="text-[14px] text-[#6b7587]">Every registered member, staff flag, and standing action.</p>
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} className="nexlo-btn nexlo-btn-blue">
          Add New User
        </button>
      </div>
      {error ? <p className="nexlo-alert nexlo-alert-error">{error}</p> : null}
      {notice ? <p className="nexlo-alert nexlo-alert-info">{notice}</p> : null}

      {open ? (
        <form
          className="grid gap-3 nexlo-card p-5 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            try {
              const body = await accountApi<{ data: { temporaryPassword?: string } }>("/api/v1/admin/users", { method: "POST", body: JSON.stringify(form) });
              setNotice(body.data.temporaryPassword ? `User created. Temporary password: ${body.data.temporaryPassword}` : "User created.");
              setForm({ firstName: "", lastName: "", email: "", password: "", staff: false, seller: false });
              setOpen(false);
              await load();
            } catch (err) {
              setError(err instanceof Error ? err.message : "Could not create user");
            }
          }}
        >
          <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} placeholder="First name" className="nexlo-field" />
          <input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} placeholder="Last name" className="nexlo-field" />
          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" type="email" required className="nexlo-field" />
          <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Password (optional)" className="nexlo-field" />
          <label className="flex items-center gap-2 text-[13px] text-[#3a4a66]"><input type="checkbox" checked={form.staff} onChange={(e) => setForm({ ...form, staff: e.target.checked })} /> Staff</label>
          <label className="flex items-center gap-2 text-[13px] text-[#3a4a66]"><input type="checkbox" checked={form.seller} onChange={(e) => setForm({ ...form, seller: e.target.checked })} /> Seller</label>
          <button className="nexlo-btn sm:col-span-2">Create user</button>
        </form>
      ) : null}

      <section className="nexlo-card p-5">
        <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); load(); }}>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search email, username, or name" className="nexlo-field min-w-[220px] flex-1" />
          <input value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Restriction reason" placeholder="Action reason" required className="nexlo-field min-w-[180px]" />
          <button className="nexlo-btn-ghost h-10 px-4">Search</button>
        </form>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[860px] text-left text-[13.5px]">
            <thead>
              <tr className="border-b border-[#eef2f7] text-[11px] font-semibold tracking-[0.06em] text-[#8a94a6]">
                <th className="py-3">Member</th>
                <th className="py-3">Role</th>
                <th className="py-3">Status</th>
                <th className="py-3">Joined</th>
                <th className="py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {people.map((person) => (
                <tr key={person.public_id} className="border-b border-[#f3f6fa]">
                  <td className="py-3">
                    <p className="font-semibold text-[#0f1c3f]">{person.display_name || [person.first_name, person.last_name].filter(Boolean).join(" ") || person.email}</p>
                    <p className="text-[12px] text-[#8a94a6]">{person.email}{person.username ? ` · @${person.username}` : ""}</p>
                  </td>
                  <td className="py-3 text-[#5b6780]">
                    {person.is_staff ? "Staff" : person.is_seller ? "Seller" : "Buyer"}
                    <span className="block text-[12px] capitalize">{person.seller_level.replace("_", " ")}</span>
                  </td>
                  <td className="py-3"><StatusPill status={person.status} /></td>
                  <td className="py-3 text-[#6b7587]">{when(person.created_at)}</td>
                  <td className="py-3">
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          ["warn", "Warning"],
                          ["restrict", "Temporary Suspension"],
                          ["restore", "Restore"],
                        ] as const
                      ).map(([action, label]) => (
                        <button key={action} type="button" className="text-[#3665f3] hover:underline" onClick={() => act(person, action)}>
                          {label}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="text-[#0f8f86] hover:underline"
                        onClick={async () => {
                          await accountApi(`/api/v1/admin/users/${person.public_id}`, { method: "PATCH", body: JSON.stringify({ staff: !person.is_staff }) });
                          await load();
                        }}
                      >
                        {person.is_staff ? "Remove staff" : "Make staff"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!people.length ? <Empty title="No members found" sub="Create a user or wait for the next registration." /> : null}
        </div>
      </section>
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <Suspense fallback={<p className="text-[14px] text-[#8a94a6]">Loading users…</p>}>
      <UsersBoard />
    </Suspense>
  );
}
