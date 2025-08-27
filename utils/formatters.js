// utils/formatters.js
import { supabase } from "@/lib/supabaseClient";

// Convierte cualquier forma a URL pública utilizable en <img />
// Acepta:
// - "https://..." (devuelve igual)
// - "/storage/v1/object/public/..." (prefija con NEXT_PUBLIC_SUPABASE_URL)
// - "product-images/archivo.jpg" -> usa Storage.getPublicUrl()
// - { url: "..."}  -> url
// - { path: "..."} -> intenta bucket + path o publicUrl directo
// - { bucket, path } -> usa Storage.getPublicUrl()
export function toPublicUrl(input) {
  if (!input) return null;

  // string directo
  if (typeof input === "string") {
    const v = input.trim();
    if (!v) return null;

    if (v.startsWith("http://") || v.startsWith("https://")) {
      return v;
    }
    if (v.startsWith("/storage/v1/object/public/")) {
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "") || "";
      return `${base}${v}`;
    }
    // caso "bucket/path/archivo.jpg"
    const parts = v.split("/");
    if (parts.length >= 2) {
      const bucket = parts[0];
      const path = parts.slice(1).join("/");
      try {
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        return data?.publicUrl || null;
      } catch (_e) {
        return null;
      }
    }
    return null;
  }

  // objeto
  if (typeof input === "object") {
    if (input.url) return toPublicUrl(input.url);
    if (input.publicUrl) return toPublicUrl(input.publicUrl);
    if (input.bucket && input.path) {
      try {
        const { data } = supabase.storage.from(input.bucket).getPublicUrl(input.path);
        return data?.publicUrl || null;
      } catch (_e) {
        return null;
      }
    }
    if (input.path) return toPublicUrl(input.path);
  }

  return null;
}

// Normaliza imágenes de un producto en un array de URLs públicas.
export function normalizeImages(product) {
  const out = [];

  // array en product.images
  if (Array.isArray(product?.images)) {
    for (const it of product.images) {
      const u = toPublicUrl(it);
      if (u) out.push(u);
    }
  }

  // string en product.images
  if (!out.length && typeof product?.images === "string") {
    const u = toPublicUrl(product.images);
    if (u) out.push(u);
  }

  // fallback: image_url
  if (!out.length && product?.image_url) {
    const u = toPublicUrl(product.image_url);
    if (u) out.push(u);
  }

  // dedup & limpia
  return Array.from(new Set(out.filter(Boolean)));
}

// Plural simple para chips (UI en plural)
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
