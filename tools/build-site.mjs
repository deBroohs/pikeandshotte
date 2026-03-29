import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const configPath = path.join(rootDir, "site.config.json");

const config = JSON.parse(await fs.readFile(configPath, "utf8"));
const siteUrl = config.siteUrl.endsWith("/") ? config.siteUrl : `${config.siteUrl}/`;
const ogImageUrl = new URL(config.ogImage, siteUrl).toString();
const visitorCounterConfig = normalizeVisitorCounterConfig(config.plugins?.visitorCounter);

const manifest = {
  name: config.siteName,
  short_name: config.shortName,
  description: config.description,
  lang: config.lang,
  start_url: "./",
  scope: "./",
  display: "standalone",
  orientation: "portrait-primary",
  theme_color: config.themeColor,
  background_color: config.backgroundColor,
  categories: config.categories,
  icons: [
    {
      src: "./assets/site/favicon.svg",
      sizes: "any",
      type: "image/svg+xml",
      purpose: "any"
    }
  ]
};

const robots = [
  "User-agent: *",
  "Allow: /",
  "",
  `Sitemap: ${new URL("sitemap.xml", siteUrl).toString()}`
].join("\n");

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  `  <url>\n` +
  `    <loc>${siteUrl}</loc>\n` +
  `    <changefreq>weekly</changefreq>\n` +
  `    <priority>1.0</priority>\n` +
  `  </url>\n` +
  `</urlset>\n`;

const metadata = {
  title: `${config.title} | ${config.titleSuffix}`,
  description: config.description,
  siteUrl,
  ogImageUrl,
  themeColor: config.themeColor,
  generatedAt: new Date().toISOString()
};

await fs.mkdir(path.join(rootDir, "assets", "site"), { recursive: true });
await fs.writeFile(path.join(rootDir, "site.webmanifest"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
await fs.writeFile(path.join(rootDir, "robots.txt"), `${robots}\n`, "utf8");
await fs.writeFile(path.join(rootDir, "sitemap.xml"), sitemap, "utf8");
await fs.writeFile(path.join(rootDir, "assets", "site", "metadata.json"), `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
await fs.writeFile(
  path.join(rootDir, "assets", "site", "visitor-counter-config.js"),
  `window.PikeShotteVisitorCounterConfig = ${JSON.stringify(visitorCounterConfig, null, 2)};\n`,
  "utf8"
);

console.log("Generated site.webmanifest, robots.txt, sitemap.xml, metadata.json and visitor counter config");

function normalizeVisitorCounterConfig(rawConfig = {}) {
  const parsedSiteUrl = new URL(siteUrl);
  return {
    enabled: Boolean(rawConfig.enabled),
    provider: rawConfig.provider === "countapi-mirror" ? "countapi-mirror" : "countapi-mirror",
    apiBaseUrl: typeof rawConfig.apiBaseUrl === "string" && rawConfig.apiBaseUrl.trim()
      ? rawConfig.apiBaseUrl.trim()
      : "https://countapi.mileshilliard.com/api/v1",
    counterKeyPrefix: typeof rawConfig.counterKeyPrefix === "string" && rawConfig.counterKeyPrefix.trim()
      ? rawConfig.counterKeyPrefix.trim()
      : sanitizeCounterKey(`${parsedSiteUrl.hostname}${parsedSiteUrl.pathname}`),
    allowLocal: Boolean(rawConfig.allowLocal),
    debug: Boolean(rawConfig.debug),
    refreshIntervalSeconds: Number.isFinite(Number(rawConfig.refreshIntervalSeconds))
      ? Math.max(15, Math.round(Number(rawConfig.refreshIntervalSeconds)))
      : 30,
    sessionMinutes: Number.isFinite(Number(rawConfig.sessionMinutes))
      ? Math.max(5, Math.round(Number(rawConfig.sessionMinutes)))
      : 30,
    timeZone: typeof rawConfig.timeZone === "string" && rawConfig.timeZone.trim()
      ? rawConfig.timeZone.trim()
      : "UTC",
    summary: {
      enabled: rawConfig.summary?.enabled !== false,
      title: typeof rawConfig.summary?.title === "string" && rawConfig.summary.title.trim()
        ? rawConfig.summary.title.trim()
        : "\u0421\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0430 \u0441\u0430\u0439\u0442\u0430"
    }
  };
}

function sanitizeCounterKey(value) {
  return String(value || "site-counter")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96) || "site-counter";
}
