/**
 * Fix PDN Sequence Check format
 * Usage: node fix-pdn-sequence-checks.js <org-id>
 */

import { MongoClient } from "mongodb";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:57018/db?authSource=admin";
const DB_NAME = process.env.DB_NAME || "omsProd";
const COLLECTION_NAME = process.env.COLLECTION_NAME || "tasks";

const ORG_ID = process.argv[2] || "org_id";

async function fixPdnSequenceChecks() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const collection = db.collection(COLLECTION_NAME);

  console.log("🔍 Finding documents with PDN Sequence Check...");

  const docs = await collection.find({
    orgId: ORG_ID,
    "attributes.pdnSequenceCheck.value": "Failed"
  }).toArray();

  console.log(`Found ${docs.length} documents to update\n`);

  for (const doc of docs) {
    const idealPdn = doc.attributes?.idealPdn?.value || "";
    const sku = doc.attributes?.sku?.value || doc._id;

    if (!idealPdn) {
      console.log(`⚠️ ${sku}: No ideal PDN, skipping`);
      continue;
    }

    const newReason = `Words out of order. Ideal order: ${idealPdn}`;

    await collection.updateOne(
      { _id: doc._id },
      { $set: { "attributes.pdnSequenceCheck.meta.reason.value": newReason } }
    );

    console.log(`✓ ${sku}: ${newReason}`);
  }

  await client.close();
  console.log("\n✅ Done!");
}

fixPdnSequenceChecks().catch(console.error);
