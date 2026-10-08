import { elecGroups, elecProducts, type ElecProduct } from "@/lib/electronics-catalog";

export type BrowseGroup = { id: string; name: string; children: readonly string[] };
export type BrowseCard = {
  title: string;
  text: string;
  img: string;
  group: string;
  sub?: string;
  bg: string;
};
export type CategoryBrowseConfig = {
  title: string;
  groups: readonly BrowseGroup[];
  products: readonly ElecProduct[];
  hero: {
    image: string;
    kicker: string;
    lines: readonly string[];
    text: string;
    cta: string;
    condition: string;
  };
  cards: readonly BrowseCard[];
  badge: readonly [string, string];
  trending: string;
  resultCount?: number;
};

let seq = 300;

function p(
  input: Pick<ElecProduct, "title" | "price" | "img" | "group" | "brand"> & Partial<ElecProduct>,
): ElecProduct {
  const id = input.id ?? seq++;
  return {
    verified: true,
    rating: 4.6,
    reviews: 214,
    seller: "Nexlo Seller",
    shipping: "Free shipping",
    format: "fixed",
    city: "Kathmandu",
    grade: "Excellent",
    condition: "Refurbished",
    ...input,
    id,
    href: `/listing/${id}`,
  };
}

const motors: ElecProduct[] = [
  p({ id: 10, title: "Sports Car Scale Model 1:18", price: 8900, img: "/trending/motors.png", group: "car", sub: "Exterior", brand: "ScaleLab", condition: "New", grade: "Excellent", seller: "PitLane", href: "/listing/10", rating: 4.7, reviews: 86 }),
  p({ title: "Front Brake Kit", price: 6400, was: 8200, img: "/shop/shop-brake.png", group: "car", sub: "Brakes", brand: "Roadline", grade: "Good", seller: "PitLane", city: "Pokhara", rating: 4.5, reviews: 142 }),
  p({ title: "LED Headlight Assembly", price: 12800, was: 15900, img: "/categories/motor-light.jpg", group: "car", sub: "Exterior", brand: "Roadline", seller: "NightDrive", rating: 4.8, reviews: 320 }),
  p({ title: "Engine Piston Pair", price: 9400, was: 12000, img: "/categories/motor-pistons.jpg", group: "car", sub: "Engines", brand: "Forge", grade: "Very Good", seller: "ForgeNepal", format: "auction", rating: 4.6, reviews: 77 }),
  p({ title: "Motorcycle Wheel and Tire", price: 18500, was: 24000, img: "/categories/motor-wheel.jpg", group: "moto", sub: "Wheels and rims", brand: "RideCo", seller: "TwoWheel", city: "Lalitpur", rating: 4.7, reviews: 201 }),
  p({ title: "Motorcycle Frame Section", price: 22000, was: 28000, img: "/trending/motors.png", group: "moto", sub: "Body and frame", brand: "RideCo", condition: "Used", grade: "Good", seller: "TwoWheel", shipping: "NPR 400 shipping" }),
  p({ title: "ATV Parts Bundle", price: 15600, was: 19800, img: "/categories/motor-pistons.jpg", group: "outdoor", sub: "ATV and UTV", brand: "Trail", seller: "HillRoute", city: "Pokhara" }),
  p({ title: "Cordless Workshop Drill", price: 9750, was: 12500, img: "/categories/industrial-drills.jpg", group: "car", sub: "Brakes", brand: "Forge", condition: "New", seller: "ToolBay", href: "/search?q=automotive%20tools", rating: 4.4, reviews: 96 }),
];

const fashion: ElecProduct[] = [
  p({ id: 4, title: "White Court Sneakers", price: 12499, was: 16999, img: "/promo/sneaker.png", group: "men", sub: "Shoes", brand: "Street", condition: "New", seller: "KickRoom", href: "/listing/4", rating: 4.8, reviews: 540 }),
  p({ id: 8, title: "Leather Crossbody Bag Tan", price: 6450, img: "/shop/shop-handbag.png", group: "women", sub: "Accessories", brand: "Atelier", condition: "New", seller: "Atelier", href: "/listing/8", rating: 4.6, reviews: 188 }),
  p({ id: 9, title: "Classic Leather Jacket Black", price: 14200, was: 18900, img: "/shop/shop-jacket-men.png", group: "men", sub: "Clothing", brand: "Northcut", condition: "Used", grade: "Good", seller: "Wardrobe", href: "/listing/9", format: "auction", rating: 4.5, reviews: 96 }),
  p({ title: "Women's Tailored Jacket", price: 9800, was: 13200, img: "/shop/shop-jacket-women.png", group: "women", sub: "Clothing", brand: "Northcut", seller: "Wardrobe", city: "Lalitpur", rating: 4.7, reviews: 230 }),
  p({ title: "Crescent Shoulder Bag", price: 7200, was: 9100, img: "/categories/fashion-bag.jpg", group: "luxury", sub: "Handbags", brand: "Atelier", seller: "Atelier", rating: 4.8, reviews: 164 }),
  p({ title: "Court Sneakers with Socks", price: 8900, was: 11000, img: "/categories/fashion-shoes.jpg", group: "luxury", sub: "Sneakers", brand: "Street", grade: "Very Good", seller: "KickRoom", city: "Pokhara" }),
  p({ title: "Kids Everyday Shoes", price: 3200, was: 4100, img: "/shop/shop-kids-shoes.png", group: "kids", sub: "Shoes", brand: "Little", condition: "New", seller: "LittleStep", rating: 4.4, reviews: 73 }),
  p({ title: "Dress Watch Silver", price: 18600, was: 24000, img: "/shop/shop-luxury-watch.png", group: "luxury", sub: "Watches", brand: "Atelier", seller: "TimeHall", city: "Kathmandu", rating: 4.9, reviews: 121 }),
];

const collectibles: ElecProduct[] = [
  p({ id: 6, title: "Building Set Supercar", price: 22999, was: 29999, img: "/categories/collect-box.jpg", group: "toys", sub: "Building sets", brand: "Brick", condition: "New", seller: "HobbyDesk", href: "/listing/6", rating: 4.8, reviews: 410 }),
  p({ id: 15, title: "Original Oil Painting Landscape", price: 16500, img: "/shop/shop-art.png", group: "art", sub: "Art", brand: "Studio", condition: "Used", grade: "Excellent", seller: "Gallery", href: "/listing/15", format: "auction", rating: 4.7, reviews: 38 }),
  p({ id: 17, title: "Vintage Camera 35mm Film", price: 11200, img: "/shop/shop-camera.png", group: "art", sub: "Antiques", brand: "Archive", condition: "Used", grade: "Good", seller: "Archive", href: "/listing/17", format: "auction", rating: 4.5, reviews: 64 }),
  p({ id: 18, title: "Stack of Hardcover Novels", price: 1850, img: "/trending/books.png", group: "art", sub: "Antiques", brand: "Shelf", condition: "Used", seller: "PageTurn", href: "/listing/18", rating: 4.3, reviews: 29 }),
  p({ title: "Cased Baseball Display", price: 4500, was: 6200, img: "/categories/collect-ball.jpg", group: "cards", sub: "Sports cards", brand: "Diamond", seller: "CardRoom", city: "Pokhara", rating: 4.6, reviews: 155 }),
  p({ title: "Comic Issue Collection", price: 2800, was: 3600, img: "/shop/shop-comic.png", group: "cards", sub: "Non-sport cards", brand: "Ink", condition: "Used", grade: "Good", seller: "InkWell" }),
  p({ title: "Seated Explorer Figure", price: 5400, was: 7000, img: "/shop/shop-figure.png", group: "toys", sub: "Action figures", brand: "Studio", seller: "HobbyDesk", city: "Lalitpur", rating: 4.7, reviews: 88 }),
  p({ title: "Trading Card Box", price: 3900, was: 4800, img: "/categories/collect-box.jpg", group: "cards", sub: "Card games", brand: "Nexlo Cards", condition: "New", seller: "CardRoom", rating: 4.8, reviews: 240 }),
];

const sports: ElecProduct[] = [
  p({ id: 13, title: "Basketball Official Size 7", price: 2150, img: "/categories/sport-basket.jpg", group: "team", sub: "Basketball", brand: "Court", condition: "New", seller: "PlayYard", href: "/listing/13", rating: 4.6, reviews: 190 }),
  p({ title: "Road Bike Wheelset View", price: 42000, was: 51000, img: "/categories/sport-bike.jpg", group: "cycle", sub: "Cycling", brand: "Trail", seller: "Spoke", city: "Pokhara", rating: 4.8, reviews: 76 }),
  p({ title: "Tennis Racket and Ball", price: 6800, was: 8900, img: "/categories/sport-tennis.jpg", group: "racket", sub: "Tennis", brand: "Court", grade: "Very Good", seller: "Baseline", rating: 4.5, reviews: 133 }),
  p({ title: "Baseball and Glove Set", price: 3400, was: 4200, img: "/shop/shop-baseball.png", group: "team", sub: "Baseball", brand: "Diamond", condition: "New", seller: "PlayYard" }),
  p({ title: "Camping Chair", price: 4500, was: 5900, img: "/shop/shop-chair.png", group: "cycle", sub: "Camping", brand: "Trail", seller: "CampNepal", city: "Lalitpur", rating: 4.4, reviews: 61 }),
  p({ title: "Running Watch", price: 9800, was: 12500, img: "/shop/shop-smartwatch.png", group: "fitness", sub: "Running", brand: "Pace", seller: "Pace", rating: 4.7, reviews: 204 }),
  p({ title: "Yoga Mat Roll", price: 1800, was: 2400, img: "/trending/home.png", group: "fitness", sub: "Yoga", brand: "Calm", condition: "New", seller: "CalmStudio", rating: 4.3, reviews: 90 }),
  p({ title: "Soccer Ball Match Size", price: 2600, was: 3300, img: "/categories/sport-basket.jpg", group: "team", sub: "Soccer", brand: "Pitch", condition: "New", seller: "PlayYard", city: "Pokhara" }),
];

const beauty: ElecProduct[] = [
  p({ id: 14, title: "Skincare Gift Set 5 Pieces", price: 4800, img: "/trending/beauty.png", group: "makeup", sub: "Skin care", brand: "Glow", condition: "New", seller: "GlowBar", href: "/listing/14", rating: 4.7, reviews: 366 }),
  p({ title: "Vanity Mirror Makeup Look", price: 6200, was: 7900, img: "/categories/beauty-mirror.jpg", group: "makeup", sub: "Makeup", brand: "Glow", seller: "GlowBar", rating: 4.8, reviews: 210 }),
  p({ title: "Eau de Parfum Bottle Set", price: 5400, was: 7200, img: "/categories/beauty-perfume.jpg", group: "scent", sub: "Fragrances for women", brand: "Nexlo", seller: "ScentRoom", city: "Lalitpur", rating: 4.6, reviews: 148 }),
  p({ title: "Coral Lipstick", price: 900, was: 1400, img: "/categories/beauty-lipstick.jpg", group: "makeup", sub: "Makeup", brand: "Glow", condition: "New", grade: "Excellent", seller: "GlowBar", rating: 4.5, reviews: 512 }),
  p({ title: "Men's Fragrance", price: 4600, was: 6100, img: "/categories/beauty-perfume.jpg", group: "scent", sub: "Fragrances for men", brand: "Nexlo", seller: "ScentRoom", city: "Pokhara" }),
  p({ title: "Hair Care Duo", price: 2100, was: 2800, img: "/trending/beauty.png", group: "makeup", sub: "Hair", brand: "Glow", condition: "New", seller: "SalonNepal", rating: 4.4, reviews: 97 }),
  p({ title: "Daily Vitamin Pack", price: 1600, was: 2100, img: "/categories/beauty-lipstick.jpg", group: "wellness", sub: "Vitamins", brand: "Well", condition: "New", seller: "WellHouse", rating: 4.3, reviews: 80 }),
  p({ title: "Soft Face Cream", price: 2400, was: 3200, img: "/categories/beauty-perfume.jpg", group: "makeup", sub: "Skin care", brand: "Glow", seller: "GlowBar", grade: "Very Good" }),
];

const industrial: ElecProduct[] = [
  p({ id: 16, title: "Cordless Drill 20V Kit", price: 9750, was: 12800, img: "/categories/industrial-drills.jpg", group: "tools", sub: "Power tools", brand: "Forge", condition: "New", seller: "ToolBay", href: "/listing/16", rating: 4.7, reviews: 256 }),
  p({ title: "Yellow and Red Drill Set", price: 14200, was: 17600, img: "/categories/industrial-drills.jpg", group: "tools", sub: "Light industrial tools", brand: "Forge", seller: "ToolBay", city: "Pokhara", rating: 4.6, reviews: 119 }),
  p({ title: "Pallet Jack with Crates", price: 38000, was: 46000, img: "/categories/industrial-pallet.jpg", group: "heavy", sub: "Heavy equipment", brand: "Yard", grade: "Very Good", seller: "YardWorks", shipping: "Local pickup", rating: 4.5, reviews: 41 }),
  p({ title: "Safety Helmet and Vest", price: 2800, was: 3600, img: "/categories/industrial-worker.jpg", group: "workplace", sub: "Safety", brand: "Guard", condition: "New", seller: "GuardLine" }),
  p({ title: "Packing Tape Carton Kit", price: 1500, was: 1900, img: "/categories/sell-box.jpg", group: "workplace", sub: "Packing and shipping", brand: "Ship", condition: "New", seller: "ShipDesk", rating: 4.4, reviews: 70 }),
  p({ title: "HVAC Service Gauge", price: 8600, was: 11000, img: "/categories/industrial-drills.jpg", group: "workplace", sub: "HVAC", brand: "Cool", seller: "CoolAir", city: "Lalitpur" }),
  p({ title: "Warehouse Cart", price: 12400, was: 15000, img: "/categories/industrial-pallet.jpg", group: "heavy", sub: "Automation", brand: "Yard", seller: "YardWorks", format: "auction" }),
  p({ title: "Inspection Lamp", price: 2200, was: 2900, img: "/categories/motor-light.jpg", group: "tools", sub: "Power tools", brand: "Forge", condition: "New", seller: "ToolBay" }),
];

const home: ElecProduct[] = [
  p({ id: 11, title: "Modern Sofa Two-Seater Beige", price: 42000, img: "/shop/shop-chair.png", group: "furniture", sub: "Home furniture", brand: "House", condition: "Used", grade: "Good", seller: "RoomEdit", href: "/listing/11", shipping: "Local pickup", rating: 4.5, reviews: 34 }),
  p({ id: 12, title: "Indoor Plant Set with Planters", price: 3200, img: "/trending/home.png", group: "garden", sub: "Plants", brand: "Green", condition: "New", seller: "GreenPot", href: "/listing/12", shipping: "NPR 200 shipping", rating: 4.8, reviews: 140 }),
  p({ title: "Checkered Throw Pillow", price: 1800, was: 2400, img: "/categories/home-pillow.jpg", group: "furniture", sub: "Decor", brand: "House", condition: "New", seller: "RoomEdit", rating: 4.6, reviews: 99 }),
  p({ title: "White Molded Chair", price: 7600, was: 9800, img: "/categories/home-chair.jpg", group: "furniture", sub: "Chairs", brand: "House", seller: "RoomEdit", city: "Lalitpur", rating: 4.7, reviews: 72 }),
  p({ title: "Cordless Stick Vacuum", price: 15400, was: 19800, img: "/categories/home-vacuum.jpg", group: "house", sub: "Vacuum cleaners", brand: "Clean", grade: "Very Good", seller: "CleanHome", rating: 4.6, reviews: 188 }),
  p({ title: "Kitchen Appliance Set", price: 8900, was: 11200, img: "/shop/shop-tv.png", group: "house", sub: "Appliances", brand: "Hearth", condition: "New", seller: "Hearth", city: "Pokhara" }),
  p({ title: "Outdoor Living Chair", price: 5400, was: 6900, img: "/shop/shop-chair.png", group: "garden", sub: "Outdoor living", brand: "Green", seller: "GreenPot" }),
  p({ title: "Desk Lamp", price: 2600, was: 3400, img: "/categories/motor-light.jpg", group: "house", sub: "Lighting", brand: "Hearth", condition: "New", seller: "Hearth", rating: 4.4, reviews: 57 }),
];

const refurbished = {
  kicker: "REFURBISHED & CERTIFIED",
  cta: "Shop Refurbished",
  condition: "Refurbished",
  badge: ["Verified", "Refurbished"] as const,
};

export const categoryBrowse: Record<string, CategoryBrowseConfig> = {
  electronics: {
    title: "Electronics",
    groups: elecGroups,
    products: elecProducts,
    hero: {
      image: "/categories/elec-hero-aligned.jpg",
      kicker: refurbished.kicker,
      lines: ["Premium Electronics.", "Smarter Prices."],
      text: "Quality checked, perfectly working, better for your wallet and the planet.",
      cta: refurbished.cta,
      condition: refurbished.condition,
    },
    cards: [
      { title: "Smartphones and smartwatches", text: "Latest phones, wearables & more", img: "/categories/elec-card-phones.jpg", group: "phones", bg: "bg-[#f3f7ff]" },
      { title: "Computers and accessories", text: "Laptops, desktops, parts & more", img: "/categories/elec-card-laptop.jpg", group: "computers", bg: "bg-[#eefbf6]" },
      { title: "Tablets and eReaders", text: "Tablets, eReaders & accessories", img: "/categories/elec-card-tablet-lilac.jpg", group: "computers", sub: "Tablets", bg: "bg-[#f3eefe]" },
    ],
    badge: refurbished.badge,
    trending: "Trending in Electronics",
    resultCount: 1248,
  },
  motors: {
    title: "Motors",
    groups: [
      { id: "car", name: "Car and truck parts", children: ["Engines", "Wheels and tires", "Exterior", "Interior", "Brakes"] },
      { id: "moto", name: "Motorcycle and more", children: ["Motorcycle parts", "Body and frame", "Wheels and rims", "Powersports gear"] },
      { id: "outdoor", name: "ATV, RV and boat", children: ["ATV and UTV", "RVs and campers", "Boat parts"] },
    ],
    products: motors,
    hero: {
      image: "/categories/motor-wheel.jpg",
      ...refurbished,
      lines: ["Parts for every", "ride."],
      text: "Engines, wheels, and accessories checked and ready for the road.",
    },
    cards: [
      { title: "Car and truck parts", text: "Engines, brakes, and exterior", img: "/categories/motor-pistons.jpg", group: "car", bg: "bg-[#f7f7f7]" },
      { title: "Motorcycle parts", text: "Wheels, frames, and gear", img: "/categories/motor-wheel.jpg", group: "moto", bg: "bg-[#eef3fb]" },
      { title: "Lighting and electrics", text: "Headlights and workshop tools", img: "/categories/motor-light.jpg", group: "car", sub: "Exterior", bg: "bg-[#f4f6f8]" },
    ],
    badge: refurbished.badge,
    trending: "Trending in Motors",
  },
  fashion: {
    title: "Fashion",
    groups: [
      { id: "women", name: "Women", children: ["Clothing", "Shoes", "Accessories"] },
      { id: "men", name: "Men", children: ["Clothing", "Shoes", "Accessories"] },
      { id: "kids", name: "Kids and baby", children: ["Clothing", "Shoes"] },
      { id: "luxury", name: "Luxury", children: ["Watches", "Handbags", "Sneakers"] },
    ],
    products: fashion,
    hero: {
      image: "/categories/fashion-person.jpg",
      ...refurbished,
      lines: ["Style that sets", "you apart."],
      text: "Checked pieces for women, men, and kids, from daily wear to watches.",
    },
    cards: [
      { title: "Women's fashion", text: "Jackets, bags, and shoes", img: "/shop/shop-jacket-women.png", group: "women", bg: "bg-[#f6f1ec]" },
      { title: "Men's fashion", text: "Jackets, sneakers, and more", img: "/shop/shop-jacket-men.png", group: "men", bg: "bg-[#eef2f6]" },
      { title: "Bags and watches", text: "Handbags, sneakers, watches", img: "/categories/fashion-bag.jpg", group: "luxury", bg: "bg-[#f7f4ff]" },
    ],
    badge: refurbished.badge,
    trending: "Trending in Fashion",
  },
  collectibles: {
    title: "Collectibles & Art",
    groups: [
      { id: "cards", name: "Trading cards", children: ["Sports cards", "Card games", "Non-sport cards"] },
      { id: "toys", name: "Toys and figures", children: ["Action figures", "Building sets"] },
      { id: "art", name: "Art and antiques", children: ["Art", "Antiques", "Coins"] },
    ],
    products: collectibles,
    hero: {
      image: "/categories/collect-person.jpg",
      ...refurbished,
      lines: ["Unique items for", "true enthusiasts."],
      text: "Cards, figures, and original art, checked before they reach you.",
    },
    cards: [
      { title: "Trading cards", text: "Sports, games, and comics", img: "/categories/collect-box.jpg", group: "cards", bg: "bg-[#fff8e8]" },
      { title: "Figures and sets", text: "Action figures and building sets", img: "/shop/shop-figure.png", group: "toys", bg: "bg-[#f4eef6]" },
      { title: "Art and antiques", text: "Paintings, cameras, and books", img: "/shop/shop-art.png", group: "art", bg: "bg-[#f7f4ef]" },
    ],
    badge: refurbished.badge,
    trending: "Trending in Collectibles",
  },
  sports: {
    title: "Sports",
    groups: [
      { id: "cycle", name: "Cycling and outdoor", children: ["Cycling", "Fishing", "Camping"] },
      { id: "fitness", name: "Fitness", children: ["Running", "Yoga", "Golf"] },
      { id: "team", name: "Team sports", children: ["Basketball", "Soccer", "Baseball"] },
      { id: "racket", name: "Tennis", children: ["Tennis", "Racquet sports"] },
    ],
    products: sports,
    hero: {
      image: "/categories/sport-basket.jpg",
      ...refurbished,
      lines: ["Unlimited activity", "and fun."],
      text: "Bikes, balls, rackets, and fitness gear ready for the next session.",
    },
    cards: [
      { title: "Cycling", text: "Bikes and outdoor gear", img: "/categories/sport-bike.jpg", group: "cycle", bg: "bg-[#eefbf6]" },
      { title: "Tennis", text: "Rackets and court gear", img: "/categories/sport-tennis.jpg", group: "racket", bg: "bg-[#f3f7ff]" },
      { title: "Team sports", text: "Basketball, soccer, baseball", img: "/categories/sport-basket.jpg", group: "team", bg: "bg-[#fff6ee]" },
    ],
    badge: refurbished.badge,
    trending: "Trending in Sports",
  },
  "health-beauty": {
    title: "Health & Beauty",
    groups: [
      { id: "makeup", name: "Makeup and skin", children: ["Makeup", "Skin care", "Hair"] },
      { id: "scent", name: "Fragrance", children: ["Fragrances for women", "Fragrances for men"] },
      { id: "wellness", name: "Health", children: ["Vitamins", "Oral hygiene", "Vision care"] },
    ],
    products: beauty,
    hero: {
      image: "/categories/beauty-mirror.jpg",
      ...refurbished,
      lines: ["Wellness and beauty", "every day."],
      text: "Skin, scent, and daily care, checked and ready to use.",
    },
    cards: [
      { title: "Makeup", text: "Color, lips, and mirrors", img: "/categories/beauty-mirror.jpg", group: "makeup", sub: "Makeup", bg: "bg-[#f8eef2]" },
      { title: "Fragrance", text: "Perfume for every day", img: "/categories/beauty-perfume.jpg", group: "scent", bg: "bg-[#f7f4ff]" },
      { title: "Skin care", text: "Creams, sets, and hair", img: "/trending/beauty.png", group: "makeup", sub: "Skin care", bg: "bg-[#f6f1ec]" },
    ],
    badge: refurbished.badge,
    trending: "Trending in Health & Beauty",
  },
  industrial: {
    title: "Industrial Equipment",
    groups: [
      { id: "tools", name: "Tools", children: ["Light industrial tools", "Power tools"] },
      { id: "heavy", name: "Heavy equipment", children: ["Heavy equipment", "Automation"] },
      { id: "workplace", name: "Workplace", children: ["Packing and shipping", "Safety", "HVAC"] },
    ],
    products: industrial,
    hero: {
      image: "/categories/industrial-worker.jpg",
      ...refurbished,
      lines: ["Reliable tools", "for your work."],
      text: "Drills, warehouse gear, and safety kit for shops and sites.",
    },
    cards: [
      { title: "Power tools", text: "Drills and workshop kits", img: "/categories/industrial-drills.jpg", group: "tools", bg: "bg-[#fff6ee]" },
      { title: "Warehouse gear", text: "Pallet jacks and carts", img: "/categories/industrial-pallet.jpg", group: "heavy", bg: "bg-[#f4f6f8]" },
      { title: "Safety", text: "Helmets, vests, and site kit", img: "/categories/industrial-worker.jpg", group: "workplace", sub: "Safety", bg: "bg-[#eefbf6]" },
    ],
    badge: refurbished.badge,
    trending: "Trending in Industrial",
  },
  "home-garden": {
    title: "Home & Garden",
    groups: [
      { id: "furniture", name: "Furniture", children: ["Home furniture", "Chairs", "Decor"] },
      { id: "garden", name: "Yard and garden", children: ["Outdoor living", "Plants"] },
      { id: "house", name: "Home care", children: ["Vacuum cleaners", "Appliances", "Lighting"] },
    ],
    products: home,
    hero: {
      image: "/categories/home-chair.jpg",
      ...refurbished,
      lines: ["Furnish, decorate,", "live better."],
      text: "Chairs, textiles, and home care picked for everyday rooms.",
    },
    cards: [
      { title: "Furniture", text: "Chairs, sofas, and pillows", img: "/categories/home-chair.jpg", group: "furniture", bg: "bg-[#f7f4ef]" },
      { title: "Decor", text: "Pillows and soft textiles", img: "/categories/home-pillow.jpg", group: "furniture", sub: "Decor", bg: "bg-[#f6f1ec]" },
      { title: "Home care", text: "Vacuums and small appliances", img: "/categories/home-vacuum.jpg", group: "house", bg: "bg-[#eefbf6]" },
    ],
    badge: refurbished.badge,
    trending: "Trending in Home & Garden",
  },
};
