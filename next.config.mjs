const nextConfig = {
  devIndicators: false,
  async rewrites() {
    const origin = process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:8000' : process.env.ACCREDITATION_API_ORIGIN
    return origin ? [{source:'/api/:path*', destination:`${origin.replace(/\/$/, '')}/api/:path*`}] : []
  },
  async headers() { return [{source:'/:path*',headers:[{key:'X-Content-Type-Options',value:'nosniff'},{key:'Referrer-Policy',value:'strict-origin-when-cross-origin'}]}] },
}
export default nextConfig
