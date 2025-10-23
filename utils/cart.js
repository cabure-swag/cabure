const KEY = 'caburee_cart_v1';
export function read(){ if (typeof window==='undefined') return {}; try { return JSON.parse(localStorage.getItem(KEY)||'{}'); } catch { return {}; } }
export function save(cart){ if (typeof window==='undefined') return; localStorage.setItem(KEY, JSON.stringify(cart)); }
export function add(brand_slug, p, qty=1){
  const cart = read();
  const byBrand = cart[brand_slug] || {};
  const line = byBrand[p.id] || { ...p, qty:0 };
  line.qty += qty;
  byBrand[p.id] = line;
  cart[brand_slug] = byBrand;
  save(cart);
}
export function lines(brand_slug){ return Object.values(read()[brand_slug] || {}); }
export function total(brand_slug){ return lines(brand_slug).reduce((s,l)=> s + l.price * l.qty, 0); }
export function clear(brand_slug){ const c = read(); delete c[brand_slug]; save(c); }
