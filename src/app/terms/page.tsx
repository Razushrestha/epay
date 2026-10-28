import Link from "next/link";
import { BuyShell } from "@/components/commerce/BuyShell";

export default function TermsPage() {
  return (
    <BuyShell
      crumbs={[
        { href: "/", label: "Home" },
        { label: "Terms" },
      ]}
      title="Terms of service"
      body="The rules for buying, bidding, and selling on Nexlo, including escrow, fees, and returns."
      aside={
        <Link href="/buyer-protection" className="text-[13px] font-semibold text-[#3665f3] hover:underline">
          Buyer Protection →
        </Link>
      }
    >
      <article className="nexlo-card mt-5 max-w-3xl space-y-4 p-5 text-[14px] leading-relaxed text-[#3a4a66] sm:p-6">
        <p>By creating an account you agree to list only items you may sell, ship on time, and keep communication inside Nexlo.</p>
        <p>Buyers pay into escrow. Funds release after delivery or when the return window closes. Auction and Best Offer winners have 48 hours to pay.</p>
        <p>Returns follow the 30-day buyer protection window. Sellers have three days to respond before a case can escalate to Nexlo staff.</p>
        <p>Fees, prohibited items, and identity checks are described in the selling guide. We may pause listings or accounts that break those rules.</p>
        <p>
          Also see the{" "}
          <Link href="/privacy" className="font-semibold text-[#3665f3] hover:underline">
            privacy policy
          </Link>{" "}
          and{" "}
          <Link href="/help" className="font-semibold text-[#3665f3] hover:underline">
            help guides
          </Link>
          .
        </p>
      </article>
    </BuyShell>
  );
}
