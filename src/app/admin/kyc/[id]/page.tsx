"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { accountApi } from "@/lib/account-api";
import { StatusPill, when } from "@/components/admin/admin-ui";

type Kyc = {
  public_id: string;
  applicationId: string;
  doc_type: string;
  status: string;
  statusLabel: string;
  rejection_reason: string | null;
  email: string;
  display_name: string | null;
  pan?: string | null;
  is_seller: boolean;
  created_at: string;
  files?: { front?: string; back?: string; selfie?: string };
};

function docLabel(type: string) {
  if (type === "passport") return "Passport";
  return "Nepali Citizenship";
}

export default function AdminKycDetailPage() {
  const pathname = usePathname();
  const router = useRouter();
  const id = pathname.split("/").filter(Boolean).pop() || "";
  const [item, setItem] = useState<Kyc | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  async function load() {
    if (!id) throw new Error("Missing application id");
    const body = await accountApi<{ data: Kyc }>(`/api/v1/admin/kyc/${id}`);
    setItem(body.data);
  }

  useEffect(() => {
    load().catch((err) => setError(err instanceof Error ? err.message : "Could not load application"));
  }, [id]);

  async function decide(decision: "approved" | "rejected", reason?: string) {
    if (!item) return;
    setError(null);
    setBusy(true);
    try {
      const body = await accountApi<{ data: { statusLabel: string; isSeller?: boolean } }>(`/api/v1/admin/kyc/${item.public_id}`, {
        method: "POST",
        body: JSON.stringify({ decision, reason }),
      });
      setRejectOpen(false);
      setNotice(
        decision === "approved"
          ? `${body.data.statusLabel}. This account is now a Seller and can use the /sell/create wizard.`
          : `${body.data.statusLabel}. The seller can re-upload clearer photos.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update application");
    } finally {
      setBusy(false);
    }
  }

  if (!item && !error) {
    return <p className="text-[14px] text-[#6b7587]">Loading application…</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <Link href="/admin/kyc" className="text-[13px] font-semibold text-[#3665f3] hover:underline">
          ← KYC queue
        </Link>
        <h1 className="mt-2 text-[26px] font-extrabold text-[#0f1c3f]">KYC application</h1>
        <p className="font-mono text-[13px] text-[#6b7587]">KYC Application ID {item?.applicationId || id}</p>
      </div>
      {error ? <p className="nexlo-alert nexlo-alert-error">{error}</p> : null}
      {notice ? <p className="nexlo-alert nexlo-alert-info">{notice}</p> : null}

      {item ? (
        <>
          <section className="nexlo-card p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[18px] font-extrabold text-[#0f1c3f]">{item.display_name || item.email}</p>
                <p className="mt-1 text-[13px] text-[#6b7587]">{item.email}</p>
                <p className="mt-1 text-[13px] text-[#6b7587]">
                  {docLabel(item.doc_type)} · PAN {item.pan || "—"} · Submitted {when(item.created_at)}
                </p>
              </div>
              <StatusPill status={item.statusLabel || item.status} />
            </div>
            {item.status === "pending" ? (
              rejectOpen ? (
                <form
                  className="mt-4 grid max-w-[560px] gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!rejectReason.trim()) {
                      setError("Enter a rejection reason.");
                      return;
                    }
                    void decide("rejected", rejectReason.trim());
                  }}
                >
                  <label className="text-[13px] font-semibold text-[#0f1c3f]">
                    Rejection Reason
                    <textarea
                      aria-label="Rejection Reason"
                      required
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      rows={3}
                      className="mt-1 w-full rounded-2xl border border-[#e7eef6] px-4 py-3 text-[14px] text-[#0f1c3f] outline-none focus:border-[#3665f3]"
                      placeholder="Document image unreadable, please re-upload clear photos"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button disabled={busy} className="h-10 rounded-full bg-[#e5484d] px-5 text-[14px] font-semibold text-white disabled:opacity-60">
                      Submit
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      className="h-10 rounded-full px-4 text-[14px] text-[#5b6780]"
                      onClick={() => setRejectOpen(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    className="nexlo-btn h-10 rounded-full bg-[#12a37e] px-5 text-[14px] font-semibold text-white disabled:opacity-60"
                    onClick={() => decide("approved")}
                  >
                    Approve Application
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="h-10 rounded-full border border-[#f5c2c7] px-5 text-[14px] font-semibold text-[#e5484d] disabled:opacity-60"
                    onClick={() => {
                      setRejectReason("");
                      setRejectOpen(true);
                    }}
                  >
                    Reject Application
                  </button>
                </div>
              )
            ) : (
              <p className="mt-4 text-[14px] text-[#0f1c3f]">
                {item.status === "approved"
                  ? "Seller access is on. This member can list items in the create wizard."
                  : item.rejection_reason
                    ? `Requires Additional Documents: ${item.rejection_reason}`
                    : "Requires Additional Documents."}
              </p>
            )}
          </section>

          <section className="nexlo-card p-5">
            <h2 className="text-[16px] font-extrabold text-[#0f1c3f]">Identity documents</h2>
            <p className="mt-1 text-[13px] text-[#6b7587]">Inspect the uploaded photos before you approve.</p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {item.files?.front ? (
                <figure className="rounded-2xl border border-[#e7eef6] p-3">
                  <figcaption className="mb-2 text-[13px] font-semibold text-[#0f1c3f]">
                    {item.doc_type === "passport" ? "Passport" : "Citizenship (Front)"}
                  </figcaption>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.files.front} alt="Citizenship front" className="max-h-[420px] w-full rounded-xl object-contain bg-[#f4f8fd]" />
                </figure>
              ) : null}
              {item.files?.back ? (
                <figure className="rounded-2xl border border-[#e7eef6] p-3">
                  <figcaption className="mb-2 text-[13px] font-semibold text-[#0f1c3f]">Citizenship (Back)</figcaption>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.files.back} alt="Citizenship back" className="max-h-[420px] w-full rounded-xl object-contain bg-[#f4f8fd]" />
                </figure>
              ) : null}
              {item.files?.selfie ? (
                <figure className="rounded-2xl border border-[#e7eef6] p-3">
                  <figcaption className="mb-2 text-[13px] font-semibold text-[#0f1c3f]">Address proof</figcaption>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.files.selfie} alt="Address proof" className="max-h-[420px] w-full rounded-xl object-contain bg-[#f4f8fd]" />
                </figure>
              ) : null}
            </div>
            {!item.files?.front && !item.files?.back ? <p className="mt-3 text-[13px] text-[#8a94a6]">No files attached.</p> : null}
          </section>
        </>
      ) : null}

      {item?.status === "approved" ? (
        <button type="button" className="nexlo-btn nexlo-btn-blue" onClick={() => router.push("/admin/kyc")}>
          Back to queue
        </button>
      ) : null}
    </div>
  );
}
