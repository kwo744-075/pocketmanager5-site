async function listFeatures() {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const registryPath = path.join("app", "pocket-manager5", "featureRegistry.ts");
  const text = await fs.readFile(registryPath, "utf8");
  const slugs = [...text.matchAll(/slug:\s*"([a-z0-9-]+)"/g)].map((match) => match[1]);
  const unique = [...new Set(slugs)].sort();
  unique.forEach((slug) => {
    console.log(slug);
  });
}

listFeatures().catch((error) => {
  console.error("Unable to list feature slugs", error);
  process.exitCode = 1;
});
