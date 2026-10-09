import { apiBase, getToken } from "@/lib/account-api";

export const sessionKey = "nexlo_session";
export const localCartKey = "nexlo_local_cart";
export const localWatchKey = "nexlo_local_watch";
export const CART_EVENT = "nexlo:cart";
export const WATCH_EVENT = "nexlo:watch";

export type CartSnapshot = {
  listing_id: number;
  title: string;
  photo_url: string | null;
  price: number;
  quantity: number;
  seller_username: string;
};

export type WatchSnapshot = {
  listing_id: number;
  title: string;
  photo_url: string | null;
  price: number;
  href?: string;
};

export type CartItemView = {
  cart_item_id: number;
  listing_id: number;
  title: string;
  variation_sku_id: number | null;
  variation_combo: Record<string, string> | null;
  photo_url: string | null;
  quantity: number;
  price: number;
  current_price: number;
  price_changed: boolean;
  stock: number;
  in_stock: boolean;
  subtotal: number;
  local?: boolean;
};

export type SellerGroupView = {
  seller_id: number;
  seller_username: string;
  items: CartItemView[];
  subtotal: number;
  shipping_cost: number;
};

export function parseMoney(value: string | number | null | undefined) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const n = Number(String(value).replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function getSessionId() {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(sessionKey);
  if (!id) {
    id = crypto.randomUUID().replaceAll("-", "");
    localStorage.setItem(sessionKey, id);
  }
  return id;
}

export function commerceHeaders(init?: HeadersInit) {
  const headers = new Headers(init);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const session = getSessionId();
  if (session) headers.set("x-session-id", session);
  return headers;
}

function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function emit(name: string) {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(name));
}

export function getLocalCart() {
  return readLocal<CartSnapshot[]>(localCartKey, []);
}

export function getLocalWatch() {
  return readLocal<WatchSnapshot[]>(localWatchKey, []);
}

export async function addToCart(input: {
  listingId: number;
  quantity?: number;
  title?: string;
  photo?: string | null;
  price?: string | number;
  seller?: string;
  localOnly?: boolean;
}) {
  const quantity = Math.max(1, input.quantity ?? 1);
  const snapshot: CartSnapshot = {
    listing_id: input.listingId,
    title: input.title || `Item #${input.listingId}`,
    photo_url: input.photo ?? null,
    price: parseMoney(input.price),
    quantity,
    seller_username: input.seller || "Nexlo",
  };

  if (!input.localOnly) {
    try {
      const headers = commerceHeaders();
      headers.set("Content-Type", "application/json");
      const res = await fetch(`${apiBase}/api/v1/cart`, {
        method: "POST",
        headers,
        body: JSON.stringify({ listing_id: input.listingId, quantity }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error || "Could not add to cart");
      writeLocal(
        localCartKey,
        getLocalCart().filter((item) => item.listing_id !== input.listingId),
      );
      emit(CART_EVENT);
      return;
    } catch {
      /* catalog / guest fallback below */
    }
  }

  {
    const local = getLocalCart();
    const existing = local.find((item) => item.listing_id === snapshot.listing_id);
    if (existing) {
      existing.quantity += quantity;
      existing.title = snapshot.title;
      existing.photo_url = snapshot.photo_url || existing.photo_url;
      existing.price = snapshot.price || existing.price;
    } else {
      local.push(snapshot);
    }
    writeLocal(localCartKey, local);
  }
  emit(CART_EVENT);
}

export async function updateCartQuantity(cartItemId: number, quantity: number, listingId?: number) {
  if (cartItemId < 0 || listingId) {
    const id = listingId ?? Math.abs(cartItemId);
    const local = getLocalCart()
      .map((item) => (item.listing_id === id ? { ...item, quantity: Math.max(1, quantity) } : item))
      .filter((item) => item.quantity > 0);
    writeLocal(localCartKey, local);
    emit(CART_EVENT);
    return;
  }
  const headers = commerceHeaders();
  headers.set("Content-Type", "application/json");
  const res = await fetch(`${apiBase}/api/v1/cart/${cartItemId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ quantity }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error || "Could not update quantity");
  }
  emit(CART_EVENT);
}

export async function removeCartItem(cartItemId: number, listingId?: number) {
  if (cartItemId < 0 || listingId) {
    const id = listingId ?? Math.abs(cartItemId);
    writeLocal(
      localCartKey,
      getLocalCart().filter((item) => item.listing_id !== id),
    );
    emit(CART_EVENT);
    return;
  }
  const res = await fetch(`${apiBase}/api/v1/cart/${cartItemId}`, {
    method: "DELETE",
    headers: commerceHeaders(),
  });
  if (!res.ok) throw new Error("Could not remove item");
  emit(CART_EVENT);
}

function localAsGroup(local: CartSnapshot[]): SellerGroupView | null {
  if (!local.length) return null;
  const items: CartItemView[] = local.map((item) => ({
    cart_item_id: -item.listing_id,
    listing_id: item.listing_id,
    title: item.title,
    variation_sku_id: null,
    variation_combo: null,
    photo_url: item.photo_url,
    quantity: item.quantity,
    price: item.price,
    current_price: item.price,
    price_changed: false,
    stock: 99,
    in_stock: true,
    subtotal: item.price * item.quantity,
    local: true,
  }));
  return {
    seller_id: -1,
    seller_username: "Saved for you",
    items,
    subtotal: items.reduce((sum, item) => sum + item.subtotal, 0),
    shipping_cost: 0,
  };
}

export async function loadCartBundle() {
  let sellers: SellerGroupView[] = [];
  let apiSubtotal = 0;
  let apiItems = 0;
  let shipping = 0;
  try {
    const res = await fetch(`${apiBase}/api/v1/cart`, { headers: commerceHeaders() });
    if (res.ok) {
      const data = await res.json();
      sellers = data.sellers || [];
      apiSubtotal = Number(data.summary?.subtotal || 0);
      apiItems = Number(data.summary?.total_items || 0);
      shipping = Number(data.summary?.shipping || 0);
    }
  } catch {
    /* local cart still shows */
  }
  const localGroup = localAsGroup(getLocalCart());
  if (localGroup) {
    const apiIds = new Set(sellers.flatMap((group) => group.items.map((item) => item.listing_id)));
    localGroup.items = localGroup.items.filter((item) => !apiIds.has(item.listing_id));
    localGroup.subtotal = localGroup.items.reduce((sum, item) => sum + item.subtotal, 0);
    if (localGroup.items.length) sellers = [...sellers, localGroup];
  }
  const localItems = localGroup?.items.length ? localGroup.items : [];
  const subtotal = apiSubtotal + localItems.reduce((sum, item) => sum + item.subtotal, 0);
  const totalItems = apiItems + localItems.reduce((sum, item) => sum + item.quantity, 0);
  return {
    sellers,
    summary: {
      total_items: totalItems,
      subtotal: String(subtotal),
      shipping: String(shipping),
      tax: "0",
      total: String(subtotal + shipping),
    },
  };
}

export async function cartCount() {
  const bundle = await loadCartBundle();
  return bundle.summary.total_items;
}

export async function toggleWatch(input: {
  listingId: number;
  saved: boolean;
  title?: string;
  photo?: string | null;
  price?: string | number;
  localOnly?: boolean;
}) {
  const token = getToken();
  if (token && !input.localOnly) {
    try {
      const res = await fetch(`${apiBase}/api/v1/listings/${input.listingId}/watch`, {
        method: input.saved ? "DELETE" : "POST",
        headers: commerceHeaders(),
      });
      if (!res.ok && res.status !== 404) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || "Watchlist update failed");
      }
    } catch {
      /* keep a local copy so the heart still updates */
    }
  }
  const local = getLocalWatch();
  if (input.saved) {
    writeLocal(
      localWatchKey,
      local.filter((item) => item.listing_id !== input.listingId),
    );
  } else {
    const next = local.filter((item) => item.listing_id !== input.listingId);
    next.unshift({
      listing_id: input.listingId,
      title: input.title || `Item #${input.listingId}`,
      photo_url: input.photo ?? null,
      price: parseMoney(input.price),
      href: `/listing/${input.listingId}`,
    });
    writeLocal(localWatchKey, next);
  }
  emit(WATCH_EVENT);
}

export async function loadWatchIds() {
  const ids = new Set(getLocalWatch().map((item) => item.listing_id));
  if (!getToken()) return ids;
  try {
    const res = await fetch(`${apiBase}/api/v1/listings/watchlist`, { headers: commerceHeaders() });
    if (res.ok) {
      const body = await res.json();
      for (const row of body.listings || []) ids.add(Number(row.id));
    }
  } catch {
    /* local ids still used */
  }
  return ids;
}

export async function loadWatchlist() {
  const local = getLocalWatch();
  const byId = new Map<number, WatchSnapshot>(local.map((item) => [item.listing_id, item]));
  if (getToken()) {
    try {
      const res = await fetch(`${apiBase}/api/v1/listings/watchlist`, { headers: commerceHeaders() });
      if (res.ok) {
        const body = await res.json();
        for (const row of body.listings || []) {
          byId.set(Number(row.id), {
            listing_id: Number(row.id),
            title: row.title,
            photo_url: row.primary_photo ?? null,
            price: parseMoney(row.auction_current_price ?? row.price),
            href: `/listing/${row.id}`,
          });
        }
      }
    } catch {
      /* local list still used */
    }
  }
  return [...byId.values()];
}

export async function watchCount() {
  return (await loadWatchlist()).length;
}
