import { BrowsePage } from "@/components/browse/BrowsePage";
import { listings } from "@/lib/home-data";

export default function DealsPage() {
  const deals = listings.filter((l) => l.off);
  return (
    <BrowsePage
      title="Today's Deals"
      crumb="Deals"
      items={deals}
      subtitle="Limited-time offers. Don't miss out!"
    />
  );
}
