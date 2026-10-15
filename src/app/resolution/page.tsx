"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getToken } from "@/lib/account-api";
import { SiteFooter } from "@/components/SiteFooter";
import { PageHero } from "@/components/ui/PageHero";
import { ResolutionCenter } from "@/components/account/ResolutionCenter";

export default function ResolutionPage() {
  const router = useRouter();

  useEffect(() => {
    if (!getToken()) router.replace("/login?redirect=/resolution");
  }, [router]);

  return (
    <>
      <PageHero
        eyebrow="Resolution Center"
        title="Returns, cases, and support in one place"
        body="File a return, follow an escalated case, or open a ticket. Eligible orders stay under Nexlo Buyer Protection for 30 days after delivery."
        cta="Buyer Protection"
        href="/buyer-protection"
      />
      <main className="page-shell py-8">
        <ResolutionCenter />
      </main>
      <SiteFooter />
    </>
  );
}
