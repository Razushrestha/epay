import { notFound } from "next/navigation";
import { ListingDetail } from "@/components/listing/ListingDetail";
import { SiteFooter } from "@/components/SiteFooter";
import { findProduct } from "@/lib/product-detail";

export default async function ListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = findProduct(Number(id));
  if (!product) notFound();

  return (
    <>
      <ListingDetail product={product} />
      <SiteFooter />
    </>
  );
}
