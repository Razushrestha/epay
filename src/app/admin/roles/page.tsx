"use client";

import { useEffect, useMemo, useState } from "react";
import { accountApi } from "@/lib/account-api";
import { Empty } from "@/components/admin/admin-ui";

type Staff = { public_id: string; email: string; name: string; staff_role: string };
type Perm = { role_id: string; module: string; action: string };
type RoleMeta = { id: string; name: string; description?: string };

const ROLE_OPTIONS = [
  { id: "super_admin", label: "Super Admin" },
  { id: "moderator", label: "Moderator" },
  { id: "finance", label: "Finance" },
  { id: "support", label: "Support" },
  { id: "catalog", label: "Catalog" },
] as const;

const MODULE_ORDER = [
  "users",
  "listings",
  "orders",
  "payouts",
  "refunds",
  "ledger",
  "finance",
  "disputes",
  "moderation",
  "trust",
  "kyc",
  "appeals",
  "reviews",
  "tickets",
  "messages",
  "cms",
  "catalog",
  "settings",
  "analytics",
  "audit",
  "roles",
];

export default function AdminRolesPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [perms, setPerms] = useState<Perm[]>([]);
  const [roles, setRoles] = useState<RoleMeta[]>([]);
  const [selectedRole, setSelectedRole] = useState<string>("moderator");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const body = await accountApi<{ staff: Staff[]; permissions: Perm[]; roles?: RoleMeta[] }>("/api/v1/admin/roles");
    setStaff(body.staff);
    setPerms(body.permissions);
    setRoles(body.roles || ROLE_OPTIONS.map((r) => ({ id: r.id, name: r.label })));
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Could not load roles"));
  }, []);

  const modules = useMemo(() => {
    const fromPerms = Array.from(new Set(perms.map((p) => p.module)));
    const ordered = MODULE_ORDER.filter((m) => fromPerms.includes(m));
    for (const m of fromPerms) if (!ordered.includes(m)) ordered.push(m);
    return ordered;
  }, [perms]);

  const matrixRoles = useMemo(() => {
    const ids = ROLE_OPTIONS.map((r) => r.id).filter((id) => id !== "super_admin");
    const known = roles.map((r) => r.id).filter((id) => id !== "super_admin");
    return Array.from(new Set([...ids, ...known]));
  }, [roles]);

  function cell(roleId: string, module: string) {
    const read = perms.some((p) => p.role_id === roleId && p.module === module && p.action === "read");
    const write = perms.some((p) => p.role_id === roleId && p.module === module && p.action === "write");
    if (write) return "R/W";
    if (read) return "R";
    return "—";
  }

  async function assignRole(person: Staff, role: string) {
    setError(null);
    setBusyId(person.public_id);
    try {
      await accountApi("/api/v1/admin/roles", {
        method: "PATCH",
        body: JSON.stringify({ userId: person.public_id, role }),
      });
      setNotice(`${person.name} → ${role.replace(/_/g, " ")}`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign role");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[26px] font-extrabold text-[#0f1c3f]">Roles</h1>
        <p className="text-[14px] text-[#6b7587]">
          Assign staff roles and review the module matrix. Super Admin bypasses the table; every other role is explicit.
        </p>
      </div>
      {error ? <p className="nexlo-alert nexlo-alert-error">{error}</p> : null}
      {notice ? <p className="nexlo-alert nexlo-alert-info">{notice}</p> : null}

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <section className="nexlo-card p-5">
          <h2 className="text-[16px] font-extrabold text-[#0f1c3f]">Staff assignments</h2>
          <ul className="mt-3 space-y-2">
            {staff.map((person) => (
              <li key={person.public_id} className="rounded-xl bg-[#f4f8fd] px-3 py-2">
                <p className="text-[14px] font-medium text-[#0f1c3f]">{person.name}</p>
                <p className="text-[12px] text-[#8a94a6]">{person.email}</p>
                <select
                  value={person.staff_role || "support"}
                  disabled={busyId === person.public_id}
                  className="mt-2 nexlo-field h-9"
                  onChange={(e) => assignRole(person, e.target.value)}
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>
          {!staff.length ? <Empty title="No staff accounts" sub="Promote a user from Settings or Users first." /> : null}
        </section>

        <section className="nexlo-card p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-extrabold text-[#0f1c3f]">Permission matrix</h2>
              <p className="text-[13px] text-[#6b7587]">R = read · R/W = read + write · — = none</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {matrixRoles.map((roleId) => (
                <button
                  key={roleId}
                  type="button"
                  onClick={() => setSelectedRole(roleId)}
                  className={`rounded-full px-3 py-1.5 text-[12px] font-semibold capitalize ${
                    selectedRole === roleId ? "bg-[#3665f3] text-white" : "bg-[#f4f8fd] text-[#5b6780]"
                  }`}
                >
                  {roleId.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-[#eef2f7] text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8a94a6]">
                  <th className="py-3 pr-3">Module</th>
                  {matrixRoles.map((roleId) => (
                    <th key={roleId} className={`py-3 pr-3 capitalize ${selectedRole === roleId ? "text-[#3665f3]" : ""}`}>
                      {roleId.replace(/_/g, " ")}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {modules.map((module) => (
                  <tr key={module} className="border-b border-[#f3f6fa]">
                    <td className="py-2.5 pr-3 font-medium text-[#0f1c3f]">{module}</td>
                    {matrixRoles.map((roleId) => {
                      const value = cell(roleId, module);
                      return (
                        <td
                          key={`${roleId}-${module}`}
                          className={`py-2.5 pr-3 font-semibold ${
                            value === "R/W" ? "text-[#12a37e]" : value === "R" ? "text-[#3665f3]" : "text-[#c5cad3]"
                          } ${selectedRole === roleId ? "bg-[#f7faff]" : ""}`}
                        >
                          {value}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {!modules.length ? <Empty title="No permissions seeded" sub="Run migration 007/010 to seed staff_permissions." /> : null}
          </div>
          <p className="mt-3 text-[12px] text-[#8a94a6]">
            Super Admin is not listed in the grid — that role short-circuits <code className="rounded bg-[#f3f6fb] px-1">denyUnless</code>.
          </p>
        </section>
      </div>
    </div>
  );
}
