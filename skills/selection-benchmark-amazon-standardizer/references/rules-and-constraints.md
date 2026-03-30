# Rules And Constraints

## User Instructions Captured From The Project

These are hard rules unless the user explicitly changes them later.

### File Safety

- Do not touch the original `Final.xlsx`.
- Do not touch `Variant.xlsx`.
- Do not touch `amazon_raw.xlsx`.
- Make and update a duplicate export only.
- For the reviewed variant workflow, do not hand-edit sidecar exports directly; regenerate them from `build_input_variants.py`.

### Workbook Scope

Primary scope:

- write changes only to the duplicate workbook
- Amazon changes belong on the `amazon` tab

Reviewed variant scope:

- the initial all-data workbook may be created from raw marketplace CSVs and should preserve marketplace-native fields
- `input2/input2.xlsx` may be updated when the user explicitly wants Amazon recovery rows added back into the reviewed source workbook
- `input2/input2.updated.xlsx` and `input2/input2.variant_aliases.csv` must be regenerated from the project script after logic changes
- for manual-results-driven reviewed work, append recovered Amazon rows only to the generated workbook such as `input1/input.updated.xlsx`, not to the source `input1/input.xlsx`
- downstream duplicate workbooks may receive a new `rubickVariant` column or recovered Amazon rows only when explicitly requested

Initial-ingestion rule:

- if the user starts from a raw CSV dump, first create an all-data workbook like `input3/input3-initial-alldata.xlsx`
- then create a compact working workbook like `input2/input2.xlsx`
- do not skip directly from raw CSV to ad hoc reviewed variants if the run is expected to be repeatable

Expanded scope allowed by explicit user instruction:

- non-Amazon tabs in the duplicate may be standardized when needed to reduce parity counts
- this was explicitly used for cases like `Bird Eye`

### Variant.xlsx Rules

- `Present = N`: leave it alone for Amazon coverage work
- `Present = Y` with `Normalized Variant`: use the normalized/canonical variant
- `Present = Y` with `ASIN`: use the ASIN to find the row in `amazon_raw.xlsx`

### amazon_raw.xlsx Matching Rules

Original strict instruction:

- check only in `item_name`
- verify it is the same missing variant
- only then add it to the duplicate final

Later proven-safe extension:

- exact ASIN lookup is allowed when the ASIN comes from `Variant.xlsx`
- exact or explicit user-approved `item_name` aliases are allowed
- same-SKU standardization to an already-existing Amazon canonical is allowed when the product identity is clearly the same
- singular/plural and `Fresh ...` wording expansions are allowed when they preserve the same product identity
- for downstream Amazon duplicate rows, `Short Title` is an allowed fallback only when `item_name` is blank
- reviewed Amazon backfills may come from `amazon_raw.xlsx` or, if the reviewed Amazon SKU is not physically present there, from the reviewed working Amazon sheet itself

Hard stop:

- do not use raw or same-SKU matching to collapse prep form, product part, or product state without explicit user approval
- do not assume a reviewed Amazon SKU exists in `amazon_raw.xlsx`; confirm it

### ManualResults Rules

For reviewed files like `input1/input1.manualresults.xlsx`:

- `Present (Y/N) = Y`: actionable
- blank `Present (Y/N)`: actionable only with exact title or exact `supporting_titles` evidence
- `Present (Y/N) = N`: reviewed only; do not add or collapse it, but do mark it reviewed
- if a manual-results row is not in the current missing export, skip it and report it rather than force-applying it
- prefer exact current-Amazon title match before any raw backfill
- if the exact title already exists on Amazon under another canonical, collapse to that existing Amazon variant; do not rename the Amazon row
- raw backfills may use `Short Title` even when `item_name` is populated if the manual workbook explicitly identified that Amazon title
- when a reviewed raw backfill is inserted into the compact reviewed workbook, use the missing variant name as the Amazon variant value
- rows with no manual `Title` should use exact `supporting_titles` inference only; if no exact supporting title resolves, leave them unresolved

### Category Rules

For new Amazon SKUs:

- category must be assigned to a category combination that already exists on Amazon in `Final.xlsx`
- do not invent new Amazon category combinations

Preferred approach:

- use dominant profile for the same canonical variant from non-Amazon tabs if available
- otherwise choose an existing Amazon category combination that best matches the inferred `L4`

### Brand Rules

For new Amazon SKUs:

- standardize brand to how it appears in the existing final sheet when possible
- if the raw brand is blank or generic-like, normalize to `Generic`
- if exact profile is unavailable, use the closest trustworthy existing profile

### Pack Size Rules

For new Amazon SKUs:

- standardize pack size to final-sheet style where possible
- otherwise normalize from raw Amazon
- compact units
- convert `kg -> g`
- convert `L -> ml`
- normalize piece/unit variants to `pc`

### Mapping Rules

- fill only columns already present in the final Amazon sheet
- do not add extra workbook sheets for reports
- reports should be sidecar CSV/JSON files
- in the compact working workbook, preserve only the normalized minimal schema needed for variant review:
  - `source`
  - `sku`
  - `title`
  - `variant`
  - `brand`
- for downstream duplicate workbook fills, match by source tab first; never mix source-title lookups across marketplaces
- preferred downstream lookup order is:
  - exact source-specific `SKU` / `ASIN`
  - `amazon asin` fallback where that field exists
  - exact same-source title
  - `Short Title` only for Amazon rows with blank `item_name`

### Accuracy Rules

- if nothing matches cleanly, leave it missing
- lowering the count is good, but not at the cost of importing the wrong product
- user-approved manual mappings are allowed and should be recorded
- do not collapse cut/diced/sliced/shredded forms into another form unless the user explicitly authorizes it
- do not collapse peeled/unpeeled forms into another form unless the user explicitly authorizes it
- do not collapse frozen/non-frozen forms into another form unless the user explicitly authorizes it
- do not collapse microgreen to leaf/whole produce unless the user explicitly authorizes it
- do not collapse string/garland/bouquet/mala into base flower unless the user explicitly authorizes it
- do not collapse stem/root/leaf-part variants into a different part unless the user explicitly authorizes it
- do not collapse cultivar-specific rice names into broad rice families unless the user explicitly authorizes it
- do not collapse urad color/form distinctions when the title explicitly gives them
- do not collapse enriched or functional atta subtypes like `High Protein`, `Low GI`, `Sugar Control`, `Keto`, or vegetable-enriched atta into plain atta unless the user explicitly approves it

## Current Sheet/Field Mapping Rules

### Amazon Row Construction

Current working mapping logic:

- `SKU` = ASIN
- `Title` = first nonblank of raw `item_name`, `Item Name`, `Title`, `Short Title`
- `Brand` = standardized from existing final-sheet profile where possible, else normalized raw brand
- `Variant` = canonical variant
- `Category Group`, `L4` = dominant profile or fallback taxonomy, but constrained to existing Amazon combinations
- `L1` = from chosen existing Amazon combination
- `L2` = from chosen existing Amazon combination
- `L3` = from chosen existing Amazon combination
- `Pack Size` = existing profile when trustworthy, else normalized raw pack size
- `Match` = `SKU`
- `Match URL` = `https://www.amazon.in/dp/{SKU}`
- `URL` = `https://www.amazon.in/dp/{SKU}`
- `Image URL` = blank unless trustworthy source says otherwise

For downstream duplicate workbooks whose Amazon tab is raw-shaped rather than final-shaped:

- preserve the workbook’s existing column set
- add only the requested new column, typically `rubickVariant`, unless the user asks for Amazon row appends
- if appending recovered Amazon rows, copy only fields that have a trustworthy shared-source mapping and leave target-only fields blank unless they can be derived safely

## Raw Taxonomy Rejection Rules

Do not use raw matches when the taxonomy is clearly outside produce/perishables.

Current disallowed set:

- `Bath & Body`
- `Soaps`
- `Ready to Eat & Cook`
- `Frozen Snacks`
- `Pasta`
- `Pastes & Sauces`
- `Cooking Paste`
- `Oils, Ghee & Masala`
- `Whole Spices`
- `Powder Spices`
- `Seasonings`
- `Party Store`
- `Paan Store`
- `Mouth Fresheners`

## Dedupe Rules

- Dedupe appended Amazon rows on `SKU + Pack Size`
- Prefer the original Amazon row if the same key already existed in `Final.xlsx`
- Otherwise keep one appended row, preferring a row with `Title`
- Treat `dedupe_delete` rows caused by an already-existing original Amazon key as a review queue for possible safe same-SKU canonicals

For downstream duplicate workbook appends:

- verify the persisted Amazon row count after saving
- if in-place save does not preserve appended rows, rebuild to a new workbook and replace the target only after verification
- beware duplicate headers like `asin` and `Asin`; always keep the first logical source column instead of letting a later duplicate override it

## Report Rules

Useful actions already used in the report:

- `rename`
- `insert`
- `skip_odd_asin`
- `skip_missing_raw`
- `skip_already_satisfied`
- `insert_item_name_recovery`
- `insert_closest_market_variant`
- `insert_non_amazon_parity`
- `normalize_non_amazon_variant`
- `dedupe_delete`

Keep these consistent when extending the workflow.
