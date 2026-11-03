"use client";

import { useState, useEffect, useRef } from "react";
import { accountApi, apiBase } from "@/lib/account-api";
import { commerceHeaders, reserveCheckout, validateCart } from "@/lib/commerce";
import { useRouter } from "next/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { PageHero } from "@/components/ui/PageHero";

interface Address {
  public_id: string;
  full_name: string;
  phone?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  region?: string | null;
  postal_code?: string | null;
  country: string;
  is_default_shipping: boolean;
  is_default_billing?: boolean;
}

export default function CheckoutPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);
  const [totals, setTotals] = useState({
    subtotal: "0",
    discount: "0",
    shipping: "0",
    tax: "0",
    donation: "0",
    total: "0",
  });
  const [error, setError] = useState<string | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const couponSectionRef = useRef<HTMLElement | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const [buyerNotes, setBuyerNotes] = useState("");
  const [selectedGateway, setSelectedGateway] = useState<"esewa" | "khalti">("esewa");
  const [donate, setDonate] = useState(false);
  const [charityName, setCharityName] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("cancelled")) {
      setCancelled(true);
    }
    loadAddresses();
    validateCart()
      .then(async (result) => {
        if (!result.valid) {
          setError(result.issues[0]?.message || "Only 0 items available in stock");
          return;
        }
        await reserveCheckout();
      })
      .catch((err: any) => setError(err.message));
    accountApi<{ prefs: { enabled: boolean; charity_id: number | null }; charities: { id: number; name: string }[] }>("/api/v1/account/donations")
      .then((body) => {
        setDonate(Boolean(body.prefs?.enabled));
        const chosen = body.charities?.find((row) => row.id === body.prefs?.charity_id) || body.charities?.[0];
        setCharityName(chosen?.name || null);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    calculateTotals();
  }, [selectedAddressId, donate]);

  async function loadAddresses() {
    try {
      const token = accountApi.getToken();
      if (!token) {
        router.push("/login?redirect=/checkout");
        return;
      }

      const data = await accountApi<{ data?: Address[]; addresses?: Address[] }>("/api/v1/account/addresses");
      const list = data.data || data.addresses || [];
      setAddresses(list);
      const defaultAddr = list.find((a) => a.is_default_shipping) ?? list[0];
      if (defaultAddr) setSelectedAddressId(defaultAddr.public_id);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function calculateTotals(coupon?: string | null, opts?: { forCoupon?: boolean }) {
    try {
      const token = accountApi.getToken();
      if (!token) return false;

      const code = coupon !== undefined ? coupon : couponApplied ? couponCode : null;
      const headers = commerceHeaders();
      headers.set("Content-Type", "application/json");
      const res = await fetch(`${apiBase}/api/v1/cart/checkout/calculate`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          shipping_address_id: selectedAddressId,
          coupon_code: code || null,
          donate,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Could not update totals");
      }

      const data = await res.json();
      setTotals(data);
      if (opts?.forCoupon) setCouponError(null);
      return true;
    } catch (err: any) {
      const message = err?.message || "Could not update totals";
      if (opts?.forCoupon) {
        setCouponError(message);
        requestAnimationFrame(() => {
          couponSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      } else {
        setError(message);
      }
      return false;
    }
  }

  async function applyCoupon() {
    if (!couponCode.trim()) return;
    setCouponError(null);
    const ok = await calculateTotals(couponCode.trim(), { forCoupon: true });
    setCouponApplied(ok);
  }

  async function removeCoupon() {
    setCouponError(null);
    setCouponApplied(false);
    setCouponCode("");
    await calculateTotals(null);
  }

  async function placeOrder() {
    if (!selectedAddressId) {
      setError("Please select a shipping address");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = accountApi.getToken();
      if (!token) {
        router.push("/login?redirect=/checkout");
        return;
      }

      const orderHeaders = commerceHeaders();
      orderHeaders.set("Content-Type", "application/json");
      const orderRes = await fetch(`${apiBase}/api/v1/cart/checkout/create-order`, {
        method: "POST",
        headers: orderHeaders,
        body: JSON.stringify({
          shipping_address_id: selectedAddressId,
          billing_address_id: selectedAddressId,
          buyer_notes: buyerNotes,
          coupon_code: couponApplied ? couponCode : null,
          donate,
        }),
      });

      if (!orderRes.ok) {
        const err = await orderRes.json();
        throw new Error(err.error || "Failed to create order");
      }

      const orderData = await orderRes.json();
      const orderId = orderData.order_id;

      const paymentHeaders = commerceHeaders();
      paymentHeaders.set("Content-Type", "application/json");
      const paymentRes = await fetch(`${apiBase}/api/v1/payments/initiate`, {
        method: "POST",
        headers: paymentHeaders,
        body: JSON.stringify({
          order_id: orderId,
          checkout_session_id: orderData.checkout_session_id || null,
          gateway: selectedGateway,
        }),
      });

      if (!paymentRes.ok) {
        const err = await paymentRes.json();
        throw new Error(err.error || "Failed to initiate payment");
      }

      const paymentData = await paymentRes.json();
      window.location.href = paymentData.payment_url;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function formatPrice(price: string | number) {
    const num = typeof price === "string" ? parseFloat(price) : price;
    return `NPR ${num.toLocaleString()}`;
  }

  return (
    <>
      <PageHero
        eyebrow="Secure checkout"
        title="Review and pay"
        body="Funds stay in escrow until delivery. Pay with eSewa or Khalti. 13% VAT included."
        cta="Back to cart"
        href="/cart"
      />
      <main className="page-shell py-8">
        {cancelled ? (
          <div role="alert" className="mb-6 rounded-xl border border-[#f5c2c7] bg-[#fff5f5] p-4 text-[14px] text-[#e53238]">
            Payment cancelled
          </div>
        ) : null}
        {error ? (
          <div role="alert" className="mb-6 rounded-xl border border-[#f5c2c7] bg-[#fff5f5] p-4 text-[14px] text-[#e53238]">
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <section className="nexlo-card p-5 sm:p-6">
              <h2 className="text-[17px] font-bold text-[#0f1c3f]">Shipping address</h2>
              {addresses.length === 0 ? (
                <div className="mt-4 text-center">
                  <p className="mb-4 text-[13px] text-[#6b7587]">No addresses yet.</p>
                  <button onClick={() => router.push("/account/addresses")} className="nexlo-btn nexlo-btn-blue">
                    Add address
                  </button>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {addresses.map((addr) => (
                    <label
                      key={addr.public_id}
                      className={`block cursor-pointer rounded-xl border p-4 transition ${
                        selectedAddressId === addr.public_id ? "border-[#3665f3] bg-[#eef3ff]" : "border-[#e7eef6] hover:border-[#ccc]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="address"
                        value={addr.public_id}
                        checked={selectedAddressId === addr.public_id}
                        onChange={() => setSelectedAddressId(addr.public_id)}
                        className="mr-3 accent-[#3665f3]"
                      />
                      <div className="inline-block text-[13px]">
                        <div className="font-semibold text-[#0f1c3f]">{addr.full_name}</div>
                        <div className="text-[#6b7587]">
                          {addr.line1}
                          {addr.line2 ? ` · ${addr.line2}` : ""}
                        </div>
                        <div className="text-[#6b7587]">
                          {addr.city}
                          {addr.region ? `, ${/^\d+$/.test(addr.region) ? `Ward ${addr.region}` : addr.region}` : ""}
                          {addr.postal_code ? ` ${addr.postal_code}` : ""}
                        </div>
                        {addr.phone ? <div className="text-[#6b7587]">{addr.phone}</div> : null}
                        {addr.is_default_shipping ? (
                          <span className="mt-1 inline-block rounded-full bg-[#d1fae5] px-2 py-0.5 text-[11px] font-semibold text-[#0d9488]">
                            Default shipping
                          </span>
                        ) : null}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </section>

            <section ref={couponSectionRef} className="nexlo-card p-5 sm:p-6">
              <h2 className="text-[17px] font-bold text-[#0f1c3f]">Coupon</h2>
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => {
                    setCouponCode(e.target.value.toUpperCase());
                    if (couponError) setCouponError(null);
                  }}
                  placeholder="Enter coupon code"
                  className={`nexlo-field flex-1 ${couponError ? "border-[#f5c2c7]" : ""}`}
                  disabled={couponApplied}
                  aria-invalid={Boolean(couponError)}
                  aria-describedby={couponError ? "coupon-error" : undefined}
                />
                {couponApplied ? (
                  <button onClick={removeCoupon} className="nexlo-btn nexlo-btn-blue">
                    Remove
                  </button>
                ) : (
                  <button onClick={applyCoupon} disabled={!couponCode.trim()} className="nexlo-btn nexlo-btn-blue disabled:opacity-50">
                    Apply
                  </button>
                )}
              </div>
              {couponError ? (
                <div
                  id="coupon-error"
                  role="alert"
                  className="mt-3 rounded-xl border border-[#f5c2c7] bg-[#fff5f5] px-3 py-2 text-[13px] font-semibold text-[#e53238]"
                >
                  {couponError}
                </div>
              ) : null}
              {couponApplied ? (
                <div role="alert" className="mt-3 rounded-xl border border-[#a7f3d0] bg-[#ecfdf5] px-3 py-2 text-[13px] font-semibold text-[#047857]">
                  {couponCode} applied.{" "}
                  {parseFloat(totals.shipping) === 0 && parseFloat(totals.discount) > 0
                    ? "Shipping is free."
                    : `You saved ${formatPrice(totals.discount)}.`}
                </div>
              ) : null}
            </section>

            <section className="nexlo-card p-5 sm:p-6">
              <h2 className="text-[17px] font-bold text-[#0f1c3f]">Round up for charity</h2>
              <label className="mt-3 flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 accent-[#3665f3]"
                  checked={donate}
                  onChange={(e) => setDonate(e.target.checked)}
                />
                <span>
                  <span className="block text-[14px] font-semibold text-[#0f1c3f]">
                    Add {parseFloat(totals.donation) > 0 ? formatPrice(totals.donation) : "spare change"} for {charityName || "a Nepal charity"}
                  </span>
                  <span className="mt-1 block text-[13px] leading-relaxed text-[#6b7587]">
                    We round the total up to the next NPR 10. Change this any time in Account → Donations.
                  </span>
                </span>
              </label>
            </section>

            <section className="nexlo-card p-5 sm:p-6">
              <h2 className="text-[17px] font-bold text-[#0f1c3f]">Order notes</h2>
              <textarea
                value={buyerNotes}
                onChange={(e) => setBuyerNotes(e.target.value)}
                placeholder="Special instructions for the seller…"
                rows={3}
                className="mt-3 w-full rounded-xl border border-[#e7eef6] px-3 py-2 text-[14px]"
              />
            </section>

            <section className="nexlo-card p-5 sm:p-6">
              <h2 className="text-[17px] font-bold text-[#0f1c3f]">Payment method</h2>
              <div className="mt-3 space-y-3">
                {([
                  ["esewa", "eSewa", "Pay with your eSewa wallet"],
                  ["khalti", "Khalti", "Wallet, card, or bank"],
                ] as const).map(([id, title, sub]) => (
                  <label
                    key={id}
                    className={`block cursor-pointer rounded-xl border p-4 transition ${
                      selectedGateway === id ? "border-[#3665f3] bg-[#eef3ff]" : "border-[#e7eef6] hover:border-[#ccc]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="gateway"
                      value={id}
                      checked={selectedGateway === id}
                      onChange={() => setSelectedGateway(id)}
                      className="mr-3 accent-[#3665f3]"
                    />
                    <div className="inline-block">
                      <div className="text-[14px] font-semibold text-[#0f1c3f]">{title}</div>
                      <div className="text-[13px] text-[#6b7587]">{sub}</div>
                    </div>
                  </label>
                ))}
              </div>
            </section>
          </div>

          <aside className="nexlo-card h-fit p-5 sm:sticky sm:top-4 sm:p-6">
            <h3 className="text-[17px] font-bold text-[#0f1c3f]">Order summary</h3>
            <div className="mt-4 space-y-2 border-b border-[#e7eef6] pb-4 text-[13px]">
              <div className="flex justify-between">
                <span className="text-[#6b7587]">Subtotal</span>
                <span className="text-[#0f1c3f]">{formatPrice(totals.subtotal)}</span>
              </div>
              {parseFloat(totals.discount) > 0 ? (
                <div className="flex justify-between text-[#0d9488]">
                  <span>Discount</span>
                  <span>-{formatPrice(totals.discount)}</span>
                </div>
              ) : null}
              <div className="flex justify-between">
                <span className="text-[#6b7587]">Shipping</span>
                <span className="text-[#0f1c3f]">{parseFloat(totals.shipping) === 0 ? "FREE" : formatPrice(totals.shipping)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6b7587]">Tax (13% VAT)</span>
                <span className="text-[#0f1c3f]">{formatPrice(totals.tax)}</span>
              </div>
              {donate && parseFloat(totals.donation) > 0 ? (
                <div className="flex justify-between">
                  <span className="text-[#6b7587]">Charity round-up</span>
                  <span className="text-[#0f1c3f]">{formatPrice(totals.donation)}</span>
                </div>
              ) : null}
            </div>
            <div className="mt-4 flex justify-between text-[18px] font-bold text-[#0f1c3f]">
              <span>Total</span>
              <span className="text-[#3665f3]">{formatPrice(totals.total)}</span>
            </div>
            <button
              onClick={placeOrder}
              disabled={loading || !selectedAddressId || Boolean(error && /available in stock/i.test(error))}
              className="nexlo-btn nexlo-btn-blue mt-6 h-11 w-full disabled:opacity-50"
            >
              {loading ? "Processing…" : "Pay Now"}
            </button>
            <p className="mt-4 text-center text-[12px] text-[#6b7587]">
              By placing your order you agree to our Terms and Privacy Policy. Escrow holds funds until delivery.
            </p>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
