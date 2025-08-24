// utils/brandCart.js
// Carrito por marca – seguro para SSR

const isBrowser = () => typeof window !== "undefined";

const key = (brandSlug) => `cabure:cart:${brandSlug || "unknown"}`;

export function readBrandCart(brandSlug) {
  try {
    if (!isBrowser()) return [];
    const raw = window.localStorage.getItem(key(brandSlug));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function writeBrandCart(brandSlug, items) {
  try {
    if (!isBrowser()) return;
    window.localStorage.setItem(key(brandSlug), JSON.stringify(items || []));
  } catch {}
}

export function clearBrandCart(brandSlug) {
  try {
    if (!isBrowser()) return;
    window.localStorage.removeItem(key(brandSlug));
  } catch {}
}

// Agrega o incrementa qty; respeta stock si viene en el producto
export function addToBrandCart(brandSlug, product, qty = 1) {
  if (!brandSlug || !product?.id) return;
  const items = readBrandCart(brandSlug);
  const idx = items.findIndex((it) => it.id === product.id);
  const inc = Math.max(1, Number(qty || 1));

  if (idx === -1) {
    const max = product.stock != null ? Number(product.stock) : Infinity;
    items.push({
      id: product.id,
      name: product.name || "",
      price: Number(product.price || 0),
      qty: Math.min(inc, isFinite(max) ? max : inc),
    });
  } else {
    const max = product.stock != null ? Number(product.stock) : Infinity;
    const nextQty = items[idx].qty + inc;
    items[idx].qty = isFinite(max) ? Math.min(nextQty, max) : nextQty;
  }

  writeBrandCart(brandSlug, items);

  // dispara un storage event a mano para que otros tabs/comp reactualicen
  try {
    if (isBrowser()) {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: key(brandSlug),
          newValue: JSON.stringify(items),
        })
      );
    }
  } catch {}
}
