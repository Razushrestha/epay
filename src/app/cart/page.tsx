"use client";

import { useState, useEffect } from "react";
import { getToken } from "@/lib/account-api";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { PageHero } from "@/components/ui/PageHero";
import { ListingGrid } from "@/components/browse/ListingGrid";
import { listings } from "@/lib/home-data";
import { CART_EVENT, loadCartBundle, removeCartItem, updateCartQuantity } from "@/lib/commerce";

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
  local?: boolean;
}

interface SellerGroup {
  seller_id: number;
  seller_username: string;
  items: CartItem[];
  subtotal: number;
  shipping_cost: number;
  combined_shipping?: boolean;
  shipping_note?: string;
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
    window.addEventListener(CART_EVENT, loadCart);
    return () => window.removeEventListener(CART_EVENT, loadCart);
  }, []);

  async function loadCart() {
    setLoading(true);
    setError(null);
    try {
      const data = await loadCartBundle();
      setSellers(data.sellers);
      setSummary(data.summary);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function updateQuantity(cartItemId: number, quantity: number, listingId: number, local?: boolean) {
    try {
      await updateCartQuantity(cartItemId, quantity, local ? listingId : undefined);
      await loadCart();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function removeItem(cartItemId: number, listingId: number, local?: boolean) {
    if (!confirm("Remove this item from cart?")) return;

    try {
      await removeCartItem(cartItemId, local ? listingId : undefined);
      await loadCart();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function proceedToCheckout() {
    if (!getToken()) {
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
    return <main className="page-shell py-16 text-[14px] text-[#6b7587]">Loading cart…</main>;
  }

  if (sellers.length === 0) {
    return (
      <>
        <PageHero
          eyebrow="Your cart"
          title="Nothing here yet"
          body="Start shopping to fill your cart. Escrow holds payment until delivery on every Nexlo order."
          cta="Continue shopping"
          href="/search"
        />
        <main className="page-shell py-8">
          <h2 className="text-[19px] font-bold text-[#0f1c3f]">Popular right now</h2>
          <div className="mt-4">
            <ListingGrid items={listings.slice(0, 8)} />
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  return (
    <>
      <PageHero
        eyebrow="Cart"
        title="Shopping cart"
        body={`${summary.total_items} item${Number(summary.total_items) === 1 ? "" : "s"} · VAT and escrow applied at checkout.`}
        cta="Keep shopping"
        href="/search"
      />
      <main className="page-shell py-8">
        {error ? (
          <div className="mb-6 rounded-xl border border-[#f5c2c7] bg-[#fff5f5] p-4 text-[14px] text-[#e53238]">
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            {sellers.map((seller) => (
              <div key={seller.seller_id} className="nexlo-card p-5 sm:p-6">
                <div className="mb-4 flex items-center justify-between border-b border-[#e7eef6] pb-4">
                  <div>
                    <h3 className="text-[15px] font-bold text-[#0f1c3f]">
                      Sold by{" "}
                      {seller.seller_id < 0 ? (
                        <span>{seller.seller_username}</span>
                      ) : (
                        <Link href={`/seller/${seller.seller_username}`} className="nexlo-link">
                          {seller.seller_username}
                        </Link>
                      )}
                    </h3>
                    <p className="text-[13px] text-[#6b7587]">
                      {seller.items.length} item{seller.items.length > 1 ? "s" : ""} · {formatPrice(seller.subtotal)}
                    </p>
                  </div>
                  <div className="text-right text-[13px] text-[#6b7587]">
                    {seller.shipping_cost > 0 ? <div>Shipping: {formatPrice(seller.shipping_cost)}</div> : <div>Free shipping</div>}
                    {seller.shipping_note ? <p className="mt-0.5 max-w-[220px] text-[11px] text-[#8a94a6]">{seller.shipping_note}</p> : null}
                  </div>
                </div>

                <div className="space-y-4">
                  {seller.items.map((item) => (
                    <div key={item.cart_item_id} className="flex gap-4">
                      <Link href={`/listing/${item.listing_id}`} className="shrink-0">
                        {item.photo_url ? (
                          <img src={item.photo_url} alt={item.title} className="h-24 w-24 rounded-xl border border-[#e7eef6] object-cover" />
                        ) : (
                          <div className="flex h-24 w-24 items-center justify-center rounded-xl bg-[#f4f8fd] text-[12px] text-[#6b7587]">
                            No image
                          </div>
                        )}
                      </Link>

                      <div className="min-w-0 flex-1">
                        <Link href={`/listing/${item.listing_id}`} className="text-[14px] font-semibold text-[#0f1c3f] hover:text-[#3665f3]">
                          {item.title}
                        </Link>
                        {item.variation_combo ? (
                          <div className="mt-1 text-[12px] text-[#6b7587]">
                            {Object.entries(item.variation_combo).map(([key, value]) => (
                              <span key={key} className="mr-2">
                                {key}: {value as string}
                              </span>
                            ))}
                          </div>
                        ) : null}

                        <div className="mt-2 flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-2">
                            <button
                                onClick={() => updateQuantity(item.cart_item_id, Math.max(1, item.quantity - 1), item.listing_id, item.local)}
                              className="flex h-8 w-8 items-center justify-center rounded-full border border-[#e7eef6] text-[#0f1c3f] hover:bg-[#f4f8fd]"
                            >
                              −
                            </button>
                            <span className="w-8 text-center text-[14px]">{item.quantity}</span>
                            <button
                                onClick={() => updateQuantity(item.cart_item_id, item.quantity + 1, item.listing_id, item.local)}
                              disabled={item.quantity >= item.stock}
                              className="flex h-8 w-8 items-center justify-center rounded-full border border-[#e7eef6] text-[#0f1c3f] hover:bg-[#f4f8fd] disabled:opacity-50"
                            >
                              +
                            </button>
                          </div>
                          <span className={`text-[12px] ${item.in_stock ? "text-[#0d9488]" : "text-[#e53238]"}`}>
                            {item.in_stock ? `In stock (${item.stock})` : `Only ${item.stock} left`}
                          </span>
                          <button onClick={() => removeItem(item.cart_item_id, item.listing_id, item.local)} className="ml-auto text-[12px] font-semibold text-[#e53238]">
                            Remove
                          </button>
                        </div>
                        {item.price_changed ? (
                          <div className="mt-2 rounded-xl bg-[#fff8e7] px-3 py-2 text-[12px] text-[#8a6d1f]">
                            Price changed: {formatPrice(item.price)} → {formatPrice(item.current_price)}
                          </div>
                        ) : null}
                      </div>

                      <div className="text-right">
                        <div className="text-[15px] font-bold text-[#0f1c3f]">{formatPrice(item.subtotal)}</div>
                        <div className="text-[12px] text-[#6b7587]">{formatPrice(item.price)} each</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <aside className="nexlo-card h-fit p-5 sm:sticky sm:top-4 sm:p-6">
            <h3 className="text-[17px] font-extrabold text-[#0f1c3f]">Order summary</h3>
            <div className="mt-4 space-y-2 border-b border-[#e7eef6] pb-4 text-[13px]">
              <div className="flex justify-between">
                <span className="text-[#6b7587]">Subtotal ({summary.total_items} items)</span>
                <span className="text-[#0f1c3f]">{formatPrice(summary.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6b7587]">Shipping</span>
                <span className="text-[#0f1c3f]">{parseFloat(summary.shipping) === 0 ? "FREE" : formatPrice(summary.shipping)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#6b7587]">Tax (13% VAT)</span>
                <span className="text-[#0f1c3f]">At checkout</span>
              </div>
            </div>
            <div className="mt-4 flex justify-between text-[16px] font-bold text-[#0f1c3f]">
              <span>Total</span>
              <span>{formatPrice(summary.total)}</span>
            </div>
            <button onClick={proceedToCheckout} className="nexlo-btn nexlo-btn-blue mt-6 h-11 w-full">
              Proceed to checkout
            </button>
            <Link href="/search" className="nexlo-link mt-3 block text-center text-[13px]">
              Continue shopping
            </Link>
          </aside>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
