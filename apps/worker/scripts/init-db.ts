/**
 * @argos/worker — سكريبت تهيئة قاعدة البيانات (Postgres)
 *
 * ينفّذ `initSchema()` من `../src/db/client.ts` ويطبع حالة النجاح.
 */

import { initSchema } from "../src/db/client.js";

async function main() {
  try {
    await initSchema();
    console.log("✓ DB ready");
  } catch (err) {
    console.error("✗ DB init failed:", err);
    process.exit(1);
  }
}

main();
