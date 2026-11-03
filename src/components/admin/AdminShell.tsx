"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { accountApi, apiBase, getToken, setToken } from "@/lib/account-api";
import { AdminChrome } from "@/components/admin/AdminChrome";
import { normalizeStaffRole, type AdminQueues } from "@/lib/staff-nav";

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
  const [queues, setQueues] = useState<AdminQueues>({});
  const [queuesLive, setQueuesLive] = useState(false);

  useEffect(() => {
    if (isLogin) return;
    if (!getToken()) {
      router.replace("/admin/login");
      return;
    }
    Promise.all([
      accountApi<{ user: User }>("/api/v1/account"),
      accountApi<{
        youAreStaff: boolean;
        staffRole?: string;
        unreadMessages?: number;
        queues?: AdminQueues;
      }>("/api/v1/admin/status"),
    ])
      .then(([account, status]) => {
        const role = normalizeStaffRole(account.user.staffRole || status.staffRole, status.youAreStaff);
        setUser({ ...account.user, staffRole: role });
        setStaff(status.youAreStaff);
        setUnread(status.unreadMessages ?? 0);
        setQueues(status.queues || {});
        if (!status.youAreStaff) router.replace("/admin/login");
      })
      .catch(() => {
        setToken(null);
        router.replace("/admin/login");
      });
  }, [router, isLogin]);

  useEffect(() => {
    if (isLogin || staff !== true) return;
    const token = getToken();
    if (!token) return;
    const url = `${apiBase}/api/v1/admin/queues/stream?access_token=${encodeURIComponent(token)}`;
    const es = new EventSource(url);
    es.addEventListener("queues", (ev) => {
      try {
        const payload = JSON.parse((ev as MessageEvent).data) as { queues?: AdminQueues };
        if (payload.queues) {
          setQueues(payload.queues);
          setUnread(Number(payload.queues.messages || 0));
          setQueuesLive(true);
        }
      } catch {
        /* ignore */
      }
    });
    es.onerror = () => setQueuesLive(false);
    return () => {
      es.close();
      setQueuesLive(false);
    };
  }, [isLogin, staff]);

  if (isLogin) return <>{children}</>;

  if (!user || staff === null) {
    return <main className="flex min-h-dvh items-center justify-center bg-[#f3f7fc] text-[14px] text-[#667085]">Loading staff tools…</main>;
  }

  if (!staff) return null;

  return (
    <AdminChrome
      user={user}
      unreadMessages={unread}
      queues={queues}
      queuesLive={queuesLive}
      onSignOut={() => {
        setToken(null);
        router.push("/admin/login");
      }}
    >
      {children}
    </AdminChrome>
  );
}
