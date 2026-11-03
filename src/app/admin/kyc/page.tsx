"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { accountApi } from "@/lib/account-api";
import { Empty, StatusPill, when } from "@/components/admin/admin-ui";

type Kyc = {
  public_id: string;
  applicationId: string;
  doc_type: string;
  status: string;
  statusLabel: string;
  email: string;
  display_name: string | null;
  pan?: string | null;
  created_at: string;
};

type Filter = "pending" | "all" | "approved" | "rejected";

function docLabel(type: string) {
  if (type === "passport") return "Passport";
  return "Nepali Citizenship";
}

export default function AdminKycPage() {
  const [rows, setRows] = useState<Kyc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("pending");

  useEffect(() => {
    accountApi<{ data: Kyc[] }>("/api/v1/admin/kyc")
      .then((body) => setRows(body.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load KYC queue"));
  }, []);

  const counts = useMemo(
    () => ({
      pending: rows.filter((row) => row.status === "pending").length,
      approved: rows.filter((row) => row.status === "approved").length,
      rejected: rows.filter((row) => row.status === "rejected").length,
      all: rows.length,
    }),
    [rows],
  );

  const visible = rows.filter((row) => (filter === "all" ? true : row.status === filter));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[26px] font-extrabold text-[#0f1c3f]">KYC review</h1>
          <p className="text-[14px] text-[#6b7587]">
            Open a pending seller application, inspect ID photos, then approve or reject with a reason.
          </p>
        </div>
        {counts.pending > 0 ? (
          <span className="rounded-full bg-[#fff6e5] px-3 py-1.5 text-[13px] font-semibold text-[#b45309]">
            {counts.pending} pending
          </span>
        ) : (
          <span className="rounded-full bg-[#ecfdf5] px-3 py-1.5 text-[13px] font-semibold text-[#047857]">Queue clear</span>
        )}
      </div>
      {error ? <p className="nexlo-alert nexlo-alert-error">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["pending", "Pending"],
            ["all", "All"],
            ["approved", "Approved"],
            ["rejected", "Rejected"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${
              filter === id ? "bg-[#3665f3] text-white" : "bg-[#f4f8fd] text-[#5b6780]"
            }`}
          >
            {label} <span className="opacity-80">{counts[id]}</span>
          </button>
        ))}
      </div>

      <ul className="space-y-2">
        {visible.map((row) => (
          <li key={row.public_id} className="flex flex-wrap items-center justify-between gap-3 nexlo-card px-4 py-3">
            <div className="min-w-0">
              <p className="font-semibold text-[#0f1c3f]">{row.display_name || row.email}</p>
              <p className="text-[13px] text-[#6b7587]">
                {docLabel(row.doc_type)} · {row.email} · {when(row.created_at)}
              </p>
              <p className="mt-1 font-mono text-[11px] text-[#8a94a6]">
                KYC Application ID {row.applicationId || row.public_id}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <StatusPill status={row.statusLabel || row.status} />
              <Link href={`/admin/kyc/${row.public_id}`} className="nexlo-btn nexlo-btn-blue h-9 px-4 text-[13px]">
                {row.status === "pending" ? "Review now" : "View"}
              </Link>
            </div>
          </li>
        ))}
      </ul>
      {!rows.length ? <Empty title="No KYC applications" sub="Seller applications will land here after document upload." /> : null}
      {rows.length && !visible.length ? (
        <Empty title={`No ${filter} applications`} sub="Switch filter to see other decisions." />
      ) : null}
    </div>
  );
}
