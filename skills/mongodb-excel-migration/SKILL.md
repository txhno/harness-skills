---
name: mongodb-excel-migration
description: |
  Import data from Excel to MongoDB with intelligent attribute mapping, optional post-import data cleaning,
  and failure reason analysis. This skill INTERACTIVELY checks data quality and ONLY cleans after user confirmation.

  Handles product data normalization, PDN/LVN presence checking with stemming, stop word filtering, and
  comprehensive data quality fixes. Use this skill when migrating product catalog data from Excel spreadsheets
  to MongoDB collections, especially for e-commerce product attribute imports with quality check attributes.

  **INTERACTIVE WORKFLOW**: This skill will:
  1. Preview Excel data and flag potential quality issues BEFORE import
  2. Import data to MongoDB
  3. Analyze imported data and PRESENT quality issues to you with BEFORE/AFTER comparisons
  4. ASK for your confirmation before applying any cleaning
  5. Only clean if you explicitly confirm - otherwise leave data as-is

compatibility:
  - Node.js with mongodb, exceljs, lodash, natural packages
  - MongoDB 4.0+ with attribute-style document structure
  - Excel files with paired value/reason columns
---

# MongoDB Excel Data Migration Skill

This skill provides an **interactive workflow** for migrating product data from Excel to MongoDB. It checks data quality at each step and **only applies cleaning operations after showing you the issues and getting your explicit confirmation**.

## Interactive Workflow

### Phase 1: Excel Pre-Check (Before Import)

**ALWAYS run this first to identify potential issues in the Excel file:**

```javascript
import ExcelJS from "exceljs";

async function previewExcelIssues(excelPath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(excelPath);
  const sheet = workbook.worksheets[0];

  const issues = {
    malformedFailureReports: [],      // Bullets without newlines
    decimalRates: [],                 // Failure rates < 1 (likely decimals)
    boilerplateText: [],              // Contains "Original PDN/LVN is missing"
    emptyIdealValues: [],             // Empty Ideal PDN/LVN columns
    totalRows: sheet.rowCount - 1
  };

  const headers = sheet.getRow(1).values.slice(1);
  const failureReportIdx = headers.findIndex(h => h === "Failure Report");
  const failureRateIdx = headers.findIndex(h => h === "Failure Rate (%)");

  for (let rowIndex = 2; rowIndex <= sheet.rowCount; rowIndex++) {
    const row = sheet.getRow(rowIndex);
    const cells = row.values.slice(1);
    const styleId = cells[0]?.toString()?.trim();

    // Check for malformed failure reports (bullets without newlines)
    if (failureReportIdx >= 0) {
      const report = cells[failureReportIdx]?.toString() || "";
      if (report.includes("•") && !report.includes("\n")) {
        issues.malformedFailureReports.push({
          row: rowIndex - 1,
          styleId,
          preview: report.substring(0, 100) + "..."
        });
      }
      // Check for boilerplate text
      if (report.includes("Original PDN is missing") || report.includes("Original LVN is missing")) {
        issues.boilerplateText.push({
          row: rowIndex - 1,
          styleId,
          hasMultiple: (report.match(/Original (PDN|LVN) is missing/g) || []).length > 1
        });
      }
    }

    // Check for decimal rates
    if (failureRateIdx >= 0) {
      const rate = cells[failureRateIdx];
      if (typeof rate === "number" && rate < 1) {
        issues.decimalRates.push({ row: rowIndex - 1, styleId, rate });
      }
    }
  }

  return issues;
}
```

**Present findings to user:**

```
## Excel Pre-Check Results

Found {totalRows} rows to import.

**Potential Quality Issues Detected:**

1. **Malformed Failure Reports** ({malformedFailureReports.length} rows)
   - Bullets are on single lines instead of separate lines
   - Example (Row {example.row}): {example.preview}

2. **Decimal Failure Rates** ({decimalRates.length} rows)
   - Rates like 0.13 should be converted to 13%
   - Example: Row {example.row} has rate {example.rate}

3. **Boilerplate Text** ({boilerplateText.length} rows)
   - Contains "Original PDN/LVN is missing" text
   - Some have multiple duplicate instances

**Note:** These issues can be fixed automatically after import.
You'll be shown exactly what will change before any cleaning is applied.

Proceed with import? (yes/no)
```

### Phase 2: Data Import

**Import ONLY after user confirms. Use the standard import pattern:**

```javascript
import { MongoClient } from "mongodb";
import ExcelJS from "exceljs";
import _ from "lodash";

async function importData(excelPath, mongoUri, orgId) {
  const client = new MongoClient(mongoUri);
  await client.connect();
  const collection = client.db("omsProd").collection("tasks");

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

    const filter = { orgId, "attributes.sku.value": styleId };
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
  return { processed, matched };
}
```

### Phase 3: Post-Import Analysis (SHOW, DON'T CLEAN)

**Analyze the imported data and PRESENT issues to the user:**

```javascript
async function analyzeImportedData(mongoUri, orgId) {
  const client = new MongoClient(mongoUri);
  await client.connect();
  const collection = client.db("omsProd").collection("tasks");

  const analysis = {
    // Check failure reports that need newline fixing
    malformedReports: [],

    // Check decimal failure rates
    decimalRates: [],

    // Check boilerplate text
    boilerplateIssues: [],

    // Check PDN presence checks that need stemming fixes
    pdnPresenceIssues: []
  };

  // Find malformed failure reports
  const docsWithReports = await collection.find({
    orgId,
    "attributes.failureReport.value": { $exists: true, $ne: "" }
  }).toArray();

  for (const doc of docsWithReports) {
    const report = doc.attributes?.failureReport?.value || "";
    const sku = doc.attributes?.sku?.value || doc._id;

    // Check if bullets aren't properly formatted
    if (report.includes("•") && (!report.includes("\n") || report.match(/ • /g))) {
      analysis.malformedReports.push({
        sku,
        current: report.substring(0, 150) + (report.length > 150 ? "..." : ""),
        cleaned: report.replace(/ • /g, "\n• ").substring(0, 150) + "..."
      });
    }

    // Check for boilerplate
    if (report.includes("Original PDN is missing") || report.includes("Original LVN is missing")) {
      const cleaned = report
        .replace(/\n?• Original LVN is missing\./g, "")
        .replace(/\n?• Original PDN is missing\./g, "")
        .trim();

      analysis.boilerplateIssues.push({
        sku,
        current: report.substring(0, 150) + "...",
        cleaned: cleaned.substring(0, 150) + "..."
      });
    }
  }

  // Find decimal failure rates
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

  // Find PDN presence checks that might pass with stemming
  const docsWithPdn = await collection.find({
    orgId,
    "attributes.pdnPresenceCheck.value": "Failed"
  }).toArray();

  for (const doc of docsWithPdn) {
    const title = doc.attributes?.title?.value || "";
    const idealPdn = doc.attributes?.idealPdn?.value || "";

    if (!idealPdn) continue;

    // Simple check - if title and idealPdn are similar but not exact
    const titleLower = title.toLowerCase();
    const idealLower = idealPdn.toLowerCase();

    // Check if words exist but differ only in form (plural/singular)
    // This is a simplified preview - full stemming would be done during actual cleaning
    if (titleLower.split(" ").some(w => idealLower.includes(w.replace(/s$/, "")))) {
      analysis.pdnPresenceIssues.push({
        sku: doc.attributes?.sku?.value || doc._id,
        title,
        idealPdn,
        currentStatus: "Failed",
        currentReason: doc.attributes?.pdnPresenceCheck?.meta?.reason?.value,
        potentialStatus: "Passed",
        potentialReason: "All words from ideal PDN present"
      });
    }
  }

  await client.close();
  return analysis;
}
```

### Phase 4: Interactive Confirmation

**Present analysis results with BEFORE/AFTER comparisons:**

```
## Post-Import Analysis Complete

I've analyzed the imported data. Here are the quality issues found:

---

### 1. Malformed Failure Reports ({malformedReports.length} documents)

These have bullets on single lines instead of properly formatted lists.

**Example - SKU {example.sku}:**

**BEFORE (Current):**
```
• Description has only 2 bullets • Ideal LVN: Camisoles • Original LVN is missing.
```

**AFTER (Proposed):**
```
• Description has only 2 bullets
• Ideal LVN: Camisoles
• Original LVN is missing
```

---

### 2. Decimal Failure Rates ({decimalRates.length} documents)

Rates stored as decimals (0.13) instead of percentages (13).

**Example - SKU {example.sku}:**
- Current: {example.current}
- Proposed: {example.cleaned}%

---

### 3. Boilerplate Text ({boilerplateIssues.length} documents)

Redundant "Original PDN/LVN is missing" text (sometimes appearing multiple times).

**Example - SKU {example.sku}:**

**BEFORE:**
```
• Ideal LVN: Camisoles
• Original LVN is missing.
• Original LVN is missing.
• Ideal PDN: Zivame Solid Camisoles
• Original PDN is missing.
```

**AFTER:**
```
• Ideal LVN: Camisoles
• Ideal PDN: Zivame Solid Camisoles
```

---

### 4. PDN Presence Checks ({pdnPresenceIssues.length} documents)

These failed but may pass when considering plural/singular forms.

**Example - SKU {example.sku}:**
- Title: "{example.title}"
- Ideal PDN: "{example.idealPdn}"
- Current Status: {example.currentStatus} - {example.currentReason}
- **Proposed Status:** {example.potentialStatus} - {example.potentialReason}

---

## Would you like me to apply these cleaning operations?

**Type YES to apply all cleaning operations shown above.**
**Type NO to leave the data as-is without any modifications.**

> Note: If you choose NO, the data will remain imported but uncleaned. You can
> always run cleaning operations later by asking me to "clean the imported data."
```

### Phase 5: Conditional Cleaning

**ONLY if user says YES, apply the cleaning:**

```javascript
// Only run these if user explicitly confirms!

async function applyCleaning(mongoUri, orgId) {
  // 1. Fix newlines in failure reports
  await fixNewlines(collection, orgId);

  // 2. Convert decimal rates to percentages
  await fixFailureRates(collection, orgId);

  // 3. Remove boilerplate text
  await removeBoilerplate(collection, orgId);

  // 4. Fix PDN presence checks with stemming
  await fixPdnPresenceChecks(collection, orgId);

  // 5. Fix PDN sequence check format
  await fixPdnSequenceChecks(collection, orgId);

  console.log("✅ All cleaning operations completed!");
}

// If user says NO:
console.log("⏹️ Cleaning skipped. Data remains imported but not cleaned.");
console.log("You can ask me to 'clean the imported data' anytime if you change your mind.");
```

## Cleaning Functions (Use ONLY after confirmation)

### Fix Newlines in Failure Reports

```javascript
async function fixNewlines(collection, orgId) {
  const docs = await collection.find({
    orgId,
    "attributes.failureReport.value": { $exists: true, $ne: "" }
  }).toArray();

  for (const doc of docs) {
    const report = doc.attributes?.failureReport?.value || "";

    let cleaned = report
      .replace(/\n?• /g, "\n• ")
      .replace(/\n\n+/g, "\n")
      .trim();

    if (cleaned !== report) {
      await collection.updateOne(
        { _id: doc._id },
        { $set: { "attributes.failureReport.value": cleaned } }
      );
    }
  }
}
```

### Convert Decimal Rates to Percentages

```javascript
async function fixFailureRates(collection, orgId) {
  const docs = await collection.find({
    orgId,
    "attributes.failureRate.value": { $exists: true }
  }).toArray();

  for (const doc of docs) {
    const rate = doc.attributes?.failureRate?.value;
    if (typeof rate === "number" && rate < 1) {
      await collection.updateOne(
        { _id: doc._id },
        { $set: { "attributes.failureRate.value": Math.round(rate * 100) } }
      );
    }
  }
}
```

### Remove Boilerplate Text

```javascript
async function removeBoilerplate(collection, orgId) {
  const docs = await collection.find({
    orgId,
    "attributes.failureReport.value": { $exists: true, $ne: "" }
  }).toArray();

  for (const doc of docs) {
    const report = doc.attributes?.failureReport?.value || "";

    const cleaned = report
      .replace(/\n?• Original LVN is missing\./g, "")
      .replace(/\n?• Original PDN is missing\./g, "")
      .replace(/\n\n+/g, "\n")
      .trim();

    if (cleaned !== report) {
      await collection.updateOne(
        { _id: doc._id },
        { $set: { "attributes.failureReport.value": cleaned } }
      );
    }
  }
}
```

### Fix PDN Presence Checks with Stemming

```javascript
import natural from "natural";
const stemmer = natural.PorterStemmer;

const STOP_WORDS = new Set([
  "and", "with", "the", "of", "in", "on", "at", "to", "for", "by", "from",
  "a", "an", "is", "are", "was", "were", "be", "been", "being",
  "this", "that", "these", "those", "it", "its", "as"
]);

function findMissingWords(title, idealPdn) {
  const titleWords = title.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  const idealWords = idealPdn.toLowerCase().split(/\s+/).filter(w => w.length > 0);
  const titleStems = titleWords.map(w => stemmer.stem(w.replace(/[^a-z0-9]/g, '')));

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

async function fixPdnPresenceChecks(collection, orgId) {
  const docs = await collection.find({
    orgId,
    "attributes.pdnPresenceCheck.value": "Failed"
  }).toArray();

  for (const doc of docs) {
    const title = doc.attributes?.title?.value || "";
    const idealPdn = doc.attributes?.idealPdn?.value || "";
    if (!idealPdn) continue;

    const missingWords = findMissingWords(title, idealPdn);

    if (missingWords.length === 0) {
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
    } else {
      await collection.updateOne(
        { _id: doc._id },
        {
          $set: {
            "attributes.pdnPresenceCheck.meta.reason.value":
              `Missing words from ideal PDN: ${missingWords.join(", ")}`
          }
        }
      );
    }
  }
}
```

### Fix PDN Sequence Check Format

```javascript
async function fixPdnSequenceChecks(collection, orgId) {
  const docs = await collection.find({
    orgId,
    "attributes.pdnSequenceCheck.value": "Failed"
  }).toArray();

  for (const doc of docs) {
    const idealPdn = doc.attributes?.idealPdn?.value || "";
    if (!idealPdn) continue;

    const newReason = `Words out of order. Ideal order: ${idealPdn}`;

    await collection.updateOne(
      { _id: doc._id },
      { $set: { "attributes.pdnSequenceCheck.meta.reason.value": newReason } }
    );
  }
}
```

## Document Structure

### Input Excel Format

| StyleId | Attribute Name | Attribute Name Reason | Failure Report | Failure Rate (%) | ... |
|---------|---------------|----------------------|----------------|------------------|-----|
| SKU123 | Passed | Some reason | • Issue 1 • Issue 2 | 0.13 | ... |

### Output MongoDB Structure

```javascript
{
  _id: ObjectId("..."),
  orgId: "org_...",
  attributes: {
    attributeName: {
      name: "Original Column Name",
      value: "Passed",
      type: "string",
      hint: "",
      meta: {
        reason: { value: "Some reason", type: "string" },
        indicates: { value: "good", type: "string" }
      },
      tags: ["intelcopilot", "myntraqc", "catalogueEdit"]
    }
  }
}
```

## Summary

This skill follows a **User-in-Control** philosophy:

1. **Preview** - Show what's going to happen before importing
2. **Import** - Push data to MongoDB (raw, unmodified)
3. **Analyze** - Check imported data and identify issues
4. **Present** - Show BEFORE/AFTER comparisons clearly
5. **Confirm** - Ask user explicitly before any modifications
6. **Execute** - Only clean if user says YES

**User can always say NO and the data will remain imported but uncleaned.**
