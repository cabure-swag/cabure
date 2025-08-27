// utils/formatters.js

// Plural simple en español para las categorías más comunes del sitio.
// Si no está en el mapa, aplicamos una regla básica (termina en vocal -> +s, sino +es).
export function pluralizeEs(word = "") {
  const base = String(word || "").trim();
  if (!base) return "";

  const m = {
    Campera: "Camperas",
    Remera: "Remeras",
    Buzo: "Buzos",
    Pantalon: "Pantalones",
    Pantalón: "Pantalones",
    Gorra: "Gorras",
    Jean: "Jeans",
    Short: "Shorts",
    Camisa: "Camisas",
    Zapatilla: "Zapatillas",
    Accesorio: "Accesorios",
    Otro: "Otros",
    Otros: "Otros",
  };
  if (m[base]) return m[base];

  const last = base.slice(-1).toLowerCase();
  if (["a", "e", "i", "o", "u"].includes(last)) return base + "s";
  return base + "es";
}

// Normaliza el campo de imágenes de productos para que siempre tengamos un array de strings (URLs públicas).
// Acepta:
// - product.images = ["url1","url2",...]
// - product.images = [{url:"..."}, {url:"..."}]
// - product.image_url = "..."
export function normalizeImages(product) {
  const urls = [];

  if (product?.images) {
    if (Array.isArray(product.images)) {
      for (const it of product.images) {
        if (!it) continue;
        if (typeof it === "string") urls.push(it);
        else if (typeof it === "object" && it.url) urls.push(it.url);
        else if (typeof it === "object" && it.path) {
          // por si guardaste { path: ".../public/brand-logos/..." }
          urls.push(it.path);
        }
      }
    } else if (typeof product.images === "string") {
      urls.push(product.images);
    }
  }
  if ((!urls.length) && product?.image_url) urls.push(product.image_url);

  // quitamos duplicados y vacíos
  const clean = Array.from(new Set(urls.filter(Boolean)));
  return clean;
}
