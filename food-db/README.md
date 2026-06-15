# Evolve — Food Packs

Optional, downloadable UK supermarket food databases for the Evolve app.

## How it works

- A GitHub Action (`.github/workflows/update-food-database.yml`) runs **monthly**
  (and on demand) and builds one JSON file per shop from
  [Open Food Facts](https://world.openfoodfacts.org), committing them here into
  `food-db/`.
- The app reads `food-db/manifest.json` to list available shops, then downloads
  **only** the shop(s) the user picks (Settings → Food packs).
- Downloaded packs are stored **on the user's device** (IndexedDB) and work
  offline. Their foods appear inside the app's normal categories (Cheese,
  Dairy, Fast food & meals, etc.), tagged with the shop name.

The app **never uploads** any personal data. These are public food lists the
app downloads — nothing more.

## Files

```
food-db/
  manifest.json     # { version, shops:[{id,name,file,count,bytes}] }
  tesco.json        # [{n,b,shop,cat,kcal,p,c,f,serve?}]  per 100 g
  sainsburys.json
  asda.json
  aldi.json
tools/
  build-openfoodfacts-uk-db.js   # builds the per-shop files
  validate-food-db.js            # sanity-checks them (fails CI on bad data)
```

## Data shape (per food)

```json
{ "n": "Mature Cheddar", "b": "Tesco", "shop": "tesco",
  "cat": "Cheese", "kcal": 416, "p": 25.4, "c": 0.1, "f": 34.9,
  "serve": { "unit": "30g slice", "grams": 30 } }
```

`cat` is always one of the app's existing categories; anything that can't be
mapped becomes `"Misc & extras"`.

## Running it manually

```bash
node tools/build-openfoodfacts-uk-db.js --test    # 5 items, 1 shop — verify the API works
node tools/build-openfoodfacts-uk-db.js           # full build
node tools/validate-food-db.js                    # validate output
```

> The build needs internet access to Open Food Facts, so it runs on GitHub's
> servers (or your own machine) — not on anyone's phone.
