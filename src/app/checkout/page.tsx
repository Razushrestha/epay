"use client";

import { useState, useEffect } from "react";
import { accountApi } from "@/lib/account-api";
import { useRouter } from "next/navigation";

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

      const res = await fetch("http://localhost:4000/api/v1/account/addresses", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to load addresses");

      const data = await res.json();
      setAddresses(data.addresses || []);

      // Auto-select default address
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

      const res = await fetch("http://localhost:4000/api/v1/cart/checkout/calculate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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

      // Step 1: Create order
      const orderRes = await fetch("http://localhost:4000/api/v1/cart/checkout/create-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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

      // Step 2: Initiate payment with selected gateway
      const paymentRes = await fetch("http://localhost:4000/api/v1/payments/initiate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
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

      // Step 3: Redirect to payment gateway
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
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-5xl px-4">
        <h1 className="mb-8 text-3xl font-bold text-gray-900">Checkout</h1>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-800">
            <strong>Error:</strong> {error}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Checkout Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Shipping Address */}
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Shipping Address</h2>

              {addresses.length === 0 ? (
                <div className="text-center text-gray-500">
                  <p className="mb-4">No addresses found.</p>
                  <button
                    onClick={() => router.push("/account?tab=addresses")}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
                  >
                    Add Address
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {addresses.map((addr) => (
                    <label
                      key={addr.id}
                      className={`block cursor-pointer rounded-lg border-2 p-4 transition ${
                        selectedAddressId === addr.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="address"
                        value={addr.id}
                        checked={selectedAddressId === addr.id}
                        onChange={() => setSelectedAddressId(addr.id)}
                        className="mr-3"
                      />
                      <div className="inline-block">
                        <div className="font-medium text-gray-900">{addr.recipient_name}</div>
                        <div className="text-sm text-gray-600">
                          {addr.address_line1}
                          {addr.address_line2 && `, ${addr.address_line2}`}
                        </div>
                        <div className="text-sm text-gray-600">
                          {addr.city}, {addr.state} {addr.postal_code}
                        </div>
                        <div className="text-sm text-gray-600">{addr.phone}</div>
                        {addr.is_default && (
                          <span className="mt-1 inline-block rounded bg-green-100 px-2 py-0.5 text-xs text-green-800">
                            Default
                          </span>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Coupon Code */}
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Coupon Code</h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="Enter coupon code"
                  className="flex-1 rounded border border-gray-300 px-3 py-2"
                  disabled={couponApplied}
                />
                <button
                  onClick={applyCoupon}
                  disabled={!couponCode.trim() || couponApplied}
                  className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Apply
                </button>
              </div>
              {couponApplied && (
                <div className="mt-2 text-sm text-green-600">✓ Coupon applied successfully!</div>
              )}
            </div>

            {/* Order Notes */}
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Order Notes (Optional)</h2>
              <textarea
                value={buyerNotes}
                onChange={(e) => setBuyerNotes(e.target.value)}
                placeholder="Special instructions for the seller..."
                rows={3}
                className="w-full rounded border border-gray-300 px-3 py-2"
              />
            </div>

            {/* Payment Method Selection */}
            <div className="rounded-lg bg-white p-6 shadow">
              <h2 className="mb-4 text-lg font-semibold text-gray-900">Payment Method</h2>
              <div className="space-y-3">
                <label
                  className={`block cursor-pointer rounded-lg border-2 p-4 transition ${
                    selectedGateway === "esewa"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="gateway"
                    value="esewa"
                    checked={selectedGateway === "esewa"}
                    onChange={() => setSelectedGateway("esewa")}
                    className="mr-3"
                  />
                  <div className="inline-block">
                    <div className="font-medium text-gray-900">eSewa</div>
                    <div className="text-sm text-gray-600">Pay with eSewa wallet</div>
                  </div>
                </label>

                <label
                  className={`block cursor-pointer rounded-lg border-2 p-4 transition ${
                    selectedGateway === "khalti"
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="gateway"
                    value="khalti"
                    checked={selectedGateway === "khalti"}
                    onChange={() => setSelectedGateway("khalti")}
                    className="mr-3"
                  />
                  <div className="inline-block">
                    <div className="font-medium text-gray-900">Khalti</div>
                    <div className="text-sm text-gray-600">Pay with Khalti wallet, card, or bank</div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-4 rounded-lg bg-white p-6 shadow">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">Order Summary</h3>

              <div className="space-y-2 border-b pb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="text-gray-900">{formatPrice(totals.subtotal)}</span>
                </div>
                {parseFloat(totals.discount) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600">Discount</span>
                    <span className="text-green-600">-{formatPrice(totals.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Shipping</span>
                  <span className="text-gray-900">
                    {parseFloat(totals.shipping) === 0 ? "FREE" : formatPrice(totals.shipping)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax (13% VAT)</span>
                  <span className="text-gray-900">{formatPrice(totals.tax)}</span>
                </div>
              </div>

              <div className="mt-4 flex justify-between text-xl font-bold">
                <span>Total</span>
                <span className="text-blue-600">{formatPrice(totals.total)}</span>
              </div>

              <button
                onClick={placeOrder}
                disabled={loading || !selectedAddressId}
                className="mt-6 w-full rounded-lg bg-blue-600 py-3 text-lg font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Processing..." : "Place Order"}
              </button>

              <p className="mt-4 text-center text-xs text-gray-500">
                By placing your order, you agree to our Terms of Service and Privacy Policy.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
