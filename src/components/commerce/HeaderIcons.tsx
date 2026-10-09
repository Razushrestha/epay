"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CART_EVENT, WATCH_EVENT, cartCount, watchCount } from "@/lib/commerce";

function Badge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#e53238] px-1 text-[10px] font-bold text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function HeaderIcons() {
  const [cart, setCart] = useState(0);
  const [watch, setWatch] = useState(0);

  useEffect(() => {
    let alive = true;
    async function refreshCart() {
      try {
        const n = await cartCount();
        if (alive) setCart(n);
      } catch {
        if (alive) setCart(0);
      }
    }
    async function refreshWatch() {
      try {
        const n = await watchCount();
        if (alive) setWatch(n);
      } catch {
        if (alive) setWatch(0);
      }
    }
    refreshCart();
    refreshWatch();
    window.addEventListener(CART_EVENT, refreshCart);
    window.addEventListener(WATCH_EVENT, refreshWatch);
    window.addEventListener("storage", refreshCart);
    window.addEventListener("storage", refreshWatch);
    return () => {
      alive = false;
      window.removeEventListener(CART_EVENT, refreshCart);
      window.removeEventListener(WATCH_EVENT, refreshWatch);
      window.removeEventListener("storage", refreshCart);
      window.removeEventListener("storage", refreshWatch);
    };
  }, []);

  return (
    <>
      <Link href="/watchlist" aria-label="Watchlist" className="relative text-[#333] hover:text-[#3665f3]">
        <svg width="22" height="22" viewBox="0 0 24 24" fill={watch ? "#e53238" : "none"} stroke="currentColor" strokeWidth="1.7">
          <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z" />
        </svg>
        <Badge count={watch} />
      </Link>
      <Link href="/cart" aria-label="Cart" className="relative text-[#333] hover:text-[#3665f3]">
        <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
        </svg>
        <Badge count={cart} />
      </Link>
    </>
  );
}
