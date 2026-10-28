"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getToken } from "@/lib/account-api";
import { BuyShell } from "@/components/commerce/BuyShell";
import { ResolutionCenter } from "@/components/account/ResolutionCenter";

export default function ResolutionPage() {
  const router = useRouter();

  useEffect(() => {
    if (!getToken()) router.replace("/login?redirect=/resolution");
  }, [router]);

  return (
    <BuyShell
      crumbs={[
        { href: "/", label: "Home" },
        { href: "/help", label: "Help" },
        { label: "Resolution Center" },
      ]}
      title="Resolution Center"
      body="File a return, follow an escalated case, or open a ticket. Eligible orders stay under Buyer Protection for 30 days after delivery."
      aside={
        <div className="flex flex-wrap gap-3">
          <Link href="/orders" className="nexlo-btn nexlo-btn-blue">
            File from an order
          </Link>
          <Link href="/buyer-protection" className="text-[13px] font-semibold leading-10 text-[#3665f3] hover:underline">
            Buyer Protection →
          </Link>
        </div>
      }
    >
      <div className="mt-5">
        <ResolutionCenter />
      </div>
    </BuyShell>
  );
}
