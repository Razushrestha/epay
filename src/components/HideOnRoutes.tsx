"use client";

import { usePathname } from "next/navigation";

/** Renders its children everywhere except on the listed routes (e.g. full-screen auth pages). */
export function HideOnRoutes({
  routes,
  children,
}: {
  routes: string[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  if (routes.some((route) => pathname === route || pathname.startsWith(`${route}/`))) return null;
  return <>{children}</>;
}
