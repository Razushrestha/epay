"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { accountApi, apiBase, getToken } from "@/lib/account-api";
import { addToCart, loadWatchIds, toggleWatch } from "@/lib/commerce";
import { SaveToCollection } from "@/components/listing/SaveToCollection";
import { WatchlistIcon } from "@/components/commerce/WatchlistIcon";
import { DsrBars } from "@/components/seller/DsrBars";

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
  seller_public_id?: string | null;
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
  shipping_additional?: number | null;
  compare_at?: number | null;
  item_location?: string | null;
  published_at?: string | null;
  created_at?: string | null;
  auction_start_price?: number | null;
  auction_current_price?: number | null;
  auction_bid_count?: number | null;
  auction_ends_at?: string | null;
  photos?: { url: string; thumbnail_url?: string | null; is_primary?: boolean }[] | null;
  variations?: { id: number; name: string; options: { id: number; value: string; photo_url?: string | null }[] | null }[] | null;
  skus?: { id: number; combination: Record<string, string>; price: number | null; quantity: number }[] | null;
  specifics?: Record<string, string> | null;
  questions?: { id: number; question: string; answer: string | null; created_at: string; answered_at?: string | null; asker?: string }[] | null;
  dsr?: { count: number; item: number | null; communication: number | null; shipping_time: number | null; shipping_cost: number | null } | null;
};

type Bid = { amount: number; created_at: string; bidder: string };
type Tab = "overview" | "shipping" | "seller" | "reviews" | "qa";
type SimilarItem = {
  id: number;
  title: string;
  price: number | null;
  auction_current_price?: number | null;
  primary_photo: string | null;
};

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
  name: "chevron" | "heart" | "share" | "truck" | "pin" | "lock" | "return" | "badge" | "box" | "tag" | "grid" | "clock" | "star" | "check" | "chat" | "cart" | "bookmark";
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
  if (name === "cart") {
    return (
      <svg {...common}>
        <circle cx="9" cy="20" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="17" cy="20" r="1.3" fill="currentColor" stroke="none" />
        <path d="M3 4h2l2.2 11h10.3a1 1 0 0 0 1-.8L21 8H7" />
      </svg>
    );
  }
  if (name === "bookmark") return <svg {...common}><path d="M7 4h10a1 1 0 0 1 1 1v15l-6-3.2L6 20V5a1 1 0 0 1 1-1Z" /></svg>;
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
  const [youLead, setYouLead] = useState(false);
  const [canRetract, setCanRetract] = useState(false);
  const [bidBusy, setBidBusy] = useState(false);
  const [watchBusy, setWatchBusy] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [messageBusy, setMessageBusy] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [tick, setTick] = useState(0);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [dest, setDest] = useState("");
  const [quote, setQuote] = useState<{ amount: number; label: string; combinedAdditional?: number } | null>(null);
  const [quoteBusy, setQuoteBusy] = useState(false);
  const [similar, setSimilar] = useState<SimilarItem[]>([]);
  const [questions, setQuestions] = useState(listing.questions || []);
  const [askText, setAskText] = useState("");
  const [answerDraft, setAnswerDraft] = useState<Record<number, string>>({});
  const [qaBusy, setQaBusy] = useState(false);
  const isAuction = listing.format === "auction" || listing.format === "both";
  const isFixed = listing.format === "fixed" || listing.format === "both";
  const live = listing.status === "active";
  const variations = (listing.variations || []).filter((v) => v.options?.length);
  const selectedSku = (listing.skus || []).find((sku) =>
    variations.every((v) => sku.combination?.[v.name] === picked[v.name]),
  );
  const stock = selectedSku?.quantity ?? listing.quantity ?? 1;
  const sellerName = listing.seller_username || listing.seller_full_name || "Seller";
  const sellerHref = `/seller/${encodeURIComponent(listing.seller_username || listing.seller_public_id || String(listing.seller_id))}`;
  const title = prettyTitle(listing.title);
  const location = listing.item_location?.trim() || listing.seller_country || "Kathmandu, Nepal";
  const reviews = Number(listing.positive_count || 0) + Number(listing.neutral_count || 0) + Number(listing.negative_count || 0);
  const positive = reviews > 0 ? Math.round(Number(listing.seller_feedback_score || 0)) : null;
  const rating = reviews > 0 ? Math.max(1, Math.round((Number(positive) / 20) * 10) / 10) : null;
  const compareAt = Number(listing.compare_at || 0);
  const memberYear = listing.seller_created_at ? new Date(listing.seller_created_at).getFullYear() : 2026;
  const visibleThumbs = thumbs.slice(0, 4);
  const extraThumbs = Math.max(0, thumbs.length - 4);

  useEffect(() => {
    loadWatchIds().then((ids) => setSaved(ids.has(listing.id)));
    fetch(`${apiBase}/api/v1/listings/${listing.id}/similar`)
      .then((res) => res.json())
      .then((body) => setSimilar(body.listings || []))
      .catch(() => setSimilar([]));
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
    accountApi<{ listing: Listing; bids: Bid[]; increment: number; youLead?: boolean; canRetract?: boolean }>(`/api/v1/auctions/${listing.id}`)
      .then((snap) => {
        if (snap.listing) {
          setPrice(Number(snap.listing.auction_current_price || price));
          setBidCount(Number(snap.listing.auction_bid_count || 0));
          setEndsAt(snap.listing.auction_ends_at);
        }
        setBids(snap.bids || []);
        if (snap.increment) setIncrement(snap.increment);
        if (typeof snap.youLead === "boolean") setYouLead(snap.youLead);
        if (typeof snap.canRetract === "boolean") setCanRetract(snap.canRetract);
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
  const variationPhoto = variations
    .flatMap((v) => (v.options || []).map((opt) => ({ name: v.name, value: opt.value, photo: opt.photo_url })))
    .find((opt) => picked[opt.name] === opt.value && opt.photo)?.photo;
  const hero = variationPhoto || photos[index] || thumbs[index] || "/logo.png";
  const displayPrice = isAuction ? price : Number(selectedSku?.price ?? listing.price ?? 0);
  const showWas = compareAt > displayPrice && compareAt > 0;
  const off = showWas ? Math.round(((compareAt - displayPrice) / compareAt) * 100) : 0;

  async function quoteShipping() {
    setQuoteBusy(true);
    try {
      const res = await fetch(
        `${apiBase}/api/v1/listings/${listing.id}/shipping?destination=${encodeURIComponent(dest)}`,
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Could not quote shipping");
      setQuote(body);
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Could not quote shipping");
    } finally {
      setQuoteBusy(false);
    }
  }

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
      setYouLead(Boolean(body.youLead));
      setCanRetract(true);
      setNotice(body.youLead ? "You are the high bidder." : "Bid placed, but another bidder still leads.");
    } finally {
      setBidBusy(false);
    }
  }

  async function retractBid() {
    if (!requireAuth()) return;
    setBidBusy(true);
    try {
      await accountApi(`/api/v1/auctions/${listing.id}/retract`, { method: "POST", body: "{}" });
      setYouLead(false);
      setCanRetract(false);
      setNotice("Bid retracted. You can bid again.");
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

  async function askQuestion() {
    if (!requireAuth()) return;
    if (askText.trim().length < 10) {
      setNotice("Questions need at least 10 characters.");
      return;
    }
    setQaBusy(true);
    try {
      const body = await accountApi<{ question: { id: number; question: string; created_at: string } }>(
        `/api/v1/listings/${listing.id}/question`,
        { method: "POST", body: JSON.stringify({ question: askText.trim() }) },
      );
      setQuestions((current) => [
        { id: body.question.id, question: body.question.question, answer: null, created_at: body.question.created_at, asker: "You" },
        ...current,
      ]);
      setAskText("");
      setNotice("Question posted. The seller will answer on this page.");
      setTab("qa");
    } finally {
      setQaBusy(false);
    }
  }

  async function answerQuestion(id: number) {
    const answer = String(answerDraft[id] || "").trim();
    if (!answer) return;
    setQaBusy(true);
    try {
      await accountApi(`/api/v1/listings/questions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ answer }),
      });
      setQuestions((current) =>
        current.map((q) => (q.id === id ? { ...q, answer, answered_at: new Date().toISOString() } : q)),
      );
      setAnswerDraft((current) => ({ ...current, [id]: "" }));
      setNotice("Answer posted.");
    } finally {
      setQaBusy(false);
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
    { id: "qa", label: `Q&A${questions.length ? ` (${questions.length})` : ""}` },
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

          <div className="mt-4 grid items-start gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)_minmax(300px,340px)]">
            <section>
              <div className="grid grid-cols-[68px_minmax(0,1fr)] gap-3 sm:grid-cols-[76px_minmax(0,1fr)]">
                <div className="flex flex-col gap-2">
                  {(visibleThumbs.length ? visibleThumbs : [hero]).map((src, i) => {
                    const last = i === visibleThumbs.length - 1 && extraThumbs > 0;
                    return (
                      <button
                        key={`${src}-${i}`}
                        type="button"
                        onClick={() => setIndex(last ? 4 : i)}
                        className={`relative h-[68px] w-[68px] overflow-hidden rounded-xl border-2 bg-white sm:h-[72px] sm:w-[72px] ${index === i ? "border-[#3665f3]" : "border-[#e6ebf2]"}`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt="" className="h-full w-full object-contain p-1" />
                        {last ? (
                          <span className="absolute inset-0 flex items-center justify-center bg-black/45 text-[13px] font-semibold text-white">+{extraThumbs}</span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>

                <div className="relative overflow-hidden rounded-2xl border border-[#e7eef8] bg-[linear-gradient(145deg,#f4f8ff_0%,#e7f0ff_42%,#f8fbff_100%)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={hero} alt={title} className="h-[420px] w-full object-contain p-6 sm:h-[460px]" />
                  <div className="absolute right-3 top-3 z-10 flex gap-2">
                    <button type="button" aria-label={saved ? "Remove from watchlist" : "Add to watchlist"} onClick={() => saveWatch().catch(() => undefined)} className={`flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md ${saved ? "text-[#e53238]" : "text-[#0f1c3f]"}`}>
                      <WatchlistIcon saved={saved} size={18} />
                    </button>
                    <button type="button" aria-label={copied ? "Copied" : "Share"} onClick={share} className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#0f1c3f] shadow-md">
                      <Icon name="share" />
                    </button>
                  </div>
                  {photos.length > 1 ? (
                    <>
                      <button type="button" aria-label="Previous photo" onClick={() => step(-1)} className="absolute left-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#0f1c3f] shadow-md">
                        <span className="rotate-180"><Icon name="chevron" /></span>
                      </button>
                      <button type="button" aria-label="Next photo" onClick={() => step(1)} className="absolute right-3 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#0f1c3f] shadow-md">
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
                  <h1 className="text-[26px] font-extrabold leading-tight tracking-tight text-[#0f1c3f] sm:text-[28px]">{title}</h1>
                  {listing.condition_name ? (
                    <span className="mt-2 inline-flex rounded-full bg-[#e8f8ee] px-2.5 py-1 text-[12px] font-semibold text-[#16a34a]">
                      {listing.condition_name} Condition
                    </span>
                  ) : null}
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

                  <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
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
                      ...Object.entries(listing.specifics || {})
                        .filter(([, value]) => String(value || "").trim())
                        .map(([label, value]) => ({ icon: "tag" as const, label, value: String(value) })),
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
                        <Link href="/buyer-protection" className="font-medium text-[#3665f3] hover:underline">Learn more</Link>
                      </p>
                    </div>
                  </div>

                  <h2 className="mt-7 text-[15px] font-bold text-[#0f1c3f]">Description</h2>
                  <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed text-[#4b5563]">
                    {listing.description || listing.subtitle || "No description yet."}
                  </p>
                  {isAuction ? (
                    <div className="mt-8">
                      <h2 className="text-[15px] font-bold text-[#0f1c3f]">Bid history ({bidCount})</h2>
                      {bids.length ? (
                        <table className="mt-3 w-full text-left text-[13px]">
                          <thead>
                            <tr className="border-b border-[#e8eef5] text-[#8a94a6]">
                              <th className="pb-2 font-medium">Bidder</th>
                              <th className="pb-2 font-medium">Bid</th>
                              <th className="pb-2 font-medium">Time</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bids.map((bid, i) => (
                              <tr key={`${bid.created_at}-${i}`} className="border-b border-[#f3f6fa]">
                                <td className="py-2 text-[#0f1c3f]">{bid.bidder}</td>
                                <td className="py-2 font-semibold">{money(Number(bid.amount))}</td>
                                <td className="py-2 text-[#8a94a6]">{new Date(bid.created_at).toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="mt-2 text-[13px] text-[#8a94a6]">No bids yet. Be the first.</p>
                      )}
                    </div>
                  ) : null}
                </>
              ) : null}

              {tab === "qa" ? (
                <div className="space-y-4 text-[14px] leading-relaxed text-[#4b5563]">
                  <h2 className="text-[18px] font-bold text-[#0f1c3f]">Questions and answers</h2>
                  {questions.length ? (
                    <ul className="space-y-3">
                      {questions.map((item) => (
                        <li key={item.id} className="rounded-2xl border border-[#e7eef6] p-3">
                          <p className="font-semibold text-[#0f1c3f]">Q: {item.question}</p>
                          <p className="mt-1 text-[12px] text-[#8a94a6]">{item.asker || "Member"} · {new Date(item.created_at).toLocaleDateString()}</p>
                          {item.answer ? (
                            <p className="mt-2 text-[#4b5563]">A: {item.answer}</p>
                          ) : isOwner ? (
                            <form
                              className="mt-2 flex gap-2"
                              onSubmit={(e) => {
                                e.preventDefault();
                                answerQuestion(item.id).catch((err) => setNotice(err instanceof Error ? err.message : "Could not answer"));
                              }}
                            >
                              <input
                                value={answerDraft[item.id] || ""}
                                onChange={(e) => setAnswerDraft((current) => ({ ...current, [item.id]: e.target.value }))}
                                placeholder="Write an answer"
                                className="h-10 flex-1 rounded-full border border-[#e2e8f0] px-3"
                              />
                              <button className="h-10 rounded-full bg-[#3665f3] px-4 text-[13px] font-semibold text-white" disabled={qaBusy}>
                                Answer
                              </button>
                            </form>
                          ) : (
                            <p className="mt-2 text-[13px] text-[#8a94a6]">Waiting for the seller.</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>No questions yet. Ask the seller about this item.</p>
                  )}
                  {!isOwner ? (
                    <form
                      className="space-y-2 rounded-2xl border border-[#e7eef6] bg-[#f8fbff] p-3"
                      onSubmit={(e) => {
                        e.preventDefault();
                        askQuestion().catch((err) => setNotice(err instanceof Error ? err.message : "Could not post question"));
                      }}
                    >
                      <label className="text-[12.5px] font-semibold text-[#0f1c3f]">
                        Ask a public question
                        <textarea
                          value={askText}
                          onChange={(e) => setAskText(e.target.value)}
                          placeholder="Does this include the original charger?"
                          className="mt-1 min-h-20 w-full rounded-xl border border-[#e2e8f0] px-3 py-2 font-normal"
                        />
                      </label>
                      <button type="submit" disabled={qaBusy} className="h-10 rounded-full bg-[#3665f3] px-4 text-[13px] font-semibold text-white disabled:opacity-60">
                        {qaBusy ? "Posting…" : "Post question"}
                      </button>
                    </form>
                  ) : null}
                </div>
              ) : null}

              {tab === "shipping" ? (
                <div className="space-y-3 text-[14px] leading-relaxed text-[#4b5563]">
                  <h2 className="text-[18px] font-bold text-[#0f1c3f]">Shipping & Returns</h2>
                  <p>{listing.shipping_free ? "Free shipping" : `Shipping ${money(Number(listing.shipping_cost || 0))}`} from {location}.</p>
                  {Number(listing.shipping_additional) > 0 ? (
                    <p>Additional item from this seller: {money(Number(listing.shipping_additional))}.</p>
                  ) : null}
                  <form
                    className="flex flex-wrap items-end gap-2 rounded-2xl border border-[#e7eef6] bg-[#f8fbff] p-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      quoteShipping().catch(() => undefined);
                    }}
                  >
                    <label className="min-w-[180px] flex-1 text-[12.5px] font-semibold text-[#0f1c3f]">
                      Destination city
                      <input
                        value={dest}
                        onChange={(e) => setDest(e.target.value)}
                        placeholder="Pokhara, Nepal"
                        className="mt-1 h-10 w-full rounded-full border border-[#e2e8f0] px-3 font-normal"
                      />
                    </label>
                    <button type="submit" disabled={quoteBusy} className="h-10 rounded-full bg-[#3665f3] px-4 text-[13px] font-semibold text-white disabled:opacity-60">
                      {quoteBusy ? "Checking…" : "Calculate shipping"}
                    </button>
                  </form>
                  {quote ? (
                    <p className="text-[14px] font-semibold text-[#0f1c3f]">
                      {quote.label}: {quote.amount > 0 ? money(quote.amount) : "Free"}
                      {quote.combinedAdditional ? ` · extra item ${money(quote.combinedAdditional)}` : ""}
                    </p>
                  ) : null}
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
                  <div className="pt-2">
                    <DsrBars dsr={listing.dsr} />
                  </div>
                </div>
              ) : null}

              {tab === "reviews" ? (
                <div className="space-y-3 text-[14px] leading-relaxed text-[#4b5563]">
                  <h2 className="text-[18px] font-bold text-[#0f1c3f]">Reviews</h2>
                  <p>{reviews ? `${reviews} seller reviews · ${positive}% positive.` : "No reviews on this seller yet."}</p>
                  <DsrBars dsr={listing.dsr} />
                </div>
              ) : null}
            </section>

            <aside className="space-y-3 lg:sticky lg:top-20">
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
                      <Link href={sellerHref} className="truncate hover:underline">{sellerName}</Link>
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
                    className="h-8 rounded-full border border-[#3665f3] px-3.5 text-[12.5px] font-semibold text-[#3665f3] disabled:opacity-60"
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

              <div className="rounded-2xl border border-[#e7eef6] bg-white p-5 shadow-[0_8px_30px_-18px_rgba(15,28,63,0.25)]">
                <div className="flex flex-wrap items-end gap-2">
                  <p className="text-[26px] font-extrabold leading-none text-[#0f1c3f]">{money(displayPrice)}</p>
                  {showWas ? <p className="text-[13px] text-[#98a2b3] line-through">{money(compareAt)}</p> : null}
                  {off > 0 ? <span className="text-[12.5px] font-semibold text-[#16a34a]">{off}% OFF</span> : null}
                </div>
                <p className="mt-2 text-[13px] text-[#16a34a]">{listing.shipping_free ? "Free shipping" : money(Number(listing.shipping_cost || 0))}</p>
                {!live ? <p className="mt-2 text-[13px] font-semibold text-[#e53238]">This listing has ended.</p> : null}
                <button type="button" className="mt-1 text-[12.5px] font-semibold text-[#3665f3] hover:underline" onClick={() => setTab("shipping")}>
                  Calculate shipping to your city
                </button>

                {notice ? <p className="mt-3 rounded-xl bg-[#eef4ff] px-3 py-2 text-[13px] text-[#3665f3]">{notice}</p> : null}

                {variations.length ? (
                  <div className="mt-3 space-y-3">
                    {variations.map((variation) => {
                      const photoOptions = (variation.options || []).filter((opt) => opt.photo_url);
                      return (
                        <div key={variation.id}>
                          <p className="text-[12.5px] font-semibold text-[#0f1c3f]">{variation.name}</p>
                          {photoOptions.length ? (
                            <div className="mt-1.5 flex flex-wrap gap-2">
                              {(variation.options || []).map((opt) => (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => setPicked((current) => ({ ...current, [variation.name]: opt.value }))}
                                  className={`overflow-hidden rounded-xl border ${picked[variation.name] === opt.value ? "border-[#3665f3] ring-2 ring-[#3665f3]/30" : "border-[#e2e8f0]"}`}
                                  title={opt.value}
                                >
                                  {opt.photo_url ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={opt.photo_url} alt={opt.value} className="h-14 w-14 object-cover" />
                                  ) : (
                                    <span className="flex h-14 min-w-14 items-center justify-center px-2 text-[12px]">{opt.value}</span>
                                  )}
                                </button>
                              ))}
                            </div>
                          ) : (
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
                          )}
                        </div>
                      );
                    })}
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
                        className={`${isAuction ? "mt-2" : "mt-4"} inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#3665f3] text-[14.5px] font-semibold text-white hover:bg-[#2953c6]`}
                        onClick={() => buyNow().catch((err) => setNotice(err instanceof Error ? err.message : "Could not add to cart"))}
                      >
                        <Icon name="cart" />
                        Buy it now
                      </button>
                    ) : null}
                  </>
                )}

                <button
                  type="button"
                  disabled={watchBusy}
                  onClick={() => saveWatch().catch((err) => setNotice(err instanceof Error ? err.message : "Could not update watchlist"))}
                  className={`mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border text-[14px] font-semibold disabled:opacity-60 ${
                    saved ? "border-[#e53238] bg-[#fff5f5] text-[#e53238]" : "border-[#d7e0ec] text-[#0f1c3f]"
                  }`}
                >
                  <WatchlistIcon saved={saved} size={16} />
                  {watchBusy ? "Saving…" : saved ? "Saved to watchlist" : "Add to watchlist"}
                </button>
                <SaveToCollection listingId={listing.id} />

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
                    {youLead ? <p className="mt-2 text-[12.5px] font-semibold text-[#12a37e]">You are the high bidder.</p> : null}
                    {canRetract ? (
                      <button
                        type="button"
                        className="mt-2 text-[12.5px] font-semibold text-[#e53238]"
                        disabled={bidBusy}
                        onClick={() => retractBid().catch((err) => setNotice(err instanceof Error ? err.message : "Could not retract"))}
                      >
                        Retract this bid (within 1 hour)
                      </button>
                    ) : null}
                    <p className="mt-2 text-[11.5px] leading-snug text-[#8a94a6]">
                      By placing a bid, you agree to Nexlo&apos;s Terms of Service and Privacy Policy.
                    </p>
                    <ul className="mt-3 space-y-1 text-[12px] text-[#5b6780]">
                      {bids.slice(0, 6).map((b, i) => (
                        <li key={`${b.created_at}-${i}`}>{money(b.amount)} · {b.bidder}</li>
                      ))}
                    </ul>
                    {bids.length > 6 ? (
                      <button type="button" className="mt-2 text-[12.5px] font-semibold text-[#3665f3]" onClick={() => setTab("overview")}>
                        See all {bidCount} bids
                      </button>
                    ) : null}
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
                    className="mt-3 flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      sendOffer().catch((err) => setNotice(err instanceof Error ? err.message : "Offer failed"));
                    }}
                  >
                    <input value={offer} onChange={(e) => setOffer(e.target.value)} placeholder="Best offer" className="h-11 flex-1 rounded-full border border-[#e2e8f0] px-4 text-[14px]" />
                    <button className="h-11 rounded-full border border-[#3665f3] px-5 text-[13.5px] font-semibold text-[#3665f3]">Make offer</button>
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
                  {isOwner ? "Buyer messages" : "Private message"}
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
                      placeholder="Send a private message. Public questions go in Q&A."
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
        {similar.length ? (
          <section className="page-shell pb-10">
            <h2 className="mb-3 text-[18px] font-bold text-[#0f1c3f]">Similar items</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {similar.map((item) => (
                <Link key={item.id} href={`/listing/${item.id}`} className="overflow-hidden rounded-xl border border-[#e7eef6] bg-white hover:shadow-sm">
                  {item.primary_photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.primary_photo} alt="" className="aspect-square w-full object-cover" />
                  ) : (
                    <span className="flex aspect-square items-center justify-center bg-[#f4f8fd] text-[11px] text-[#8a94a6]">No image</span>
                  )}
                  <span className="block p-2">
                    <span className="line-clamp-2 text-[12px] text-[#0f1c3f]">{item.title}</span>
                    <span className="mt-1 block text-[13px] font-bold">{money(Number(item.auction_current_price || item.price || 0))}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </main>
      <SiteFooter />
    </>
  );
}
