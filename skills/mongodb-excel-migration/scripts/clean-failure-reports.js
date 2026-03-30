/**
 * Clean up failure reports - fix newlines and remove boilerplate text
 * Usage: node clean-failure-reports.js <org-id>
 */

import { MongoClient } from "mongodb";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:57018/db?authSource=admin";
const DB_NAME = process.env.DB_NAME || "omsProd";
const COLLECTION_NAME = process.env.COLLECTION_NAME || "tasks";

const ORG_ID = process.argv[2] || "org_id";

// Boilerplate phrases to remove (customize as needed)
const BOILERPLATE_PATTERNS = [
  /\n?• Original LVN is missing\./g,
  /\n?• Original PDN is missing\./g,
  /\n?• Original PDN\/LVN is missing\./g,
];

async function cleanFailureReports() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const collection = db.collection(COLLECTION_NAME);

  console.log("🔍 Finding documents with failure reports...");

  const docs = await collection.find({
    orgId: ORG_ID,
    "attributes.failureReport.value": { $exists: true, $ne: "" }
  }).toArray();

  console.log(`Found ${docs.length} documents to process\n`);

  let updated = 0;

  for (const doc of docs) {
    let failureReport = doc.attributes?.failureReport?.value || "";
    const sku = doc.attributes?.sku?.value || doc._id;

    // Fix newlines - ensure each bullet is on its own line
    let cleaned = failureReport
      .replace(/ \u2022 /g, "\n• ")  // Replace space-bullet-space with newline-bullet-space
      .replace(/^• /, "• ");       // Keep first bullet at start

    // Remove boilerplate phrases
    for (const pattern of BOILERPLATE_PATTERNS) {
      cleaned = cleaned.replace(pattern, "");
    }

    // Clean up double newlines and trim
    cleaned = cleaned.replace(/\n\n+/g, "\n").trim();

    if (cleaned !== failureReport) {
      await collection.updateOne(
        { _id: doc._id },
        { $set: { "attributes.failureReport.value": cleaned } }
      );
      console.log(`✓ ${sku}: Cleaned failure report`);
      updated++;
    }
  }

  await client.close();
  console.log(`\n✅ Done! Updated ${updated} documents`);
}

cleanFailureReports().catch(console.error);
