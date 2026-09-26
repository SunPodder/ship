/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@ship/ui', '@ship/sdk', '@ship/core'],
};

export default nextConfig;
