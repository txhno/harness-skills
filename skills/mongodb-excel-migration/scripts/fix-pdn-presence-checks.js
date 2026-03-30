/**
 * Fix PDN Presence Checks with stemming and stop word filtering
 * Usage: node fix-pdn-presence-checks.js <org-id>
 */

import { MongoClient } from "mongodb";
import natural from "natural";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:57018/db?authSource=admin";
const DB_NAME = process.env.DB_NAME || "omsProd";
const COLLECTION_NAME = process.env.COLLECTION_NAME || "tasks";

const ORG_ID = process.argv[2] || "org_id";

const stemmer = natural.PorterStemmer;

const STOP_WORDS = new Set([
  "and", "with", "the", "of", "in", "on", "at", "to", "for", "by", "from",
  "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "this", "that", "these", "those", "it", "its", "as"
]);

function findMissingWords(title, idealPdn) {
  const titleWords = title.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  const idealWords = idealPdn.toLowerCase().split(/\s+/).filter(w => w.length > 0);

  const titleStems = titleWords.map(w =>
    stemmer.stem(w.replace(/[^a-z0-9]/g, ''))
  );

  const missingWords = [];

  for (const word of idealWords) {
    const cleanWord = word.replace(/[^a-z0-9]/g, '');
    if (STOP_WORDS.has(cleanWord)) continue;

    const wordStem = stemmer.stem(cleanWord);
    if (!titleStems.includes(wordStem)) {
      missingWords.push(word);
    }
  }

  return missingWords;
}

async function fixPdnPresenceChecks() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const collection = db.collection(COLLECTION_NAME);

  console.log("🔍 Finding documents with PDN Presence Check...");

  const docs = await collection.find({
    orgId: ORG_ID,
    "attributes.pdnPresenceCheck.value": { $exists: true }
  }).toArray();

  console.log(`Found ${docs.length} documents to process\n`);

  let passed = 0;
  let failed = 0;

  for (const doc of docs) {
    const title = doc.attributes?.title?.value || "";
    const idealPdn = doc.attributes?.idealPdn?.value || "";
    const sku = doc.attributes?.sku?.value || doc._id;

    if (!idealPdn) {
      console.log(`⚠️ ${sku}: No ideal PDN, skipping`);
      continue;
    }

    const missingWords = findMissingWords(title, idealPdn);

    if (missingWords.length === 0) {
      // All words present -> PASS
      await collection.updateOne(
        { _id: doc._id },
        {
          $set: {
            "attributes.pdnPresenceCheck.value": "Passed",
            "attributes.pdnPresenceCheck.meta.reason.value": "All words from ideal PDN present",
            "attributes.pdnPresenceCheck.meta.indicates.value": "good"
          }
        }
      );
      console.log(`✓ ${sku}: PASSED`);
      passed++;
    } else {
      // Still failed
      await collection.updateOne(
        { _id: doc._id },
        {
          $set: {
            "attributes.pdnPresenceCheck.meta.reason.value":
              `Missing words from ideal PDN: ${missingWords.join(", ")}`
          }
        }
      );
      console.log(`✗ ${sku}: FAILED - Missing: ${missingWords.join(", ")}`);
      failed++;
    }
  }

  await client.close();
  console.log(`\n✅ Done! Passed: ${passed}, Failed: ${failed}`);
}

fixPdnPresenceChecks().catch(console.error);
