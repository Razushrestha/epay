"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { similarProducts, type ProductDetail } from "@/lib/product-detail";
import { addToCart, loadWatchIds, toggleWatch } from "@/lib/commerce";

const blue = "#3665f3";

type RGB = { r: number; g: number; b: number };
type Tone = { accent: string; panel: string; soft: string; line: string; deep: string; onAccent: string };

function hexToRgb(hex: string): RGB {
  const value = Number.parseInt(hex.slice(1), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

function channelMix(channel: number, target: number, amount: number) {
  return channel + (target - channel) * amount;
}

function toHex(r: number, g: number, b: number) {
  const part = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

function hslOf(r: number, g: number, b: number) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (max === rn) h = ((gn - bn) / d) % 6;
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}

function pickColor(data: Uint8ClampedArray): RGB {
  const bins = new Map<number, { r: number; g: number; b: number; n: number }>();
  const gray = { r: 0, g: 0, b: 0, n: 0 };
  let colored = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    if (a < 200) continue;
    const { h, s, l } = hslOf(r, g, b);
    if (l > 0.94) continue;
    gray.r += r;
    gray.g += g;
    gray.b += b;
    gray.n += 1;
    if (s < 0.2 || l < 0.1 || l > 0.9) continue;
    colored += 1;
    const bin = Math.round(h / 20) % 18;
    const slot = bins.get(bin) ?? { r: 0, g: 0, b: 0, n: 0 };
    slot.r += r;
    slot.g += g;
    slot.b += b;
    slot.n += 1;
    bins.set(bin, slot);
  }
  if (colored >= 8) {
    let best: { r: number; g: number; b: number; n: number } | null = null;
    for (const slot of bins.values()) {
      if (!best || slot.n > best.n) best = slot;
    }
    if (best && best.n > 0) return { r: best.r / best.n, g: best.g / best.n, b: best.b / best.n };
  }
  if (gray.n > 0) return { r: gray.r / gray.n, g: gray.g / gray.n, b: gray.b / gray.n };
  return { r: 54, g: 101, b: 243 };
}

function shades(rgb: RGB): Tone {
  const { l } = hslOf(rgb.r, rgb.g, rgb.b);
  let r = rgb.r;
  let g = rgb.g;
  let b = rgb.b;
  if (l > 0.58) {
    const scale = 0.42 / l;
    r *= scale;
    g *= scale;
    b *= scale;
  } else if (l < 0.28) {
    r = channelMix(r, 255, 0.28);
    g = channelMix(g, 255, 0.28);
    b = channelMix(b, 255, 0.28);
  }
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return {
    accent: toHex(r, g, b),
    panel: toHex(channelMix(rgb.r, 255, 0.9), channelMix(rgb.g, 255, 0.9), channelMix(rgb.b, 255, 0.9)),
    soft: toHex(channelMix(rgb.r, 255, 0.78), channelMix(rgb.g, 255, 0.78), channelMix(rgb.b, 255, 0.78)),
    line: toHex(channelMix(rgb.r, 255, 0.7), channelMix(rgb.g, 255, 0.7), channelMix(rgb.b, 255, 0.7)),
    deep: toHex(rgb.r * 0.38, rgb.g * 0.38, rgb.b * 0.38),
    onAccent: luma > 0.64 ? "#172033" : "#ffffff",
  };
}

function useImageShade(src: string, fallbackHex: string) {
  const [tone, setTone] = useState(() => shades(hexToRgb(fallbackHex)));
  useEffect(() => {
    let cancel = false;
    setTone(shades(hexToRgb(fallbackHex)));
    const image = new window.Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 28;
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;
      context.drawImage(image, 0, 0, size, size);
      const color = pickColor(context.getImageData(0, 0, size, size).data);
      if (!cancel) setTone(shades(color));
    };
    image.src = src;
    return () => {
      cancel = true;
    };
  }, [src, fallbackHex]);
  return tone;
}

const taglines: Record<string, string> = {
  electronics: "More power. More possibilities.",
  fashion: "Find the piece that fits.",
  motors: "Parts and accessories, ready to fit.",
  sports: "Gear up for the next session.",
  "health-beauty": "Everyday care, ready to ship.",
  industrial: "Equipment that keeps work moving.",
  "home-garden": "Make the space feel finished.",
  collectibles: "Pieces worth keeping.",
};

const dealBadges = [
  { label: "Best Seller", className: "bg-[#ef3b3b]" },
  { label: "Hot Deal", className: "bg-[#f59e0b]" },
  { label: "Popular", className: "bg-[#7c3aed]" },
  { label: "Trending", className: "bg-[#3b82f6]" },
  { label: "New Arrival", className: "bg-[#22c55e]" },
];

const tabs = ["Description", "Specifications", "Shipping & Returns", "FAQs"] as const;

function Icon({
  name,
  size = 18,
}: {
  name:
    | "signal"
    | "camera"
    | "battery"
    | "shield"
    | "truck"
    | "card"
    | "heart"
    | "share"
    | "cart"
    | "check"
    | "chevron"
    | "star"
    | "store";
  size?: number;
}) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (name === "star") {
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden>
        <path
          fill="currentColor"
          d="m10 1.8 2.4 5.2 5.7.7-4.2 3.9 1.1 5.6L10 14.6 4.9 17.2l1.1-5.6L1.9 7.7l5.7-.7L10 1.8z"
        />
      </svg>
    );
  }
  if (name === "heart") {
    return (
      <svg {...props}>
        <path d="M12 20s-7-4.4-9.2-8.2C1 8.8 2.2 5.5 5.4 4.8 7.2 4.4 8.8 5.1 12 7.4c3.2-2.3 4.8-3 6.6-2.6 3.2.7 4.4 4 2.6 7-2.2 3.8-9.2 8.2-9.2 8.2z" />
      </svg>
    );
  }
  if (name === "share") {
    return (
      <svg {...props}>
        <circle cx="18" cy="5" r="2.2" />
        <circle cx="6" cy="12" r="2.2" />
        <circle cx="18" cy="19" r="2.2" />
        <path d="m8 11 8-5M8 13l8 5" />
      </svg>
    );
  }
  if (name === "cart") {
    return (
      <svg {...props}>
        <path d="M6 7h15l-1.6 8.2a2 2 0 0 1-2 1.6H9.2a2 2 0 0 1-2-1.6L5.2 4H3" />
        <circle cx="9" cy="20" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="17" cy="20" r="1.3" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (name === "check") {
    return (
      <svg {...props}>
        <path d="m5 12 5 5L20 7" />
      </svg>
    );
  }
  if (name === "chevron") {
    return (
      <svg {...props}>
        <path d="m9 6 6 6-6 6" />
      </svg>
    );
  }
  if (name === "signal") {
    return (
      <svg {...props}>
        <path d="M5 12.5a10 10 0 0 1 14 0" />
        <path d="M8 15.5a6 6 0 0 1 8 0" />
        <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (name === "camera") {
    return (
      <svg {...props}>
        <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z" />
        <circle cx="12" cy="13" r="3.2" />
      </svg>
    );
  }
  if (name === "battery") {
    return (
      <svg {...props}>
        <rect x="3" y="7" width="16" height="10" rx="2" />
        <path d="M21 10v4" />
        <path d="M6 10v4M9.5 10v4M13 10v4" />
      </svg>
    );
  }
  if (name === "truck") {
    return (
      <svg {...props}>
        <path d="M3 7h11v8H3zM14 10h4l3 3v2h-7" />
        <circle cx="7" cy="17.5" r="1.5" />
        <circle cx="17" cy="17.5" r="1.5" />
      </svg>
    );
  }
  if (name === "card") {
    return (
      <svg {...props}>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="M3 10h18" />
      </svg>
    );
  }
  if (name === "store") {
    return (
      <svg {...props}>
        <path d="M4 10 6 5h12l2 5" />
        <path d="M5 10v8h14v-8" />
        <path d="M9 18v-5h6v5" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <path d="M12 3 5 6v6c0 4 3 6.5 7 8 4-1.5 7-4 7-8V6l-7-3z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 text-[#f5b301]" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} className={index < Math.round(rating) ? "opacity-100" : "opacity-30"}>
          <Icon name="star" size={size} />
        </span>
      ))}
    </span>
  );
}

function headline(product: ProductDetail) {
  const brand = product.brand.trim();
  const source = product.title.trim();
  if (source.toLowerCase().startsWith(brand.toLowerCase())) {
    const rest = source.slice(brand.length).replace(/^[\s\-–—]+/, "");
    return { brand, line: rest || source };
  }
  return { brand, line: source };
}

function pointsFor(product: ProductDetail) {
  const title = `${product.title} ${product.group ?? ""}`.toLowerCase();
  const place = product.city ? `From ${product.city}` : "Tracked to your door";
  if (/phone|galaxy|iphone|smartphone/.test(title)) {
    return [
      { icon: "signal" as const, title: "Stays connected", copy: "Calls, data, and everyday use" },
      { icon: "camera" as const, title: "Camera ready", copy: "Photos and video on the go" },
      { icon: "battery" as const, title: "Daily power", copy: "Built for a full day" },
    ];
  }
  return [
    {
      icon: "truck" as const,
      title: product.shipping.toLowerCase().includes("free") ? "Free Shipping" : "Shipping",
      copy: place,
    },
    {
      icon: "shield" as const,
      title: product.condition,
      copy: product.grade ? `${product.grade} grade` : "Checked before listing",
    },
    { icon: "store" as const, title: product.brand, copy: product.seller },
  ];
}

function featureRow(product: ProductDetail) {
  const title = `${product.title} ${product.group ?? ""}`.toLowerCase();
  const brandLine = { icon: "shield" as const, title: `${product.brand} Quality`, copy: "Trusted brand" };
  if (/phone|galaxy|iphone|smartphone/.test(title)) {
    return [
      /5g/.test(title)
        ? { icon: "signal" as const, title: "5G Ready", copy: "Faster internet" }
        : { icon: "signal" as const, title: "Stays Connected", copy: "Calls and data" },
      { icon: "camera" as const, title: "Powerful Camera", copy: "Photos and video" },
      { icon: "battery" as const, title: "Long Battery Life", copy: "All-day power" },
      brandLine,
    ];
  }
  if (product.category === "motors") {
    return [
      { icon: "check" as const, title: "Ready to Fit", copy: "Checked before sale" },
      { icon: "shield" as const, title: product.condition, copy: product.grade ? `${product.grade} grade` : "As shown" },
      { icon: "truck" as const, title: "Fast Delivery", copy: product.shipping },
      brandLine,
    ];
  }
  return [
    { icon: "check" as const, title: product.condition, copy: product.grade ? `${product.grade} grade` : "As shown" },
    { icon: "shield" as const, title: "Checked Listing", copy: "Matches the photos" },
    { icon: "truck" as const, title: "Fast Delivery", copy: product.shipping },
    brandLine,
  ];
}

function blurb(product: ProductDetail) {
  const title = product.title.toLowerCase();
  if (/phone|galaxy|iphone|smartphone/.test(title)) {
    return `${product.title} offers a smooth everyday experience, with a clear display, a capable camera and battery life for a full day. Perfect for calls, photos and daily use.`;
  }
  const grade = product.grade ? `, graded ${product.grade}` : "";
  return `${product.title} is ready to use, in ${product.condition.toLowerCase()} condition${grade}. Sold by ${product.seller}${product.city ? ` in ${product.city}` : ""}.`;
}

export function ListingDetail({ product }: { product: ProductDetail }) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [qty, setQty] = useState(1);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [adding, setAdding] = useState(false);
  const [tab, setTab] = useState<(typeof tabs)[number]>("Description");
  const [savedIds, setSavedIds] = useState<number[]>([]);
  const related = useMemo(() => similarProducts(product), [product]);
  const tone = useImageShade(product.img, product.accent);
  const active = product.images[index] ?? product.img;
  const name = headline(product);
  const points = pointsFor(product);
  const perks = featureRow(product);
  const positive = Math.round((product.rating / 5) * 100);
  const crumb = product.sub || product.group || product.brand;
  const freeShip = product.shipping.toLowerCase().includes("free");

  function step(direction: number) {
    if (product.images.length < 2) return;
    setIndex((current) => (current + direction + product.images.length) % product.images.length);
  }

  async function share() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  const checks = perks.map((perk) => perk.title);

  useEffect(() => {
    loadWatchIds().then((ids) => {
      setSaved(ids.has(product.id));
      setSavedIds([...ids]);
    });
  }, [product.id]);

  async function addProductToCart(next: "/cart" | "/checkout") {
    setAdding(true);
    try {
      await addToCart({
        listingId: product.id,
        quantity: qty,
        title: product.title,
        photo: product.img,
        price: product.price,
        seller: product.seller,
        localOnly: true,
      });
      router.push(next);
    } finally {
      setAdding(false);
    }
  }

  return (
    <main className="bg-white">
      <div className="page-shell py-4">
        <nav className="flex flex-wrap items-center gap-1.5 text-[13px] text-[#8b93a1]" aria-label="Breadcrumb">
          <Link href="/" className="font-medium text-[#3665f3] hover:underline">
            Home
          </Link>
          <Icon name="chevron" size={14} />
          <Link href={`/categories/${product.category}`} className="font-medium text-[#3665f3] hover:underline">
            {product.categoryLabel}
          </Link>
          <Icon name="chevron" size={14} />
          <Link href={`/categories/${product.category}`} className="font-medium text-[#3665f3] hover:underline">
            {crumb}
          </Link>
          <Icon name="chevron" size={14} />
          <span className="max-w-[420px] truncate text-[#1f2430]">{product.title}</span>
        </nav>

        <div className="mt-4 grid items-stretch gap-x-8 gap-y-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,420px)]">
          <div>
            <div className="grid items-start gap-3 lg:grid-cols-[76px_minmax(0,1fr)]">
              <div className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
                {product.images.map((image, imageIndex) => (
                  <button
                    key={`${image}-${imageIndex}`}
                    type="button"
                    onClick={() => setIndex(imageIndex)}
                    className="relative h-[68px] w-[68px] shrink-0 overflow-hidden rounded-xl border-2 bg-white"
                    style={{ borderColor: imageIndex === index ? blue : "#e6ebf2" }}
                    aria-label={`Photo ${imageIndex + 1}`}
                  >
                    <Image src={image} alt="" fill className="object-contain p-1.5" sizes="68px" />
                  </button>
                ))}
              </div>

              <div>
              <div className="relative overflow-hidden rounded-2xl border border-[#e7eef8] bg-[linear-gradient(145deg,#f4f8ff_0%,#e7f0ff_42%,#f8fbff_100%)]">
                <div
                  className="pointer-events-none absolute inset-y-0 right-0 w-[62%] bg-[linear-gradient(165deg,#d5e6ff_0%,#eaf2ff_48%,#f7fbff_100%)]"
                  style={{ clipPath: "polygon(16% 0, 100% 0, 100% 100%, 0 100%)" }}
                />
                <div className="relative grid min-h-[420px] md:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
                  <div className="flex flex-col justify-center px-6 py-8 md:px-8 md:py-10">
                    <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[#3665f3] px-3 py-1 text-[12px] font-semibold text-white">
                      <Icon name="check" size={13} />
                      Official Store
                    </span>
                    <p className="mt-5 text-[15px] font-extrabold tracking-[0.14em] text-[#1b2434]">{name.brand.toUpperCase()}</p>
                    <h2 className="mt-1 max-w-[340px] text-[28px] font-extrabold leading-[1.12] tracking-tight text-[#121826] md:text-[32px]">
                      {name.line}
                    </h2>
                    <p className="mt-2 text-[15px] text-[#8b93a3]">{taglines[product.category] ?? "Ready to ship."}</p>
                    <ul className="mt-6 space-y-3.5">
                      {points.map((point) => (
                        <li key={point.title} className="flex items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#3665f3] shadow-[0_6px_16px_-10px_rgba(30,70,160,0.7)]">
                            <Icon name={point.icon} />
                          </span>
                          <span>
                            <span className="block text-[13.5px] font-bold text-[#1b2434]">{point.title}</span>
                            <span className="block text-[12px] text-[#8b93a3]">{point.copy}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="relative min-h-[300px] md:min-h-[380px]">
                    <Image src={active} alt={product.title} fill className="object-contain p-3 mix-blend-multiply" sizes="520px" priority />
                    <button
                      type="button"
                      aria-label="Previous photo"
                      onClick={() => step(-1)}
                      disabled={product.images.length < 2}
                      className="absolute left-1 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#1b2434] shadow-md disabled:opacity-40"
                    >
                      <span className="rotate-180">
                        <Icon name="chevron" size={16} />
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label="Next photo"
                      onClick={() => step(1)}
                      disabled={product.images.length < 2}
                      className="absolute right-2 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white text-[#1b2434] shadow-md disabled:opacity-40"
                    >
                      <Icon name="chevron" size={16} />
                    </button>
                  </div>
                </div>
                <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
                  {product.images.map((image, imageIndex) => (
                    <button
                      key={`dot-${image}-${imageIndex}`}
                      type="button"
                      aria-label={`Show photo ${imageIndex + 1}`}
                      onClick={() => setIndex(imageIndex)}
                      className="h-1.5 rounded-full"
                      style={{
                        width: imageIndex === index ? 16 : 6,
                        background: imageIndex === index ? blue : "#c5d0e0",
                      }}
                    />
                  ))}
                </div>
              </div>
              </div>
            </div>
          </div>

          <aside className="rounded-t-3xl p-5 pb-2" style={{ background: tone.panel }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[13px] font-semibold" style={{ color: tone.accent }}>{product.brand}</p>
                <h1 className="mt-1 text-[20px] font-bold leading-snug text-[#121826]">{product.title}</h1>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  aria-label={saved ? "Remove from wishlist" : "Add to wishlist"}
                  onClick={() => setSaved((current) => !current)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border bg-white text-[#667085]"
                  style={{ borderColor: tone.line, color: saved ? "#ef3b3b" : undefined }}
                >
                  <Icon name="heart" size={16} />
                </button>
                <button
                  type="button"
                  aria-label={copied ? "Link copied" : "Share listing"}
                  onClick={share}
                  className="flex h-9 w-9 items-center justify-center rounded-full border bg-white text-[#667085]"
                  style={{ borderColor: tone.line }}
                >
                  <Icon name="share" size={16} />
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-[#6b7280]">
              <Stars rating={product.rating} />
              <span className="font-semibold text-[#121826]">{product.rating.toFixed(1)}</span>
              <span>({product.reviews.toLocaleString()} reviews)</span>
              <span className="mx-1 hidden h-4 w-px bg-[#e5e7eb] sm:inline-block" />
              <span className="inline-flex items-center gap-1 font-medium text-[#16a34a]">
                <Icon name="check" size={14} />
                {positive}% positive feedback
              </span>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { icon: "store" as const, label: "Official Store" },
                { icon: "truck" as const, label: freeShip ? "Free Shipping" : product.shipping },
                { icon: "shield" as const, label: "1 Year Warranty" },
              ].map((pill) => (
                <span
                  key={pill.label}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-white/80 px-2.5 py-1 text-[12px] font-medium text-[#374151]"
                  style={{ borderColor: tone.line }}
                >
                  <span style={{ color: tone.accent }}>
                    <Icon name={pill.icon} size={13} />
                  </span>
                  {pill.label}
                </span>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <p className="text-[34px] font-extrabold leading-none tracking-tight text-[#121826]">{product.price}</p>
              {product.was && <p className="text-[14px] text-[#98a2b3] line-through">{product.was}</p>}
              <span className="rounded-md bg-[#e8f8ee] px-2 py-1 text-[12px] font-semibold text-[#16a34a]">
                {product.format === "auction" ? "Auction" : "In Stock"}
              </span>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#eef1f4] pt-3 text-[13px] text-[#6b7280]">
              <p>
                Return: <span className="font-medium text-[#1f2430]">30 days return policy</span>
              </p>
              <p>
                Condition: <span className="font-medium text-[#1f2430]">{product.condition}</span>
              </p>
            </div>

            <p className="mt-3 text-[13.5px] leading-relaxed text-[#4b5563]">{blurb(product)}</p>
            {product.format === "auction" && product.timeLeft && (
              <p className="mt-2 text-[13px] text-[#4b5563]">
                {product.bids ?? 0} bids · ends in {product.timeLeft}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="text-[14px] font-semibold text-[#1f2430]">Quantity:</span>
              <div className="flex h-9 items-center rounded-lg border bg-white" style={{ borderColor: tone.line }}>
                <button
                  type="button"
                  aria-label="Decrease quantity"
                  onClick={() => setQty((count) => Math.max(1, count - 1))}
                  className="w-9 text-[18px] text-[#374151]"
                >
                  −
                </button>
                <span className="w-6 text-center text-[14px] font-semibold text-[#121826]">{qty}</span>
                <button
                  type="button"
                  aria-label="Increase quantity"
                  onClick={() => setQty((count) => Math.min(10, count + 1))}
                  className="w-9 text-[18px] text-[#374151]"
                >
                  +
                </button>
              </div>
              <span className="text-[13px] font-medium" style={{ color: tone.accent }}>More than 10 available</span>
            </div>

            <button
              type="button"
              disabled={adding}
              onClick={() => addProductToCart(product.format === "auction" ? "/cart" : "/checkout")}
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full text-[15px] font-semibold hover:brightness-95 disabled:opacity-60"
              style={{ background: tone.accent, color: tone.onAccent }}
            >
              <Icon name="cart" size={18} />
              {product.format === "auction" ? "Place bid" : "Buy It Now"}
            </button>
            <button
              type="button"
              disabled={adding}
              onClick={() => addProductToCart("/cart")}
              className="mt-2.5 flex h-12 w-full items-center justify-center gap-2 rounded-full border bg-white text-[15px] font-semibold disabled:opacity-60"
              style={{ borderColor: tone.accent, color: tone.accent }}
            >
              <Icon name="cart" size={18} />
              {adding ? "Adding…" : "Add to Cart"}
            </button>
          </aside>

          <div className="grid grid-cols-2 gap-3 pt-4 sm:grid-cols-4 lg:self-center">
            {perks.map((perk) => (
              <div key={perk.title} className="flex h-[72px] items-center gap-2.5 rounded-2xl border border-[#e7eef6] bg-white px-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#eef4ff] text-[#3665f3]">
                  <Icon name={perk.icon} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-bold leading-tight text-[#1b2434]">{perk.title}</span>
                  <span className="mt-0.5 block text-[12px] leading-tight text-[#8b93a3]">{perk.copy}</span>
                </span>
              </div>
            ))}
          </div>

          <div className="px-5 py-4" style={{ background: tone.panel }}>
            <button
              type="button"
              onClick={async () => {
                const currently = saved;
                setSaved(!currently);
                await toggleWatch({
                  listingId: product.id,
                  saved: currently,
                  title: product.title,
                  photo: product.img,
                  price: product.price,
                  localOnly: true,
                });
              }}
              className="flex w-full items-center justify-center gap-2 text-[14px] font-medium"
              style={{ color: tone.accent }}
            >
              <Icon name="heart" size={16} />
              {saved ? "Saved to watchlist" : "Add to watchlist"}
            </button>
            <div className="mt-3 grid grid-cols-3 gap-2 rounded-2xl border bg-white/70 px-2 py-3" style={{ borderColor: tone.line }}>
              {[
                { icon: "shield" as const, title: "100% Genuine", copy: "Original product" },
                { icon: "card" as const, title: "Secure Payment", copy: "Multiple payment options" },
                { icon: "truck" as const, title: "Fast Delivery", copy: "Get it within 3-5 days" },
              ].map((item) => (
                <div key={item.title} className="text-center">
                  <span className="mx-auto flex h-8 w-8 items-center justify-center rounded-full" style={{ background: tone.soft, color: tone.accent }}>
                    <Icon name={item.icon} size={15} />
                  </span>
                  <p className="mt-1.5 text-[11.5px] font-bold leading-tight text-[#1b2434]">{item.title}</p>
                  <p className="mt-0.5 text-[10.5px] leading-tight text-[#8b93a3]">{item.copy}</p>
                </div>
              ))}
            </div>
          </div>

          <section className="pt-8">
            <div className="flex items-center justify-between">
              <h2 className="text-[18px] font-bold text-[#121826]">Similar Products</h2>
              <Link href={`/categories/${product.category}`} className="text-[13px] font-semibold text-[#3665f3] hover:underline">
                See All →
              </Link>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
              {related.map((item, itemIndex) => {
                const badge = dealBadges[itemIndex % dealBadges.length];
                const wished = savedIds.includes(item.id);
                return (
                  <article key={item.id} className="relative rounded-xl border border-[#e8edf3] bg-white p-2.5 hover:shadow-sm">
                    <button
                      type="button"
                      aria-label={wished ? "Remove from wishlist" : "Save item"}
                      onClick={async () => {
                        const currently = savedIds.includes(item.id);
                        setSavedIds((current) =>
                          currently ? current.filter((id) => id !== item.id) : [...current, item.id],
                        );
                        await toggleWatch({
                          listingId: item.id,
                          saved: currently,
                          title: item.title,
                          photo: item.img,
                          price: item.price,
                          localOnly: true,
                        });
                      }}
                      className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white text-[#98a2b3]"
                      style={{ color: wished ? "#ef3b3b" : undefined }}
                    >
                      <Icon name="heart" size={15} />
                    </button>
                    <Link href={`/listing/${item.id}`} className="block">
                      <span className="relative block h-[132px]">
                        <Image src={item.img} alt="" fill className="object-contain" sizes="180px" />
                        <span className={`absolute left-0 top-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white ${badge.className}`}>
                          {badge.label}
                        </span>
                      </span>
                      <span className="clamp-2 mt-2 block min-h-[34px] text-[12.5px] font-semibold leading-snug text-[#1b2434]">
                        {item.short || item.title}
                      </span>
                      <span className="mt-1 flex items-center gap-1 text-[11px] text-[#6b7280]">
                        <Stars rating={item.rating} size={11} />
                        <span className="font-semibold text-[#1b2434]">{item.rating.toFixed(1)}</span>
                        <span>({item.reviews.toLocaleString()})</span>
                      </span>
                      <span className="mt-1 block text-[16px] font-bold text-[#121826]">{item.price}</span>
                      <span className={`mt-1 flex items-center gap-1 text-[11.5px] ${item.shipping.toLowerCase().includes("free") ? "text-[#16a34a]" : "text-[#6b7280]"}`}>
                        <Icon name="truck" size={12} />
                        {item.shipping.toLowerCase().includes("free") ? "Free Shipping" : item.shipping}
                      </span>
                    </Link>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="h-full rounded-b-3xl px-5 pb-5 pt-2" style={{ background: tone.panel }}>
            <div className="flex gap-5 overflow-x-auto border-b border-[#e8edf3]">
              {tabs.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => setTab(name)}
                  className="shrink-0 border-b-2 pb-2.5 text-[13.5px] font-semibold"
                  style={{
                    borderColor: tab === name ? tone.accent : "transparent",
                    color: tab === name ? tone.accent : "#6b7280",
                  }}
                >
                  {name}
                </button>
              ))}
            </div>
            <div className="min-h-[220px] pt-4 text-[13.5px] leading-relaxed text-[#374151]">
              {tab === "Description" && (
                <div>
                  <p>{blurb(product)}</p>
                  <ul className="mt-4 space-y-2.5">
                    {checks.map((line) => (
                      <li key={line} className="flex items-start gap-2">
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full" style={{ background: tone.accent, color: tone.onAccent }}>
                          <Icon name="check" size={11} />
                        </span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {tab === "Specifications" && (
                <dl className="divide-y divide-[#eef1f4]">
                  {[
                    ["Brand", product.brand],
                    ["Condition", product.condition],
                    ["Grade", product.grade ?? "—"],
                    ["Category", product.categoryLabel],
                    ["Type", crumb],
                    ["Seller", product.seller],
                    ["Shipping", product.shipping],
                    ["Location", product.city ?? "Nepal"],
                    ["Buying format", product.format === "auction" ? "Auction" : "Buy It Now"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between gap-4 py-2.5">
                      <dt className="text-[#6b7280]">{label}</dt>
                      <dd className="text-right font-semibold text-[#121826]">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
              {tab === "Shipping & Returns" && (
                <div className="space-y-3">
                  <p>
                    {product.shipping}
                    {product.city ? ` from ${product.city}` : ""}. Delivery timing is shown at checkout.
                  </p>
                  <p>If the item is not as described, you can request a return within 30 days.</p>
                </div>
              )}
              {tab === "FAQs" && (
                <div className="space-y-4">
                  <div>
                    <p className="font-semibold text-[#121826]">Is this the item in the photos?</p>
                    <p className="mt-1">Yes. The gallery shows this listing.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-[#121826]">How do I buy it?</p>
                    <p className="mt-1">Buy It Now and Add to Cart both continue in the cart. Quantity is {qty}.</p>
                  </div>
                  <div>
                    <p className="font-semibold text-[#121826]">Can I save it for later?</p>
                    <p className="mt-1">Add to watchlist saves the item so it shows under Saved.</p>
                  </div>
                </div>
              )}
              <div className="mt-5 flex items-center gap-2 rounded-xl px-4 py-3 text-[13px] font-medium" style={{ background: tone.soft, color: tone.deep }}>
                <span style={{ color: tone.accent }}>
                  <Icon name="shield" size={16} />
                </span>
                Trusted by millions of customers worldwide
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
