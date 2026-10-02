export const navCategories = [
  "Saved",
  "Electronics",
  "Motors",
  "Fashion",
  "Collectibles & Art",
  "Sports",
  "Health & Beauty",
  "Industrial Equipment",
  "Home & Garden",
  "Deals",
  "Sell",
];

const u = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=500&q=70`;

export const shopCategories = [
  { name: "Electronics", slug: "electronics", bg: "#eef3fb", img: "/categories/electronics.png" },
  { name: "Fashion", slug: "fashion", bg: "#f6f1ec", img: "/categories/fashion.png" },
  { name: "Motors", slug: "motors", bg: "#eef1f4", img: "/categories/motors.png" },
  { name: "Home & Garden", slug: "home-garden", bg: "#f7f4ef", img: "/categories/home.png" },
  { name: "Sports", slug: "sports", bg: "#f8eef1", img: "/categories/sports.png" },
  { name: "Health & Beauty", slug: "health-beauty", bg: "#f8eef2", img: "/categories/beauty.png" },
  { name: "Collectibles & Art", slug: "collectibles", bg: "#f4eef6", img: "/categories/art.png" },
  { name: "Industrial Equipment", slug: "industrial", bg: "#eef2f6", img: "/categories/industrial.png" },
];

export const todaysDeals = [
  {
    id: 1,
    title: 'Apple MacBook Air M2 13.6" 8GB/256GB',
    price: "NPR 1,24,999",
    was: "NPR 1,49,999",
    off: "17% OFF",
    img: u("photo-1517336714731-489689fd1ca8"),
  },
  {
    id: 2,
    title: "Sony WH-1000XM5 Wireless Headphones",
    price: "NPR 24,999",
    was: "NPR 33,999",
    off: "24% OFF",
    img: u("photo-1505740420928-5e560c06d30e"),
  },
  {
    id: 3,
    title: "Samsung Galaxy Watch6 44mm",
    price: "NPR 18,999",
    was: "NPR 26,999",
    off: "30% OFF",
    img: u("photo-1523275335684-37898b6baf30"),
  },
  {
    id: 4,
    title: "Nike Air Force 1 '07 White",
    price: "NPR 12,499",
    was: "NPR 16,999",
    off: "27% OFF",
    img: u("photo-1595950653106-6c9ebd614d3a"),
  },
  {
    id: 5,
    title: "PlayStation 5 Slim + Game Bundle",
    price: "NPR 74,999",
    was: "NPR 86,999",
    off: "13% OFF",
    img: u("photo-1606813907291-d86efa9b94db"),
  },
  {
    id: 6,
    title: "LEGO Technic Bugatti Chiron",
    price: "NPR 22,999",
    was: "NPR 29,999",
    off: "23% OFF",
    img: u("photo-1587654780291-39c9404d746b"),
  },
];

export const trending = [
  { name: "Tech", href: "/categories/electronics", img: "/trending/tech.png" },
  { name: "Motors", href: "/categories/motors", img: "/trending/motors.png" },
  { name: "Fashion", href: "/categories/fashion", img: "/trending/fashion.png" },
  { name: "Toys & Hobbies", href: "/search?q=toys", img: "/trending/toys.png" },
  { name: "Home & Garden", href: "/categories/home-garden", img: "/trending/home.png" },
  { name: "Beauty & Personal Care", href: "/categories/health-beauty", img: "/trending/beauty.png" },
  { name: "Collectibles", href: "/categories/collectibles", img: "/trending/collectibles.png" },
  { name: "Books & Magazines", href: "/search?q=books", img: "/trending/books.png" },
];

export const promoTiles = [
  { img: u("photo-1590658268037-6bf12165a8df"), bg: "bg-sky-400" },
  { img: u("photo-1600185365483-26d7a4cc7519"), bg: "bg-fuchsia-400" },
  { img: u("photo-1553062407-98eeb64c6a62"), bg: "bg-indigo-900" },
  { img: u("photo-1524805444758-089113d48a6d"), bg: "bg-slate-800" },
  { img: u("photo-1516035069371-29a1b244cc32"), bg: "bg-purple-500" },
  { img: u("photo-1511707171634-5f897ff02aa9"), bg: "bg-cyan-400" },
];

export const premiumPicks = [
  { label: "Smart watch", img: u("photo-1546868871-7041f2a55e12") },
  { label: "Backpack", img: u("photo-1491637639811-60e2756cc1c7") },
  { label: "Earbuds", img: u("photo-1572569511254-d8f925fe2cbb") },
  { label: "Sleeve", img: u("photo-1627123424574-724758594e93") },
];

export type Listing = {
  id: number;
  title: string;
  price: string;
  was?: string;
  off?: string;
  img: string;
  category: string;
  bids?: number;
  format: "auction" | "fixed";
  timeLeft?: string;
  condition: string;
  shipping: string;
};

export const listings: Listing[] = [
  { id: 1, title: 'Apple MacBook Air M2 13.6" 8GB/256GB', price: "NPR 1,24,999", was: "NPR 1,49,999", off: "17% OFF", img: u("photo-1517336714731-489689fd1ca8"), category: "electronics", format: "fixed", condition: "Used", shipping: "Free shipping" },
  { id: 2, title: "Sony WH-1000XM5 Wireless Headphones", price: "NPR 24,999", was: "NPR 33,999", off: "24% OFF", img: u("photo-1505740420928-5e560c06d30e"), category: "electronics", format: "fixed", condition: "New", shipping: "Free shipping" },
  { id: 3, title: "Samsung Galaxy Watch6 44mm", price: "NPR 18,999", was: "NPR 26,999", off: "30% OFF", img: u("photo-1523275335684-37898b6baf30"), category: "electronics", format: "auction", bids: 18, timeLeft: "2h 14m", condition: "New", shipping: "Free shipping" },
  { id: 4, title: "Nike Air Force 1 '07 White", price: "NPR 12,499", was: "NPR 16,999", off: "27% OFF", img: u("photo-1595950653106-6c9ebd614d3a"), category: "fashion", format: "fixed", condition: "New", shipping: "NPR 250 shipping" },
  { id: 5, title: "PlayStation 5 Slim + Game Bundle", price: "NPR 74,999", was: "NPR 86,999", off: "13% OFF", img: u("photo-1606813907291-d86efa9b94db"), category: "electronics", format: "auction", bids: 41, timeLeft: "5h 02m", condition: "New", shipping: "Free shipping" },
  { id: 6, title: "LEGO Technic Bugatti Chiron", price: "NPR 22,999", was: "NPR 29,999", off: "23% OFF", img: u("photo-1587654780291-39c9404d746b"), category: "collectibles", format: "fixed", condition: "New", shipping: "Free shipping" },
  { id: 7, title: "iPhone 15 128GB Blue", price: "NPR 98,500", img: u("photo-1511707171634-5f897ff02aa9"), category: "electronics", format: "auction", bids: 27, timeLeft: "1d 3h", condition: "Used", shipping: "Free shipping" },
  { id: 8, title: "Leather Crossbody Bag Tan", price: "NPR 6,450", img: u("photo-1584917865442-de89df76afd3"), category: "fashion", format: "fixed", condition: "New", shipping: "NPR 180 shipping" },
  { id: 9, title: "Classic Leather Jacket Black", price: "NPR 14,200", img: u("photo-1551028719-00167b16eac5"), category: "fashion", format: "auction", bids: 9, timeLeft: "8h 40m", condition: "Used", shipping: "Free shipping" },
  { id: 10, title: "Sports Car Scale Model 1:18", price: "NPR 8,900", img: u("photo-1503376780353-7e6692767b70"), category: "motors", format: "fixed", condition: "New", shipping: "NPR 400 shipping" },
  { id: 11, title: "Modern Sofa Two-Seater Beige", price: "NPR 42,000", img: u("photo-1555041469-a586c61ea9bc"), category: "home-garden", format: "fixed", condition: "Used", shipping: "Local pickup" },
  { id: 12, title: "Indoor Plant Set with Planters", price: "NPR 3,200", img: u("photo-1485955900006-10f4d324d411"), category: "home-garden", format: "fixed", condition: "New", shipping: "NPR 200 shipping" },
  { id: 13, title: "Basketball Official Size 7", price: "NPR 2,150", img: u("photo-1519861531473-9200262188bf"), category: "sports", format: "fixed", condition: "New", shipping: "Free shipping" },
  { id: 14, title: "Skincare Gift Set 5 Pieces", price: "NPR 4,800", img: u("photo-1596462502278-27bfdc403348"), category: "health-beauty", format: "fixed", condition: "New", shipping: "Free shipping" },
  { id: 15, title: "Original Oil Painting Landscape", price: "NPR 16,500", img: u("photo-1579783902614-a3fb3927b6a5"), category: "collectibles", format: "auction", bids: 6, timeLeft: "3d 1h", condition: "Used", shipping: "NPR 350 shipping" },
  { id: 16, title: "Cordless Drill 20V Kit", price: "NPR 9,750", img: u("photo-1504148455328-c376907d081c"), category: "industrial", format: "fixed", condition: "New", shipping: "Free shipping" },
  { id: 17, title: "Vintage Camera 35mm Film", price: "NPR 11,200", img: u("photo-1516035069371-29a1b244cc32"), category: "collectibles", format: "auction", bids: 14, timeLeft: "12h 05m", condition: "Used", shipping: "NPR 220 shipping" },
  { id: 18, title: "Stack of Hardcover Novels", price: "NPR 1,850", img: u("photo-1512820790803-83ca734da794"), category: "collectibles", format: "fixed", condition: "Used", shipping: "NPR 150 shipping" },
];

export const categoryNames: Record<string, string> = {
  electronics: "Electronics",
  fashion: "Fashion",
  motors: "Motors",
  "home-garden": "Home & Garden",
  sports: "Sports",
  "health-beauty": "Health & Beauty",
  collectibles: "Collectibles & Art",
  "collectibles-art": "Collectibles & Art",
  industrial: "Industrial Equipment",
  "industrial-equipment": "Industrial Equipment",
  saved: "Saved",
  deals: "Deals",
  sell: "Sell",
};

export const categoryAliases: Record<string, string> = {
  "collectibles-art": "collectibles",
  "industrial-equipment": "industrial",
};

export const heroRightImages = {
  main: u("photo-1496181133206-80ce9b88a853"),
  sneakers: u("photo-1542291026-7eec264c27ff"),
  phone: u("photo-1511707171634-5f897ff02aa9"),
  headphones: u("photo-1505740420928-5e560c06d30e"),
  watch: u("photo-1523275335684-37898b6baf30"),
  bag: u("photo-1584917865442-de89df76afd3"),
  glasses: u("photo-1572635196237-14b3f281503f"),
};
