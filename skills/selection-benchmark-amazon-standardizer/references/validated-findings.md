# Validated Findings

This file captures what has already been proven in this project.

Only add findings here when they were validated by a workbook regeneration or by strong direct evidence.

## Proven Process Learnings

### What Worked Reliably

- Updating the duplicate workbook only.
- Using the existing project script as the single source of repeatable logic.
- For the atta/rice workflow, using `build_input_variants.py` as the single source of repeatable logic and regenerating the workbook plus alias exports after every rule change.
- Creating an initial all-data workbook like `input3/input3-initial-alldata.xlsx` from the raw marketplace CSVs before starting review.
- Deriving a compact working workbook like `input2/input2.xlsx` from the initial all-data workbook, with one normalized row per marketplace record and the minimal fields needed for review.
- Treating `Variant.xlsx` as the primary intent layer.
- Using exact ASIN lookups from `Variant.xlsx`.
- Using exact `amazon_raw.item_name` matches for recovery.
- Standardizing new SKU `Brand`, `Pack Size`, and category fields to existing final-sheet patterns.
- Restricting new category assignments to combinations already present on Amazon.
- Using same-SKU standardization when the same SKU already exists on original Amazon under a clearly equivalent variant.
- Deduping appended Amazon rows on `SKU + Pack Size`.
- Exporting missing sets to CSV/JSON to drive the next pass.
- Resolving chained non-Amazon alias maps to their final canonical in one pass.
- Refreshing `Final.non_amazon_missing_all.csv`, `Final.non_amazon_missing_all.json`, and `Final.non_amazon_missing_not_n.csv` directly from the main rebuild script so sidecars stay in sync with the workbook.
- Expanding raw-text recovery with synonym search terms helps for wording families like `Sonaka/Green Seedless Grapes`, `Chikoo/Sapota`, and `Custard Apple/Sitaphal/Ramphal`.
- Adding generic singular/plural plus `Fresh ...` search-term expansion helps raw recovery for wording shifts like `Hybrid Tomatoes -> Fresh Hybrid Tomato`.
- Mining `dedupe_delete` rows whose reason says the key already existed in original Amazon is a strong source of safe same-SKU canonical candidates.
- Exact synonym families already represented on Amazon can safely reduce the broader gap.
- Applying the same raw-row rejection gate to every import path works better than only checking ASIN imports. `item_name` recovery, closest-variant recovery, and parity backfills also need the same semantic guard.
- When the local Amazon worksheet is incomplete for non-grocery general-merchandise items, direct or indexed Amazon-platform evidence can be used to remove false misses from the final non-Amazon-minus-Amazon export without changing the workbook row variants.
- Flour or atta titles that mention synonym pairs like `jowar/sorghum`, `bajra/bajri`, or `ragi/nachni`, or use marketing `and` text around the same flour family, should not be treated as true combos.
- Urad canonicals need explicit color and form preservation when the title provides it. `Whole Black Urad Dal`, `Whole White Urad Dal`, `Split Black Urad Dal`, and `Split White Urad Dal` are safer than collapsing to generic `Whole Urad` or `Split Urad`.
- Reviewing bounded blocks of rows and marking them only after rechecking the same block catches more real errors than broad fast scans.
- Using the reviewed alias export itself as the source of truth for parity math is more reliable than recomputing canonicals ad hoc from workbook titles.
- The most effective Amazon-gap reduction sequence in the atta/rice workflow was:
  - fix title-to-variant precision first
  - regenerate reviewed aliases
  - compute missing Amazon variants
  - check current Amazon sheet
  - check `amazon_raw.xlsx`
  - add proven raw-backed Amazon SKUs back into the working Amazon sheet
  - regenerate before considering any further collapse
- Safe parity reduction came mostly from wording drift, spelling drift, regional synonym drift, and exact same-product subtype normalization, not from aggressive family flattening.
- For downstream duplicate workbooks, source-tab-specific exact SKU/ASIN matching first, then exact same-source title, produced clean `rubickVariant` fills with zero blanks.
- Amazon duplicate rows with blank `item_name` but populated `Short Title` can still be mapped accurately by `Short Title` when restricted to Amazon-only fallback.
- Rebuilding a downstream workbook to a new file and replacing the original after verification is safer than relying on in-place save when append operations seem to disappear.
- Header maps on workbooks with both `asin` and `Asin` must preserve the first occurrence; lowercasing into an overwriting dictionary caused silent source-row lookup failures.
- A reviewed Amazon SKU may exist in the working Amazon workbook even if it does not physically exist in `amazon_raw.xlsx`; one such SKU in the atta/rice run was `P31WG8MK6J -> Raw Sugar`.
- A manual overlay workbook like `input1/input1.manualresults.xlsx` works well as a post-review layer when it is applied only to variants still missing in the current regenerated export.
- The most reliable manual-results order was:
  - exact current-Amazon title match first
  - exact `amazon_raw.item_name`
  - `amazon_raw.Short Title` fallback
- Syncing `reviewed_missing_variants.txt` from the manual-results workbook keeps `done/pending` aligned with the user’s full review pass, including `N` rows.
- For manual-results raw backfills in the reviewed workflow, writing the missing variant name directly onto the appended Amazon row removes the gap cleanly without inventing a new canonical.
- Manual-results rows that are no longer present in the current missing export should be skipped and reported, not forced back into the workbook.

### What Did Not Work Reliably

- Broad exact normalized `item_name` scans across the entire full missing set: they produced essentially no new clean wins.
- Blind fuzzy matching from raw text without direct product identity confirmation.
- Treating every same-SKU relationship as safe; some are clearly wrong.
- Prep-form, product-part, or product-state collapses are not reliable default mappings, even when they reduce the count.
- Letting recovery/parity passes ignore taxonomy/title safety checks caused obvious bad imports such as hair oil for `Coconut`, face scrub for `Papaya`, soap for `Pears Conference`, and artificial decor for garland/bouquet variants.
- Counting a target workbook append as successful without reopening the saved file and checking the persisted row count.
- Treating the raw Amazon workbook as complete for every reviewed Amazon SKU in the working workbook.
- Letting duplicate lowercase headers overwrite earlier source columns in parser dictionaries.
- Starting a large review directly from loose marketplace CSVs without first creating the evidence-layer workbook and the compact working workbook.
- Treating blank-status manual-results rows with no manual `Title` as automatically resolvable did not work reliably; they still needed exact `supporting_titles` evidence.

## Dangerous False-Positive Pattern

Same-SKU does not automatically mean same product label is safe.

Example of a rejected/unsafe mapping:

- `Shevanthi Flower Garland -> Onion`
- `Watermelon -> Sliced Watermelon`

This appeared because the SKU overlapped, but the product identity was clearly wrong.

Rule:

- never accept a same-SKU canonical if the semantic label is obviously unrelated
- never accept a same-SKU canonical if it changes prep form, product part, or state without explicit user approval

## Reversals And Unlearnings

These patterns are no longer default-safe and should not be reused unless the user explicitly relaxes accuracy:

- cut/diced/sliced/shredded to another form
- peeled/unpeeled to another form
- frozen/non-frozen to another form
- microgreen to leaf/whole produce
- string/garland/bouquet/mala to base flower
- stem/root/leaf-part substitutions

Examples that should now be treated as unsafe-by-default:

- `Watermelon -> Sliced Watermelon`
- `Peeled Baby Corn -> Baby Corn`
- `Pappali Papaya -> Cut Papaya`
- `Raw Jackfruit -> Cubes Jackfruit`
- `Snack Pomegranate -> Peeled Pomegranate`
- `Microgreens Mustard Leaves -> Mustard Leaves`
- `Apricot -> cosmetic/body-care raw rows`
- `Jalapeno -> soda/snack raw rows`
- `Fruit Box -> dry-fruit gift box raw rows`
- `Raw Mango -> juice raw rows`
- `Coconut -> hair oil or coconut powder raw rows`
- `Papaya -> scrub or cut-fruit raw rows when the target is whole papaya`
- `Grapes -> hair serum raw rows`
- `Purple Orchids Bouquet -> bottle/household raw rows`

Additional atta/rice-specific unlearnings:

- `Peanuts -> Raw Peanuts` was not safe by default until explicitly user-approved. Generic peanut families should stay distinct from `Raw`, `Roasted`, `Salted`, and flavored forms unless the user wants the broader collapse.
- `Sugar` looked missing when noisy `sugar free`, `no added sugar`, and `sugar control` rows were mixed into raw review. Generic `Sugar` needs real sugar-title evidence, not substring hits.
- `Barley` should not be treated as automatically present from `Pearl Barley`.
- `Boiled Rice` should not be treated as automatically present from a specific subtype like `Ponni Boiled Rice`.
- `Buckwheat` should not be treated as automatically present from `Buckwheat Flour` or noodles.
- `Byadgi Chilli` should not be treated as automatically present from paprika or products merely flavored with byadgi chilli.
- `White Urad Dal` should not be treated as automatically present from `Split White Urad Dal` or `Whole White Urad Dal` unless the user explicitly approves broader collapse.

## Current Proven Canonicalization Patterns

### User-Approved Manual Aliases

- `Classy Red Roses Bouquet -> Red Rose Bouquet`
- `White And Yellow Gerbera Bouquet -> White And Yellow Bouquet`
- `Exotic Salad -> Fruit Salad`
- `Protected Mint Leaves -> Mint Leaves`
- `Large Avocado -> Avocado`
- `Orange Marigold Garland -> Marigold Garland`
- `Organic Broad Beans -> Broad Beans`
- `Peanuts -> Raw Peanuts`

### ASIN Canonicals

- `B0B12CKZ1Y -> Banganapalli Mango`
- `B07MM5S7V6 -> Green Seedless Grapes`
- `B0BPMXX98X -> Mustard Leaves`
- `B0DQTRXHP2 -> Mixed Berries Juice`
- `P31WG8MK6J -> Raw Sugar`

### Proven Safe Atta/Rice Canonicalization Patterns

These were validated in the reviewed `input1` / `input2` workflow and are safe enough to reuse when the title supports them.

- Preserve urad color/form explicitly:
  - `Urad Dal White Split -> Split White Urad Dal`
  - `Urad Dal White Whole -> Whole White Urad Dal`
  - `Urad Dal Black Split -> Split Black Urad Dal`
  - `Urad Dal Black Whole -> Whole Black Urad Dal`
- Rice naming that should stay distinct when supported by title:
  - `Sonamasoori/Sona Masuri/Sona Masoori -> Sonamasuri Rice`
  - `Mini Mongra/Mini Mogra -> Mini Mogra Rice`
  - `Pulav/Pulao -> Pulav Basmati Rice`
  - `Biryani/Biriyani -> Biryani Basmati Rice`
  - `HMT Kolam -> HMT Kolam Rice` as an intermediate title-supported canonical, but this may later collapse to `Kolam Rice` only if the user explicitly approves that broader reduction
- Proven safe reviewed-workflow collapses used to reduce Amazon missing % without losing too much identity:
  - `Wheat Atta -> Whole Wheat Atta`
  - `Bhatura Poori Atta -> Bhatura Mix`
  - `Coffee Sweetener -> Jaggery Cubes`
  - `Tea Sweetener -> Jaggery Cubes`
  - `Low GI Millet Atta -> Low GI Multigrain Atta`
  - `Coriander -> Whole Coriander`
  - `Barley -> Pearl Barley`
  - `Upwas Bhajani -> Bhajni Upwas`
  - `HMT Kolam Rice -> Kolam Rice`
  - `Puttu Podi -> White Puttupodi`
  - `Whole Arhar Dal -> Arhar Dal`
  - `Whole Chana Dal -> Chana Dal`
  - `High Protein Sharbati Atta -> Sharbati Atta`
  - `Khaman Atta -> Khaman Dhokla`
- Proven safe wording-family normalizations from the reviewed workflow:
  - `Idiappam Podi -> Idiyappam Podi`
  - `Singara Flour -> Singhara Flour`
  - `Rajbhogam Rice -> Rajabogham Rice`
  - `Ragi Semiya -> Ragi Vermicelli`
  - `Kutki -> Little Millet`
  - `Top Millet -> Browntop Millet`
  - `Lobia Chawli -> White Lobia`
  - `Lobia Chavli -> White Lobia`
  - `Masoor Black -> Whole Masoor Dal`

### Proven Safe Non-Amazon To Amazon Alias Standardizations

These were validated enough to be used in the project script.

Important:

- If any mapping below changes prep form, product part, or state, it should now be treated as historical context, not as a default-safe rule.
- The current default-safe set is the subset that preserves product form/state and only normalizes wording, spelling, regional synonyms, or exact synonym families.

- `Amaranthus -> Green Amaranthus`
- `Areca Betel Leaves -> Betel Leaves`
- `Assorted Chrysanthemum -> Chrysanthemum`
- `Avarekai -> Broad Beans`
- `Baby Bok Choy -> Bok Choy`
- `Baby Bokchoy -> Bok Choy`
- `Banana Leaves -> Banana Leaf`
- `Banthi Marigold -> Marigold`
- `Bathua Leaves -> Bathua`
- `Ber -> Apple Ber`
- `Beans Avarekai -> Avare Beans`
- `Bel Patta -> Bel Patra`
- `Bird Eye -> Thai Bird Eye Chilli`
- `Bok Choi -> Bok Choy`
- `Broad Beans -> Avare Beans`
- `Capsicum -> Green Capsicum`
- `Carrot & Beans - Strips -> Mix Vegetables`
- `Carrot -> Ooty Carrot`
- `Carrot Beans -> Mix Vegetables`
- `Chenopodium Leaves -> Bathua`
- `Chard Rocket Leaves -> Rocket Leaves`
- `Chinna Sambar Onion -> Organic Sambar Onion`
- `Chopped Coriander Leaves -> Coriander Leaves`
- `Chowli Sprouts -> Cow Sprouts`
- `Clove Garlic -> Garlic`
- `Cob American Sweet Corn -> Cob Sweet Corn`
- `Cob Corn -> Cob Sweet Corn`
- `Colocasia Leaves -> Colocasia Leaf`
- `Cut Ashgourd -> Ash Gourd`
- `Curled Parsley -> Parsley`
- `Desi Coriander Leaves -> Coriander Leaves`
- `Desi Spinach -> Spinach`
- `Dill -> Dill Leaves`
- `Florets Brocolli -> Florets Broccoli`
- `Flower -> Assorted Flower Mix`
- `Flower Mix -> Edible Flower Mix`
- `Fruit Box -> Fruit Chaat`
- `Frozen Avacado -> Frozen Avocado`
- `Frozen Berries -> Frozen Mixed Berry`
- `Frozen Cranberries -> Frozen Cranberry`
- `Fruit Chat -> Fruit Chaat`
- `Fruit Bulb -> Bulb Jackfruit`
- `Gongura Leaves -> Gongura`
- `Green Amaranth -> Green Amaranthus`
- `Green Moong Sprouts -> Moong Sprouts`
- `Greenpeas -> Green Peas`
- `Granny Apple -> Granny Smith Apple`
- `Ground Nut -> Groundnut`
- `Holy Tulsi Leaves -> Tulsi Leaves`
- `Holy Tulsi -> Tulsi Leaves`
- `Hydroponic Rocket Leaves -> Rocket Leaves`
- `Hybrid Tomatoes -> Hybrid Tomato`
- `Kinnow -> Kinnow Orange`
- `Hydroponic Butterhead -> Butterhead Lettuce`
- `Indian Asparagus -> Asparagus`
- `Indian Blueberries -> Indian Blueberry`
- `Indian Blueberry -> Blueberry`
- `Italian Basil Leaves -> Basil Leaves`
- `Jannat Watermelon -> Striped Watermelon`
- `Kadi Curry Leaves -> Curry Leaves`
- `Kale Leaf -> Kale`
- `Kharbuja Muskmelon -> Striped Muskmelon`
- `Kiwi -> Green Kiwi`
- `Kullu Garlic -> Garlic`
- `Large Avocado -> Avocado`
- `Large Pomegranate -> Pomegranate`
- `Lady Papaya -> Ripened Papaya`
- `Lemonchillii Spinach -> Spinach`
- `Local Beans -> Avare Beans`
- `Local Broad Beans -> Avare Beans`
- `Local Cucumber -> Cucumber`
- `Long Cucumber -> Cucumber`
- `Madhu Muskmelon -> Muskmelon`
- `Madhumati Muskmelon -> Muskmelon`
- `Mavadu Mango -> Raw Mango`
- `Microgreen -> Mixed Microgreens`
- `Microgreens Mustard Leaves -> Mustard Leaves`
- `Mizuna Mustard Leaves -> Mustard Leaves`
- `Mokkajonna Sweet Corn -> Sweet Corn`
- `Mola Chrysanthemum -> Chrysanthemum`
- `Mosambi Sweet Lime -> Sweet Lime`
- `Muskmleon -> Muskmelon`
- `Namdhari Watermelon -> Striped Watermelon`
- `Naturoponic Spinach -> Spinach`
- `Nut Betel Leaf -> Betel Leaf`
- `Ooty Chow Chow -> Chow Chow`
- `Ooty Broccoli -> Broccoli`
- `Organic Asparagus -> Asparagus`
- `Organic Brinjal -> Varikatri Brinjal`
- `Organic Celery -> Celery`
- `Organic Chilli -> Green Chilli`
- `Organic Kiwi -> Green Kiwi`
- `Organic Muskmelon -> Organic Musk Melon`
- `Organic Radish -> White Radish`
- `Organic Sweet Lime -> Organic Mosambi`
- `Palak -> Spinach`
- `Pappali Papaya -> Cut Papaya`
- `Peeled Baby Corn -> Baby Corn`
- `Raw Jackfruit -> Cubes Jackfruit`
- `Protected Mint Leaves -> Mint Leaves`
- `Ramphal -> Custard Apple`
- `Raw Turmeric -> Turmeric`
- `Roundels Cucumber -> Cucumber`
- `Salad Lettuce -> Green Lettuce`
- `Safeda Mango -> Banganapalli Mango`
- `Semi Ripe Papaya -> Raw Papaya`
- `Semi Ripe Sapota -> Sapota`
- `Semiripe Avocado -> Avocado`
- `Seedless Grapes -> Flame Seedless Grapes`
- `Sitaphal -> Custard Apple`
- `Small Watermelon -> Kiran Watermelon`
- `Snack Bell Pepper -> Snack Pepper`

- `Snack Pomegranate -> Peeled Pomegranate`
- `Sonaka Grapes -> Green Seedless Grapes`
- `Sambar Onion -> Sambhar Onion`
- `Stick Sugar Cane -> Stump Sugarcane`
- `Sugarcane -> Stump Sugarcane`
- `Sweetcorn Kernels -> Kernels Sweet Corn`
- `Fruits Ganpati -> Fruit Chaat`
- `Bouquet -> Mix Rose Bouquet`
- `Bijli -> Assorted Flower Mix`
- `Brown Coconut -> Medium Coconut`
- `Cantaloupe Muskmelon -> Muskmelon`
- `Chikoo -> Sapota`
- `Chickoo -> Sapota`
- `Chikoo Sapota -> Sapota`
- `Sapota Chikoo -> Sapota`
- `Tindli Coccinia -> Coccinia`
- `Tropical Amaranth -> Green Amaranthus`
- `Unripe Avocado -> Avocado`
- `Unripe Tomato -> Green Tomato`
- `Valentine Red Roses Bouquet -> Red Rose Bouquet`
- `Whole Jackfruit -> Tender Jackfruit`
- `Whole Pumpkin -> Pumpkin`
- `With Roots Spinach -> Spinach`
- `Yellow Passion Fruit -> Passion Fruit`
- `Yellow Pumpkin -> Pumpkin`
- `Orange Chrysanthemum -> Chrysanthemum`
- `Organic Mango Ginger -> Mango Ginger`
- `Organic Mango Leaves -> Mango Leaves`
- `Organic Mustard Leaves -> Mustard Leaves`
- `Organic Neem Leaves -> Neem Leaves`
- `Pyaj Onion -> Onion`
- `Radish -> White Radish`
- `Red Bell Pepper -> Red Capsicum`
- `Roots Gongura Leaves -> Gongura`
- `Siru Leaves -> Siru`
- `Stem Lotus -> Lotus Stem`

## Downstream Workbook Lessons

These were validated while updating `Selection benchmark - Atta_Rice categories (2).xlsx`.

### What Worked

- Adding only a new `rubickVariant` column and filling it by source tab kept the duplicate workbook stable.
- Source-specific lookup order of `SKU/ASIN -> amazon asin -> same-source title` produced clean fills.
- For Amazon-only blank-title rows, `Short Title` was a workable fallback.
- Appending the reviewed Amazon recovery rows into the downstream workbook brought the workbook-level missing percentage into sync with the reviewed pipeline.

## Initial Ingestion Lessons

These were validated while moving from raw marketplace data into the reviewed atta/rice workflow.

### What Worked

- Building a raw evidence workbook first, with one sheet per marketplace and the marketplace-native columns preserved.
- Carrying source provenance such as source file, city, and source sheet into that workbook.
- Building a second compact working workbook from the evidence workbook before classification started.
- Keeping the compact workbook schema minimal: `source`, `sku`, `title`, `variant`, `brand`.
- Treating the compact workbook as the only workbook the variant-classification script mutates directly.

### What To Avoid

- Mixing raw-ingestion cleanup, classification, and downstream parity work in one ad hoc workbook.
- Starting bounded variant review from the large raw evidence workbook instead of the compact working workbook.

### What Broke

- A naive lowercase header map overwrote the first `asin` column with the later `Asin` column from `amazon_raw.xlsx`, making valid source rows appear missing.
- In-place save plus append was not trustworthy on the downstream workbook; rebuilding and replacing was safer.
- Printing the number of candidate ASINs was misleading; only the persisted row count after reopening the workbook was trustworthy.
- `Stem Rajnigandha -> Rajnigandha`
- `Sunflower Microgreen -> Sunflower Microgreens`
- `Thai Asparagus -> Asparagus`
- `Thai Basil Leaves -> Basil Leaves`
- `Tulsi -> Tulsi Leaves`
- `Ugadi Ashoka Leaves -> Ashoka Leaves`
- `With Roots Coriander Leaves -> Coriander Leaves`
- `With Roots Spring Onion -> Spring Onion`
- `White Shevanthi -> White Sevanthi`
- `Yellow Shevanthi -> Yellow Sevanthi`

## Explicit Raw Item Names That Helped

User-provided raw Amazon names that were useful to reduce the remaining count:

- `Fresh Broad Beans - Avare Chikadi`
- `Fresh Cow Pea Sprouts`
- `Fresh Broccoli`
- `Frugivore Frozen Avocado`
- `Frugivore Frozen Mix Berry`
- `Fresh Gongura`
- `Fresh Blueberry - Indian`
- `Fresh Muskmelon`
- `Fresh Organic Red Capsicum`
- `Fresh Green Capsicum`
- `Fresh Diced Sugar Cane`
- `Fresh Ashoka Leaves`
- `Fresh White Chrysanthemum/Shevanti Flowers`
- `Fresh Yellow Chrysanthemum/Shevanti Flowers`

Some of these were not present verbatim in `amazon_raw.xlsx`, but near-equivalent actual raw `item_name` values still helped when explicitly confirmed.

## Findings From Count Reduction

Observed project progression:

- full non-Amazon-minus-Amazon missing set reached `800`
- conservative alias and evidence-based standardization reduced it to `746`
- chained-alias resolution plus further normalized-target folds reduced it further to `672`
- after removing unsafe prep/state collapses and rebuilding with only stricter synonym-family rules, the full missing set still came down further to `573`

This demonstrates:

- exact raw matching alone is not enough
- same-SKU canonical reuse is powerful when carefully filtered
- conservative alias normalization removes a large amount of noise safely
- removing unsafe prep/state collapses may reduce short-term coverage, but strict synonym families can recover a meaningful share safely

## Current High-Level Decision Rule

Safe to standardize:

- spelling fix
- singular/plural or leaf/flower qualifier normalization
- obvious regional synonym where the same Amazon SKU already proves equivalence
- user-approved manual alias
- exact synonym family already represented on Amazon, when it does not change prep form, product part, or state

Unsafe unless user explicitly approves:

- organic to non-organic when evidence is weak
- cut/sliced/frozen to whole/non-frozen
- diced/shredded/peeled to another form
- microgreen to leaf/whole
- bouquet/garland/flower mismatches
- string/mala to base flower
- stem/root/leaf-part substitutions
- fruit/vegetable substitutions
- anything where the only proof is loose lexical similarity
