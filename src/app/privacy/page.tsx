import { SiteFooter } from "@/components/SiteFooter";
import { PageHero } from "@/components/ui/PageHero";
import { PrivacyAccept } from "@/components/legal/PrivacyAccept";

export default function PrivacyPage() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Privacy policy"
        body="How Nexlo collects, uses, and protects your account, orders, and messages. Current version 2026-10-15."
        cta="Back to help"
        href="/help"
      />
      <main className="page-shell py-8">
        <article className="nexlo-card max-w-3xl space-y-4 p-6 text-[14px] leading-relaxed text-[#333] sm:p-8">
          <p>Nexlo is a Nepal marketplace. We store the account details you give us, listings you create, orders, messages, and payment references from eSewa or Khalti, not full card numbers.</p>
          <p>We use that data to run escrow, shipping, returns, and fraud checks. Staff can see a case only when a dispute or ticket is open.</p>
          <p>You can update your profile, addresses, and notification preferences in Account. To close an account, open a support ticket from Account → Support.</p>
          <p>We do not sell personal data. Session tokens stay in your browser. Guest carts use a local session id until you sign in.</p>
          <PrivacyAccept />
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
