"use client";

import { useEffect, useMemo, useState } from "react";
import { accountApi } from "@/lib/account-api";
import { Empty, when } from "@/components/admin/admin-ui";

type Row = {
  id: number;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  email: string | null;
  created_at: string;
  new_value: unknown;
};

export default function AdminAuditPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    accountApi<{ data: Row[] }>("/api/v1/admin/audit")
      .then((b) => setRows(b.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load audit log"));
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const blob = `${row.action} ${row.entity_type || ""} ${row.entity_id || ""} ${row.email || ""} ${JSON.stringify(row.new_value || {})}`.toLowerCase();
      return blob.includes(q);
    });
  }, [rows, query]);

  const selected = rows.find((r) => r.id === selectedId) || null;
  const prefixes = useMemo(() => {
    const set = new Set<string>();
    for (const row of rows) {
      const prefix = row.action.split(".")[0];
      if (prefix) set.add(prefix);
    }
    return Array.from(set).sort();
  }, [rows]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[26px] font-extrabold text-[#0f1c3f]">Audit log</h1>
        <p className="text-[14px] text-[#6b7587]">Every staff write on users, listings, disputes, CMS, and settings.</p>
      </div>
      {error ? <p className="nexlo-alert nexlo-alert-error">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by action, actor, entity…"
          className="nexlo-field min-w-[220px] flex-1"
        />
        {prefixes.slice(0, 8).map((prefix) => (
          <button
            key={prefix}
            type="button"
            onClick={() => setQuery(prefix)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
              query === prefix ? "bg-[#3665f3] text-white" : "bg-[#f4f8fd] text-[#5b6780]"
            }`}
          >
            {prefix}
          </button>
        ))}
        {query ? (
          <button type="button" onClick={() => setQuery("")} className="rounded-full px-3 py-1.5 text-[12px] font-semibold text-[#3665f3]">
            Clear
          </button>
        ) : null}
        <button
          type="button"
          className="nexlo-btn-ghost h-10 px-4"
          onClick={() => {
            const header = ["id", "action", "entity_type", "entity_id", "email", "created_at", "payload"];
            const lines = visible.map((row) =>
              [row.id, row.action, row.entity_type, row.entity_id, row.email, row.created_at, JSON.stringify(row.new_value ?? {})]
                .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
                .join(","),
            );
            const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `nexlo-audit-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Export CSV
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="nexlo-card overflow-hidden">
          <ul className="divide-y divide-[#eef2f7]">
            {visible.map((row) => {
              const active = selectedId === row.id;
              return (
                <li
                  key={row.id}
                  className={`cursor-pointer px-4 py-3 text-[13px] ${active ? "bg-[#eef4ff]" : "hover:bg-[#f8fbff]"}`}
                  onClick={() => setSelectedId(row.id)}
                >
                  <p>
                    <span className="font-semibold text-[#0f1c3f]">{row.action}</span>
                    <span className="text-[#6b7587]">
                      {" "}
                      · {row.entity_type} {row.entity_id} · {row.email || "system"} · {when(row.created_at)}
                    </span>
                  </p>
                </li>
              );
            })}
          </ul>
          {!visible.length ? <Empty title="No matching audit rows" sub="Staff actions on users, listings, and cases are logged here." /> : null}
        </section>

        <aside className="nexlo-card h-fit p-5 xl:sticky xl:top-24">
          {selected ? (
            <div className="space-y-3">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-[#8a94a6]">Event</p>
                <h2 className="mt-1 text-[18px] font-extrabold text-[#0f1c3f]">{selected.action}</h2>
              </div>
              <dl className="space-y-2 text-[13px]">
                <div className="flex justify-between gap-3">
                  <dt className="text-[#8a94a6]">Actor</dt>
                  <dd className="text-[#0f1c3f]">{selected.email || "system"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[#8a94a6]">Entity</dt>
                  <dd className="text-right text-[#0f1c3f]">
                    {selected.entity_type} {selected.entity_id}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[#8a94a6]">When</dt>
                  <dd className="text-[#0f1c3f]">{when(selected.created_at)}</dd>
                </div>
              </dl>
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-[#8a94a6]">Payload</p>
                <pre className="mt-2 max-h-64 overflow-auto rounded-xl bg-[#f7fafd] p-3 text-[11px] text-[#3a4a66]">
                  {JSON.stringify(selected.new_value ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <Empty title="Select an event" sub="Inspect the audited payload for any staff write." />
          )}
        </aside>
      </div>
    </div>
  );
}
