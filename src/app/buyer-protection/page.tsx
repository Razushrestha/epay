import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { PageHero } from "@/components/ui/PageHero";
import { TrustBar } from "@/components/home/TrustBar";

const covered = [
  { title: "Item not as described", text: "It does not match the listing photos, condition, or specifics." },
  { title: "Damaged in transit", text: "It arrived broken, leaking, or otherwise unusable." },
  { title: "Wrong item", text: "You received a different product, size, or color." },
  { title: "Never arrived", text: "The seller marked it shipped but tracking never showed delivery." },
];

const steps = [
  { n: "1", title: "Pay on Nexlo", text: "Use eSewa or Khalti. Funds sit in escrow, not with the seller." },
  { n: "2", title: "Confirm delivery", text: "Mark the order received, or wait for the auto-complete window." },
  { n: "3", title: "Open a case", text: "You have 30 days after delivery. File from Resolution Center." },
  { n: "4", title: "We hold the money", text: "Escrow stays frozen until the seller, then Nexlo staff, resolve it." },
];

const notCovered = [
  "Changed-mind returns unless the listing allows them",
  "Items you already used beyond inspecting them",
  "Purchases paid outside Nexlo",
  "Counterfeit claims that need a separate authenticity programme (not in this fee)",
];

export default function BuyerProtectionPage() {
  return (
    <>
      <PageHero
        eyebrow="Nexlo Buyer Protection"
        title="Shop knowing escrow has your back"
        body="Every eligible order is covered for 30 days after delivery. If the item is not as described, damaged, or never arrives, we freeze the payout until the case is closed."
        cta="Open Resolution Center"
        href="/resolution"
      />
      <main className="page-shell space-y-10 py-10">
        <section>
          <h2 className="text-[20px] font-extrabold text-[#0f1c3f]">How it works</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => (
              <article key={step.n} className="nexlo-card p-5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#3665f3] text-[13px] font-bold text-white">{step.n}</span>
                <h3 className="mt-3 text-[15px] font-bold text-[#0f1c3f]">{step.title}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-[#5b6780]">{step.text}</p>
              </article>
            ))}
          </div>
        </section>
        <section>
          <h2 className="text-[20px] font-extrabold text-[#0f1c3f]">What is covered</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {covered.map((item) => (
              <article key={item.title} className="rounded-2xl border border-[#e7eef6] bg-white p-5">
                <h3 className="text-[15px] font-bold text-[#0f1c3f]">{item.title}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-[#5b6780]">{item.text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="nexlo-card p-6">
            <h2 className="text-[18px] font-extrabold text-[#0f1c3f]">How to file</h2>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-[14px] leading-relaxed text-[#4b5563]">
              <li>Open the order and choose Return or open Resolution Center.</li>
              <li>Pick a reason, add photos, and say whether you want a refund.</li>
              <li>The seller has 3 days to accept or decline.</li>
              <li>If they stay silent, Nexlo staff decide. Escrow stays frozen.</li>
            </ol>
            <p className="mt-4 text-[13px] text-[#8a94a6]">Prepaid return labels are not included in this go-live. Arrange return shipping with the seller if a return is approved.</p>
          </div>
          <div className="rounded-2xl bg-[#0f1c3f] p-6 text-white">
            <h2 className="text-[18px] font-extrabold">Not covered</h2>
            <ul className="mt-3 space-y-2 text-[13.5px] leading-relaxed text-white/80">
              {notCovered.map((item) => (
                <li key={item}>· {item}</li>
              ))}
            </ul>
            <Link href="/help/returns" className="mt-5 inline-block text-[13px] font-semibold text-[#7ee7d6] hover:underline">
              Read the returns policy
            </Link>
          </div>
        </section>
      </main>
      <TrustBar />
      <SiteFooter />
    </>
  );
}
