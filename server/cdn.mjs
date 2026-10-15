function strip(value) {
  return String(value || "").replace(/\/$/, "");
}

export function cdnOrigin() {
  return strip(process.env.CDN_PUBLIC_URL || process.env.NEXT_PUBLIC_CDN_URL || "");
}

export function storageOrigin() {
  return strip(process.env.AWS_ENDPOINT_URL_S3 || process.env.S3_PUBLIC_URL || "");
}

export function publicObjectUrl(key) {
  const path = String(key || "").replace(/^\/+/, "");
  const cdn = cdnOrigin();
  if (cdn) return `${cdn}/uploads/${path}`;
  const origin = storageOrigin();
  return origin ? `${origin}/uploads/${path}` : `/uploads/${path}`;
}

export function cdnify(url) {
  if (!url) return url;
  const value = String(url);
  const cdn = cdnOrigin();
  if (!cdn) return value;
  const origin = storageOrigin();
  if (origin && value.startsWith(origin)) return cdn + value.slice(origin.length);
  if (value.startsWith("/uploads/")) return cdn + value;
  return value;
}

export function cdnifyListing(row) {
  if (!row) return row;
  return {
    ...row,
    primary_photo: cdnify(row.primary_photo),
    seller_avatar: cdnify(row.seller_avatar),
    avatar_url: cdnify(row.avatar_url),
    photos: Array.isArray(row.photos)
      ? row.photos.map((photo) => ({
          ...photo,
          url: cdnify(photo.url),
          thumbnail_url: cdnify(photo.thumbnail_url),
        }))
      : row.photos,
    variations: Array.isArray(row.variations)
      ? row.variations.map((variation) => ({
          ...variation,
          options: (variation.options || []).map((opt) => ({ ...opt, photo_url: cdnify(opt.photo_url) })),
        }))
      : row.variations,
  };
}
