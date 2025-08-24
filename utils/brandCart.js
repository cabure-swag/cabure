// utils/brandCart.js
export function getBrandCart(brandSlug) {
  try {
    const raw = localStorage.getItem(`cart:${brandSlug}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function setBrandCart(brandSlug, items) {
  try {
    localStorage.setItem(`cart:${brandSlug}`, JSON.stringify(items || []));
    // Para que el Sidebar se auto-actualice si está en otra pestaña
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: `cart:${brandSlug}`,
        newValue: JSON.stringify(items || []),
      })
    );
  } catch {
    // no-op
  }
}

export function addToBrandCart(brandSlug, product, qty = 1) {
  const items = getBrandCart(brandSlug);
  const idx = items.findIndex((x) => x.product_id === product.id);
  const max = Number(product.stock ?? Infinity);
  if (idx >= 0) {
    const cur = Number(items[idx].qty || 0);
    items[idx].qty = Math.min(cur + Number(qty || 1), max);
  } else {
    items.push({
      product_id: product.id,
      name: product.name,
      price: Number(product.price || 0),
      qty: Math.max(1, Math.min(Number(qty || 1), max)),
      image:
        (Array.isArray(product.images) && product.images[0]) ||
        product.image_url ||
        product.image ||
        null,
      stock: max,
    });
  }
  setBrandCart(brandSlug, items);
  return items;
}
