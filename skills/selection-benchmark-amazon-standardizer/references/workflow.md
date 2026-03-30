# Workflow

## Core Files

Expected files in the working directory:

- `Final.xlsx`: original workbook, read-only reference
- `Final.updated.xlsx`: duplicate workbook, write target
- `Variant.xlsx`: variant instructions and ownership/presence metadata
- `amazon_raw.xlsx`: Amazon master/raw source sheet
- `update_final_amazon_from_variant.py`: preferred implementation entrypoint if already present

Alternative reviewed-variant workflow files:

- raw marketplace CSV(s) that seed the run
- `input3/input3-initial-alldata.xlsx` or equivalent initial-ingestion workbook
- `input1/input.xlsx`
- `input1/input.updated.xlsx`
- `input1/input.variant_aliases.csv`
- `input2/input2.xlsx`
- `input2/input2.updated.xlsx`
- `input2/input2.variant_aliases.csv`
- `input2/input2.amazon_missing_variants.csv`
- `build_input_variants.py`: preferred implementation entrypoint for reviewed variant generation and Amazon-gap reduction

Downstream duplicate workbook examples:

- `Selection benchmark - Atta_Rice categories (2).xlsx`

Useful sidecar outputs:

- `Final.amazon_update_report.csv`
- `Final.amazon_present_y_verification.csv`
- `Final.amazon_present_y_missing.csv`
- `Final.non_amazon_missing_not_n.csv`
- `Final.non_amazon_missing_all.csv`
- `Final.non_amazon_missing_all.json`
- `input1/input1.manualresults.xlsx`
- `input1/input1.manualresults.resolution.csv`

## End-To-End Procedure

### 1. Establish Current State

- Confirm the workbook files exist in the current directory.
- Prefer reading and patching the existing project script instead of rebuilding logic from scratch:
  - `update_final_amazon_from_variant.py` for the `Final` workflow
  - `build_input_variants.py` for the reviewed `input1` / `input2` workflow
- Check current report files if they exist; they often contain evidence from the last validated run.

### 1A. Build The Initial Ingestion Workbook When Starting From CSV

If the run starts from raw marketplace CSV files:

1. build an initial all-data workbook like `input3/input3-initial-alldata.xlsx`
2. keep one sheet per marketplace source
3. preserve the marketplace-native fields that matter for later recovery and review, including:
   - SKU / ASIN
   - title
   - brand
   - pack size
   - marketplace taxonomy columns
   - source provenance columns such as source file / city / sheet
   - linkage columns such as `amazon asin` where present
4. treat this workbook as the raw evidence layer, not the main classification layer

Do not start durable variant work directly from loose CSVs when this initial workbook can be created first.

### 1B. Build The Compact Working Workbook

After the initial all-data workbook exists, derive a compact working workbook like `input2/input2.xlsx`.

Purpose:

- reduce the review surface to the fields needed for classification
- standardize every marketplace tab to the same minimal schema
- create a stable write target for Amazon recovery and later regeneration

Expected compact schema:

- `source`
- `sku`
- `title`
- `variant`
- `brand`

Rules for this stage:

- preserve one row per marketplace record keyed by the marketplace’s unique SKU / ASIN identity
- keep separate tabs by source
- carry over original title, SKU / ASIN, and brand
- leave `variant` blank initially if the row has not yet been classified
- use this compact workbook as the canonical working input for the reviewed pipeline

### 2. Respect the Write Boundary

- Never overwrite `Final.xlsx`.
- Never overwrite `Variant.xlsx`.
- Never overwrite `amazon_raw.xlsx`.
- Write the updated result to `Final.updated.xlsx`.
- Use report files as sidecars, not as extra workbook sheets.

For the reviewed variant workflow:

- the initial all-data workbook is the raw evidence layer and should remain available for inspection
- `input2/input2.xlsx` is the working source workbook for the reviewed Amazon/non-Amazon pipeline
- `input2/input2.updated.xlsx` and `input2/input2.variant_aliases.csv` are the validated downstream artifacts
- a downstream workbook such as `Selection benchmark - Atta_Rice categories (2).xlsx` may be updated only when the user explicitly asks for it
- when updating a downstream workbook, do not mutate unrelated fields; prefer adding one new column or appending only the specific Amazon recovery rows the user asked for

### 3. Base Update Pass From Variant.xlsx

- Read the first sheet of `Variant.xlsx`.
- Accept either `Variant` or `ok` as the variant column name.
- Treat `Present = Y` as active.
- Ignore `Present = N` for insertion/recovery purposes.
- Blank `Present` is not equal to `N`; it may still matter in parity analysis.

For `Present = Y`:

- if `Normalized Variant` exists, use it as the preferred canonical
- if `ASIN` exists, look up that ASIN in `amazon_raw.xlsx`
- if both exist, the normalized/canonical variant still controls the variant name

### 4. Update Existing Amazon Rows

- Work on the `amazon` sheet in the duplicate workbook.
- Rename existing Amazon `Variant` values from `Variant.xlsx` source variant to `Normalized Variant` when:
  - `Present = Y`
  - `Normalized Variant` is nonblank
  - the current Amazon row variant exactly matches the source variant after trimming

### 5. Insert New Amazon Rows From ASIN

- For `Present = Y` rows with `ASIN`, find the raw row by exact `asin` or `Asin`.
- Reject rows whose raw taxonomy is outside produce/perishables.
- Build the new Amazon row only with columns already present in the final Amazon sheet.
- Standardize `Brand`, `Pack Size`, and category fields using existing final-sheet patterns where possible.

### 6. Recover Missing Variants Without ASIN

Use this order:

1. exact or phrase-safe `amazon_raw.item_name` recovery
   this can include proven synonym expansions for the same product wording family
2. explicit user-approved raw item names
3. review `dedupe_delete` rows where the original Amazon `SKU + Pack Size` already existed; use those only when the original Amazon canonical preserves the same product identity and form
4. same-SKU standardization to an already-existing Amazon canonical
5. manual mapping only when the user explicitly authorizes it or the identity is clearly the same product

Do not treat weak fuzzy text matches as sufficient evidence.
Do not use this step to collapse prep form, product part, or state unless the user explicitly approves that relaxation.

### 7. Reduce Non-Amazon Minus Amazon Gaps

To compute the broader gap:

- build the unique Amazon variant set from the reviewed Amazon output
  - `Final.updated.xlsx -> amazon` in the old workflow
  - `input2/input2.variant_aliases.csv` where `source == amazon` in the reviewed workflow
- build the unique non-Amazon variant set across every other marketplace tab or source
- missing set = other-tabs variants minus Amazon variants

Then reduce it using only:

- proven safe non-Amazon alias standardizations to existing Amazon canonicals
- exact raw imports that survive scrutiny
- exact synonym families already represented on Amazon
- reviewed Amazon rows recovered from `amazon_raw.xlsx` and inserted back into the working Amazon sheet before recomputing the gap

Before accepting a broader alias:

- reject it if it changes prep form or state
- reject it if it changes plant/fruit part
- reject it if it only works because a duplicate appended row got deduped against an original Amazon key but the original canonical is semantically different
- reject it if it collapses a cultivar or distinctive subtype into a broader family when the title clearly carries that subtype
- allow it when it is only spelling drift, singular/plural drift, regional synonym drift, or exact same-product wording drift

Recommended reviewed-workflow pass order:

0. if starting from CSV, create the initial all-data workbook and the compact working workbook first
1. review and fix title-to-variant precision in bounded blocks
2. regenerate `input2/input2.variant_aliases.csv`
3. compute the missing Amazon variant set from reviewed outputs
4. check each candidate against the current Amazon sheet
5. check each remaining candidate against `amazon_raw.xlsx`
6. if found in `amazon_raw.xlsx`, add the SKU back into the working Amazon workbook and regenerate
7. only then decide whether a still-missing variant is a safe collapse to an Amazon-present canonical
8. track reviewed misses explicitly so the same candidates are not repeatedly re-audited without new evidence

### 7A. Apply ManualResults Overlay When Available

If the user supplies a reviewed workbook like `input1/input1.manualresults.xlsx`:

1. regenerate the current reviewed outputs first
2. treat the manual workbook as a post-review overlay, not a replacement for the main pipeline
3. read the `variants` sheet with columns:
   - `variants`
   - `Present (Y/N)`
   - `Title`
4. process only rows marked `Y` or blank that are still present in the current missing export
5. mark every row present in the manual workbook as reviewed in `reviewed_missing_variants.txt`, including `N` rows
6. resolve in this order:
   - exact current-Amazon title match, collapsing to the already-present Amazon canonical
   - exact `amazon_raw.item_name`
   - `amazon_raw.Short Title` fallback
7. if the title is blank, try exact inference from the missing export’s `supporting_titles`
8. append recovered Amazon rows only to the generated reviewed workbook such as `input1/input.updated.xlsx`, not the source `input1/input.xlsx`
9. when appending a raw-backed Amazon row in the reviewed workflow, set its variant to the missing variant name so that variant becomes Amazon-present directly
10. export a manual resolution sidecar such as `input1/input1.manualresults.resolution.csv`

If a manual-results row is outside the current missing export, skip it and report it rather than forcing it back into the workbook.

### 8. Dedupe Appended Amazon Rows

After inserts:

- dedupe appended rows on `SKU + Pack Size`
- if the same `SKU + Pack Size` already existed in original Amazon, keep the original and delete appended duplicates
- otherwise keep one appended row, preferring the row that has a `Title`

### 9. Export Verification

Refresh any needed sidecars:

- full missing list: CSV and JSON
- filtered missing list for non-`N`
- present-`Y` verification reports
- reviewed alias exports for every source sheet
- downstream workbook parity checks if a duplicate workbook was updated from the reviewed pipeline

Preferred implementation detail:

- have the main rebuild script refresh these sidecars as part of the same run, so the workbook and parity exports cannot drift out of sync
- if the script also owns initial ingestion, keep both the initial all-data workbook and the compact working workbook reproducible from the same pipeline

### 10. Learn From The Run

Before finalizing:

- update the skill’s validated findings if a new rule or mapping was proven
- record failed or unsafe mappings that looked tempting but were rejected
- keep the skill’s knowledge cumulative and evidence-based

### 11. Downstream Workbook Mapping

When the user asks to add `rubickVariant` or equivalent to a duplicate workbook:

1. inspect every target tab and map it to the reviewed `source`
2. build source-specific lookup maps from the reviewed alias export
3. match in this order:
   - exact source-specific `SKU` / `ASIN`
   - exact `amazon asin` fallback when the row is a non-Amazon tab carrying Amazon linkage
   - exact same-source title
   - for Amazon-only cleanup, explicit title fallback fields such as `Short Title`
4. add only the requested new variant column unless the user explicitly asks for row appends
5. verify blank-counts per tab after the fill

When the user wants the duplicate workbook’s missing-Amazon % to match the reviewed pipeline:

1. diff the reviewed Amazon SKU set against the duplicate workbook’s Amazon tab
2. append the recovered Amazon rows from `amazon_raw.xlsx`
3. if a reviewed Amazon SKU is absent from `amazon_raw.xlsx`, add the minimal row from the reviewed working workbook instead of forcing a raw lookup
4. recompute unique Amazon variants vs unique non-Amazon variants from the duplicate workbook itself
5. only finish when the duplicate workbook’s % matches the reviewed pipeline state

## Safe Decision Hierarchy

Highest confidence:

1. exact ASIN from `Variant.xlsx`
2. exact existing Amazon variant already present
3. exact or clearly equivalent raw `item_name`
4. same SKU already on Amazon under a clearly equivalent canonical
5. explicit user instruction
6. exact downstream workbook row keyed to a reviewed alias export by source-specific SKU/ASIN

Lower confidence:

- broad fuzzy title matching without confirming product identity
- category-only or brand-only similarity
- lexical similarity that changes product state, prep form, or organic/frozen status
- lexical similarity that changes product part such as leaf/stem/root/bulb/string/garland/bouquet
- broad family flattening that discards cultivar or subtype identity just to reduce the missing count

## Durable Implementation Lessons

- Starting from a raw initial-ingestion workbook like `input3/input3-initial-alldata.xlsx` is better than starting variant work from loose CSVs. It preserves the marketplace-native evidence needed for later Amazon recovery and downstream mapping.
- Building a compact working workbook like `input2/input2.xlsx` before classification is a durable pattern. It standardizes the minimal fields needed for review and keeps the later variant pipeline simple.
- Build header maps with `setdefault` behavior when a workbook contains duplicate logical headers such as `asin` and `Asin`; otherwise the later duplicate may silently override the usable source column.
- When appending rows into a workbook that does not persist in-place reliably, rebuild to a new file and replace the target only after verification.
- For downstream duplicate workbooks, verify the persisted row count after append operations instead of trusting the attempted append count.
- If Amazon rows have blank `item_name` but populated `Short Title`, use `Short Title` as the Amazon-only title fallback for variant assignment.

## Preferred Outputs

- one regenerated duplicate workbook
- one updated report CSV
- one updated full missing JSON/CSV when parity work is involved
- concise verification counts in the final response
