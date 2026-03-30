/**
 * Convert decimal failure rates to percentages
 * Usage: node fix-failure-rates.js <org-id>
 */

import { MongoClient } from "mongodb";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:57018/db?authSource=admin";
const DB_NAME = process.env.DB_NAME || "omsProd";
const COLLECTION_NAME = process.env.COLLECTION_NAME || "tasks";

const ORG_ID = process.argv[2] || "org_id";

async function fixFailureRates() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const collection = db.collection(COLLECTION_NAME);

  console.log("🔍 Finding documents with failure rates...");

  const docs = await collection.find({
    orgId: ORG_ID,
    "attributes.failureRate.value": { $exists: true }
  }).toArray();

  console.log(`Found ${docs.length} documents to check\n`);

  let updated = 0;

  for (const doc of docs) {
    const rate = doc.attributes?.failureRate?.value;
    const sku = doc.attributes?.sku?.value || doc._id;

    // Convert if it's a decimal (less than 1)
    if (typeof rate === "number" && rate < 1) {
      const percentage = Math.round(rate * 100);

      await collection.updateOne(
        { _id: doc._id },
        { $set: { "attributes.failureRate.value": percentage } }
      );

      console.log(`✓ ${sku}: ${rate} → ${percentage}%`);
      updated++;
    }
  }

  await client.close();
  console.log(`\n✅ Done! Updated ${updated} documents`);
}

fixFailureRates().catch(console.error);
