import { redirect } from "next/navigation";

export default async function UsrRedirect({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  redirect(`/seller/${handle}`);
}
