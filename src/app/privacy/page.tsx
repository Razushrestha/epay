import Link from "next/link";
import { BuyShell } from "@/components/commerce/BuyShell";
import { PrivacyAccept } from "@/components/legal/PrivacyAccept";

export default function PrivacyPage() {
  return (
    <BuyShell
      crumbs={[
        { href: "/", label: "Home" },
        { label: "Privacy" },
      ]}
      title="Privacy policy"
      body="How Nexlo collects, uses, and protects your account, orders, and messages. Current version 2026-10-15."
      aside={
        <Link href="/help" className="text-[13px] font-semibold text-[#3665f3] hover:underline">
          Back to help →
        </Link>
      }
    >
      <article className="nexlo-card mt-5 max-w-3xl space-y-4 p-5 text-[14px] leading-relaxed text-[#3a4a66] sm:p-6">
        <p>Nexlo is a Nepal marketplace. We store the account details you give us, listings you create, orders, messages, and payment references from eSewa or Khalti, not full card numbers.</p>
        <p>We use that data to run escrow, shipping, returns, and fraud checks. Staff can see a case only when a dispute or ticket is open.</p>
        <p>You can update your profile, addresses, and notification preferences in Account. To close an account, open a support ticket from Account → Support.</p>
        <p>We do not sell personal data. Session tokens stay in your browser. Guest carts use a local session id until you sign in.</p>
        <PrivacyAccept />
      </article>
    </BuyShell>
  );
}
