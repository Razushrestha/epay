"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { accountApi, getToken, setToken } from "@/lib/account-api";
import { AdminChrome } from "@/components/admin/AdminChrome";

type User = {
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  avatarUrl: string | null;
  isStaff?: boolean;
  staffRole?: string | null;
};

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isLogin = pathname === "/admin/login";
  const [user, setUser] = useState<User | null>(null);
  const [staff, setStaff] = useState<boolean | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (isLogin) return;
    if (!getToken()) {
      router.replace("/admin/login");
      return;
    }
    Promise.all([
      accountApi<{ user: User }>("/api/v1/account"),
      accountApi<{ youAreStaff: boolean; unreadMessages?: number }>("/api/v1/admin/status"),
    ])
      .then(([account, status]) => {
        setUser(account.user);
        setStaff(status.youAreStaff);
        setUnread(status.unreadMessages ?? 0);
        if (!status.youAreStaff) router.replace("/admin/login");
      })
      .catch(() => {
        setToken(null);
        router.replace("/admin/login");
      });
  }, [router, isLogin]);

  if (isLogin) return <>{children}</>;

  if (!user || staff === null) {
    return <main className="flex min-h-dvh items-center justify-center bg-[#f3f7fc] text-[14px] text-[#667085]">Loading staff tools…</main>;
  }

  if (!staff) return null;

  return (
    <AdminChrome
      user={user}
      unreadMessages={unread}
      onSignOut={() => {
        setToken(null);
        router.push("/admin/login");
      }}
    >
      {children}
    </AdminChrome>
  );
}
