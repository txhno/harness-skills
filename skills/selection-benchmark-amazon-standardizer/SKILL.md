---
name: selection-benchmark-amazon-standardizer
description: Use when working on the selection benchmark workbooks that compare Amazon vs non-Amazon marketplaces, especially when updating duplicate benchmark workbooks from reviewed variant outputs and amazon_raw.xlsx, generating or standardizing Rubick variants, reducing missing Amazon variants without losing identity accuracy, preserving original source files, and maintaining a validated decision log for future runs.
---

# Selection Benchmark Amazon Standardizer

## Overview

Use this skill for the workbook workflows built around:

- `Final.xlsx`, `Final.updated.xlsx`, `Variant.xlsx`, and `amazon_raw.xlsx`
- `input1` / `input2` reviewed variant pipelines driven by `build_input_variants.py`
- downstream duplicate selection workbooks such as `Selection benchmark - Atta_Rice categories (2).xlsx`

This skill is for high-accuracy Amazon-tab maintenance in the selection benchmark project: update only the duplicate workbook, standardize variants carefully, reduce non-Amazon-minus-Amazon gaps using validated evidence, preserve a running knowledge base of what worked and what failed, and keep the Amazon coverage math in sync across the reviewed workbook, sidecar exports, and any downstream duplicate workbook.

## When To Use

Use this skill when the user asks for any of the following:

- take the initial marketplace CSV(s) and build a workbook like `input3/input3-initial-alldata.xlsx`
- take the initial all-data workbook and build a compact working workbook like `input2/input2.xlsx`
- update the duplicate final workbook from `Variant.xlsx`
- update reviewed `input1` / `input2` workbooks from `build_input_variants.py`
- add a `rubickVariant` column to a downstream workbook and map it by tab plus SKU/ASIN/title
- add Amazon rows from `amazon_raw.xlsx`
- reduce the count of variants present in non-Amazon tabs but missing on Amazon
- standardize Amazon or non-Amazon variant names to existing Amazon canonicals
- verify `Present = Y` coverage on Amazon
- export missing-variant lists to CSV or JSON
- copy recovered Amazon rows into a downstream benchmark workbook so its Amazon coverage matches the reviewed `input2` state
- keep the workflow self-improving by recording new validated mappings or failure modes

Do not use this skill for generic Excel cleanup unrelated to this benchmark workflow.

## Required Workflow

Read these references in this order:

1. [workflow.md](./references/workflow.md)
2. [rules-and-constraints.md](./references/rules-and-constraints.md)
3. [validated-findings.md](./references/validated-findings.md)

Read [maintenance-and-learning.md](./references/maintenance-and-learning.md) before finalizing any run that changes the workbook, script, or validated rule set.

## Operating Rules

- Prefer updating the existing project script if present: `update_final_amazon_from_variant.py`.
- For the reviewed atta/rice pipeline, prefer updating the existing project script if present: `build_input_variants.py`.
- Default outputs are the duplicate workbook and sidecar reports, never the originals.
- Treat accuracy as higher priority than aggressive coverage. Only standardize or import when the product identity is defensible.
- Prefer existing Amazon canonicals and existing Amazon category combinations over inventing new ones.
- If a proposed mapping is semantically weak, leave it missing unless the user explicitly approves it.
- For Amazon-gap reduction, treat the reviewed alias export as the source of truth for canonicals; do not hand-maintain downstream workbook variants independently of the reviewed pipeline.
- For reviewed variant work, keep two stages distinct:
  - the raw initial-ingestion workbook with marketplace-specific columns
  - the compact working workbook with normalized columns such as `source`, `sku`, `title`, `variant`, and `brand`

## Fast Path

1. Confirm the working files in the current directory.
2. Inspect the existing project script if it exists:
   - `update_final_amazon_from_variant.py` for the `Final.xlsx` workflow
   - `build_input_variants.py` for the reviewed `input1` / `input2` workflow
3. Run the existing workflow rather than rewriting it from scratch.
4. Regenerate:
   - `Final.updated.xlsx`
   - `Final.amazon_update_report.csv`
   - any requested verification exports such as `Final.non_amazon_missing_all.csv` or `.json`
   - or, for the reviewed variant workflow:
     - the initial all-data workbook, e.g. `input3/input3-initial-alldata.xlsx`
     - the compact working workbook, e.g. `input2/input2.xlsx`
     - `input2/input2.updated.xlsx`
     - `input2/input2.variant_aliases.csv`
     - `input2/input2.amazon_missing_variants.csv`
     - any downstream duplicate workbook requested by the user
5. Apply the maintenance protocol so the skill learns from new validated outcomes.

## What This Skill Must Preserve

- Original files stay untouched unless the user explicitly says otherwise.
- The duplicate workbook remains the write target.
- Amazon changes must be explainable from one of:
  - `Variant.xlsx`
  - reviewed `input1` / `input2` alias exports produced by the project script
  - exact or defensible `amazon_raw.xlsx` evidence
  - proven same-SKU standardization to an already-existing Amazon canonical
  - explicit user instruction

## References

- [workflow.md](./references/workflow.md): end-to-end process
- [rules-and-constraints.md](./references/rules-and-constraints.md): explicit user rules and field mapping rules
- [validated-findings.md](./references/validated-findings.md): what worked, what failed, and current proven canonicals
- [maintenance-and-learning.md](./references/maintenance-and-learning.md): how to update the skill after each validated run
