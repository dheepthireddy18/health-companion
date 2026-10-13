/** @type {import('next').NextConfig} */
const BACKEND = process.env.BACKEND_URL || "http://127.0.0.1:8000";

const nextConfig = {
  // Browser calls /api/* on the Next server, which forwards to FastAPI (no CORS needed).
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${BACKEND}/api/:path*` }];
  },
  // Food, activity and health now live together on /track.
  async redirects() {
    return ["/food", "/activity", "/health"].map((source) => ({ source, destination: "/track", permanent: false }));
  },
};

export default nextConfig;
