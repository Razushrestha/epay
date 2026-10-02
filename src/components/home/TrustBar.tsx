const items = [
  {
    title: "Buy with confidence",
    text: "Buyer protection & secure payments",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#191919" strokeWidth="1.6">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
  {
    title: "Worldwide shipping",
    text: "Millions of products, delivered globally",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#191919" strokeWidth="1.6">
        <circle cx="12" cy="12" r="10" />
        <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
  },
  {
    title: "24/7 customer support",
    text: "We're here to help",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#191919" strokeWidth="1.6">
        <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
      </svg>
    ),
  },
  {
    title: "Easy returns",
    text: "Hassle-free within 30 days",
    icon: (
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#191919" strokeWidth="1.6">
        <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
        <path d="M3 3v5h5" />
      </svg>
    ),
  },
];

export function TrustBar() {
  return (
    <section className="page-shell py-9">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <div key={item.title} className="flex items-start gap-3">
            <span className="mt-[1px] shrink-0">{item.icon}</span>
            <span>
              <span className="block text-[13.5px] font-bold text-[#191919]">{item.title}</span>
              <span className="mt-[2px] block text-[12px] leading-snug text-[#707070]">{item.text}</span>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
