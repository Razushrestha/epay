"use client";

import { useEffect, useState } from "react";
import { accountApi } from "@/lib/account-api";

type Staff = { public_id: string; email: string; name: string; staff_role: string };
type Perm = { role_id: string; module: string; action: string };

export default function AdminRolesPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [perms, setPerms] = useState<Perm[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    const body = await accountApi<{ staff: Staff[]; permissions: Perm[] }>("/api/v1/admin/roles");
    setStaff(body.staff);
    setPerms(body.permissions);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Could not load roles"));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[26px] font-extrabold text-[#0f1c3f]">Roles</h1>
        <p className="text-[14px] text-[#6b7587]">Super Admin, Moderator, Finance, and Support with module permissions.</p>
      </div>
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p> : null}
      {notice ? <p className="rounded-xl bg-[#eaf1ff] px-4 py-3 text-[13px] text-[#2a4fa8]">{notice}</p> : null}
      <section className="nexlo-card p-5">
        <h2 className="text-[16px] font-extrabold">Staff</h2>
        <ul className="mt-3 space-y-2">
          {staff.map((person) => (
            <li key={person.public_id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#f7f7f7] px-3 py-2">
              <span className="text-[14px] font-medium text-[#0f1c3f]">{person.name} · {person.email}</span>
              <select
                defaultValue={person.staff_role || "super_admin"}
                className="h-9 rounded-full border px-3 text-[13px]"
                onChange={async (e) => {
                  await accountApi("/api/v1/admin/roles", { method: "PATCH", body: JSON.stringify({ userId: person.public_id, role: e.target.value }) });
                  setNotice(`${person.name} is now ${e.target.value.replace(/_/g, " ")}.`);
                }}
              >
                <option value="super_admin">Super Admin</option>
                <option value="moderator">Moderator</option>
                <option value="finance">Finance</option>
                <option value="support">Support</option>
              </select>
            </li>
          ))}
        </ul>
      </section>
      <section className="nexlo-card p-5">
        <h2 className="text-[16px] font-extrabold">Permissions</h2>
        <ul className="mt-3 grid gap-1 text-[13px] text-[#5b6780] sm:grid-cols-2">
          {perms.map((p) => (
            <li key={`${p.role_id}-${p.module}-${p.action}`}>{p.role_id} · {p.module}.{p.action}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
