"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { accountApi } from "@/lib/account-api";

function OrdersContent() {
  const searchParams = useSearchParams();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    try {
      const token = accountApi.getToken();
      if (!token) {
        window.location.href = "/login?redirect=/orders";
        return;
      }

      const body = await accountApi<{ data: any[] }>("/api/v1/orders");
      setOrders(body.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Check for success parameter
  const success = searchParams?.get("success");

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-7xl px-4">
        {success && (
          <div className="mb-8 rounded-lg bg-green-50 p-6">
            <div className="text-center">
              <div className="mb-4 text-6xl">✅</div>
              <h2 className="text-2xl font-bold text-green-900">Payment Successful!</h2>
              <p className="mt-2 text-green-700">Your order has been confirmed and is being processed.</p>
            </div>
          </div>
        )}

        <h1 className="mb-8 text-3xl font-bold text-gray-900">My Orders</h1>

        {loading ? (
          <div className="text-center text-gray-500">Loading orders...</div>
        ) : orders.length === 0 ? (
          <div className="rounded-lg bg-white p-12 text-center shadow">
            <div className="mb-4 text-6xl">📦</div>
            <h2 className="text-2xl font-bold text-gray-900">No orders yet</h2>
            <p className="mt-2 text-gray-600">Start shopping to see your orders here!</p>
            <Link
              href="/search"
              className="mt-6 inline-block rounded-lg bg-blue-600 px-6 py-3 text-white hover:bg-blue-700"
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <Link key={order.id} href={`/orders/${order.order_number}`} className="block rounded-lg bg-white p-6 shadow hover:ring-1 hover:ring-[#2f6bff]">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">Order #{order.order_number}</h3>
                    <p className="text-sm text-gray-500">Placed on {new Date(order.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">NPR {Number(order.total_amount).toLocaleString()}</div>
                    <div className="text-sm capitalize text-gray-500">{String(order.status).replace(/_/g, " ")}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 py-8"><div className="text-center">Loading...</div></div>}>
      <OrdersContent />
    </Suspense>
  );
}
