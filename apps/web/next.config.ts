import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Proxy is handled by app/api/proxy/[...path]/route.ts with a 2min timeout
  // so long LLM calls don't cause "socket hang up" (ECONNRESET).
};

export default nextConfig;
