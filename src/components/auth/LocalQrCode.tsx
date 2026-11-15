"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

/**
 * Draws a QR code in the browser. The value (for example an authenticator setup link that contains
 * the account's 2FA secret) never leaves the device, unlike third-party QR image services.
 */
export function LocalQrCode({
  value,
  size = 180,
  className,
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  const [rendered, setRendered] = useState<{ value: string; url: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void QRCode.toDataURL(value, { width: size, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => {
        if (!cancelled) setRendered({ value, url });
      })
      .catch(() => {
        if (!cancelled) setRendered(null);
      });
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!rendered || rendered.value !== value) {
    return <div aria-hidden style={{ width: size, height: size }} className={className} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt="Authenticator QR code" src={rendered.url} width={size} height={size} className={className} />
  );
}
