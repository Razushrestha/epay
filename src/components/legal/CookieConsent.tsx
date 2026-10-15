"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { accountApi, getToken } from "@/lib/account-api";

const KEY = "nexlo_consent_cookies";
const VERSION = "2026-10-15";

export function CookieConsent() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(localStorage.getItem(KEY) !== VERSION);
  }, []);

  async function accept() {
    localStorage.setItem(KEY, VERSION);
    setOpen(false);
    if (getToken()) {
      await accountApi("/api/v1/account/consents", {
        method: "POST",
        body: JSON.stringify({ policy: "cookies" }),
      }).catch(() => undefined);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e7eef6] bg-white px-4 py-3 shadow-[0_-8px_24px_-16px_rgba(15,28,63,0.35)]">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] leading-relaxed text-[#3a4a66]">
          Nexlo uses cookies to keep you signed in and to remember search and cart. See the{" "}
          <Link href="/privacy" className="font-semibold text-[#3665f3] hover:underline">
            privacy policy
          </Link>{" "}
          (version {VERSION}).
        </p>
        <button
          type="button"
          onClick={() => void accept()}
          className="nexlo-btn nexlo-btn-blue shrink-0"
        >
          Accept cookies
        </button>
      </div>
    </div>
  );
}
