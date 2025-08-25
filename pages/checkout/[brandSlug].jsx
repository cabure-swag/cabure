async function confirmarPedido(cartItems, paymentMethod) {
  try {
    // 1) usuario logueado
    const { data: s } = await supabase.auth.getSession();
    const uid = s?.session?.user?.id;
    if (!uid) { alert("Tenés que iniciar sesión para confirmar."); return; }

    // 2) conseguir la brand por el slug de la ruta
    const { brandSlug } = router.query;
    const { data: b, error: eB } = await supabase
      .from("brands")
      .select("id")
      .eq("slug", brandSlug)
      .maybeSingle();
    if (eB || !b?.id) { alert("Marca no encontrada."); return; }

    // 3) preparar items para la RPC (usa los precios actuales del carrito)
    const items = (cartItems || []).map(it => ({
      product_id: it.product_id,
      qty: it.qty || 1,
      unit_price: it.unit_price || 0
    }));

    if (!items.length) { alert("Tu carrito está vacío."); return; }

    // 4) crear pedido + descontar stock
    const { data: orderId, error: eOrder } = await supabase.rpc(
      "create_order_with_stock",
      {
        p_brand_id: b.id,
        p_buyer_id: uid,
        p_items: items,
        p_payment_method: paymentMethod || "transfer"
      }
    );
    if (eOrder || !orderId) { alert(eOrder?.message || "No se pudo crear el pedido."); return; }

    // 5) abrir / reutilizar chat con la MARCA (vendedor)
    const { data: threadId, error: eThread } = await supabase.rpc(
      "open_brand_thread",
      { p_brand_id: b.id, p_user_id: uid }
    );
    if (eThread || !threadId) {
      alert("Pedido creado, pero no se pudo abrir el chat.");
      router.push("/soporte"); // fallback
      return;
    }

    // 6) redirigir al chat del cliente con esa marca
    router.push(`/soporte?t=${encodeURIComponent(threadId)}`);
  } catch (err) {
    console.error(err);
    alert("No se pudo crear el pedido. Probá de nuevo.");
  }
}
