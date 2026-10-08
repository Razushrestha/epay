import { categoryBrowse } from "@/lib/category-catalogs";
import { categoryNames, listings, type Listing } from "@/lib/home-data";
import type { ElecProduct } from "@/lib/electronics-catalog";

export type ProductDetail = {
  id: number;
  title: string;
  price: string;
  was?: string;
  img: string;
  images: string[];
  category: string;
  categoryLabel: string;
  condition: string;
  shipping: string;
  format: "auction" | "fixed";
  seller: string;
  rating: number;
  reviews: number;
  brand: string;
  accent: string;
  grade?: string;
  group?: string;
  sub?: string;
  short?: string;
  bids?: number;
  timeLeft?: string;
  city?: string;
};

const accents: Record<number, string> = {
  1: "#3d7ee8",
  2: "#d01212",
  3: "#e28aa8",
  4: "#c4a574",
  5: "#2c2c2c",
  6: "#e0a020",
  7: "#3b6fd8",
  8: "#b08968",
  9: "#2a2a2a",
  10: "#d23a2f",
  11: "#c4b39a",
  12: "#3d9a4a",
  13: "#e07a2f",
  14: "#d46a9a",
  15: "#6b8f71",
  16: "#e0a020",
  17: "#5c5346",
  18: "#8b5a3c",
  21: "#2a2a2a",
  22: "#3a3a3a",
  23: "#4a5568",
  24: "#7c5cff",
  25: "#1f4e79",
};

const categoryAccent: Record<string, string> = {
  electronics: "#3b6fd8",
  fashion: "#b08968",
  motors: "#e07a2f",
  sports: "#2f9e6b",
  "health-beauty": "#c45c9a",
  industrial: "#e08a1e",
  "home-garden": "#6a9a3a",
  collectibles: "#d4a017",
};

function money(amount: number) {
  return `NPR ${amount.toLocaleString("en-IN")}`;
}

function slugFor(label: string) {
  const entry = Object.entries(categoryNames).find(([, name]) => name === label);
  return entry?.[0] ?? "electronics";
}

function fromCatalog(product: ElecProduct, label: string): ProductDetail {
  const category = slugFor(label);
  return {
    id: product.id,
    title: product.title,
    price: money(product.price),
    was: product.was ? money(product.was) : undefined,
    img: product.img,
    images: [product.img],
    category,
    categoryLabel: label,
    condition: product.condition,
    shipping: product.shipping,
    format: product.format,
    seller: product.seller,
    rating: product.rating,
    reviews: product.reviews,
    brand: product.brand,
    accent: accents[product.id] ?? categoryAccent[category] ?? "#3665f3",
    grade: product.grade,
    group: product.group,
    sub: product.sub,
    short: product.short,
    city: product.city,
  };
}

function fromListing(item: Listing): ProductDetail {
  return {
    id: item.id,
    title: item.title,
    price: item.price,
    was: item.was,
    img: item.img,
    images: [item.img],
    category: item.category,
    categoryLabel: categoryNames[item.category] ?? item.category,
    condition: item.condition,
    shipping: item.shipping,
    format: item.format,
    seller: "Nexlo Seller",
    rating: 4.6,
    reviews: 120,
    brand: item.title.split(" ")[0] ?? "Nexlo",
    accent: accents[item.id] ?? categoryAccent[item.category] ?? "#3665f3",
    bids: item.bids,
    timeLeft: item.timeLeft,
  };
}

export function findProduct(id: number): ProductDetail | null {
  const catalog = Object.values(categoryBrowse).flatMap((config) =>
    config.products.map((product) => fromCatalog(product, config.title)),
  );
  const match = catalog.find((product) => product.id === id);
  const listing = listings.find((item) => item.id === id);
  if (!match && !listing) return null;

  const base = match ?? fromListing(listing as Listing);
  const related = catalog.filter((product) => product.category === base.category);
  const images = [...new Set([base.img, ...related.map((product) => product.img)])].slice(0, 5);
  if (listing && !match) {
    return { ...base, images };
  }
  return {
    ...base,
    images,
    bids: listing?.bids,
    timeLeft: listing?.timeLeft,
  };
}

export function similarProducts(product: ProductDetail) {
  return Object.values(categoryBrowse)
    .flatMap((config) => config.products.map((item) => fromCatalog(item, config.title)))
    .filter((item) => item.category === product.category && item.id !== product.id)
    .slice(0, 5);
}
