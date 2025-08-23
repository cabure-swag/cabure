/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // Public URLs de Supabase Storage (ajusta tu proyecto si querés ser más estricto)
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.supabase.in' },
      // Si tenés logos externos, podés sumar otros hosts, ej:
      // { protocol: 'https', hostname: 'images.unsplash.com' },
      // { protocol: 'https', hostname: 'i.imgur.com' },
    ],
  },
};

module.exports = nextConfig;
