"use client";

import { useEffect } from "react";

export default function PaymentFailedPage() {
  useEffect(() => {
    window.location.replace("/checkout?cancelled=1");
  }, []);

  return (
    <p className="p-8 text-[14px] text-[#6b7587]">Returning to checkout…</p>
  );
}
