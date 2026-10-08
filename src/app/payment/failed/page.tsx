"use client";

import Link from "next/link";

export default function PaymentFailedPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="mx-auto max-w-2xl px-4">
        <div className="rounded-lg bg-white p-12 text-center shadow">
          <div className="mb-6 text-6xl">❌</div>
          <h1 className="mb-4 text-3xl font-bold text-gray-900">Payment Failed</h1>
          <p className="mb-8 text-gray-600">
            Your payment could not be processed. Please try again or contact support if the problem persists.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/cart"
              className="rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
            >
              Back to Cart
            </Link>
            <Link
              href="/search"
              className="rounded-lg border border-gray-300 bg-white px-6 py-3 text-gray-700 hover:bg-gray-50"
            >
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
