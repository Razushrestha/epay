"use client";

import { useEffect, useState } from "react";
import { accountApi } from "@/lib/account-api";
import { Empty, when } from "@/components/admin/admin-ui";

type Row = { id: number; action: string; entity_type: string | null; entity_id: string | null; email: string | null; created_at: string; new_value: unknown };

export default function AdminAuditPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    accountApi<{ data: Row[] }>("/api/v1/admin/audit")
      .then((b) => setRows(b.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load audit log"));
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[26px] font-extrabold text-[#0f1c3f]">Audit log</h1>
        <p className="text-[14px] text-[#6b7587]">Every staff write on users, listings, disputes, CMS, and settings.</p>
      </div>
      {error ? <p className="rounded-xl bg-red-50 px-4 py-3 text-[13px] text-red-700">{error}</p> : null}
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="rounded-2xl border border-[#e7eef6] bg-white px-4 py-3 text-[13px]">
            <span className="font-semibold text-[#0f1c3f]">{row.action}</span>
            <span className="text-[#6b7587]"> · {row.entity_type} {row.entity_id} · {row.email || "system"} · {when(row.created_at)}</span>
          </li>
        ))}
      </ul>
      {!rows.length ? <Empty title="No admin writes yet" sub="Staff actions on users, listings, and cases are logged here." /> : null}
    </div>
  );
}
