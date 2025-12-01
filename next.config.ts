import os from "node:os";
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
};

export default nextConfig;
