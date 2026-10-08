import { notFound } from "next/navigation";
import { ListingDetail } from "@/components/listing/ListingDetail";
import { LiveListing } from "@/components/listing/LiveListing";
import { SiteFooter } from "@/components/SiteFooter";
import { findProduct } from "@/lib/product-detail";

export default async function ListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  try {
    const res = await fetch(`${api}/api/v1/listings/${id}`, { cache: "no-store" });
    if (res.ok) {
      const body = (await res.json()) as { listing?: Record<string, unknown> };
      if (body.listing) return <LiveListing listing={body.listing as never} />;
    }
  } catch {
    /* fall back to catalog mock */
  }
  const product = findProduct(Number(id));
  if (!product) notFound();

  return (
    <>
      <ListingDetail product={product} />
      <SiteFooter />
    </>
  );
}
