import os from "node:os";
import path from "node:path";
import type { NextConfig } from "next";

const parsedEnvOrigins = (process.env.NEXT_DEV_ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const autoDetectedLanHosts = new Set<string>();
Object.values(os.networkInterfaces()).forEach((entries) => {
  entries?.forEach((entry) => {
    if (entry && entry.family === "IPv4" && !entry.internal && entry.address) {
      autoDetectedLanHosts.add(entry.address);
    }
  });
});

parsedEnvOrigins.forEach((origin) => autoDetectedLanHosts.add(origin));

const allowedDevOrigins = autoDetectedLanHosts.size ? Array.from(autoDetectedLanHosts) : undefined;

const nextConfig: NextConfig = {
  allowedDevOrigins,
  experimental: {
    externalDir: true,
  },
  turbopack: {
    resolveAlias: {
      "@shared": path.resolve(__dirname, "../shared"),
    },
  },
  webpack: (config) => {
    config.resolve ??= {};
    config.resolve.alias ??= {};
    config.resolve.alias["@shared"] = path.resolve(__dirname, "../shared");
    return config;
  },
};

export default nextConfig;
