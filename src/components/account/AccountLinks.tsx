"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  PROFILE_EVENT,
  accountApi,
  cacheProfile,
  getToken,
  readCachedProfile,
  type CachedProfile,
} from "@/lib/account-api";

function initials(user: CachedProfile) {
  const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.displayName || user.username || "N";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function AccountLinks() {
  const [signedIn, setSignedIn] = useState(false);
  const [profile, setProfile] = useState<CachedProfile | null>(null);

  useEffect(() => {
    function refresh() {
      const token = Boolean(getToken());
      setSignedIn(token);
      setProfile(token ? readCachedProfile() : null);
    }
    refresh();
    window.addEventListener(PROFILE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener(PROFILE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  useEffect(() => {
    if (!signedIn) return;
    let alive = true;
    accountApi<{ user: CachedProfile }>("/api/v1/account")
      .then((body) => {
        if (!alive) return;
        cacheProfile(body.user);
        setProfile(body.user);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [signedIn]);

  if (!signedIn) {
    return (
      <>
        <Link href="/login" className="hover:text-[#3665f3] hover:underline">
          Sign in
        </Link>
        <Link href="/register" className="hover:text-[#3665f3] hover:underline">
          Register
        </Link>
      </>
    );
  }

  return (
    <>
      <Link href="/orders" className="hover:text-[#3665f3] hover:underline">
        Orders
      </Link>
      <Link href="/account/profile" className="flex items-center gap-2 hover:text-[#3665f3]">
        {profile?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={profile.avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
        ) : (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#dbe7ff] text-[9px] font-bold text-[#3665f3]">
            {profile ? initials(profile) : "N"}
          </span>
        )}
        <span className="hover:underline">Account</span>
      </Link>
    </>
  );
}
