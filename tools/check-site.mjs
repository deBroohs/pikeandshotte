import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

const requiredFiles = [
  "index.html",
  "site.config.json",
  "site.webmanifest",
  "robots.txt",
  "sitemap.xml",
  "assets/site/favicon.svg",
  "assets/site/metadata.json"
];

for (const relativePath of requiredFiles) {
  const fullPath = path.join(rootDir, relativePath);
  await fs.access(fullPath);
}

const indexHtml = await fs.readFile(path.join(rootDir, "index.html"), "utf8");
const manifest = JSON.parse(await fs.readFile(path.join(rootDir, "site.webmanifest"), "utf8"));
const robots = await fs.readFile(path.join(rootDir, "robots.txt"), "utf8");
const sitemap = await fs.readFile(path.join(rootDir, "sitemap.xml"), "utf8");
const config = JSON.parse(await fs.readFile(path.join(rootDir, "site.config.json"), "utf8"));

const assertions = [
  ["canonical", /<link rel="canonical" href="https:\/\/debroohs\.github\.io\/pikeandshotte\/">/],
  ["manifest", /<link rel="manifest" href="\.\/site\.webmanifest">/],
  ["favicon", /<link rel="icon" href="\.\/assets\/site\/favicon\.svg" type="image\/svg\+xml">/],
  ["description", /<meta name="description" content="[^"]+">/],
  ["open graph title", /<meta property="og:title" content="[^"]+">/],
  ["twitter card", /<meta name="twitter:card" content="summary_large_image">/],
  ["json-ld", /<script type="application\/ld\+json">[\s\S]*"@type": "WebApplication"/],
  ["css versioning", /styles\.css\?v=/],
  ["rules data versioning", /rules-data\.js\?v=/],
  ["app versioning", /app\.js\?v=/]
];

for (const [label, pattern] of assertions) {
  if (!pattern.test(indexHtml)) {
    throw new Error(`Missing or invalid ${label} in index.html`);
  }
}

if (manifest.name !== config.siteName) {
  throw new Error("Manifest name does not match site config");
}

if (!robots.includes("Sitemap: https://debroohs.github.io/pikeandshotte/sitemap.xml")) {
  throw new Error("robots.txt sitemap URL is missing or invalid");
}

if (!sitemap.includes("<loc>https://debroohs.github.io/pikeandshotte/</loc>")) {
  throw new Error("sitemap.xml root URL is missing");
}

console.log("Site checks passed");
