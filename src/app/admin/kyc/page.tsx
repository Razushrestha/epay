"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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

function docLabel(type: string) {
  if (type === "passport") return "Passport";
  return "Nepali Citizenship";
}

export default function AdminKycPage() {
  const [rows, setRows] = useState<Kyc[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    accountApi<{ data: Kyc[] }>("/api/v1/admin/kyc")
      .then((body) => setRows(body.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load KYC queue"));
  }, []);

  const pending = rows.filter((row) => row.status === "pending");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[26px] font-extrabold text-[#0f1c3f]">KYC review</h1>
        <p className="text-[14px] text-[#6b7587]">Open a pending seller application, inspect ID photos, then approve or reject.</p>
      </div>
      {error ? <p className="nexlo-alert nexlo-alert-error">{error}</p> : null}

      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.public_id} className="flex flex-wrap items-center justify-between gap-3 nexlo-card px-4 py-3">
            <div className="min-w-0">
              <p className="font-semibold text-[#0f1c3f]">{row.display_name || row.email}</p>
              <p className="text-[13px] text-[#6b7587]">
                {docLabel(row.doc_type)} · {row.email} · {when(row.created_at)}
              </p>
              <p className="mt-1 font-mono text-[11px] text-[#8a94a6]">KYC Application ID {row.applicationId || row.public_id}</p>
            </div>
            <div className="flex items-center gap-2">
              <StatusPill status={row.statusLabel || row.status} />
              <Link href={`/admin/kyc/${row.public_id}`} className="nexlo-btn nexlo-btn-blue h-9 px-4 text-[13px]">
                {row.status === "pending" ? "Open pending application" : "View application"}
              </Link>
            </div>
          </li>
        ))}
      </ul>
      {!rows.length ? <Empty title="No KYC applications" sub="Seller applications will land here after document upload." /> : null}
      {rows.length && !pending.length ? <p className="text-[13px] text-[#6b7587]">No pending applications right now.</p> : null}
    </div>
  );
}
