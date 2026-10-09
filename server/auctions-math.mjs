export function applyProxyBid({
  highId,
  highMax,
  price,
  start,
  bidderId,
  maxAmount,
  increment,
}) {
  let nextHigh = highId;
  let nextMax = Number(highMax) || 0;
  let nextPrice = Number(price) || Number(start) || 0;
  let outbidUser = null;
  let lostLead = false;

  if (!highId) {
    nextHigh = bidderId;
    nextMax = maxAmount;
    nextPrice = Number(start) || 0;
  } else if (Number(highId) === Number(bidderId)) {
    nextMax = Math.max(nextMax, maxAmount);
  } else if (maxAmount > nextMax) {
    nextPrice = Math.min(maxAmount, nextMax + increment);
    outbidUser = highId;
    nextHigh = bidderId;
    nextMax = maxAmount;
  } else {
    nextPrice = Math.min(nextMax, maxAmount + increment);
    lostLead = true;
  }

  return { highId: nextHigh, highMax: nextMax, price: nextPrice, outbidUser, lostLead };
}

export function softCloseEndsAt(endsAt, now = Date.now(), windowMs = 2 * 60 * 1000, extendMs = 5 * 60 * 1000, maxExtensions = 8, extensionCount = 0) {
  if (!endsAt) return { endsAt, extensionCount };
  const end = new Date(endsAt).getTime();
  if (end - now >= windowMs) return { endsAt, extensionCount };
  if (extensionCount >= maxExtensions) return { endsAt, extensionCount };
  return { endsAt: new Date(now + extendMs).toISOString(), extensionCount: extensionCount + 1 };
}
