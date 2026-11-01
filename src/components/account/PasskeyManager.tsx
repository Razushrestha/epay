"use client";

import { useEffect, useState } from "react";
import { accountApi } from "@/lib/account-api";
import { passkeysSupported, registerPasskey } from "@/lib/webauthn";

type Passkey = {
  id: number;
  name: string | null;
  device_type: string | null;
  created_at: string;
  last_used_at: string | null;
};

export function PasskeyManager() {
  const [rows, setRows] = useState<Passkey[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);

  async function load() {
    const body = await accountApi<{ data: Passkey[] }>("/api/v1/account/passkeys");
    setRows(body.data || []);
  }

  useEffect(() => {
    setSupported(passkeysSupported());
    load().catch(() => undefined);
  }, []);

  async function add() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await registerPasskey();
      await load();
      setNotice("Passkey saved. You can use Sign in with a passkey on the login page.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save this passkey";
      if (/not allowed|abort/i.test(message)) setError("Passkey prompt was cancelled.");
      else setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number) {
    setBusy(true);
    setError(null);
    try {
      await accountApi(`/api/v1/account/passkeys/${id}`, { method: "DELETE" });
      await load();
      setNotice("Passkey removed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove this passkey");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-[#d7e3f4] bg-[#f7fbff] p-4">
      <div>
        <h2 className="text-[15px] font-bold text-[#0f1c3f]">Register a passkey</h2>
        <p className="mt-1 text-[13.5px] text-[#5b6780]">
          Use your face, fingerprint, PIN, or a security key instead of a password. Passkeys stay on this device or in your password manager.
        </p>
      </div>
      {supported === false ? (
        <p className="text-[13px] text-[#b45309]">
          This browser does not support passkeys. Try Chrome, Edge, or Safari on a device with a screen lock.
        </p>
      ) : null}
      {rows.length ? (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2">
              <span>
                <span className="block text-[14px] font-semibold text-[#0f1c3f]">{row.name || "Passkey"}</span>
                <span className="text-[12px] text-[#6b7587]">
                  Added {new Date(row.created_at).toLocaleDateString()}
                  {row.last_used_at ? ` · Last used ${new Date(row.last_used_at).toLocaleDateString()}` : ""}
                </span>
              </span>
              <button type="button" className="text-[13px] font-semibold text-[#e53238]" disabled={busy} onClick={() => void remove(row.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13.5px] text-[#5b6780]">No passkeys are saved on this account yet. Add one below to enable passkey login.</p>
      )}
      <button
        type="button"
        className="inline-flex h-10 items-center justify-center rounded-full bg-[#3665f3] px-5 text-[14px] font-semibold text-white disabled:opacity-60"
        disabled={busy || supported !== true}
        onClick={() => void add()}
      >
        {busy ? "Waiting for this device…" : rows.length ? "Add another passkey" : "Add a passkey"}
      </button>
      {notice ? <p className="text-[13px] text-[#12a37e]">{notice}</p> : null}
      {error ? <p className="text-[13px] text-red-600">{error}</p> : null}
    </div>
  );
}
