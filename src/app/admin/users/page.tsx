"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { accountApi } from "@/lib/account-api";
import { Empty, StatusPill, when } from "@/components/admin/admin-ui";
import { SavedViewsBar } from "@/components/admin/SavedViewsBar";

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

type StatusFilter = "all" | "active" | "pending" | "restricted" | "suspended";
type RoleFilter = "all" | "staff" | "seller" | "buyer";

function personName(person: Person) {
  return (
    person.display_name ||
    [person.first_name, person.last_name].filter(Boolean).join(" ") ||
    person.email ||
    person.phone ||
    person.public_id
  );
}

function UsersBoard() {
  const params = useSearchParams();
  const [query, setQuery] = useState(params.get("q") || "");
  const [people, setPeople] = useState<Person[]>([]);
  const [reason, setReason] = useState("Policy review");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [open, setOpen] = useState(params.get("new") === "1");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", staff: false, seller: false });

  async function load(q = query) {
    const body = await accountApi<{ data: Person[] }>(`/api/v1/admin/users?q=${encodeURIComponent(q)}`);
    setPeople(body.data);
  }

  useEffect(() => {
    const q = params.get("q");
    if (q != null && q !== "") setQuery(q);
  }, [params]);

  useEffect(() => {
    load(query).catch((err) => setError(err instanceof Error ? err.message : "Could not load users"));
  }, [query]);

  const filtered = useMemo(() => {
    return people.filter((person) => {
      if (statusFilter !== "all" && person.status !== statusFilter) return false;
      if (roleFilter === "staff" && !person.is_staff) return false;
      if (roleFilter === "seller" && !person.is_seller) return false;
      if (roleFilter === "buyer" && (person.is_staff || person.is_seller)) return false;
      return true;
    });
  }, [people, statusFilter, roleFilter]);

  const selected = filtered.find((p) => p.public_id === selectedId) || people.find((p) => p.public_id === selectedId) || null;

  async function act(person: Person, action: "warn" | "restrict" | "suspend" | "restore") {
    setError(null);
    if (reason.trim().length < 3) {
      setError("Enter a reason before applying a standing action.");
      return;
    }
    setBusy(true);
    try {
      const body = await accountApi<{ data: { kind: string } }>("/api/v1/admin/actions", {
        method: "POST",
        body: JSON.stringify({
          userId: person.public_id,
          action,
          reason: reason.trim(),
          until: action === "restrict" ? new Date(Date.now() + 7 * 86400000).toISOString() : null,
        }),
      });
      setNotice(`${body.data.kind} applied to ${personName(person)}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not apply action");
    } finally {
      setBusy(false);
    }
  }

  async function toggleStaff(person: Person) {
    setBusy(true);
    setError(null);
    try {
      await accountApi(`/api/v1/admin/users/${person.public_id}`, {
        method: "PATCH",
        body: JSON.stringify({ staff: !person.is_staff }),
      });
      setNotice(person.is_staff ? "Staff access removed." : "Staff access granted (support role by default).");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update staff flag");
    } finally {
      setBusy(false);
    }
  }

  const counts = {
    all: people.length,
    active: people.filter((p) => p.status === "active").length,
    pending: people.filter((p) => p.status === "pending").length,
    restricted: people.filter((p) => p.status === "restricted").length,
    suspended: people.filter((p) => p.status === "suspended").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold text-[#0f1c3f]">Users</h1>
          <p className="text-[14px] text-[#6b7587]">Search, filter, and resolve standing without leaving this page.</p>
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} className="nexlo-btn nexlo-btn-blue">
          Add New User
        </button>
      </div>
      {error ? <p className="nexlo-alert nexlo-alert-error">{error}</p> : null}
      {notice ? <p className="nexlo-alert nexlo-alert-info">{notice}</p> : null}

      <SavedViewsBar
        desk="users"
        role="staff"
        current={{ query, status: statusFilter === "all" ? "" : statusFilter }}
        onApply={(view) => {
          setQuery(view.query || "");
          setStatusFilter((view.status as StatusFilter) || "all");
        }}
      />

      {open ? (
        <form
          className="grid gap-3 nexlo-card p-5 sm:grid-cols-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            try {
              const body = await accountApi<{ data: { temporaryPassword?: string } }>("/api/v1/admin/users", {
                method: "POST",
                body: JSON.stringify(form),
              });
              setNotice(
                body.data.temporaryPassword
                  ? `User created. Temporary password: ${body.data.temporaryPassword}`
                  : "User created.",
              );
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
          <label className="flex items-center gap-2 text-[13px] text-[#3a4a66]">
            <input type="checkbox" checked={form.staff} onChange={(e) => setForm({ ...form, staff: e.target.checked })} /> Staff
          </label>
          <label className="flex items-center gap-2 text-[13px] text-[#3a4a66]">
            <input type="checkbox" checked={form.seller} onChange={(e) => setForm({ ...form, seller: e.target.checked })} /> Seller
          </label>
          <button className="nexlo-btn sm:col-span-2">Create user</button>
        </form>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="nexlo-card p-5">
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              load().catch((err) => setError(err instanceof Error ? err.message : "Could not load users"));
            }}
          >
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search email, username, or name"
              className="nexlo-field min-w-[220px] flex-1"
            />
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              aria-label="Restriction reason"
              placeholder="Action reason"
              required
              className="nexlo-field min-w-[180px]"
            />
            <button className="nexlo-btn-ghost h-10 px-4">Search</button>
          </form>

          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [
                ["all", "All"],
                ["active", "Active"],
                ["pending", "Pending"],
                ["restricted", "Restricted"],
                ["suspended", "Suspended"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setStatusFilter(id)}
                className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                  statusFilter === id ? "bg-[#3665f3] text-white" : "bg-[#f4f8fd] text-[#5b6780]"
                }`}
              >
                {label}
                <span className="ml-1 opacity-80">{counts[id]}</span>
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {(
              [
                ["all", "Any role"],
                ["staff", "Staff"],
                ["seller", "Sellers"],
                ["buyer", "Buyers"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setRoleFilter(id)}
                className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
                  roleFilter === id ? "bg-[#0f1c3f] text-white" : "bg-[#f4f8fd] text-[#5b6780]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[13.5px]">
              <thead>
                <tr className="border-b border-[#eef2f7] text-[11px] font-semibold tracking-[0.06em] text-[#8a94a6]">
                  <th className="py-3">Member</th>
                  <th className="py-3">Role</th>
                  <th className="py-3">Status</th>
                  <th className="py-3">Joined</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((person) => {
                  const active = selectedId === person.public_id;
                  return (
                    <tr
                      key={person.public_id}
                      className={`cursor-pointer border-b border-[#f3f6fa] ${active ? "bg-[#eef4ff]" : "hover:bg-[#f8fbff]"}`}
                      onClick={() => setSelectedId(person.public_id)}
                    >
                      <td className="py-3">
                        <p className="font-semibold text-[#0f1c3f]">{personName(person)}</p>
                        <p className="text-[12px] text-[#8a94a6]">
                          {person.email}
                          {person.username ? ` · @${person.username}` : ""}
                        </p>
                      </td>
                      <td className="py-3 text-[#5b6780]">
                        {person.is_staff ? "Staff" : person.is_seller ? "Seller" : "Buyer"}
                        <span className="block text-[12px] capitalize">{person.seller_level.replace("_", " ")}</span>
                      </td>
                      <td className="py-3">
                        <StatusPill status={person.status} />
                      </td>
                      <td className="py-3 text-[#6b7587]">{when(person.created_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!filtered.length ? <Empty title="No members found" sub="Try another search or clear filters." /> : null}
          </div>
        </section>

        <aside className="nexlo-card h-fit p-5 xl:sticky xl:top-24">
          {selected ? (
            <div className="space-y-4">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-[#8a94a6]">Selected member</p>
                <h2 className="mt-1 text-[18px] font-extrabold text-[#0f1c3f]">{personName(selected)}</h2>
                <p className="text-[13px] text-[#6b7587]">{selected.email || "No email"}</p>
                {selected.phone ? <p className="text-[13px] text-[#6b7587]">{selected.phone}</p> : null}
                <p className="mt-2 font-mono text-[11px] text-[#8a94a6]">{selected.public_id}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusPill status={selected.status} />
                <span className="rounded-full bg-[#f4f8fd] px-2.5 py-1 text-[12px] font-semibold text-[#5b6780]">
                  {selected.is_staff ? "Staff" : selected.is_seller ? "Seller" : "Buyer"}
                </span>
              </div>
              <dl className="space-y-2 text-[13px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-[#8a94a6]">Seller level</dt>
                  <dd className="capitalize text-[#0f1c3f]">{selected.seller_level.replace("_", " ")}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[#8a94a6]">Country</dt>
                  <dd className="text-[#0f1c3f]">{selected.country || "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[#8a94a6]">Joined</dt>
                  <dd className="text-[#0f1c3f]">{when(selected.created_at)}</dd>
                </div>
              </dl>

              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-[#8a94a6]">Standing</p>
                <p className="mt-1 text-[12.5px] text-[#6b7587]">Uses the reason field above. Required for every action.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button type="button" disabled={busy} className="nexlo-btn-ghost h-9 px-3 text-[13px]" onClick={() => act(selected, "warn")}>
                    Warn
                  </button>
                  <button type="button" disabled={busy} className="nexlo-btn-ghost h-9 px-3 text-[13px]" onClick={() => act(selected, "restrict")}>
                    Restrict 7d
                  </button>
                  <button type="button" disabled={busy} className="nexlo-btn-ghost h-9 px-3 text-[13px] text-[#e5484d]" onClick={() => act(selected, "suspend")}>
                    Suspend
                  </button>
                  <button type="button" disabled={busy} className="nexlo-btn nexlo-btn-blue h-9 px-3 text-[13px]" onClick={() => act(selected, "restore")}>
                    Restore
                  </button>
                </div>
              </div>

              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-[#8a94a6]">Access</p>
                <button type="button" disabled={busy} className="mt-2 nexlo-btn-ghost h-9 w-full px-3 text-[13px]" onClick={() => toggleStaff(selected)}>
                  {selected.is_staff ? "Remove staff" : "Make staff"}
                </button>
              </div>

              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-[#8a94a6]">Related</p>
                <div className="mt-2 flex flex-col gap-1.5">
                  <Link href={`/admin/kyc`} className="text-[13px] font-semibold text-[#3665f3] hover:underline">
                    Open KYC queue →
                  </Link>
                  <Link href={`/admin/orders`} className="text-[13px] font-semibold text-[#3665f3] hover:underline">
                    Orders desk →
                  </Link>
                  <Link href={`/admin/trust`} className="text-[13px] font-semibold text-[#3665f3] hover:underline">
                    Trust / blacklist →
                  </Link>
                  <Link href={`/admin/appeals`} className="text-[13px] font-semibold text-[#3665f3] hover:underline">
                    Appeals →
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <Empty title="Select a member" sub="Click a row to review standing, staff access, and related queues." />
          )}
        </aside>
      </div>
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
