import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { PageHero } from "@/components/ui/PageHero";

export default function NotFound() {
  return (
    <>
      <PageHero
        eyebrow="404"
        title="We could not find that page"
        body="The link may be old, or the listing ended. Search Nexlo or return home."
        cta="Back to home"
        href="/"
      />
      <main className="page-shell py-8">
        <div className="flex flex-wrap gap-3">
          <Link href="/search" className="nexlo-btn nexlo-btn-blue">Search listings</Link>
          <Link href="/help" className="nexlo-link text-[13.5px] leading-10">Help centre →</Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
