"use client";

import { useEffect, useState } from "react";
import { accountApi, getToken } from "@/lib/account-api";

export function PrivacyAccept() {
  const [signedIn, setSignedIn] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) return;
    setSignedIn(true);
    accountApi<{ currentAccepted: { privacy: boolean }; current: { privacy: string } }>("/api/v1/account/consents")
      .then((body) => setAccepted(Boolean(body.currentAccepted?.privacy)))
      .catch(() => undefined);
  }, []);

  if (!signedIn) {
    return <p className="text-[13px] text-[#6b7587]">Sign in to record that you accepted this version.</p>;
  }

  if (accepted) {
    return <p className="text-[13px] text-[#12a37e]">You accepted privacy policy version 2026-10-15.</p>;
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        className="h-10 rounded-full bg-[#3665f3] px-5 text-[13.5px] font-semibold text-white"
        onClick={async () => {
          await accountApi("/api/v1/account/consents", { method: "POST", body: JSON.stringify({ policies: ["privacy"] }) });
          setAccepted(true);
          setNotice("Saved.");
        }}
      >
        I accept this privacy policy
      </button>
      {notice ? <p className="text-[13px] text-[#12a37e]">{notice}</p> : null}
    </div>
  );
}
