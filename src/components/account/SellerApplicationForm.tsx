"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

export type KycDraft = {
  sellerType: string;
  fullName: string;
  legalName: string;
  pan: string;
  docType: string;
  docNumber: string;
};

const inputClass =
  "h-12 w-full rounded-xl border border-[#d9e2ef] bg-white px-4 text-[16px] text-[#0f1c3f] outline-none transition placeholder:text-[#9aa6b8] hover:border-[#c2cfe2] focus:border-[#3665f3] focus:ring-4 focus:ring-[#3665f3]/10 sm:text-[15px]";

function Field({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-semibold text-[#0f1c3f]">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1.5 text-[12px] leading-snug text-[#8a94a6]">{hint}</p> : null}
    </div>
  );
}

function Step({ n, title, sub }: { n: number; title: string; sub?: string }) {
  return (
    <div className="mb-3 flex items-start gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0f1c3f] text-[12px] font-bold text-white">{n}</span>
      <div>
        <h3 className="text-[15px] font-bold leading-6 text-[#0f1c3f]">{title}</h3>
        {sub ? <p className="text-[12.5px] leading-snug text-[#6b7587]">{sub}</p> : null}
      </div>
    </div>
  );
}

export function FileDrop({
  name,
  label,
  hint,
  required = true,
  accept = "image/jpeg,image/png,.jpg,.jpeg,.png",
}: {
  name: string;
  label: string;
  hint?: string;
  required?: boolean;
  accept?: string;
}) {
  const [file, setFile] = useState<{ name: string; size: number; url: string | null } | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  function onPick(picked: File | undefined) {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    if (!picked) {
      setFile(null);
      return;
    }
    const url = picked.type.startsWith("image/") ? URL.createObjectURL(picked) : null;
    urlRef.current = url;
    setFile({ name: picked.name, size: picked.size, url });
  }

  const id = `upload-${name}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-[#0f1c3f]">
        {label}
      </label>
      <label
        htmlFor={id}
        className="group flex min-h-[56px] cursor-pointer items-center gap-3 rounded-xl border border-[#d9e2ef] bg-white px-3 py-2 transition hover:border-[#c2cfe2] focus-within:border-[#3665f3] focus-within:ring-4 focus-within:ring-[#3665f3]/10"
      >
        <input id={id} name={name} type="file" accept={accept} required={required} className="sr-only" onChange={(e) => onPick(e.target.files?.[0])} />
        {file?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={file.url} alt="" className="h-10 w-14 shrink-0 rounded-md border border-[#dbe6f5] bg-white object-cover" />
        ) : null}
        <span className="min-w-0 flex-1 pl-1">
          <span className={`block truncate text-[14px] ${file ? "font-semibold text-[#0f1c3f]" : "text-[#9aa6b8]"}`}>
            {file ? file.name : "No file chosen"}
          </span>
          {file ? <span className="block text-[12px] text-[#6b7587]">{(file.size / 1024 / 1024).toFixed(2)} MB</span> : null}
        </span>
        <span className="shrink-0 rounded-full bg-[#0f1c3f] px-4 py-2 text-[13px] font-semibold text-white transition group-hover:bg-[#1b2e5c]">
          {file ? "Replace" : "Choose file"}
        </span>
      </label>
      {hint ? <p className="mt-1.5 text-[12px] leading-snug text-[#8a94a6]">{hint}</p> : null}
    </div>
  );
}

export function SellerApplicationForm({
  draft,
  onChange,
  onSubmit,
  onCancel,
}: {
  draft: KycDraft;
  onChange: (next: KycDraft) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const business = draft.sellerType === "business";
  const passport = draft.docType === "passport";
  const set = (patch: Partial<KycDraft>) => onChange({ ...draft, ...patch });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    setBusy(true);
    try {
      await onSubmit(event);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-5 space-y-7">
      {/* 1. seller type */}
      <section>
        <Step n={1} title="Seller type" sub="Choose how you'll be selling on MeroAuction." />
        <div role="radiogroup" aria-label="Seller type" className="grid grid-cols-2 gap-2 rounded-2xl bg-[#eef3fa] p-1.5 sm:max-w-[360px]">
          {(["individual", "business"] as const).map((type) => (
            <label key={type} className="cursor-pointer">
              <input
                type="radio"
                name="sellerType"
                value={type}
                checked={draft.sellerType === type}
                onChange={() => set({ sellerType: type })}
                className="peer sr-only"
              />
              <span className="flex h-10 items-center justify-center rounded-xl text-[14px] font-semibold capitalize text-[#5b6780] transition peer-checked:bg-white peer-checked:text-[#0f1c3f] peer-checked:shadow-[0_2px_8px_rgba(15,28,63,0.12)] peer-focus-visible:ring-4 peer-focus-visible:ring-[#3665f3]/20">
                {type}
              </span>
            </label>
          ))}
        </div>
      </section>

      {/* 2. details */}
      <section>
        <Step n={2} title="Your details" sub="Use the name exactly as it appears on your ID." />
        <div className="grid gap-4 sm:grid-cols-2">
          {business ? (
            <Field label="Business legal name" htmlFor="kyc-legal">
              <input id="kyc-legal" value={draft.legalName} onChange={(e) => set({ legalName: e.target.value })} placeholder="e.g. Himalayan Traders Pvt. Ltd." required autoComplete="organization" className={inputClass} />
            </Field>
          ) : (
            <Field label="Full name" htmlFor="kyc-name">
              <input id="kyc-name" value={draft.fullName} onChange={(e) => set({ fullName: e.target.value })} placeholder="e.g. Raju Shrestha" required autoComplete="name" className={inputClass} />
            </Field>
          )}
          <Field label="PAN number" htmlFor="kyc-pan" hint="Your 9-digit Permanent Account Number.">
            <input id="kyc-pan" value={draft.pan} onChange={(e) => set({ pan: e.target.value })} placeholder="e.g. 123456789" required inputMode="numeric" autoComplete="off" className={inputClass} />
          </Field>
        </div>
      </section>

      {/* 3. identity */}
      <section>
        <Step n={3} title="Identity verification" sub="Photos must be clear, uncropped and readable." />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="ID type" htmlFor="kyc-doctype">
            <div className="relative">
              <select id="kyc-doctype" value={draft.docType} onChange={(e) => set({ docType: e.target.value })} className={`${inputClass} appearance-none pr-10`}>
                <option value="citizenship">Nepali Citizenship</option>
                <option value="passport">Passport</option>
              </select>
              <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6b7587" strokeWidth="2.4" className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2"><path d="m6 9 6 6 6-6" /></svg>
            </div>
          </Field>
          <Field label={passport ? "Passport number" : "Citizenship number"} htmlFor="kyc-docnum">
            <input
              id="kyc-docnum"
              value={draft.docNumber}
              onChange={(e) => set({ docNumber: e.target.value })}
              placeholder={passport ? "e.g. 12345678" : "e.g. 12-34-56-78901"}
              required
              autoComplete="off"
              className={inputClass}
            />
          </Field>
          <FileDrop name="front" label={passport ? "Passport photo page" : "Citizenship front"} hint="JPG or PNG, clear and uncropped." />
          {!passport ? <FileDrop name="back" label="Citizenship back" hint="JPG or PNG, clear and uncropped." /> : null}
        </div>
      </section>

      <p className="rounded-xl bg-[#f4f8ff] px-4 py-3 text-[12.5px] leading-relaxed text-[#4b5873]">
        Your documents are stored securely and only used to verify your identity. We review applications within 1–3 business days and email you the result.
      </p>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={onCancel}
          className="h-12 rounded-full px-6 text-[14.5px] font-semibold text-[#5b6780] transition hover:bg-[#f0f4fa] sm:h-11"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="h-12 flex-1 rounded-full bg-[#3665f3] px-8 text-[15px] font-semibold text-white shadow-[0_10px_22px_-10px_rgba(54,101,243,0.9)] transition hover:bg-[#2953c6] disabled:opacity-60 sm:h-11 sm:flex-none"
        >
          {busy ? "Submitting…" : "Submit application"}
        </button>
      </div>
    </form>
  );
}
