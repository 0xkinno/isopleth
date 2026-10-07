import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [{ protocol: "https", hostname: "cdn.simpleicons.org" }],
  },
  // Pin the monorepo root explicitly: an unrelated lockfile sitting one
  // level up in this machine's Downloads folder otherwise confuses Next's
  // automatic workspace-root detection.
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
