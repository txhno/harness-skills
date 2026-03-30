/**
 * INTERACTIVE Excel to MongoDB import with user-controlled cleaning
 * Usage: node interactive-import.js <excel-file> <org-id>
 */

import { MongoClient } from "mongodb";
import ExcelJS from "exceljs";
import _ from "lodash";
import natural from "natural";
import readline from "readline";

const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:57018/db?authSource=admin";
const DB_NAME = process.env.DB_NAME || "omsProd";
const COLLECTION_NAME = process.env.COLLECTION_NAME || "tasks";

const EXCEL_FILE_PATH = process.argv[2] || "./data.xlsx";
const ORG_ID = process.argv[3] || "org_id";
const SKU_FIELD = process.env.SKU_FIELD || "attributes.sku.value";

const stemmer = natural.PorterStemmer;
const STOP_WORDS = new Set([
  "and", "with", "the", "of", "in", "on", "at", "to", "for", "by", "from",
  "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "this", "that", "these", "those", "it", "its", "as"
]);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

// Phase 1: Excel Pre-Check
async function previewExcelIssues(excelPath) {
  console.log("\n📊 Phase 1: Analyzing Excel file...\n");

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(excelPath);
  const sheet = workbook.worksheets[0];

  const issues = {
    malformedFailureReports: [],
    decimalRates: [],
    boilerplateText: [],
    emptyIdealValues: [],
    totalRows: sheet.rowCount - 1
  };

  const headers = sheet.getRow(1).values.slice(1);
  const failureReportIdx = headers.findIndex(h => h === "Failure Report");
  const failureRateIdx = headers.findIndex(h => h === "Failure Rate (%)");
  const idealPdnIdx = headers.findIndex(h => h === "Ideal PDN");
  const idealLvnIdx = headers.findIndex(h => h === "Ideal LVN");

  for (let rowIndex = 2; rowIndex <= sheet.rowCount; rowIndex++) {
    const row = sheet.getRow(rowIndex);
    const cells = row.values.slice(1);
    const styleId = cells[0]?.toString()?.trim();
    if (!styleId) continue;

    if (failureReportIdx >= 0) {
      const report = cells[failureReportIdx]?.toString() || "";
      if (report.includes("•") && !report.includes("\n")) {
        issues.malformedFailureReports.push({
          row: rowIndex - 1,
          styleId,
          preview: report.substring(0, 100) + (report.length > 100 ? "..." : "")
        });
      }
      if (report.includes("Original PDN is missing") || report.includes("Original LVN is missing")) {
        const count = (report.match(/Original (PDN|LVN) is missing/g) || []).length;
        issues.boilerplateText.push({ row: rowIndex - 1, styleId, count });
      }
    }

    if (failureRateIdx >= 0) {
      const rate = cells[failureRateIdx];
      if (typeof rate === "number" && rate < 1) {
        issues.decimalRates.push({ row: rowIndex - 1, styleId, rate });
      }
    }

    if (idealPdnIdx >= 0 && (!cells[idealPdnIdx] || cells[idealPdnIdx].toString().trim() === "")) {
      issues.emptyIdealValues.push({ row: rowIndex - 1, styleId, field: "Ideal PDN" });
    }
  }

  return issues;
}

function displayPreCheckResults(issues) {
  console.log("=" .repeat(60));
  console.log("📋 EXCEL PRE-CHECK RESULTS");
  console.log("=" .repeat(60));
  console.log(`\nTotal rows to import: ${issues.totalRows}\n`);

  const hasIssues = issues.malformedFailureReports.length > 0 ||
                    issues.decimalRates.length > 0 ||
                    issues.boilerplateText.length > 0 ||
                    issues.emptyIdealValues.length > 0;

  if (!hasIssues) {
    console.log("✅ No quality issues detected in Excel file.\n");
    return;
  }

  console.log("⚠️  Potential Quality Issues Detected:\n");

  if (issues.malformedFailureReports.length > 0) {
    console.log(`1. Malformed Failure Reports (${issues.malformedFailureReports.length} rows)`);
    console.log("   Bullets are on single lines instead of separate lines");
    const ex = issues.malformedFailureReports[0];
    console.log(`   Example (Row ${ex.row}, SKU ${ex.styleId}):`);
    console.log(`   ${ex.preview}\n`);
  }

  if (issues.decimalRates.length > 0) {
    console.log(`2. Decimal Failure Rates (${issues.decimalRates.length} rows)`);
    console.log("   Rates like 0.13 should be converted to 13%");
    const ex = issues.decimalRates[0];
    console.log(`   Example: Row ${ex.row}, SKU ${ex.styleId} has rate ${ex.rate}\n`);
  }

  if (issues.boilerplateText.length > 0) {
    console.log(`3. Boilerplate Text (${issues.boilerplateText.length} rows)`);
    console.log("   Contains 'Original PDN/LVN is missing' text");
    const multiCount = issues.boilerplateText.filter(x => x.count > 1).length;
    if (multiCount > 0) {
      console.log(`   ${multiCount} rows have multiple duplicate instances\n`);
    } else {
      console.log();
    }
  }

  if (issues.emptyIdealValues.length > 0) {
    console.log(`4. Empty Ideal Values (${issues.emptyIdealValues.length} rows)`);
    console.log("   Ideal PDN/LVN columns are empty\n");
  }

  console.log("💡 Note: These issues can be fixed automatically after import.");
  console.log("   You'll be shown exactly what will change before any cleaning is applied.\n");
}

// Phase 2: Import Data
async function importData(excelPath, orgId) {
  console.log("\n📥 Phase 2: Importing data to MongoDB...\n");

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const collection = client.db(DB_NAME).collection(COLLECTION_NAME);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(excelPath);
  const sheet = workbook.worksheets[0];
  const headers = sheet.getRow(1).values.slice(1);

  let processed = 0;
  let matched = 0;

  for (let rowIndex = 2; rowIndex <= sheet.rowCount; rowIndex++) {
    const row = sheet.getRow(rowIndex);
    const cells = row.values.slice(1);
    const styleId = cells[0]?.toString()?.trim();
    if (!styleId) continue;

    const filter = { orgId };
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
      const reasonValue = nextHeader?.toLowerCase().endsWith("reason") ? cells[j + 1] : "";
      const key = _.camelCase(header);

      updateObj[`attributes.${key}`] = {
        name: header,
        value: value ?? "",
        type: "string",
        hint: "",
        meta: {
          reason: { value: reasonValue ?? "", type: "string" },
          indicates: {
            value: (value ?? "").toString().toLowerCase() === "passed" ? "good" : "bad",
            type: "string"
          }
        },
        tags: ["intelcopilot", "myntraqc", "catalogueEdit"]
      };
    }

    const result = await collection.updateOne(filter, { $set: updateObj });
    processed++;
    if (result.matchedCount > 0) matched++;
  }

  await client.close();
  console.log(`✅ Import complete: ${processed} rows processed, ${matched} documents matched\n`);
  return { processed, matched };
}

// Phase 3: Analyze Imported Data
async function analyzeImportedData(orgId) {
  console.log("🔍 Phase 3: Analyzing imported data...\n");

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const collection = client.db(DB_NAME).collection(COLLECTION_NAME);

  const analysis = {
    malformedReports: [],
    decimalRates: [],
    boilerplateIssues: [],
    pdnPresenceIssues: []
  };

  const docsWithReports = await collection.find({
    orgId,
    "attributes.failureReport.value": { $exists: true, $ne: "" }
  }).toArray();

  for (const doc of docsWithReports) {
    const report = doc.attributes?.failureReport?.value || "";
    const sku = doc.attributes?.sku?.value || doc._id;

    if (report.includes("•") && (!report.includes("\n") || report.match(/ • /g))) {
      const cleaned = report.replace(/ • /g, "\n• ").replace(/\n\n+/g, "\n").trim();
      analysis.malformedReports.push({ sku, current: report.substring(0, 120), cleaned: cleaned.substring(0, 120) });
    }

    if (report.includes("Original PDN is missing") || report.includes("Original LVN is missing")) {
      const cleaned = report
        .replace(/\n?• Original LVN is missing\./g, "")
        .replace(/\n?• Original PDN is missing\./g, "")
        .replace(/\n\n+/g, "\n")
        .trim();
      analysis.boilerplateIssues.push({ sku, current: report.substring(0, 120), cleaned: cleaned.substring(0, 120) });
    }
  }

  const docsWithRates = await collection.find({
    orgId,
    "attributes.failureRate.value": { $exists: true }
  }).toArray();

  for (const doc of docsWithRates) {
    const rate = doc.attributes?.failureRate?.value;
    if (typeof rate === "number" && rate < 1) {
      analysis.decimalRates.push({
        sku: doc.attributes?.sku?.value || doc._id,
        current: rate,
        cleaned: Math.round(rate * 100)
      });
    }
  }

  await client.close();
  return analysis;
}

// Phase 4: Display Analysis and Ask for Confirmation
async function displayAnalysisAndConfirm(analysis) {
  console.log("=" .repeat(60));
  console.log("📋 POST-IMPORT ANALYSIS");
  console.log("=" .repeat(60));

  const hasIssues = analysis.malformedReports.length > 0 ||
                    analysis.decimalRates.length > 0 ||
                    analysis.boilerplateIssues.length > 0 ||
                    analysis.pdnPresenceIssues.length > 0;

  if (!hasIssues) {
    console.log("\n✅ No quality issues found in imported data.\n");
    return false;
  }

  console.log("\nI've analyzed the imported data. Here are the quality issues:\n");

  if (analysis.malformedReports.length > 0) {
    console.log("─".repeat(60));
    console.log(`1. Malformed Failure Reports (${analysis.malformedReports.length} documents)`);
    console.log("─".repeat(60));
    console.log("   These have bullets on single lines instead of properly formatted lists.\n");
    const ex = analysis.malformedReports[0];
    console.log(`   📌 Example - SKU ${ex.sku}:\n`);
    console.log("   BEFORE (Current):");
    console.log(`   ${ex.current}...\n`);
    console.log("   AFTER (Proposed):");
    console.log(`   ${ex.cleaned}...\n`);
  }

  if (analysis.decimalRates.length > 0) {
    console.log("─".repeat(60));
    console.log(`2. Decimal Failure Rates (${analysis.decimalRates.length} documents)`);
    console.log("─".repeat(60));
    console.log("   Rates stored as decimals (0.13) instead of percentages (13).\n");
    const ex = analysis.decimalRates[0];
    console.log(`   📌 Example - SKU ${ex.sku}:`);
    console.log(`   • Current: ${ex.current}`);
    console.log(`   • Proposed: ${ex.cleaned}%\n`);
  }

  if (analysis.boilerplateIssues.length > 0) {
    console.log("─".repeat(60));
    console.log(`3. Boilerplate Text (${analysis.boilerplateIssues.length} documents)`);
    console.log("─".repeat(60));
    console.log("   Redundant 'Original PDN/LVN is missing' text.\n");
    const ex = analysis.boilerplateIssues[0];
    console.log(`   📌 Example - SKU ${ex.sku}:\n`);
    console.log("   BEFORE:");
    console.log(`   ${ex.current}...\n`);
    console.log("   AFTER:");
    console.log(`   ${ex.cleaned}...\n`);
  }

  console.log("═".repeat(60));
  console.log("⚠️  Would you like me to apply these cleaning operations?");
  console.log("═".repeat(60));
  console.log("\nType YES to apply all cleaning operations shown above.");
  console.log("Type NO to leave the data as-is without any modifications.\n");

  const answer = await question("Your choice (yes/no): ");
  return answer.toLowerCase().trim() === "yes";
}

// Phase 5: Apply Cleaning
async function applyCleaning(orgId) {
  console.log("\n🧹 Phase 5: Applying cleaning operations...\n");

  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const collection = client.db(DB_NAME).collection(COLLECTION_NAME);

  // Fix newlines
  const newlineDocs = await collection.find({
    orgId,
    "attributes.failureReport.value": { $exists: true, $ne: "" }
  }).toArray();

  let newlineFixed = 0;
  for (const doc of newlineDocs) {
    const report = doc.attributes?.failureReport?.value || "";
    let cleaned = report.replace(/\n?• /g, "\n• ").replace(/\n\n+/g, "\n").trim();
    if (cleaned !== report) {
      await collection.updateOne({ _id: doc._id }, { $set: { "attributes.failureReport.value": cleaned } });
      newlineFixed++;
    }
  }
  console.log(`✅ Fixed newlines in ${newlineFixed} failure reports`);

  // Fix decimal rates
  const rateDocs = await collection.find({ orgId, "attributes.failureRate.value": { $exists: true } }).toArray();
  let ratesFixed = 0;
  for (const doc of rateDocs) {
    const rate = doc.attributes?.failureRate?.value;
    if (typeof rate === "number" && rate < 1) {
      await collection.updateOne({ _id: doc._id }, { $set: { "attributes.failureRate.value": Math.round(rate * 100) } });
      ratesFixed++;
    }
  }
  console.log(`✅ Converted ${ratesFixed} decimal rates to percentages`);

  // Remove boilerplate
  let boilerplateFixed = 0;
  for (const doc of newlineDocs) {
    const report = doc.attributes?.failureReport?.value || "";
    const cleaned = report.replace(/\n?• Original LVN is missing\./g, "").replace(/\n?• Original PDN is missing\./g, "").replace(/\n\n+/g, "\n").trim();
    if (cleaned !== report) {
      await collection.updateOne({ _id: doc._id }, { $set: { "attributes.failureReport.value": cleaned } });
      boilerplateFixed++;
    }
  }
  console.log(`✅ Removed boilerplate text from ${boilerplateFixed} reports`);

  await client.close();
  console.log("\n✅ All cleaning operations completed!");
}

// Main Workflow
async function main() {
  try {
    // Phase 1: Pre-check
    const issues = await previewExcelIssues(EXCEL_FILE_PATH);
    displayPreCheckResults(issues);

    const proceed = await question("Proceed with import? (yes/no): ");
    if (proceed.toLowerCase().trim() !== "yes") {
      console.log("\n⏹️ Import cancelled.\n");
      rl.close();
      return;
    }

    // Phase 2: Import
    await importData(EXCEL_FILE_PATH, ORG_ID);

    // Phase 3: Analyze
    const analysis = await analyzeImportedData(ORG_ID);

    // Phase 4: Confirm
    const shouldClean = await displayAnalysisAndConfirm(analysis);

    // Phase 5: Clean or Skip
    if (shouldClean) {
      await applyCleaning(ORG_ID);
    } else {
      console.log("\n⏹️ Cleaning skipped. Data remains imported but not cleaned.");
      console.log("You can ask me to 'clean the imported data' anytime if you change your mind.\n");
    }

    rl.close();
  } catch (err) {
    console.error("❌ Error:", err);
    rl.close();
    process.exit(1);
  }
}

main();
