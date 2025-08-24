// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" }, // por si usas fotos de Google
      { protocol: "https", hostname: "**.imgur.com" },              // ejemplo opcional
    ],
  },
};

module.exports = nextConfig;
