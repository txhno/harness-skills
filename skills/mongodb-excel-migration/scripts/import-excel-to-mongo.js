/**
 * Main import script for Excel to MongoDB data migration
 * Usage: node import-excel-to-mongo.js <excel-file> <org-id>
 */

import { MongoClient } from "mongodb";
import ExcelJS from "exceljs";
import _ from "lodash";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:57018/db?authSource=admin";
const DB_NAME = process.env.DB_NAME || "omsProd";
const COLLECTION_NAME = process.env.COLLECTION_NAME || "tasks";

const EXCEL_FILE_PATH = process.argv[2] || "./data.xlsx";
const ORG_ID = process.argv[3] || "org_id";
const SKU_FIELD = process.env.SKU_FIELD || "attributes.sku.value"; // or "attributes.styleId.value"

async function importData() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const collection = db.collection(COLLECTION_NAME);

  console.log("📊 Reading Excel file...");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(EXCEL_FILE_PATH);
  const sheet = workbook.worksheets[0];

  const headers = sheet.getRow(1).values.slice(1);
  console.log(`✅ Found ${headers.length} columns`);

  let processed = 0;
  let matched = 0;

  for (let rowIndex = 2; rowIndex <= sheet.rowCount; rowIndex++) {
    const row = sheet.getRow(rowIndex);
    const cells = row.values.slice(1);

    const styleId = cells[0]?.toString()?.trim();
    if (!styleId) continue;

    // Build filter dynamically based on SKU_FIELD
    const filter = { orgId: ORG_ID };
    const fieldPath = SKU_FIELD.split(".");
    let current = filter;
    for (let i = 0; i < fieldPath.length - 1; i++) {
      current[fieldPath[i]] = current[fieldPath[i]] || {};
      current = current[fieldPath[i]];
    }
    current[fieldPath[fieldPath.length - 1]] = styleId;

    const updateObj = {};

    for (let j = 1; j < headers.length; j++) {
      const header = headers[j];
      const value = cells[j];

      if (!header || header.toLowerCase().endsWith("reason")) continue;

      const nextHeader = headers[j + 1];
      const reasonValue =
        nextHeader && nextHeader.trim().toLowerCase().endsWith("reason")
          ? cells[j + 1]
          : "";

      const key = _.camelCase(header);

      updateObj[`attributes.${key}`] = {
        name: header,
        value: value ?? "",
        type: "string",
        hint: "",
        meta: {
          reason: { value: reasonValue ?? "", type: "string" },
          indicates: {
            value:
              (value ?? "").toString().toLowerCase() === "passed"
                ? "good"
                : "bad",
            type: "string",
          },
        },
        tags: ["intelcopilot", "myntraqc", "catalogueEdit"],
      };
    }

    const result = await collection.updateOne(filter, { $set: updateObj });

    processed++;
    if (result.matchedCount > 0) matched++;

    console.log(
      `#${rowIndex - 1}: ${styleId} → matched ${result.matchedCount}, modified ${result.modifiedCount}`
    );
  }

  await client.close();
  console.log(`\n✅ Done! Processed ${processed} rows, matched ${matched} documents`);
}

importData().catch(console.error);
