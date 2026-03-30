# Maintenance And Learning

This skill is meant to be self-improving.

Whenever you use it and discover a new validated rule, mapping, or failure mode, update this skill before you finish.

## Required Self-Update Protocol

At the end of a meaningful run:

1. Check whether you learned something new that is likely to help future runs.
2. If yes, update the skill files in `~/.codex/skills/selection-benchmark-amazon-standardizer/`.
3. Regenerate `agents/openai.yaml` only if the UI metadata needs to change.
4. Keep changes additive and evidence-based.

## What Counts As A Validated Learning

Add a new item when one of these is true:

- a new alias reduced the count and was semantically correct
- a new raw `item_name` or ASIN rule reliably produced correct rows
- a new rejection rule prevented bad imports
- a new dedupe or standardization rule improved accuracy
- a new workbook or header quirk required a durable parser fix

Do not add speculative mappings.

## Where To Record New Knowledge

### Update `validated-findings.md` for:

- new safe alias mappings
- new rejected or unsafe mapping examples
- new raw-source matching patterns
- new count-reduction lessons

### Update `rules-and-constraints.md` for:

- new user-level hard rules
- changed write boundaries
- changed field mapping logic
- changed category, brand, or pack-size policies

### Update `workflow.md` for:

- changed execution order
- new verification outputs
- new repeatable steps that future runs should always follow

## Quality Bar For New Mappings

Before adding a mapping to the skill, ask:

- Was the product identity confirmed?
- Did it survive workbook regeneration?
- Did it reduce the count without introducing obvious semantic drift?
- Would you trust this rule on the next run without rereading the whole conversation?

If not, do not add it to the permanent skill.

## How To Handle Reversals

If a previously accepted rule turns out to be unsafe:

1. remove it from the live standardization list in the project script
2. update `validated-findings.md`
3. add a brief note explaining why it was removed

## Project-Specific Notes To Preserve

- `Variant.xlsx` may use `ok` instead of `Variant` as the column header.
- The duplicate workbook is the required output target.
- Broad parity work may legitimately involve non-Amazon tab standardization in the duplicate when explicitly requested.
- The Amazon raw sheet often contains near matches, but broad exact normalization across the full missing set has not been a productive primary strategy.
- In the reviewed atta/rice workflow, `build_input_variants.py` is the canonical place for durable logic changes; sidecars and reviewed workbooks should be regenerated from it, not patched by hand.
- For downstream duplicate workbooks, the trusted parity target is the reviewed alias export, not a fresh ad hoc recount from workbook titles.
- Watch for duplicate logical headers such as `asin` and `Asin`; parser maps must preserve first occurrence rather than overwrite with the later duplicate.
- If append operations appear to succeed but disappear after save, verify by reopening the workbook and checking the row count. Rebuild to a new file and replace the target if necessary.
- If a reviewed manual workbook like `input1.manualresults.xlsx` exists, treat it as an overlay input with columns `variants`, `Present (Y/N)`, and `Title`; keep the overlay logic inside `build_input_variants.py` and regenerate the reviewed workbook plus sidecars from that single script.
- If the run starts from raw CSVs, preserve the pattern of:
  - initial all-data workbook as the evidence layer
  - compact working workbook as the review/classification layer
  Record changes to that ingestion pattern as durable workflow knowledge, not as one-off run notes.

## Final Check Before Responding To The User

Make sure:

- the workbook/report outputs were refreshed if you changed logic
- the JSON/CSV sidecars match the current workbook state
- the skill files were updated if you learned something durable
- your final message reports the new counts, not stale ones
