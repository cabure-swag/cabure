// lib/brandCart.js
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

const BrandCartCtx = createContext(null);

export function BrandCartProvider({ brandSlug, children }) {
  const storageKey = useMemo(() => `cabure:cart:${brandSlug}`, [brandSlug]);
  const [items, setItems] = useState([]);

  // Cargar desde localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setItems(JSON.parse(raw));
    } catch {}
  }, [storageKey]);

  // Persistir en localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {}
  }, [storageKey, items]);

  const add = (p, qty = 1) => {
    setItems((prev) => {
      const i = prev.findIndex((x) => x.product_id === p.id);
      if (i === -1) {
        const newItem = {
          product_id: p.id,
          name: p.name,
          price: p.price,
          image_url: p.images?.[0] || p.image_url || null,
          qty: Math.max(1, Math.min(qty, p.stock ?? 999)),
          stock: p.stock ?? 999,
        };
        return [...prev, newItem];
      } else {
        const next = [...prev];
        const row = next[i];
        row.qty = Math.max(1, Math.min((row.qty ?? 1) + qty, row.stock ?? 999));
        return next;
      }
    });
  };

  const setQty = (product_id, qty) => {
    setItems((prev) =>
      prev
        .map((x) =>
          x.product_id === product_id
            ? { ...x, qty: Math.max(1, Math.min(qty, x.stock ?? 999)) }
            : x
        )
        .filter((x) => x.qty > 0)
    );
  };

  const remove = (product_id) => {
    setItems((prev) => prev.filter((x) => x.product_id !== product_id));
  };

  const clear = () => setItems([]);

  const subtotal = useMemo(
    () => items.reduce((acc, it) => acc + (Number(it.price) || 0) * (it.qty || 0), 0),
    [items]
  );

  const value = { items, add, setQty, remove, clear, subtotal, brandSlug };
  return <BrandCartCtx.Provider value={value}>{children}</BrandCartCtx.Provider>;
}

export function useBrandCart() {
  const ctx = useContext(BrandCartCtx);
  if (!ctx) throw new Error("useBrandCart debe usarse dentro de <BrandCartProvider />");
  return ctx;
}
