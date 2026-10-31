"use client";

import { useEffect, useState } from "react";
import { accountApi, getToken } from "@/lib/account-api";
import { Empty, StatusPill, when } from "@/components/admin/admin-ui";

type Appeal = {
  public_id: string;
  message: string;
  status: string;
  email: string;
  display_name: string | null;
  evidence?: string | null;
  reason?: string | null;
  kind?: string | null;
  created_at: string;
};

export default function AdminAppealsPage() {
  const [rows, setRows] = useState<Appeal[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    const body = await accountApi<{ data: Appeal[] }>("/api/v1/admin/appeals");
    setRows(body.data);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Could not load appeals"));
  }, []);

  async function decide(item: Appeal, decision: "upheld" | "lift") {
    setError(null);
    await accountApi(`/api/v1/admin/appeals/${item.public_id}`, {
      method: "POST",
      body: JSON.stringify({
        decision: decision === "lift" ? "lift" : "upheld",
        resolution: decision === "lift" ? "Restriction lifted after appeal" : "Original action stands",
      }),
    });
    setNotice(decision === "lift" ? `Lifted restriction for ${item.display_name || item.email}.` : `Upheld restriction for ${item.display_name || item.email}.`);
    await load();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[26px] font-extrabold text-[#0f1c3f]">Appeals</h1>
        <p className="text-[14px] text-[#6b7587]">Review standing appeals. Uphold the restriction or lift it.</p>
      </div>
      {error ? <p className="nexlo-alert nexlo-alert-error">{error}</p> : null}
      {notice ? <p className="nexlo-alert nexlo-alert-info">{notice}</p> : null}
      <ul className="space-y-3">
        {rows.map((item) => (
          <li key={item.public_id} className="nexlo-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-[#0f1c3f]">{item.display_name || item.email}</p>
                <p className="text-[13px] text-[#6b7587]">
                  {item.kind || "Restriction"} · {item.email} · {when(item.created_at)}
                </p>
                {item.reason ? <p className="mt-1 text-[13px] text-[#6b7587]">Staff reason: {item.reason}</p> : null}
                <p className="mt-2 text-[14px] text-[#0f1c3f]">{item.message}</p>
              </div>
              <StatusPill status={item.status} />
            </div>
            {item.evidence ? <EvidencePreview src={item.evidence} /> : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="h-10 rounded-full bg-[#12a37e] px-5 text-[14px] font-semibold text-white" onClick={() => decide(item, "lift")}>
                Lift restriction
              </button>
              <button type="button" className="h-10 rounded-full border border-[#f5c2c7] px-5 text-[14px] font-semibold text-[#e5484d]" onClick={() => decide(item, "upheld")}>
                Uphold
              </button>
            </div>
          </li>
        ))}
      </ul>
      {!rows.length ? <Empty title="No pending appeals" sub="Member appeals from Account standing will land here." /> : null}
    </div>
  );
}

function EvidencePreview({ src }: { src: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [kind, setKind] = useState("image");
  useEffect(() => {
    let objectUrl = "";
    let cancelled = false;
    (async () => {
      const token = getToken();
      const res = await fetch(src, { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
      if (!res.ok) return;
      const blob = await res.blob();
      objectUrl = URL.createObjectURL(blob);
      if (cancelled) {
        URL.revokeObjectURL(objectUrl);
        return;
      }
      setKind(blob.type.includes("pdf") ? "pdf" : "image");
      setUrl(objectUrl);
    })().catch(() => undefined);
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);
  if (!url) return <p className="mt-3 text-[13px] text-[#6b7587]">Loading evidence…</p>;
  return (
    <figure className="mt-3 max-w-md rounded-2xl border border-[#e7eef6] p-3">
      <figcaption className="mb-2 text-[13px] font-semibold text-[#0f1c3f]">Evidence</figcaption>
      {kind === "pdf" ? (
        <a href={url} target="_blank" rel="noreferrer" className="text-[13px] font-semibold text-[#3665f3]">
          Open evidence PDF
        </a>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="Appeal evidence" className="max-h-[280px] w-full rounded-xl object-contain bg-[#f4f8fd]" />
      )}
    </figure>
  );
}
