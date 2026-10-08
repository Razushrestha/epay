"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getToken } from "@/lib/account-api";

export function AccountLinks() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    setSignedIn(Boolean(getToken()));
  }, []);

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
      <Link href="/account" className="hover:text-[#3665f3] hover:underline">
        Account
      </Link>
      <Link href="/admin" className="hover:text-[#3665f3] hover:underline">
        Staff
      </Link>
    </>
  );
}
