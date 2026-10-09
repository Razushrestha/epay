import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Shop now — Nexlo",
  description: "Free shipping on top categories, tech, fashion, and collectibles.",
};

const search = (q: string) => `/search?q=${encodeURIComponent(q)}`;

const bannerTiles = [
  { src: "/shop/tile-light.jpg", alt: "Car light" },
  { src: "/shop/tile-sneakers.jpg", alt: "Sneakers" },
  { src: "/shop/tile-bag.jpg", alt: "Handbag" },
  { src: "/shop/tile-laptop.jpg", alt: "Laptop" },
  { src: "/shop/tile-hammock.jpg", alt: "Hammock" },
  { src: "/shop/tile-phone.jpg", alt: "Phone" },
  { src: "/shop/tile-turtle.jpg", alt: "Plush toy" },
  { src: "/shop/tile-person.jpg", alt: "Camera" },
];

const sections = [
  {
    title: "Enjoy free shipping on top categories",
    href: "/deals",
    items: [
      { label: "Computers and tablets", img: "/shop/shop-laptop.png", href: search("computers tablets") },
      { label: "Fashion", img: "/shop/shop-handbag.png", href: "/categories/fashion" },
      { label: "Motors", img: "/shop/shop-brake.png", href: "/categories/motors" },
      { label: "Collectibles", img: "/trending/collectibles.png", href: "/categories/collectibles" },
      { label: "Home and garden", img: "/shop/shop-chair.png", href: "/categories/home-garden" },
      { label: "Refurbished", img: "/categories/electronics.png", href: search("refurbished") },
    ],
  },
  {
    title: "All about tech",
    href: "/categories/electronics",
    items: [
      { label: "Cameras", img: "/shop/shop-camera.png", href: search("cameras") },
      { label: "Cell phones", img: "/shop/shop-phone.png", href: search("cell phones") },
      { label: "Portable audio and headphones", img: "/shop/shop-headphones.png", href: search("headphones") },
      { label: "TV, video and home audio", img: "/shop/shop-tv.png", href: search("television") },
      { label: "Video games and consoles", img: "/shop/shop-consoles.png", href: search("video games") },
      { label: "Smartwatches", img: "/shop/shop-smartwatch.png", href: search("smartwatches") },
    ],
  },
  {
    title: "Fashion space",
    href: "/categories/fashion",
    items: [
      { label: "Men", img: "/shop/shop-jacket-men.png", href: search("men clothing") },
      { label: "Women", img: "/shop/shop-jacket-women.png", href: search("women clothing") },
      { label: "Kids", img: "/shop/shop-kids-shoes.png", href: search("kids shoes") },
      { label: "Pre-loved", img: "/shop/shop-shoulder.png", href: search("pre-loved fashion") },
      { label: "Luxury", img: "/shop/shop-luxury-watch.png", href: search("luxury watches") },
      { label: "Shoes", img: "/promo/sneaker.png", href: search("shoes") },
    ],
  },
  {
    title: "Collectibles hub",
    href: "/categories/collectibles",
    items: [
      { label: "Comics", img: "/shop/shop-comic.png", href: search("comics") },
      { label: "Sports memorabilia", img: "/shop/shop-baseball.png", href: search("sports memorabilia") },
      { label: "Toys", img: "/trending/toys.png", href: search("toys") },
      { label: "Action figures", img: "/shop/shop-figure.png", href: search("action figures") },
      { label: "Sports trading cards", img: "/shop/shop-card.png", href: search("trading cards") },
      { label: "Antique art", img: "/shop/shop-art.png", href: search("antique art") },
    ],
  },
];

export default function ShopPage() {
  return (
    <main className="min-h-screen bg-white">
      <section className="page-shell pt-4">
        <div className="hero-bg flex flex-col justify-center gap-6 overflow-hidden rounded-[16px] px-6 py-8 sm:px-8 lg:h-[300px] lg:flex-row lg:items-center lg:justify-between lg:px-12">
          <div className="max-w-[420px] shrink-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#0f1c3f]">Shop</p>
            <h1 className="mt-2 text-[34px] font-bold leading-[1.05] tracking-tight text-[#0f1c3f] sm:text-[40px]">
              Direct to you — for free
            </h1>
            <p className="mt-3 text-[15px] text-[#333]">Free shipping on these favourite items, with escrow on every order.</p>
          </div>
          <div className="grid w-full max-w-[560px] grid-cols-4 gap-2.5 lg:w-[560px]">
            {bannerTiles.map((tile) => (
              <span key={tile.src} className="relative aspect-square overflow-hidden rounded-[12px] bg-white">
                <Image src={tile.src} alt={tile.alt} fill sizes="140px" className="object-cover" priority />
              </span>
            ))}
          </div>
        </div>
      </section>

      {sections.map((section, index) => (
        <section
          key={section.title}
          id={index === 0 ? "top-categories" : undefined}
          className="page-shell pt-8"
        >
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-[22px] font-bold tracking-tight text-[#10245c] sm:text-[26px]">{section.title}</h2>
            <Link href={section.href} className="shrink-0 text-[14px] font-medium text-[#3665f3] hover:underline">
              Shop all ›
            </Link>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
            {section.items.map((item) => (
              <Link key={item.label} href={item.href} className="group text-center">
                <span className="relative block aspect-[5/4] overflow-hidden rounded-[18px] bg-[#ececef]">
                  <Image
                    src={item.img}
                    alt={item.label}
                    fill
                    sizes="180px"
                    className="object-contain p-3.5 transition duration-300 group-hover:scale-[1.03]"
                  />
                </span>
                <span className="mt-2.5 block text-[13px] leading-snug text-[#3a3a3a]">{item.label}</span>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <div className="pt-10">
        <SiteFooter />
      </div>
    </main>
  );
}
