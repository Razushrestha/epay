"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  seller_avatar?: string | null;
  seller_created_at?: string | null;
  seller_account_type?: string | null;
  seller_country?: string | null;
  seller_feedback_score?: number | null;
  positive_count?: number | null;
  neutral_count?: number | null;
  negative_count?: number | null;
  category_name?: string;
  category_slug?: string;
  brand_name?: string | null;
  condition_name?: string;
  shipping_free?: boolean;
  shipping_cost?: number;
  item_location?: string | null;
  published_at?: string | null;
  created_at?: string | null;
  auction_start_price?: number | null;
  auction_current_price?: number | null;
  auction_bid_count?: number | null;
  auction_ends_at?: string | null;
  photos?: { url: string; thumbnail_url?: string | null; is_primary?: boolean }[] | null;
  variations?: { id: number; name: string; options: { id: number; value: string }[] | null }[] | null;
  skus?: { id: number; combination: Record<string, string>; price: number | null; quantity: number }[] | null;
};

type Bid = { amount: number; created_at: string; bidder: string };
type Tab = "overview" | "shipping" | "seller" | "reviews";

function money(n: number) {
  return `NPR ${Number(n || 0).toLocaleString("en-NP")}`;
}

function prettyTitle(value: string) {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}

function countdown(iso?: string | null) {
  if (!iso) return "-";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Ended";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 48) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h}h ${m}m ${s}s`;
}

function postedAgo(iso?: string | null) {
  if (!iso) return "-";
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
  if (days < 1) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function Icon({
  name,
  className,
}: {
  name: "chevron" | "heart" | "share" | "truck" | "pin" | "lock" | "return" | "badge" | "box" | "tag" | "grid" | "clock" | "star" | "check" | "chat";
  className?: string;
}) {
  const common = {
    width: 16,
    height: 16,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
    "aria-hidden": true,
  };
  if (name === "star") {
    return (
      <svg width="14" height="14" viewBox="0 0 20 20" className={className} aria-hidden>
        <path fill="currentColor" d="m10 1.8 2.4 5.2 5.7.7-4.2 3.9 1.1 5.6L10 14.6 4.9 17.2l1.1-5.6L1.9 7.7l5.7-.7L10 1.8z" />
      </svg>
    );
  }
  if (name === "chevron") return <svg {...common}><path d="m9 6 6 6-6 6" /></svg>;
  if (name === "heart") return <svg {...common}><path d="M12 21s-7-4.4-9.5-8.2C.6 9.7 2.2 6 5.8 6c2 0 3.3 1.2 4.2 2.4C10.9 7.2 12.2 6 14.2 6c3.6 0 5.2 3.7 3.3 6.8C19 16.6 12 21 12 21Z" /></svg>;
  if (name === "share") return <svg {...common}><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v14" /></svg>;
  if (name === "truck") return <svg {...common}><path d="M3 7h11v10H3zM14 11h4l3 3v3h-7zM7 20a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" /></svg>;
  if (name === "pin") return <svg {...common}><path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" /><circle cx="12" cy="10" r="2.2" /></svg>;
  if (name === "lock") return <svg {...common}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>;
  if (name === "return") return <svg {...common}><path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5" /></svg>;
  if (name === "badge") return <svg {...common}><path d="M12 3 14.5 8.5 21 9.5 16.5 14l1 6.5L12 17.8 6.5 20.5l1-6.5L3 9.5 9.5 8.5 12 3Z" /></svg>;
  if (name === "box") return <svg {...common}><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Zm0 18V12m8-4.5L12 12 4 7.5" /></svg>;
  if (name === "tag") return <svg {...common}><path d="M20 13 11 4H4v7l9 9 7-7Z" /><circle cx="7.5" cy="7.5" r="1" /></svg>;
  if (name === "grid") return <svg {...common}><path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z" /></svg>;
  if (name === "clock") return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
  if (name === "check") return <svg {...common}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>;
  return <svg {...common}><path d="M4 6h16v12H7l-3 3V6Z" /></svg>;
}

function Trust({ icon, children }: { icon: Parameters<typeof Icon>[0]["name"]; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[#5b6780]">
      <span className="text-[#8a94a6]">
        <Icon name={icon} />
      </span>
      {children}
    </span>
  );
}

export function LiveListing({ listing }: { listing: Listing }) {
  const router = useRouter();
  const bidInputRef = useRef<HTMLInputElement>(null);
  const photos = (listing.photos || [])
    .map((p) => p.url || p.thumbnail_url)
    .filter(Boolean) as string[];
  const thumbs = (listing.photos || []).map((p) => p.thumbnail_url || p.url).filter(Boolean) as string[];
  const [index, setIndex] = useState(0);
  const [isOwner, setIsOwner] = useState(false);
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
  const [copied, setCopied] = useState(false);
  const [following, setFollowing] = useState(false);
  const [qty, setQty] = useState(1);
  const [bidBusy, setBidBusy] = useState(false);
  const [watchBusy, setWatchBusy] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [messageBusy, setMessageBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [tick, setTick] = useState(0);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const isAuction = listing.format === "auction" || listing.format === "both";
  const isFixed = listing.format === "fixed" || listing.format === "both";
  const live = listing.status === "active";
  const variations = (listing.variations || []).filter((v) => v.options?.length);
  const selectedSku = (listing.skus || []).find((sku) =>
    variations.every((v) => sku.combination?.[v.name] === picked[v.name]),
  );
  const stock = selectedSku?.quantity ?? listing.quantity ?? 1;
  const sellerName = listing.seller_username || listing.seller_full_name || "Seller";
  const title = prettyTitle(listing.title);
  const location = listing.item_location?.trim() || listing.seller_country || "Kathmandu, Nepal";
  const reviews = Number(listing.positive_count || 0) + Number(listing.neutral_count || 0) + Number(listing.negative_count || 0);
  const positive = reviews > 0 ? Math.round(Number(listing.seller_feedback_score || 0)) : null;
  const rating = reviews > 0 ? Math.max(1, Math.round((Number(positive) / 20) * 10) / 10) : null;
  const compareAt = Number(listing.price || 0);
  const showWas = isAuction && compareAt > price && compareAt > 0;
  const off = showWas ? Math.round(((compareAt - price) / compareAt) * 100) : 0;
  const memberYear = listing.seller_created_at ? new Date(listing.seller_created_at).getFullYear() : 2026;
  const visibleThumbs = thumbs.slice(0, 4);
  const extraThumbs = Math.max(0, thumbs.length - 4);

  useEffect(() => {
    loadWatchIds().then((ids) => setSaved(ids.has(listing.id)));
  }, [listing.id]);

  useEffect(() => {
    if (!getToken()) return;
    accountApi<{ user: { username?: string | null; email?: string | null } }>("/api/v1/account")
      .then((body) => {
        const mine =
          (body.user.username && listing.seller_username && body.user.username === listing.seller_username) ||
          (body.user.email && listing.seller_email && body.user.email === listing.seller_email);
        setIsOwner(Boolean(mine));
      })
      .catch(() => undefined);
    if (listing.seller_id) {
      accountApi<{ following: boolean }>(`/api/v1/account/follow/${listing.seller_id}`)
        .then((body) => setFollowing(Boolean(body.following)))
        .catch(() => undefined);
    }
  }, [listing.id, listing.seller_id, listing.seller_username, listing.seller_email]);

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

  const minNext = useMemo(
    () => (bidCount > 0 ? price + increment : Number(listing.auction_start_price || price)),
    [bidCount, price, increment, listing.auction_start_price],
  );
  const hero = photos[index] || thumbs[index] || "/logo.png";
  const displayPrice = isAuction ? price : Number(selectedSku?.price ?? listing.price ?? 0);

  function step(direction: number) {
    if (photos.length < 2) return;
    setIndex((current) => (current + direction + photos.length) % photos.length);
  }

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  function requireAuth() {
    if (getToken()) return true;
    router.push(`/login?redirect=/listing/${listing.id}`);
    return false;
  }

  async function placeBid() {
    if (isOwner) {
      router.push(`/sell/edit/${listing.id}`);
      return;
    }
    if (!requireAuth()) return;
    const amount = Number(maxBid || minNext);
    if (!Number.isFinite(amount) || amount < minNext) {
      setNotice(`Enter a maximum bid of at least ${money(minNext)}.`);
      bidInputRef.current?.focus();
      return;
    }
    setBidBusy(true);
    try {
      const body = await accountApi<{ youLead?: boolean }>(`/api/v1/auctions/${listing.id}/bid`, {
        method: "POST",
        body: JSON.stringify({ maxAmount: amount }),
      });
      setNotice(body.youLead ? "You are the high bidder." : "Bid placed, but another bidder still leads.");
    } finally {
      setBidBusy(false);
    }
  }

  async function sendOffer() {
    if (!requireAuth()) return;
    await accountApi("/api/v1/offers", { method: "POST", body: JSON.stringify({ listingId: listing.id, amount: Number(offer) }) });
    setNotice("Offer sent. The seller has 48 hours to respond.");
    setOffer("");
  }

  async function contactSeller() {
    if (isOwner) {
      router.push("/account?tab=messages");
      return;
    }
    if (!requireAuth()) return;
    if (!message.trim()) {
      setNotice("Write a question for the seller first.");
      return;
    }
    setMessageBusy(true);
    try {
      const convo = await accountApi<{ data: { id: number } }>("/api/v1/conversations", {
        method: "POST",
        body: JSON.stringify({ sellerId: listing.seller_id, listingId: listing.id, subject: listing.title }),
      });
      await accountApi(`/api/v1/conversations/${convo.data.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: message.trim() }),
      });
      setMessage("");
      setNotice("Message sent. Opening your inbox…");
      router.push("/account?tab=messages");
    } finally {
      setMessageBusy(false);
    }
  }

  async function buyNow() {
    if (isOwner) {
      router.push(`/sell/edit/${listing.id}`);
      return;
    }
    if (!requireAuth()) return;
    if (variations.length && !selectedSku) {
      setNotice("Select size and color first.");
      return;
    }
    await addToCart({
      listingId: listing.id,
      quantity: qty,
      title: listing.title,
      photo: photos[0] ?? null,
      price: Number(selectedSku?.price ?? listing.price ?? 0),
      seller: sellerName,
      variationSkuId: selectedSku?.id ?? null,
    });
    window.location.href = "/cart";
  }

  async function saveWatch() {
    if (!requireAuth()) return;
    const currently = saved;
    setWatchBusy(true);
    try {
      await toggleWatch({
        listingId: listing.id,
        saved: currently,
        title: listing.title,
        photo: photos[0] ?? null,
        price: Number(listing.price || price),
      });
      setSaved(!currently);
      setNotice(currently ? "Removed from your watchlist." : "Saved to your watchlist.");
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not update watchlist");
    } finally {
      setWatchBusy(false);
    }
  }

  async function toggleFollow() {
    if (isOwner) {
      router.push(`/seller/${encodeURIComponent(sellerName)}`);
      return;
    }
    if (!requireAuth()) return;
    setFollowBusy(true);
    try {
      const next = !following;
      await accountApi("/api/v1/account/follow", {
        method: next ? "POST" : "DELETE",
        body: JSON.stringify({ sellerId: listing.seller_id }),
      });
      setFollowing(next);
      setNotice(next ? `You are following ${sellerName}.` : `Unfollowed ${sellerName}.`);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not update follow");
    } finally {
      setFollowBusy(false);
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "shipping", label: "Shipping & Returns" },
    { id: "seller", label: "Seller Info" },
    { id: "reviews", label: "Reviews" },
  ];

  return (
    <>
      <main className="bg-white">
        <div className="page-shell py-4 lg:py-5">
          <nav className="flex flex-wrap items-center gap-1.5 text-[13px] text-[#8b93a1]" aria-label="Breadcrumb">
            <Link href="/" className="font-medium text-[#3665f3] hover:underline">Home</Link>
            <Icon name="chevron" className="text-[#c5cedb]" />
            <Link href={`/categories/${listing.category_slug || "electronics"}`} className="font-medium text-[#3665f3] hover:underline">
              {listing.category_name || "Electronics"}
            </Link>
            <Icon name="chevron" className="text-[#c5cedb]" />
            <span className="max-w-[280px] truncate text-[#5b6780]">{title}</span>
          </nav>

          <div className="mt-4 grid items-start gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.95fr)_minmax(300px,340px)]">
            <section>
              <div className="grid grid-cols-[64px_minmax(0,1fr)] gap-3 sm:grid-cols-[72px_minmax(0,1fr)]">
                <div className="flex flex-col gap-2">
                  {visibleThumbs.map((src, i) => {
                    const last = i === visibleThumbs.length - 1 && extraThumbs > 0;
                    return (
                      <button
                        key={`${src}-${i}`}
                        type="button"
                        onClick={() => setIndex(last ? 4 : i)}
                        className={`relative h-16 w-16 overflow-hidden rounded-xl border-2 bg-[#f4f7fb] sm:h-[72px] sm:w-[72px] ${index === i ? "border-[#3665f3]" : "border-transparent"}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="" className="h-full w-full object-cover" />
                        {last ? (
                          <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-[13px] font-semibold text-white">+{extraThumbs}</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                <div className="relative overflow-hidden rounded-2xl bg-[#f4f7fb]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={hero} alt={title} className="h-[420px] w-full object-cover sm:h-[480px]" />
                  <div className="absolute right-3 top-3 flex gap-2">
                    <button type="button" aria-label={saved ? "Saved" : "Save"} onClick={() => saveWatch().catch(() => undefined)} className={`flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-sm ${saved ? "text-[#ef3b3b]" : "text-[#5b6780]"}`}>
                      <Icon name="heart" />
                    </button>
                    <button type="button" aria-label={copied ? "Copied" : "Share"} onClick={share} className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#5b6780] shadow-sm">
                      <Icon name="share" />
                    </button>
                  </div>
                  {photos.length > 1 ? (
                    <>
                      <button type="button" aria-label="Previous photo" onClick={() => step(-1)} className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-sm">
                        <span className="rotate-180"><Icon name="chevron" /></span>
                      </button>
                      <button type="button" aria-label="Next photo" onClick={() => step(1)} className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white shadow-sm">
                        <Icon name="chevron" />
                      </button>
                    </>
                  ) : null}
                  <span className="absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-[11px] font-medium text-white">
                    {Math.min(index + 1, Math.max(photos.length, 1))}/{Math.max(photos.length, 1)}
                  </span>
                </div>
              </div>

              <div className="mt-5 flex gap-5 overflow-x-auto border-b border-[#e8eef5]">
                {tabs.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className="shrink-0 border-b-2 pb-2.5 text-[13.5px] font-semibold"
                    style={{
                      borderColor: tab === item.id ? "#3665f3" : "transparent",
                      color: tab === item.id ? "#3665f3" : "#6b7587",
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="min-w-0 pt-1">
              {tab === "overview" ? (
                <>
                  <p className="text-[13px] font-semibold text-[#0d9488]">{listing.category_name || "Electronics"}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-[#0f1c3f]">{title}</h1>
                    {listing.condition_name ? (
                      <span className="rounded-full bg-[#e8f8ee] px-2.5 py-1 text-[12px] font-semibold text-[#16a34a]">
                        {listing.condition_name} Condition
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap items-end gap-2.5">
                    <p className="text-[30px] font-extrabold leading-none text-[#0f1c3f]">{money(displayPrice)}</p>
                    {showWas ? <p className="text-[15px] text-[#98a2b3] line-through">{money(compareAt)}</p> : null}
                    {off > 0 ? <span className="text-[13px] font-semibold text-[#16a34a]">{off}% OFF</span> : null}
                  </div>
                  {isAuction ? (
                    <p className="mt-2 text-[13px] text-[#6b7587]">
                      {bidCount} bids · {countdown(endsAt)} left
                      <span className="sr-only">{tick}</span>
                    </p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                    <Trust icon="truck">{listing.shipping_free ? "Free shipping" : money(Number(listing.shipping_cost || 0))}</Trust>
                    <Trust icon="pin">{location}</Trust>
                    <Trust icon="lock">Secure payment</Trust>
                    <Trust icon="return">7-day returns</Trust>
                    <Trust icon="badge">Verified seller</Trust>
                  </div>

                  <h2 className="mt-7 text-[15px] font-bold text-[#0f1c3f]">Key details</h2>
                  <dl className="mt-3 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                    {[
                      { icon: "box" as const, label: "Condition", value: listing.condition_name || "Used" },
                      { icon: "tag" as const, label: "Brand", value: listing.brand_name || "N/A" },
                      { icon: "grid" as const, label: "Category", value: listing.category_name || "N/A" },
                      { icon: "clock" as const, label: "Posted", value: postedAgo(listing.published_at || listing.created_at) },
                    ].map((row) => (
                      <div key={row.label} className="flex items-start gap-3">
                        <span className="mt-0.5 text-[#8a94a6]"><Icon name={row.icon} /></span>
                        <div>
                          <dt className="text-[12px] text-[#8a94a6]">{row.label}</dt>
                          <dd className="text-[13.5px] font-semibold text-[#0f1c3f]">{row.value}</dd>
                        </div>
                      </div>
                    ))}
                  </dl>

                  <div className="mt-6 flex items-start gap-3 rounded-2xl bg-[#eef4ff] px-4 py-3">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#3665f3] text-white">
                      <Icon name="check" className="h-3 w-3" />
                    </span>
                    <div>
                      <p className="text-[13.5px] font-semibold text-[#0f1c3f]">This item is covered by Nexlo&apos;s Buyer Protection</p>
                      <p className="mt-0.5 text-[12.5px] text-[#5b6780]">
                        Shop with confidence.{" "}
                        <Link href="/help/returns" className="font-medium text-[#3665f3] hover:underline">Learn more</Link>
                      </p>
                    </div>
                  </div>

                  <h2 className="mt-7 text-[15px] font-bold text-[#0f1c3f]">Description</h2>
                  <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-[#4b5563]">
                    {listing.description || listing.subtitle || "No description yet."}
                  </p>
                </>
              ) : null}

              {tab === "shipping" ? (
                <div className="space-y-3 text-[14px] leading-relaxed text-[#4b5563]">
                  <h2 className="text-[18px] font-bold text-[#0f1c3f]">Shipping & Returns</h2>
                  <p>{listing.shipping_free ? "Free shipping" : `Shipping ${money(Number(listing.shipping_cost || 0))}`} from {location}.</p>
                  <p>Returns are accepted within 7 days if the item is not as described. Nexlo Buyer Protection covers eligible orders.</p>
                  {isAuction ? <p>This auction ends in {countdown(endsAt)}.</p> : null}
                </div>
              ) : null}

              {tab === "seller" ? (
                <div className="space-y-3 text-[14px] leading-relaxed text-[#4b5563]">
                  <h2 className="text-[18px] font-bold text-[#0f1c3f]">Seller info</h2>
                  <p>
                    <Link href={`/seller/${encodeURIComponent(sellerName)}`} className="font-semibold text-[#3665f3] hover:underline">{sellerName}</Link>
                    {" "}has been a member since {memberYear}.
                  </p>
                  <p>{reviews ? `${positive}% positive feedback from ${reviews.toLocaleString()} reviews.` : "No reviews yet."}</p>
                  <p>Ships from {location}.</p>
                </div>
              ) : null}

              {tab === "reviews" ? (
                <div className="space-y-3 text-[14px] leading-relaxed text-[#4b5563]">
                  <h2 className="text-[18px] font-bold text-[#0f1c3f]">Reviews</h2>
                  <p>{reviews ? `${reviews} seller reviews · ${positive}% positive.` : "No reviews on this seller yet."}</p>
                </div>
              ) : null}
            </section>

            <aside className="space-y-3 xl:sticky xl:top-24">
              <div className="rounded-2xl border border-[#e7eef6] bg-white p-4 shadow-[0_8px_30px_-18px_rgba(15,28,63,0.25)]">
                <div className="flex items-start gap-3">
                  {listing.seller_avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={listing.seller_avatar} alt="" className="h-12 w-12 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e8eefc] text-[16px] font-extrabold text-[#3665f3]">
                      {sellerName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 font-bold text-[#0f1c3f]">
                      <Link href={`/seller/${encodeURIComponent(sellerName)}`} className="truncate hover:underline">{sellerName}</Link>
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#3665f3] text-white" title="Verified">
                        <Icon name="check" className="h-2.5 w-2.5" />
                      </span>
                    </p>
                    <p className="text-[12px] text-[#8a94a6]">Member since {memberYear}</p>
                  </div>
                  <button
                    type="button"
                    disabled={followBusy}
                    onClick={() => toggleFollow().catch((err) => setNotice(err instanceof Error ? err.message : "Could not follow"))}
                    className="h-8 rounded-full border border-[#d7e0ec] px-3 text-[12.5px] font-semibold text-[#3665f3] disabled:opacity-60"
                  >
                    {isOwner ? "Your shop" : followBusy ? "…" : following ? "Following" : "Follow"}
                  </button>
                </div>
                <p className="mt-3 flex flex-wrap items-center gap-1.5 text-[12.5px] text-[#5b6780]">
                  {rating != null ? (
                    <>
                      <span className="text-[#f5b400]"><Icon name="star" /></span>
                      <span className="font-semibold text-[#0f1c3f]">{rating.toFixed(1)}</span>
                      <span>({reviews.toLocaleString()} reviews)</span>
                      <span className="text-[#16a34a]">· {positive}% positive feedback</span>
                    </>
                  ) : (
                    <span>New seller · no reviews yet</span>
                  )}
                </p>
              </div>

              <div className="rounded-2xl border border-[#e7eef6] bg-white p-4 shadow-[0_8px_30px_-18px_rgba(15,28,63,0.25)]">
                <div className="flex flex-wrap items-end gap-2">
                  <p className="text-[26px] font-extrabold leading-none text-[#0f1c3f]">{money(displayPrice)}</p>
                  {showWas ? <p className="text-[13px] text-[#98a2b3] line-through">{money(compareAt)}</p> : null}
                  {off > 0 ? <span className="text-[12.5px] font-semibold text-[#16a34a]">{off}% OFF</span> : null}
                </div>
                <p className="mt-2 text-[13px] text-[#16a34a]">{listing.shipping_free ? "Free shipping" : money(Number(listing.shipping_cost || 0))}</p>

                {notice ? <p className="mt-3 rounded-xl bg-[#eef4ff] px-3 py-2 text-[13px] text-[#3665f3]">{notice}</p> : null}

                {variations.length ? (
                  <div className="mt-3 space-y-2">
                    {variations.map((variation) => (
                      <label key={variation.id} className="block text-[12.5px] font-semibold text-[#0f1c3f]">
                        {variation.name}
                        <select
                          className="mt-1 h-10 w-full rounded-full border border-[#e2e8f0] px-3 font-normal"
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
                  </div>
                ) : null}

                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-[13px] font-semibold text-[#0f1c3f]">Quantity</span>
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 items-center rounded-full border border-[#e2e8f0]">
                      <button type="button" aria-label="Decrease quantity" className="w-8 text-[16px]" onClick={() => setQty((n) => Math.max(1, n - 1))}>−</button>
                      <span className="w-6 text-center text-[13.5px] font-semibold">{qty}</span>
                      <button type="button" aria-label="Increase quantity" className="w-8 text-[16px]" onClick={() => setQty((n) => Math.min(stock, n + 1))}>+</button>
                    </div>
                    <span className="text-[12px] font-medium text-[#16a34a]">Only {stock} left in stock</span>
                  </div>
                </div>

                {isOwner ? (
                  <>
                    <Link
                      href={`/sell/edit/${listing.id}`}
                      className="mt-4 flex h-11 w-full items-center justify-center rounded-full bg-[#3665f3] text-[14.5px] font-semibold text-white hover:bg-[#2953c6]"
                    >
                      Edit listing
                    </Link>
                    <Link
                      href="/sell/listings"
                      className="mt-2 flex h-11 w-full items-center justify-center rounded-full border border-[#d7e0ec] text-[14px] font-semibold text-[#0f1c3f]"
                    >
                      Manage listings
                    </Link>
                  </>
                ) : (
                  <>
                    {isAuction ? (
                      <button
                        type="button"
                        disabled={!live || bidBusy}
                        className="mt-4 h-11 w-full rounded-full bg-[#3665f3] text-[14.5px] font-semibold text-white hover:bg-[#2953c6] disabled:opacity-60"
                        onClick={() => placeBid().catch((err) => setNotice(err instanceof Error ? err.message : "Bid failed"))}
                      >
                        {bidBusy ? "Placing bid…" : "Place bid"}
                      </button>
                    ) : null}

                    {isFixed && live ? (
                      <button
                        type="button"
                        className={`${isAuction ? "mt-2" : "mt-4"} h-11 w-full rounded-full bg-[#3665f3] text-[14.5px] font-semibold text-white hover:bg-[#2953c6]`}
                        onClick={() => buyNow().catch((err) => setNotice(err instanceof Error ? err.message : "Could not add to cart"))}
                      >
                        Buy it now
                      </button>
                    ) : null}
                  </>
                )}

                <button
                  type="button"
                  disabled={watchBusy}
                  onClick={() => saveWatch().catch((err) => setNotice(err instanceof Error ? err.message : "Could not update watchlist"))}
                  className="mt-2 h-11 w-full rounded-full border border-[#d7e0ec] text-[14px] font-semibold text-[#0f1c3f] disabled:opacity-60"
                >
                  {watchBusy ? "Saving…" : saved ? "Saved to Watchlist" : "Add to Watchlist"}
                </button>

                {isAuction && !isOwner ? (
                  <form
                    className="mt-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      placeBid().catch((err) => setNotice(err instanceof Error ? err.message : "Bid failed"));
                    }}
                  >
                    <label className="text-[12.5px] font-medium text-[#5b6780]">Enter your maximum bid (NPR)</label>
                    <div className="mt-1.5 flex gap-2">
                      <input
                        ref={bidInputRef}
                        value={maxBid}
                        onChange={(e) => setMaxBid(e.target.value)}
                        placeholder={String(minNext)}
                        className="h-10 flex-1 rounded-full border border-[#e2e8f0] px-4 text-[14px]"
                        disabled={!live || bidBusy}
                      />
                      <button type="submit" className="h-10 rounded-full bg-[#3665f3] px-4 text-[13px] font-semibold text-white disabled:opacity-60" disabled={!live || bidBusy}>
                        {bidBusy ? "…" : "Place bid"}
                      </button>
                    </div>
                    <p className="mt-2 text-[11.5px] leading-snug text-[#8a94a6]">
                      By placing a bid, you agree to Nexlo&apos;s Terms of Service and Privacy Policy.
                    </p>
                    <ul className="mt-3 space-y-1 text-[12px] text-[#5b6780]">
                      {bids.slice(0, 4).map((b, i) => (
                        <li key={`${b.created_at}-${i}`}>{money(b.amount)} · {b.bidder}</li>
                      ))}
                    </ul>
                  </form>
                ) : null}

                {isOwner && isAuction ? (
                  <ul className="mt-4 space-y-1 text-[12px] text-[#5b6780]">
                    {bids.length ? bids.slice(0, 6).map((b, i) => (
                      <li key={`${b.created_at}-${i}`}>{money(b.amount)} · {b.bidder}</li>
                    )) : <li>No bids yet.</li>}
                  </ul>
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
                    <button className="h-10 rounded-full border border-[#3665f3] px-4 text-[13px] font-semibold text-[#3665f3]">Make offer</button>
                  </form>
                ) : null}
              </div>

              <form
                className="rounded-2xl border border-[#e7eef6] bg-white p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  contactSeller().catch((err) => setNotice(err instanceof Error ? err.message : "Could not message seller"));
                }}
              >
                <p className="flex items-center gap-2 text-[13.5px] font-semibold text-[#0f1c3f]">
                  <span className="text-[#3665f3]"><Icon name="chat" /></span>
                  {isOwner ? "Buyer messages" : "Have a question?"}
                </p>
                {isOwner ? (
                  <Link href="/account?tab=messages" className="mt-2 inline-block text-[13px] font-semibold text-[#3665f3]">
                    Open inbox
                  </Link>
                ) : (
                  <>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Message the seller before buying."
                      className="mt-2 min-h-16 w-full rounded-xl border border-[#e2e8f0] px-3 py-2 text-[13px]"
                    />
                    <button type="submit" disabled={messageBusy} className="mt-2 text-[13px] font-semibold text-[#3665f3] disabled:opacity-60">
                      {messageBusy ? "Sending…" : "Message seller"}
                    </button>
                  </>
                )}
              </form>
            </aside>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
