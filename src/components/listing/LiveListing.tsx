"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { accountApi, apiBase, getToken } from "@/lib/account-api";
import { addToCart, loadWatchIds, toggleWatch } from "@/lib/commerce";

type Listing = {
  id: number;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  format: string;
  price: number | null;
  quantity: number;
  status: string;
  allow_best_offer?: boolean;
  auto_accept_price?: number | null;
  seller_id: number;
  seller_username?: string | null;
  seller_full_name?: string | null;
  seller_email?: string | null;
  category_name?: string;
  category_slug?: string;
  condition_name?: string;
  shipping_free?: boolean;
  shipping_cost?: number;
  auction_start_price?: number | null;
  auction_current_price?: number | null;
  auction_bid_count?: number | null;
  auction_ends_at?: string | null;
  photos?: { url: string; thumbnail_url?: string | null; is_primary?: boolean }[] | null;
  variations?: { id: number; name: string; options: { id: number; value: string }[] | null }[] | null;
  skus?: { id: number; combination: Record<string, string>; price: number | null; quantity: number }[] | null;
};

type Bid = { amount: number; created_at: string; bidder: string };

function money(n: number) {
  return `NPR ${Number(n || 0).toLocaleString("en-NP")}`;
}

function countdown(iso?: string | null) {
  if (!iso) return "—";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Ended";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 48) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h}h ${m}m ${s}s`;
}

export function LiveListing({ listing }: { listing: Listing }) {
  const photos = (listing.photos || []).map((p) => p.url || p.thumbnail_url).filter(Boolean) as string[];
  const [index, setIndex] = useState(0);
  const [price, setPrice] = useState(Number(listing.auction_current_price || listing.auction_start_price || listing.price || 0));
  const [bids, setBids] = useState<Bid[]>([]);
  const [bidCount, setBidCount] = useState(Number(listing.auction_bid_count || 0));
  const [endsAt, setEndsAt] = useState(listing.auction_ends_at);
  const [increment, setIncrement] = useState(50);
  const [maxBid, setMaxBid] = useState("");
  const [offer, setOffer] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [tick, setTick] = useState(0);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const isAuction = listing.format === "auction" || listing.format === "both";
  const isFixed = listing.format === "fixed" || listing.format === "both";
  const live = listing.status === "active";
  const variations = (listing.variations || []).filter((v) => v.options?.length);
  const selectedSku = (listing.skus || []).find((sku) =>
    variations.every((v) => sku.combination?.[v.name] === picked[v.name]),
  );

  useEffect(() => {
    loadWatchIds().then((ids) => setSaved(ids.has(listing.id)));
  }, [listing.id]);

  useEffect(() => {
    if (!getToken()) return;
    fetch(`${apiBase}/api/v1/listings/${listing.id}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    }).catch(() => undefined);
  }, [listing.id]);

  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!isAuction) return;
    accountApi<{ listing: Listing; bids: Bid[]; increment: number }>(`/api/v1/auctions/${listing.id}`)
      .then((snap) => {
        if (snap.listing) {
          setPrice(Number(snap.listing.auction_current_price || price));
          setBidCount(Number(snap.listing.auction_bid_count || 0));
          setEndsAt(snap.listing.auction_ends_at);
        }
        setBids(snap.bids || []);
        if (snap.increment) setIncrement(snap.increment);
      })
      .catch(() => undefined);
    const url = `${apiBase}/api/v1/auctions/${listing.id}/stream`;
    const es = new EventSource(url);
    es.addEventListener("bid", (ev) => {
      try {
        const snap = JSON.parse((ev as MessageEvent).data);
        if (snap.listing) {
          setPrice(Number(snap.listing.auction_current_price || 0));
          setBidCount(Number(snap.listing.auction_bid_count || 0));
          setEndsAt(snap.listing.auction_ends_at);
        }
        if (snap.bids) setBids(snap.bids);
        if (snap.increment) setIncrement(snap.increment);
      } catch {
        /* ignore */
      }
    });
    return () => es.close();
  }, [listing.id, isAuction]);

  const minNext = useMemo(() => (bidCount > 0 ? price + increment : Number(listing.auction_start_price || price)), [bidCount, price, increment, listing.auction_start_price]);
  const hero = photos[index] || "/logo.png";

  async function placeBid() {
    if (!getToken()) {
      window.location.href = `/login?redirect=/listing/${listing.id}`;
      return;
    }
    const body = await accountApi<{ youLead?: boolean }>(`/api/v1/auctions/${listing.id}/bid`, {
      method: "POST",
      body: JSON.stringify({ maxAmount: Number(maxBid) }),
    });
    setNotice(body.youLead ? "You are the high bidder." : "Bid placed, but another bidder still leads.");
  }

  async function sendOffer() {
    if (!getToken()) {
      window.location.href = `/login?redirect=/listing/${listing.id}`;
      return;
    }
    await accountApi("/api/v1/offers", { method: "POST", body: JSON.stringify({ listingId: listing.id, amount: Number(offer) }) });
    setNotice("Offer sent. The seller has 48 hours to respond.");
    setOffer("");
  }

  async function contactSeller() {
    if (!getToken()) {
      window.location.href = `/login?redirect=/listing/${listing.id}`;
      return;
    }
    const convo = await accountApi<{ data: { id: number } }>("/api/v1/conversations", {
      method: "POST",
      body: JSON.stringify({ sellerId: listing.seller_id, listingId: listing.id, subject: listing.title }),
    });
    if (message.trim()) {
      await accountApi(`/api/v1/conversations/${convo.data.id}/messages`, { method: "POST", body: JSON.stringify({ body: message }) });
    }
    window.location.href = "/account?tab=messages";
  }

  return (
    <>
      <main className="bg-white">
        <div className="page-shell py-6">
          <nav className="text-[13px] text-[#8b93a1]">
            <Link href="/" className="nexlo-link">Home</Link>
            <span> / </span>
            <Link href={`/categories/${listing.category_slug || "electronics"}`} className="nexlo-link">{listing.category_name}</Link>
          </nav>
          <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,400px)]">
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={hero} alt={listing.title} className="h-[420px] w-full rounded-xl border border-[#e7e7e7] bg-[#f7f7f7] object-contain" />
              {photos.length > 1 ? (
                <div className="mt-3 flex gap-2 overflow-x-auto">
                  {photos.map((src, i) => (
                    <button key={src + i} type="button" onClick={() => setIndex(i)} className="h-16 w-16 overflow-hidden rounded-xl border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={src} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="mt-8 whitespace-pre-wrap text-[14px] leading-relaxed text-[#4b5563]">{listing.description}</div>
            </div>
            <aside className="nexlo-card p-5">
              <p className="text-[13px] font-semibold text-[#3665f3]">{listing.seller_full_name || listing.seller_username || "Seller"}</p>
              <h1 className="mt-1 text-[22px] font-bold leading-snug text-[#191919]">{listing.title}</h1>
              {listing.subtitle ? <p className="mt-1 text-[13px] text-[#707070]">{listing.subtitle}</p> : null}
              <p className="mt-4 text-[32px] font-bold text-[#191919]">{money(isAuction ? price : Number(listing.price || 0))}</p>
              <p className="text-[13px] text-[#707070]">
                {listing.condition_name || "Used"} · {listing.shipping_free ? "Free shipping" : money(Number(listing.shipping_cost || 0))}
              </p>
              {notice ? <p className="mt-3 rounded-xl bg-[#f7f7f7] px-3 py-2 text-[13px] text-[#3665f3]">{notice}</p> : null}
              {variations.length ? (
                <div className="mt-4 space-y-3">
                  {variations.map((variation) => (
                    <label key={variation.id} className="block text-[13px] font-semibold text-[#191919]">
                      {variation.name}
                      <select
                        className="mt-1 h-10 w-full rounded-full border px-3 font-normal"
                        value={picked[variation.name] || ""}
                        onChange={(e) => setPicked((current) => ({ ...current, [variation.name]: e.target.value }))}
                      >
                        <option value="">Select {variation.name}</option>
                        {(variation.options || []).map((opt) => (
                          <option key={opt.id} value={opt.value}>{opt.value}</option>
                        ))}
                      </select>
                    </label>
                  ))}
                  {selectedSku ? (
                    <p className="text-[12px] text-[#6b7587]">
                      {selectedSku.quantity} in stock
                      {selectedSku.price != null ? ` · ${money(Number(selectedSku.price))}` : ""}
                    </p>
                  ) : (
                    <p className="text-[12px] text-[#8a94a6]">Choose options to add this item.</p>
                  )}
                </div>
              ) : null}
              <button
                type="button"
                className="mt-3 text-[13px] font-semibold text-[#3665f3]"
                onClick={async () => {
                  const currently = saved;
                  setSaved(!currently);
                  await toggleWatch({
                    listingId: listing.id,
                    saved: currently,
                    title: listing.title,
                    photo: photos[0] ?? null,
                    price: Number(listing.price || price),
                  });
                }}
              >
                {saved ? "♥ Saved to watchlist" : "♡ Add to watchlist"}
              </button>

              {isAuction ? (
                <div className="mt-4 rounded-2xl bg-white p-4">
                  <p className="text-[13px] text-[#6b7587]">{bidCount} bids · {countdown(endsAt)} <span className="sr-only">{tick}</span></p>
                  <p className="mt-1 text-[12px] text-[#8a94a6]">Bid at least {money(minNext)}. Your max bid is kept private.</p>
                  <form
                    className="mt-3 flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      placeBid().catch((err) => setNotice(err instanceof Error ? err.message : "Bid failed"));
                    }}
                  >
                    <input value={maxBid} onChange={(e) => setMaxBid(e.target.value)} placeholder={String(minNext)} className="h-10 flex-1 rounded-full border px-4" disabled={!live} />
                    <button className="nexlo-btn nexlo-btn-blue h-10" disabled={!live}>Place bid</button>
                  </form>
                  <ul className="mt-3 space-y-1 text-[12px] text-[#5b6780]">
                    {bids.slice(0, 6).map((b, i) => (
                      <li key={`${b.created_at}-${i}`}>{money(b.amount)} · {b.bidder}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {isFixed && live ? (
                <button
                  type="button"
                  className="nexlo-btn mt-4 h-11 w-full"
                  onClick={async () => {
                    try {
                      if (variations.length && !selectedSku) {
                        setNotice("Select size and color first.");
                        return;
                      }
                      await addToCart({
                        listingId: listing.id,
                        quantity: 1,
                        title: listing.title,
                        photo: photos[0] ?? null,
                        price: Number(selectedSku?.price ?? listing.price ?? 0),
                        seller: listing.seller_username || listing.seller_full_name || "Seller",
                        variationSkuId: selectedSku?.id ?? null,
                      });
                      window.location.href = "/cart";
                    } catch (err) {
                      setNotice(err instanceof Error ? err.message : "Could not add to cart");
                    }
                  }}
                >
                  Buy it now · {money(Number(listing.price || 0))}
                </button>
              ) : null}

              {listing.allow_best_offer && live ? (
                <form
                  className="mt-4 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    sendOffer().catch((err) => setNotice(err instanceof Error ? err.message : "Offer failed"));
                  }}
                >
                  <input value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="Best offer" className="h-10 flex-1 rounded-full border px-4" />
                  <button className="h-10 rounded-full border border-[#3665f3] px-4 text-[13.5px] font-semibold text-[#3665f3]">Make offer</button>
                </form>
              ) : null}

              <form
                className="mt-4 space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  contactSeller().catch((err) => setNotice(err instanceof Error ? err.message : "Could not message seller"));
                }}
              >
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ask the seller a question" className="min-h-20 w-full rounded-2xl border px-3 py-2 text-[13px]" />
                <button className="h-10 w-full rounded-full border border-[#e7e7e7] text-[13.5px] font-semibold text-[#191919]">Contact seller</button>
              </form>
            </aside>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
