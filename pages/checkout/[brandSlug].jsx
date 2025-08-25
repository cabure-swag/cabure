import { useRouter } from "next/router";
import { supabase } from "@/lib/supabaseClient";

export default function Checkout({ cartItems }) {
  const router = useRouter();
  const { brandSlug } = router.query;

  async function confirmarPedido(paymentMethod) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData?.session?.user?.id;
      if (!uid) {
        alert("Debes iniciar sesión para continuar.");
        return;
      }

      // Obtener ID de la marca actual
      const { data: brand, error: brandError } = await supabase
        .from("brands")
        .select("id")
        .eq("slug", brandSlug)
        .maybeSingle();

      if (brandError || !brand?.id) {
        alert("Marca no encontrada.");
        return;
      }

      // Preparar items para el pedido
      const items = (cartItems || []).map(item => ({
        product_id: item.product_id,
        qty: item.qty || 1,
        unit_price: item.unit_price || 0
      }));

      if (!items.length) {
        alert("Tu carrito está vacío.");
        return;
      }

      // Crear pedido con la nueva función SQL
      const { data: orderId, error: orderError } = await supabase.rpc(
        "create_order_with_stock",
        {
          p_brand_id: brand.id,
          p_buyer_id: uid,
          p_items: items,
          p_payment_method: paymentMethod || "transfer"
        }
      );

      if (orderError || !orderId) {
        alert(orderError?.message || "No se pudo crear el pedido.");
        return;
      }

      // Crear / reutilizar chat con vendedor
      const { data: threadId, error: chatError } = await supabase.rpc(
        "open_brand_thread",
        {
          p_brand_id: brand.id,
          p_user_id: uid
        }
      );

      if (chatError || !threadId) {
        alert("Pedido creado, pero no se pudo abrir el chat con el vendedor.");
        router.push("/");
        return;
      }

      alert("Pedido creado con éxito.");
      router.push(`/vendedor-chat?t=${encodeURIComponent(threadId)}`);
    } catch (error) {
      console.error(error);
      alert("Hubo un error. Intenta de nuevo.");
    }
  }

  return (
    <div>
      <h1>Finalizar Compra</h1>
      <button onClick={() => confirmarPedido("transfer")} className="btn btn-primary">
        Confirmar Pedido
      </button>
    </div>
  );
}
