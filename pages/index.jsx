import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function Home() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);

  // Traer marcas desde Supabase
  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const { data, error } = await supabase.from("brands").select("*").order("name", { ascending: true });
        if (error) throw error;
        setBrands(data || []);
      } catch (err) {
        console.error("Error cargando marcas:", err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchBrands();
  }, []);

  return (
    <>
      <Head>
        <title>CABURE.STORE</title>
        <meta name="description" content="Caburé Store — Moda, música y lifestyle." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {/* Hero principal */}
      <section className="hero">
        <div className="hero-content">
          <h1 className="hero-title">CABURE.STORE</h1>
          <p className="hero-subtitle">Donde moda, música y cultura se encuentran.</p>
          <Link href="/productos" className="btn-primary">
            Ver productos
          </Link>
        </div>
      </section>

      {/* Marcas */}
      <section className="brands">
        <h2 className="section-title">Marcas destacadas</h2>

        {loading ? (
          <p className="loading">Cargando marcas...</p>
        ) : brands.length === 0 ? (
          <p className="empty">No hay marcas disponibles por ahora.</p>
        ) : (
          <div className="brands-grid">
            {brands.map((brand) => (
              <div key={brand.id} className="brand-card">
                <img
                  src={brand.logo_url || "/placeholder-brand.png"}
                  alt={brand.name}
                  className="brand-logo"
                />
                <h3 className="brand-name">{brand.name}</h3>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="cta">
        <h2>Sumate a Caburé</h2>
        <p>Registrate como vendedor y empezá a mostrar tus productos.</p>
        <Link href="/vendedores" className="btn-secondary">
          Ser vendedor
        </Link>
      </section>

      <style jsx>{`
        /* Hero */
        .hero {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 70vh;
          background: url("/hero-bg.jpg") center/cover no-repeat;
          text-align: center;
          padding: 2rem;
        }
        .hero-content {
          background: rgba(0, 0, 0, 0.5);
          padding: 2rem;
          border-radius: 12px;
        }
        .hero-title {
          font-size: 3rem;
          font-weight: bold;
          color: #fff;
        }
        .hero-subtitle {
          color: #eee;
          margin-top: 0.5rem;
          margin-bottom: 1rem;
          font-size: 1.2rem;
        }
        .btn-primary {
          background: #000;
          color: #fff;
          padding: 0.8rem 1.5rem;
          border-radius: 8px;
          font-weight: 500;
          transition: 0.3s ease;
        }
        .btn-primary:hover {
          background: #222;
        }

        /* Sección Marcas */
        .brands {
          padding: 3rem 2rem;
          text-align: center;
        }
        .section-title {
          font-size: 1.8rem;
          margin-bottom: 1.5rem;
        }
        .brands-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 1.5rem;
        }
        .brand-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 1rem;
          background: #f8f8f8;
          border-radius: 12px;
          transition: transform 0.2s ease;
        }
        .brand-card:hover {
          transform: translateY(-4px);
        }
        .brand-logo {
          width: 80px;
          height: 80px;
          object-fit: contain;
          border-radius: 8px;
          margin-bottom: 0.5rem;
        }
        .brand-name {
          font-size: 1rem;
          font-weight: 600;
        }

        /* CTA */
        .cta {
          background: #000;
          color: #fff;
          padding: 2.5rem 2rem;
          text-align: center;
          margin-top: 3rem;
        }
        .btn-secondary {
          display: inline-block;
          margin-top: 1rem;
          padding: 0.8rem 1.5rem;
          background: #fff;
          color: #000;
          border-radius: 8px;
          font-weight: 600;
          transition: 0.3s ease;
        }
        .btn-secondary:hover {
          background: #eee;
        }
      `}</style>
    </>
  );
}
