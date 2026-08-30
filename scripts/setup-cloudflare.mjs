import { existsSync, copyFileSync } from "node:fs";

if (!existsSync("wrangler.jsonc")) {
  copyFileSync("wrangler.example.jsonc", "wrangler.jsonc");
  console.log("Created wrangler.jsonc. Add the D1 database ID returned by Cloudflare, then run npm run db:migrate:remote.");
} else {
  console.log("wrangler.jsonc already exists, so no configuration was overwritten.");
}

console.log("Create resources once with:");
console.log("  npx wrangler d1 create course-board-db");
console.log("  npx wrangler r2 bucket create course-board-syllabi");
