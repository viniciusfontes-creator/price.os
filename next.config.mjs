/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // @sparticuz/chromium ships a binary que precisa ficar fora do bundle
  // serverless do Vercel, senão o caminho /node_modules/.../bin some.
  // puppeteer-core também precisa ser externalizado pra resolver corretamente.
  experimental: {
    serverComponentsExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/dashboard',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
