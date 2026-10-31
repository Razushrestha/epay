import Link from "next/link";
import type { ReactNode } from "react";
import { SiteFooter } from "@/components/SiteFooter";

export function money(n: number | string | null | undefined) {
  return `NPR ${Number(n || 0).toLocaleString("en-NP")}`;
}

export function statusLabel(status: string) {
  return String(status || "").replace(/_/g, " ");
}

export function statusClass(status: string) {
  const value = String(status || "").toLowerCase();
  if (value.includes("cancel") || value.includes("fail") || value.includes("suspend") || value.includes("restrict")) return "bg-[#fff5f5] text-[#b42318]";
  if (value.includes("warn")) return "bg-[#fff8e8] text-[#b45309]";
  if (value.includes("complete") || value.includes("deliver") || value.includes("released")) return "bg-[#e8f8ee] text-[#159947]";
  if (value.includes("ship")) return "bg-[#e6faf6] text-[#0d9488]";
  if (value.includes("paid") || value.includes("process")) return "bg-[#eef3ff] text-[#3665f3]";
  if (value.includes("pending")) return "bg-[#fff8e8] text-[#b45309]";
  return "bg-[#f4f8fd] text-[#0f1c3f]";
}

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold capitalize ${statusClass(status)}`}>
      {statusLabel(status)}
    </span>
  );
}

export function BuyShell({
  crumbs,
  title,
  body,
  aside,
  children,
}: {
  crumbs: { href?: string; label: string }[];
  title: string;
  body?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#f6f7f9]">
      <main className="page-shell py-5">
        <p className="text-[12.5px] text-[#98a2b3]">
          {crumbs.map((crumb, index) => (
            <span key={`${crumb.label}-${index}`}>
              {index > 0 ? <span className="mx-1.5">›</span> : null}
              {crumb.href ? (
                <Link href={crumb.href} className="hover:underline">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-[#667085]">{crumb.label}</span>
              )}
            </span>
          ))}
        </p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-[26px] font-extrabold tracking-tight text-[#0f1c3f] sm:text-[30px]">{title}</h1>
            {body ? <p className="mt-1 max-w-xl text-[13px] text-[#6b7587]">{body}</p> : null}
          </div>
          {aside}
        </div>
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
