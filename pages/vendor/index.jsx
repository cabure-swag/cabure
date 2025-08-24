// pages/vendor/index.jsx
import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Head from "next/head";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import ImageBox from "@/components/ImageBox";

// ----- helpers -----
const money = (n) => {
  const v = Number(n || 0);
  return v.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
};
const slugify = (s) =>
  (s || "")
    .toString()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 60);

// ----- página interna (sin SSR) -----
function VendorInner() {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [err, setErr] = useState("");

  // marcas del vendedor
  const [brands, setBrands] = useState(null);
  const [brandId, setBrandId] = useState(null);

  // data de catálogo
  const [products, setProducts] = useState(null);
  const [prodLoading, setProdLoading] = useState(false);

  // data de pedidos
  const [orders, setOrders] = useState(null);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // ui
  const [showCreateProduct, setShowCreateProduct] = useState(false);

  // sesión + rol
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!alive) return;
        const s = data?.session ?? null;
        setSession(s);

        if (s?.user?.id) {
          const { data: prof, error } = await supabase
            .from("profiles")
            .select("role,email")
            .eq("user_id", s.user.id)
            .maybeSingle();
          if (error) throw error;
          setRole(prof?.role ?? null);
        } else {
          setRole(null);
        }
      } catch (e) {
        setErr(e.message || "No se pudo cargar la sesión.");
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub?.subscription?.unsubscribe?.();
  }, []);

  // cargar marcas del vendedor (o todas si admin)
  useEffect(() => {
    if (!session) return;
    (async () => {
      try {
        setErr("");
        if (role === "admin") {
          const { data, error } = await supabase
            .from("brands")
            .select("id,name,slug,active,deleted_at")
            .order("name", { ascending: true });
          if (error) throw error;
          setBrands(data || []);
          if (!brandId && (data || []).length) setBrandId(data[0].id);
        } else if (role === "vendor") {
          const uid = session.user.id;
          const { data: bu, error: e1 } = await supabase
            .from("brand_users")
            .select("brand_id")
            .eq("user_id", uid);
          if (e1) throw e1;
          const ids = [...new Set((bu || []).map((x) => x.brand_id))];
          if (ids.length === 0) {
            setBrands([]);
            setBrandId(null);
            return;
          }
          const { data: brs, error: e2 } = await supabase
            .from("brands")
            .select("id,name,slug,active,deleted_at")
            .in("id", ids)
            .order("name", { ascending: true });
          if (e2) throw e2;
          setBrands(brs || []);
          if (!brandId && (brs || []).length) setBrandId(brs[0].id);
        }
      } catch (e) {
        setBrands([]);
        setErr(e.message || "No se pudieron cargar tus marcas.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, role]);

  // cargar productos de la marca elegida
  async function loadProducts(bid = brandId) {
    if (!bid) return;
    setProdLoading(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id,brand_id,name,price,image_url,image_urls,category,subcategory,active,deleted_at,created_at,stock")
        .eq("brand_id", bid)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setProducts(data || []);
    } catch (e) {
      setProducts([]);
      alert(e.message || "No se pudieron cargar productos.");
    } finally {
      setProdLoading(false);
    }
  }

  // cargar pedidos de la marca elegida (con detalles)
  async function loadOrders(bid = brandId) {
    if (!bid) return;
    setOrdersLoading(true);
    try {
      const { data: ods, error } = await supabase
        .from("orders")
        .select("id,brand_id,buyer_id,total,status,payment_method,mp_preference_id,mp_payment_id,created_at")
        .eq("brand_id", bid)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;

      const orderIds = (ods || []).map((o) => o.id);
      let itemsMap = {};
      if (orderIds.length) {
        const { data: it, error: e2 } = await supabase
          .from("order_items")
          .select("id,order_id,product_id,qty,unit_price,created_at")
          .in("order_id", orderIds);
        if (e2) throw e2;
        for (const row of it || []) {
          if (!itemsMap[row.order_id]) itemsMap[row.order_id] = [];
          itemsMap[row.order_id].push(row);
        }
      }
      setOrders((ods || []).map((o) => ({ ...o, items: itemsMap[o.id] || [] })));
    } catch (e) {
      setOrders([]);
      alert(e.message || "No se pudieron cargar pedidos.");
    } finally {
      setOrdersLoading(false);
    }
  }

  // refrescar cuando cambia la marca
  useEffect(() => {
    if (!brandId) return;
    loadProducts(brandId);
    loadOrders(brandId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId]);

  const brand = useMemo(() => (brands || []).find((b) => b.id === brandId) || null, [brands, brandId]);

  // guards UI
  if (!session) {
    return (
      <div className="container">
        <Head><title>Vendedor — CABURE.STORE</title><meta name="robots" content="noindex" /></Head>
        <h1>Vendedor</h1>
        <div className="card" style={{ padding: 16 }}>
          <p>Necesitás iniciar sesión.</p>
          <Link href="/soporte" className="btn">Iniciar sesión</Link>
        </div>
      </div>
    );
  }
  if (!role || (role !== "vendor" && role !== "admin")) {
    return (
      <div className="container">
        <Head><title>Vendedor — CABURE.STORE</title><meta name="robots" content="noindex" /></Head>
        <h1>Vendedor</h1>
        <div className="card" style={{ padding: 16 }}>
          <p>No tenés permisos de vendedor.</p>
          <Link href="/" className="btn">Volver</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <Head><title>Vendedor — CABURE.STORE</title><meta name="robots" content="noindex" /></Head>
      <h1>Vendedor</h1>

      {/* selector de marca */}
      <section className="card" style={{ padding: 12, marginTop: 8 }}>
        <label className="input-label">Marca</label>
        {!brands ? (
          <div className="skel" style={{ height: 44 }} />
        ) : brands.length === 0 ? (
          <div>No tenés marcas asignadas aún.</div>
        ) : (
          <select className="input" value={brandId || ""} onChange={(e) => setBrandId(e.target.value)}>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>
                {b.deleted_at ? "🗑️ " : ""}{b.name} — /marcas/{b.slug}
              </option>
            ))}
          </select>
        )}
      </section>

      {brand && (
        <>
          {/* catálogo */}
          <section className="card" style={{ padding: 16, marginTop: 12 }}>
            <div className="row" style={{ alignItems: "center", gap: 8 }}>
              <h2 style={{ margin: 0 }}>Catálogo</h2>
              <div style={{ flex: 1 }} />
              <button className="btn" onClick={() => setShowCreateProduct(true)}>Nuevo producto</button>
              <button className="btn ghost" onClick={() => loadProducts()} disabled={prodLoading}>
                {prodLoading ? "Actualizando…" : "Refrescar"}
              </button>
            </div>

            {showCreateProduct && (
              <CreateProductForm
                brandId={brand.id}
                onCancel={() => setShowCreateProduct(false)}
                onCreated={async () => { setShowCreateProduct(false); await loadProducts(); }}
              />
            )}

            {!products ? (
              <div className="skel" style={{ height: 140, marginTop: 8 }} />
            ) : products.length === 0 ? (
              <div style={{ marginTop: 8 }}>Aún no hay productos.</div>
            ) : (
              <div className="grid grid-4" style={{ gap: 12, marginTop: 12 }}>
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} onChanged={loadProducts} />
                ))}
              </div>
            )}
          </section>

          {/* pedidos */}
          <section className="card" style={{ padding: 16, marginTop: 12 }}>
            <div className="row" style={{ alignItems: "center", gap: 8 }}>
              <h2 style={{ margin: 0 }}>Pedidos</h2>
              <div style={{ flex: 1 }} />
              <button className="btn ghost" onClick={() => loadOrders()} disabled={ordersLoading}>
                {ordersLoading ? "Actualizando…" : "Refrescar"}
              </button>
            </div>

            {!orders ? (
              <div className="skel" style={{ height: 140, marginTop: 8 }} />
            ) : orders.length === 0 ? (
              <div style={{ marginTop: 8 }}>Sin pedidos por ahora.</div>
            ) : (
              <div className="card" style={{ padding: 0, marginTop: 12, overflowX: "auto" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Total</th>
                      <th>Método</th>
                      <th>Estado</th>
                      <th>Items</th>
                      <th style={{ width: 160 }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id}>
                        <td>{new Date(o.created_at).toLocaleString("es-AR")}</td>
                        <td>{money(o.total)}</td>
                        <td>{o.payment_method || "—"}</td>
                        <td>{o.status || "—"}</td>
                        <td>
                          {(o.items || []).length
                            ? o.items.map((it) => (
                                <div key={it.id} style={{ fontSize: 12, opacity: 0.9 }}>
                                  #{String(it.product_id).slice(0, 6)} • x{it.qty} • {money(it.unit_price)}
                                </div>
                              ))
                            : "—"}
                        </td>
                        <td>
                          <button className="btn danger xsmall" onClick={() => deleteOrder(o.id)}>Eliminar</button>
                          {o.mp_payment_id ? (
                            <a className="btn ghost xsmall" href={`https://www.mercadopago.com.ar/money-transfer/details/${o.mp_payment_id}`} target="_blank" rel="noreferrer">
                              MP
                            </a>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* grid 4 por fila responsivo para el vendor */}
          <style jsx>{`
            .grid.grid-4 {
              display: grid;
              grid-template-columns: repeat(4, minmax(0, 1fr));
            }
            @media (max-width: 1100px) {
              .grid.grid-4 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
            }
            @media (max-width: 800px) {
              .grid.grid-4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            }
            @media (max-width: 520px) {
              .grid.grid-4 { grid-template-columns: 1fr; }
            }
          `}</style>
        </>
      )}
    </div>
  );

  // eliminar pedido
  async function deleteOrder(orderId) {
    if (!confirm("¿Eliminar este pedido? Esta acción no se puede deshacer.")) return;
    try {
      const { error: e1 } = await supabase.from("order_items").delete().eq("order_id", orderId);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("orders").delete().eq("id", orderId);
      if (e2) throw e2;
      await loadOrders();
      alert("Pedido eliminado.");
    } catch (e) {
      alert(e.message || "No se pudo eliminar el pedido.");
    }
  }
}

// ----- crear producto (con múltiples imágenes) -----
function CreateProductForm({ brandId, onCancel, onCreated }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [stock, setStock] = useState("1");
  const [files, setFiles] = useState([]); // múltiples
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) { alert("Nombre obligatorio"); return; }
    const priceNum = Number(price || 0);
    if (Number.isNaN(priceNum) || priceNum < 0) { alert("Precio inválido"); return; }

    let stockNum = parseInt(stock === "" ? "1" : stock, 10);
    if (Number.isNaN(stockNum) || stockNum < 0) stockNum = 1;

    setSaving(true);
    try {
      // subir hasta 5 imágenes
      const selected = files.slice(0, 5);
      const urls = [];
      for (const file of selected) {
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${brandId}/${Date.now()}-${slugify(name)}-${Math.random().toString(36).slice(2)}.${ext}`;
        const up = await supabase.storage.from("product-images").upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || "image/jpeg",
        });
        if (up.error) throw up.error;
        const { data } = supabase.storage.from("product-images").getPublicUrl(path);
        if (data?.publicUrl) urls.push(data.publicUrl);
      }

      const image_urls = urls.length ? urls : null;
      const image_url = image_urls?.[0] || null;

      const payload = {
        brand_id: brandId,
        name: name.trim(),
        price: priceNum,
        category: category || null,
        subcategory: subcategory || null,
        image_url,
        image_urls,
        stock: stockNum,
        active: stockNum > 0,
      };
      const { error } = await supabase.from("products").insert(payload);
      if (error) throw error;
      alert("Producto creado.");
      onCreated?.();
    } catch (e) {
      alert(e.message || "No se pudo crear el producto.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="card" style={{ padding: 12, marginTop: 12, border: "1px dashed var(--border)" }}>
      <div className="row" style={{ alignItems: "center" }}>
        <h3 style={{ margin: 0 }}>Nuevo producto</h3>
        <div style={{ flex: 1 }} />
        <button className="btn ghost" onClick={onCancel}>Cancelar</button>
      </div>
      <form onSubmit={handleSubmit} className="grid grid-2" style={{ gap: 12, marginTop: 8 }}>
        <div>
          <label className="input-label">Nombre *</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="input-label">Precio (ARS) *</label>
          <input className="input" type="number" min="0" step="1" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div>
          <label className="input-label">Categoría</label>
          <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Remera, Pantalón, etc." />
        </div>
        <div>
          <label className="input-label">Subcategoría</label>
          <input className="input" value={subcategory} onChange={(e) => setSubcategory(e.target.value)} placeholder="Oversize, Slim, etc." />
        </div>
        <div>
          <label className="input-label">Stock *</label>
          <input
            className="input"
            type="number"
            min="0"
            step="1"
            value={stock}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "") { setStock(""); return; }
              const n = parseInt(v, 10);
              if (Number.isNaN(n) || n < 0) return;
              setStock(String(n));
            }}
            onBlur={() => { if (stock === "") setStock("1"); }}
          />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label className="input-label">Imágenes (hasta 5)</label>
          <input
            className="input"
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
          />
          <div className="grid grid-4" style={{ gap: 8, marginTop: 8 }}>
            {(files || []).slice(0, 5).map((f, i) => (
              <ImageBox key={i} src={URL.createObjectURL(f)} alt={`preview-${i}`} ratio="4:3" />
            ))}
          </div>
        </div>
        <div style={{ gridColumn: "1 / -1", textAlign: "right" }}>
          <button className="btn" type="submit" disabled={saving}>
            {saving ? "Creando…" : "Crear producto"}
          </button>
        </div>
      </form>
    </section>
  );
}

// ----- card de producto (galería, principal, eliminar imagen, editar campos) -----
function ProductCard({ product, onChanged }) {
  const [name, setName] = useState(product.name || "");
  const [price, setPrice] = useState(product.price || 0);
  const [category, setCategory] = useState(product.category || "");
  const [subcategory, setSubcategory] = useState(product.subcategory || "");
  const [stock, setStock] = useState(
    (product.stock === null || product.stock === undefined) ? "1" : String(product.stock)
  );
  const [active, setActive] = useState(!!product.active);
  const [imageUrls, setImageUrls] = useState(Array.isArray(product.image_urls) ? product.image_urls : (product.image_url ? [product.image_url] : []));
  const [saving, setSaving] = useState(false);

  const primary = imageUrls[0] || null;

  useEffect(() => {
    setName(product.name || "");
    setPrice(product.price || 0);
    setCategory(product.category || "");
    setSubcategory(product.subcategory || "");
    setStock((product.stock === null || product.stock === undefined) ? "1" : String(product.stock));
    setActive(!!product.active);
    setImageUrls(Array.isArray(product.image_urls) ? product.image_urls : (product.image_url ? [product.image_url] : []));
  }, [product.id]);

  const parseStock = () => {
    if (stock === "" || stock === null || stock === undefined) return 1;
    const n = parseInt(stock, 10);
    return Number.isNaN(n) || n < 0 ? 1 : n;
  };

  async function save(patch) {
    try {
      setSaving(true);
      const body = {
        name: name.trim(),
        price: Number(price || 0),
        category: category || null,
        subcategory: subcategory || null,
        stock: parseStock(),
        active,
        image_urls: imageUrls.length ? imageUrls : null,
        image_url: imageUrls.length ? imageUrls[0] : null, // principal
        ...(patch || {})
      };

      // ajustar activo según stock
      const sVal = body.stock;
      if (sVal <= 0) {
        body.active = false;
        setActive(false);
      } else if (!active) {
        body.active = true;
        setActive(true);
      }

      const { error } = await supabase.from("products").update(body).eq("id", product.id);
      if (error) throw error;
      await onChanged?.();
    } catch (e) {
      alert(e.message || "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadImages(e) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    try {
      setSaving(true);
      const current = [...imageUrls];
      for (const file of files) {
        if (current.length >= 5) break;
        const brandPart = product.brand_id || "brand";
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${brandPart}/${product.id}-${Math.random().toString(36).slice(2)}.${ext}`;
        const up = await supabase.storage.from("product-images").upload(path, file, {
          cacheControl: "3600",
          upsert: true,
          contentType: file.type || "image/jpeg",
        });
        if (up.error) throw up.error;
        const { data } = supabase.storage.from("product-images").getPublicUrl(path);
        const url = data?.publicUrl || null;
        if (url) current.push(url);
      }
      setImageUrls(current.slice(0, 5));
      await save({ image_urls: current.slice(0, 5), image_url: current[0] || null });
    } catch (e2) {
      alert(e2.message || "No se pudo subir la imagen.");
    } finally {
      setSaving(false);
      // limpiar input
      e.target.value = "";
    }
  }

  async function removeImage(idx) {
    if (!confirm("¿Quitar esta imagen del producto?")) return;
    const next = imageUrls.filter((_, i) => i !== idx);
    setImageUrls(next);
    await save({ image_urls: next, image_url: next[0] || null });
  }

  async function setPrimary(idx) {
    const next = [...imageUrls];
    const [img] = next.splice(idx, 1);
    next.unshift(img);
    setImageUrls(next);
    await save({ image_urls: next, image_url: next[0] || null });
  }

  async function softDelete() {
    if (!confirm(`¿Eliminar (soft) el producto “${product.name}”?`)) return;
    try {
      const { error } = await supabase
        .from("products")
        .update({ deleted_at: new Date().toISOString(), active: false })
        .eq("id", product.id);
      if (error) throw error;
      await onChanged?.();
    } catch (e) {
      alert(e.message || "No se pudo eliminar.");
    }
  }

  return (
    <div className="card" style={{ padding: 12 }}>
      {/* Imagen principal 4:3 */}
      <ImageBox src={primary} alt={name} ratio="4:3" rounded={12} objectFit="cover" />

      {/* Thumbnails */}
      <div className="thumbs" style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        {imageUrls.map((u, i) => (
          <div key={i} style={{ width: 84 }}>
            <ImageBox src={u} alt={`img-${i}`} ratio="4:3" rounded={8} />
            <div className="row" style={{ gap: 6, marginTop: 6 }}>
              <button className="btn xsmall ghost" onClick={() => setPrimary(i)} disabled={i === 0}>Principal</button>
              <button className="btn xsmall danger" onClick={() => removeImage(i)}>Quitar</button>
            </div>
          </div>
        ))}
        {imageUrls.length < 5 && (
          <div style={{ width: 84 }}>
            <label className="btn xsmall" style={{ display: "inline-block", width: "100%", textAlign: "center" }}>
              + Agregar
              <input type="file" accept="image/*" multiple style={{ display: "none" }} onChange={uploadImages} />
            </label>
          </div>
        )}
      </div>

      <div className="row" style={{ alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        <strong style={{ fontSize: 16 }}>{name || "(Sin nombre)"}</strong>
        <div className="badge">{money(price)}</div>
        <div className="badge">Stock: {stock === "" ? "…" : parseStock()}</div>
        <div style={{ flex: 1 }} />
        <label className="chip">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => {
              const v = e.target.checked;
              if (v && parseStock() <= 0) { alert("No podés activar un producto con stock 0."); return; }
              setActive(v);
              save({ active: v, stock: parseStock() });
            }}
          /> activo
        </label>
        <button className="btn danger xsmall" onClick={softDelete}>Eliminar</button>
      </div>

      <div className="grid grid-2" style={{ gap: 8, marginTop: 8 }}>
        <div>
          <label className="input-label">Nombre</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => save()} />
        </div>
        <div>
          <label className="input-label">Precio (ARS)</label>
          <input className="input" type="number" min="0" step="1" value={price} onChange={(e) => setPrice(e.target.value)} onBlur={() => save()} />
        </div>
        <div>
          <label className="input-label">Categoría</label>
          <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} onBlur={() => save()} />
        </div>
        <div>
          <label className="input-label">Subcategoría</label>
          <input className="input" value={subcategory} onChange={(e) => setSubcategory(e.target.value)} onBlur={() => save()} />
        </div>
        <div>
          <label className="input-label">Stock</label>
          <input
            className="input"
            type="number"
            min="0"
            step="1"
            value={stock}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "") { setStock(""); return; }
              const n = parseInt(v, 10);
              if (Number.isNaN(n) || n < 0) return;
              setStock(String(n));
            }}
            onBlur={() => {
              const normalized = (stock === "" ? "1" : stock);
              setStock(normalized);
              const n = parseInt(normalized, 10);
              if (Number.isNaN(n) || n <= 0) {
                save({ stock: 0, active: false });
              } else {
                save({ stock: n, active: true });
                setActive(true);
              }
            }}
          />
        </div>
      </div>
      {saving ? <div className="badge" style={{ marginTop: 8 }}>Guardando…</div> : null}
    </div>
  );
}

export default dynamic(() => Promise.resolve(VendorInner), { ssr: false });
