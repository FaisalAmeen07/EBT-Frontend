import type { NextConfig } from "next";

const backendProxy =
  (process.env.BACKEND_PROXY_URL || process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000").replace(
    /\/$/,
    "",
  );

const chatProxy =
  (process.env.CHAT_PROXY_URL || process.env.NEXT_PUBLIC_CHAT_API_URL || "https://chatservice-backend.onrender.com").replace(
    /\/$/,
    "",
  );

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/auth/:path*", destination: `${backendProxy}/api/auth/:path*` },
      { source: "/api/profile/:path*", destination: `${backendProxy}/api/profile/:path*` },
      { source: "/api/admin/:path*", destination: `${backendProxy}/api/admin/:path*` },
      { source: "/api/teams/:path*", destination: `${backendProxy}/api/teams/:path*` },
      { source: "/api/integrations/:path*", destination: `${backendProxy}/api/integrations/:path*` },
      { source: "/api/chats", destination: `${chatProxy}/api/chats` },
      { source: "/api/chats/:path*", destination: `${chatProxy}/api/chats/:path*` },
      // Socket.IO on auth backend — browser uses same origin + this proxy when NEXT_PUBLIC_SOCKET_URL is unset locally
      { source: "/socket.io/:path*", destination: `${backendProxy}/socket.io/:path*` },
    ];
  },
  async redirects() {
    return [{ source: '/schedule', destination: '/project-manager', permanent: true }];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
        pathname: '/dcfzqdk58/**',
      },
    ],
  },
};

export default nextConfig;
