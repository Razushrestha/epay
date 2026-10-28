import Link from "next/link";
import { BuyShell } from "@/components/commerce/BuyShell";

export default function NotFound() {
  return (
    <BuyShell
      crumbs={[
        { href: "/", label: "Home" },
        { label: "Page not found" },
      ]}
      title="We could not find that page"
      body="The link may be old, or the listing ended. Search Nexlo or return home."
      aside={
        <Link href="/" className="nexlo-btn nexlo-btn-blue">
          Back to home
        </Link>
      }
    >
      <div className="nexlo-card mt-5 px-6 py-16 text-center">
        <h2 className="text-[18px] font-bold text-[#0f1c3f]">404</h2>
        <p className="mt-2 text-[14px] text-[#6b7587]">Try a search, or read how buying and selling work on Nexlo.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <Link href="/search" className="nexlo-btn nexlo-btn-blue">
            Search listings
          </Link>
          <Link href="/help" className="nexlo-btn-ghost">
            Help centre
          </Link>
        </div>
      </div>
    </BuyShell>
  );
}
