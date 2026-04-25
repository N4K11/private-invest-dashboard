import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const staticDir = path.resolve(process.cwd(), ".next", "static");

const forbiddenEnvKeys = [
  "DASHBOARD_SECRET_TOKEN",
  "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY",
  "GOOGLE_SERVICE_ACCOUNT_JSON",
  "GOOGLE_SERVICE_ACCOUNT_EMAIL",
  "COINGECKO_API_KEY",
  "CSFLOAT_API_KEY",
  "PRICEMPIRE_API_KEY",
  "CACHE_REDIS_REST_TOKEN",
];

function walkFiles(rootDir) {
  const entries = readdirSync(rootDir);
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(rootDir, entry);
    const stats = statSync(absolutePath);

    if (stats.isDirectory()) {
      files.push(...walkFiles(absolutePath));
      continue;
    }

    if (/\.(js|mjs|txt|map)$/i.test(entry)) {
      files.push(absolutePath);
    }
  }

  return files;
}

if (!existsSync(staticDir)) {
  throw new Error(`Client bundle directory not found: ${staticDir}. Run npm run build first.`);
}

const files = walkFiles(staticDir);
const findings = [];

for (const filePath of files) {
  const content = readFileSync(filePath, "utf8");

  for (const envKey of forbiddenEnvKeys) {
    if (content.includes(envKey)) {
      findings.push(`${envKey} identifier found in ${path.relative(process.cwd(), filePath)}`);
    }

    const envValue = process.env[envKey];
    if (envValue && envValue.length >= 8 && content.includes(envValue)) {
      findings.push(`${envKey} value found in ${path.relative(process.cwd(), filePath)}`);
    }
  }
}

if (findings.length > 0) {
  throw new Error(`Client bundle safety check failed:\n- ${findings.join("\n- ")}`);
}

console.log(`Client bundle safety check passed across ${files.length} static files.`);
