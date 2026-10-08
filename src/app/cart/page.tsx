"use client";

import { useState, useEffect } from "react";
import { accountApi } from "@/lib/account-api";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface CartItem {
  cart_item_id: number;
  listing_id: number;
  title: string;
  variation_sku_id: number | null;
  variation_combo: any;
  photo_url: string | null;
  quantity: number;
  price: number;
  current_price: number;
  price_changed: boolean;
  stock: number;
  in_stock: boolean;
  subtotal: number;
}

interface SellerGroup {
  seller_id: number;
  seller_username: string;
  items: CartItem[];
  subtotal: number;
  shipping_cost: number;
}

export default function CartPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [sellers, setSellers] = useState<SellerGroup[]>([]);
  const [summary, setSummary] = useState({
    total_items: 0,
    subtotal: "0",
    shipping: "0",
    tax: "0",
    total: "0",
  });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCart();
  }, []);

  async function loadCart() {
    setLoading(true);
    setError(null);
    try {
      const token = accountApi.getToken();
      const headers: any = { "Content-Type": "application/json" };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch("http://localhost:4000/api/v1/cart", { headers });
      if (!res.ok) throw new Error("Failed to load cart");

      const data = await res.json();
      setSellers(data.sellers || []);
      setSummary(data.summary || summary);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function updateQuantity(cartItemId: number, quantity: number) {
    try {
      const token = accountApi.getToken();
      const headers: any = { "Content-Type": "application/json" };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch(`http://localhost:4000/api/v1/cart/${cartItemId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ quantity }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update quantity");
      }

      loadCart();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function removeItem(cartItemId: number) {
    if (!confirm("Remove this item from cart?")) return;

    try {
      const token = accountApi.getToken();
      const headers: any = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const res = await fetch(`http://localhost:4000/api/v1/cart/${cartItemId}`, {
        method: "DELETE",
        headers,
      });

      if (!res.ok) throw new Error("Failed to remove item");
      loadCart();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function proceedToCheckout() {
    const token = accountApi.getToken();
    if (!token) {
      router.push("/login?redirect=/checkout");
      return;
    }

    router.push("/checkout");
  }

  function formatPrice(price: number | string) {
    const num = typeof price === "string" ? parseFloat(price) : price;
    return `NPR ${num.toLocaleString()}`;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="mx-auto max-w-7xl px-4">
          <div className="text-center text-gray-500">Loading cart...</div>
        </div>
      </div>
    );
  }

  if (sellers.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="mx-auto max-w-7xl px-4">
          <div className="rounded-lg bg-white p-12 text-center shadow">
            <div className="mb-4 text-6xl">🛒</div>
            <h2 className="text-2xl font-bold text-gray-900">Your cart is empty</h2>
            <p className="mt-2 text-gray-600">Start shopping to add items to your cart!</p>
            <Link
              href="/search"
              className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4">
        <h1 className="mb-8 text-3xl font-bold text-gray-900">Shopping Cart</h1>

        {error && (
          <div className="mb-6 rounded-lg bg-red-50 p-4 text-red-800">
            <strong>Error:</strong> {error}
          </div>
        )}

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Cart Items */}
          <div className="lg:col-span-2">
            <div className="space-y-6">
              {sellers.map((seller) => (
                <div key={seller.seller_id} className="rounded-lg bg-white p-6 shadow">
                  <div className="mb-4 flex items-center justify-between border-b pb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        Sold by{" "}
                        <Link href={`/seller/${seller.seller_username}`} className="text-blue-600 hover:underline">
                          {seller.seller_username}
                        </Link>
                      </h3>
                      <p className="text-sm text-gray-500">
                        {seller.items.length} item{seller.items.length > 1 ? "s" : ""} · Subtotal:{" "}
                        {formatPrice(seller.subtotal)}
                      </p>
                    </div>
                    {seller.shipping_cost > 0 && (
                      <div className="text-sm text-gray-600">
                        Shipping: {formatPrice(seller.shipping_cost)}
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    {seller.items.map((item) => (
                      <div key={item.cart_item_id} className="flex gap-4">
                        <Link href={`/listing/${item.listing_id}`} className="flex-shrink-0">
                          {item.photo_url ? (
                            <img
                              src={item.photo_url}
                              alt={item.title}
                              className="h-24 w-24 rounded object-cover"
                            />
                          ) : (
                            <div className="flex h-24 w-24 items-center justify-center rounded bg-gray-100 text-gray-400">
                              No Image
                            </div>
                          )}
                        </Link>

                        <div className="flex-1">
                          <Link
                            href={`/listing/${item.listing_id}`}
                            className="font-medium text-gray-900 hover:text-blue-600"
                          >
                            {item.title}
                          </Link>

                          {item.variation_combo && (
                            <div className="mt-1 text-sm text-gray-500">
                              {Object.entries(item.variation_combo).map(([key, value]) => (
                                <span key={key} className="mr-2">
                                  {key}: {value as string}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="mt-2 flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => updateQuantity(item.cart_item_id, Math.max(1, item.quantity - 1))}
                                className="flex h-8 w-8 items-center justify-center rounded border border-gray-300 hover:bg-gray-50"
                              >
                                −
                              </button>
                              <span className="w-8 text-center">{item.quantity}</span>
                              <button
                                onClick={() => updateQuantity(item.cart_item_id, item.quantity + 1)}
                                disabled={item.quantity >= item.stock}
                                className="flex h-8 w-8 items-center justify-center rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                              >
                                +
                              </button>
                            </div>

                            <div className="text-sm text-gray-500">
                              {item.in_stock ? (
                                <span className="text-green-600">In stock ({item.stock} available)</span>
                              ) : (
                                <span className="text-red-600">Only {item.stock} left</span>
                              )}
                            </div>

                            <button
                              onClick={() => removeItem(item.cart_item_id)}
                              className="ml-auto text-sm text-red-600 hover:text-red-700"
                            >
                              Remove
                            </button>
                          </div>

                          {item.price_changed && (
                            <div className="mt-2 rounded bg-yellow-50 p-2 text-sm text-yellow-800">
                              Price changed: {formatPrice(item.price)} → {formatPrice(item.current_price)}
                            </div>
                          )}
                        </div>

                        <div className="text-right">
                          <div className="font-semibold text-gray-900">{formatPrice(item.subtotal)}</div>
                          <div className="text-sm text-gray-500">{formatPrice(item.price)} each</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-4 rounded-lg bg-white p-6 shadow">
              <h3 className="mb-4 text-lg font-semibold text-gray-900">Order Summary</h3>

              <div className="space-y-2 border-b pb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal ({summary.total_items} items)</span>
                  <span className="text-gray-900">{formatPrice(summary.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Shipping</span>
                  <span className="text-gray-900">
                    {parseFloat(summary.shipping) === 0 ? "FREE" : formatPrice(summary.shipping)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax (13% VAT)</span>
                  <span className="text-gray-900">Calculated at checkout</span>
                </div>
              </div>

              <div className="mt-4 flex justify-between text-lg font-semibold">
                <span>Total</span>
                <span>{formatPrice(summary.total)}</span>
              </div>

              <button
                onClick={proceedToCheckout}
                className="mt-6 w-full rounded-lg bg-blue-600 py-3 text-white hover:bg-blue-700"
              >
                Proceed to Checkout
              </button>

              <Link href="/search" className="mt-3 block text-center text-sm text-blue-600 hover:underline">
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
