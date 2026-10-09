"use client";

import { useState, useEffect } from "react";
import { accountApi, apiBase } from "@/lib/account-api";
import { commerceHeaders } from "@/lib/commerce";
import { useRouter } from "next/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { PageHero } from "@/components/ui/PageHero";

interface Address {
  id: number;
  recipient_name: string;
  phone: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_default: boolean;
}

export default function CheckoutPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [couponCode, setCouponCode] = useState("");
  const [couponApplied, setCouponApplied] = useState(false);
  const [totals, setTotals] = useState({
    subtotal: "0",
    discount: "0",
    shipping: "0",
    tax: "0",
    total: "0",
  });
  const [error, setError] = useState<string | null>(null);
  const [buyerNotes, setBuyerNotes] = useState("");
  const [selectedGateway, setSelectedGateway] = useState<"esewa" | "khalti">("esewa");

  useEffect(() => {
    loadAddresses();
    calculateTotals();
  }, []);

  async function loadAddresses() {
    try {
      const token = accountApi.getToken();
      if (!token) {
        router.push("/login?redirect=/checkout");
        return;
      }

      const res = await fetch(`${apiBase}/api/v1/account/addresses`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to load addresses");

      const data = await res.json();
      setAddresses(data.addresses || []);

      const defaultAddr = data.addresses.find((a: Address) => a.is_default);
      if (defaultAddr) {
        setSelectedAddressId(defaultAddr.id);
      }
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function calculateTotals(coupon?: string) {
    try {
      const token = accountApi.getToken();
      if (!token) return;

      const headers = commerceHeaders();
      headers.set("Content-Type", "application/json");
      const res = await fetch(`${apiBase}/api/v1/cart/checkout/calculate`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          shipping_address_id: selectedAddressId,
          coupon_code: coupon || couponCode,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }

      const data = await res.json();
      setTotals(data);
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function applyCoupon() {
    if (!couponCode.trim()) return;

    try {
      setError(null);
      await calculateTotals(couponCode);
      setCouponApplied(true);
    } catch (err: any) {
      setError(err.message);
      setCouponApplied(false);
    }
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
        body="Funds stay in escrow until delivery. Pay with eSewa or Khalti — 13% VAT included."
        cta="Back to cart"
        href="/cart"
      />
      <main className="page-shell py-8">
        {error ? (
          <div className="mb-6 rounded-xl border border-[#f5c2c7] bg-[#fff5f5] p-4 text-[14px] text-[#e53238]">
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <section className="nexlo-card p-5 sm:p-6">
              <h2 className="text-[17px] font-bold text-[#191919]">Shipping address</h2>
              {addresses.length === 0 ? (
                <div className="mt-4 text-center">
                  <p className="mb-4 text-[13px] text-[#707070]">No addresses yet.</p>
                  <button onClick={() => router.push("/account?tab=addresses")} className="nexlo-btn nexlo-btn-blue">
                    Add address
                  </button>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {addresses.map((addr) => (
                    <label
                      key={addr.id}
                      className={`block cursor-pointer rounded-xl border p-4 transition ${
                        selectedAddressId === addr.id ? "border-[#3665f3] bg-[#eef3ff]" : "border-[#e7e7e7] hover:border-[#ccc]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="address"
                        value={addr.id}
                        checked={selectedAddressId === addr.id}
                        onChange={() => setSelectedAddressId(addr.id)}
                        className="mr-3 accent-[#3665f3]"
                      />
                      <div className="inline-block text-[13px]">
                        <div className="font-semibold text-[#191919]">{addr.recipient_name}</div>
                        <div className="text-[#707070]">
                          {addr.address_line1}
                          {addr.address_line2 ? `, ${addr.address_line2}` : ""}
                        </div>
                        <div className="text-[#707070]">
                          {addr.city}, {addr.state} {addr.postal_code}
                        </div>
                        <div className="text-[#707070]">{addr.phone}</div>
                        {addr.is_default ? (
                          <span className="mt-1 inline-block rounded-full bg-[#d1fae5] px-2 py-0.5 text-[11px] font-semibold text-[#0d9488]">
                            Default
                          </span>
                        ) : null}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </section>

            <section className="nexlo-card p-5 sm:p-6">
              <h2 className="text-[17px] font-bold text-[#191919]">Coupon</h2>
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="Enter coupon code"
                  className="h-10 flex-1 rounded-full border border-[#e7e7e7] px-4 text-[14px]"
                  disabled={couponApplied}
                />
                <button onClick={applyCoupon} disabled={!couponCode.trim() || couponApplied} className="nexlo-btn nexlo-btn-blue disabled:opacity-50">
                  Apply
                </button>
              </div>
              {couponApplied ? <div className="mt-2 text-[13px] text-[#0d9488]">Coupon applied.</div> : null}
            </section>

            <section className="nexlo-card p-5 sm:p-6">
              <h2 className="text-[17px] font-bold text-[#191919]">Order notes</h2>
              <textarea
                value={buyerNotes}
                onChange={(e) => setBuyerNotes(e.target.value)}
                placeholder="Special instructions for the seller…"
                rows={3}
                className="mt-3 w-full rounded-xl border border-[#e7e7e7] px-3 py-2 text-[14px]"
              />
            </section>

            <section className="nexlo-card p-5 sm:p-6">
              <h2 className="text-[17px] font-bold text-[#191919]">Payment method</h2>
              <div className="mt-3 space-y-3">
                {([
                  ["esewa", "eSewa", "Pay with your eSewa wallet"],
                  ["khalti", "Khalti", "Wallet, card, or bank"],
                ] as const).map(([id, title, sub]) => (
                  <label
                    key={id}
                    className={`block cursor-pointer rounded-xl border p-4 transition ${
                      selectedGateway === id ? "border-[#3665f3] bg-[#eef3ff]" : "border-[#e7e7e7] hover:border-[#ccc]"
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
                      <div className="text-[14px] font-semibold text-[#191919]">{title}</div>
                      <div className="text-[13px] text-[#707070]">{sub}</div>
                    </div>
                  </label>
                ))}
              </div>
            </section>
          </div>

          <aside className="nexlo-card h-fit p-5 sm:sticky sm:top-4 sm:p-6">
            <h3 className="text-[17px] font-bold text-[#191919]">Order summary</h3>
            <div className="mt-4 space-y-2 border-b border-[#e7e7e7] pb-4 text-[13px]">
              <div className="flex justify-between">
                <span className="text-[#707070]">Subtotal</span>
                <span className="text-[#191919]">{formatPrice(totals.subtotal)}</span>
              </div>
              {parseFloat(totals.discount) > 0 ? (
                <div className="flex justify-between text-[#0d9488]">
                  <span>Discount</span>
                  <span>-{formatPrice(totals.discount)}</span>
                </div>
              ) : null}
              <div className="flex justify-between">
                <span className="text-[#707070]">Shipping</span>
                <span className="text-[#191919]">{parseFloat(totals.shipping) === 0 ? "FREE" : formatPrice(totals.shipping)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#707070]">Tax (13% VAT)</span>
                <span className="text-[#191919]">{formatPrice(totals.tax)}</span>
              </div>
            </div>
            <div className="mt-4 flex justify-between text-[18px] font-bold text-[#191919]">
              <span>Total</span>
              <span className="text-[#3665f3]">{formatPrice(totals.total)}</span>
            </div>
            <button onClick={placeOrder} disabled={loading || !selectedAddressId} className="nexlo-btn mt-6 h-11 w-full disabled:opacity-50">
              {loading ? "Processing…" : "Place order"}
            </button>
            <p className="mt-4 text-center text-[12px] text-[#707070]">
              By placing your order you agree to our Terms and Privacy Policy. Escrow holds funds until delivery.
            </p>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
