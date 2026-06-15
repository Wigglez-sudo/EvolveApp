#!/usr/bin/env node
/* ============================================================================
   Evolve — build per-shop UK food packs from Open Food Facts
   ----------------------------------------------------------------------------
   Runs on GitHub Actions (or locally). Fetches UK products per supermarket
   from the Open Food Facts search API and writes:

       food-db/manifest.json
       food-db/tesco.json
       food-db/sainsburys.json
       food-db/asda.json
       food-db/aldi.json

   Each shop file is an array of:
       { n, b, shop, cat, kcal, p, c, f, serve?:{unit,grams} }   (per 100 g)

   The app downloads only the shop(s) the user chooses. No personal data is
   involved — this only reads a public food database.

   Usage:
     node tools/build-openfoodfacts-uk-db.js            # full build
     node tools/build-openfoodfacts-uk-db.js --test     # tiny dry run (5 items, 1 shop)
     node tools/build-openfoodfacts-uk-db.js --pages 8  # cap pages per shop
   ========================================================================== */

const fs = require("fs");
const path = require("path");

const OFF_BASE = "https://world.openfoodfacts.org/cgi/search.pl";
const OUT_DIR = path.join(__dirname, "..", "food-db");
const USER_AGENT = "EvolveApp/1.0 (https://github.com/Wigglez-sudo/EvolveAppTest)";

const SHOPS = [
  { id: "tesco",      name: "Tesco",       tag: "Tesco" },
  { id: "sainsburys", name: "Sainsbury's", tag: "Sainsbury's" },
  { id: "asda",       name: "Asda",        tag: "Asda" },
  { id: "aldi",       name: "Aldi",        tag: "Aldi" },
];

const args = process.argv.slice(2);
const TEST = args.includes("--test");
const PAGE_SIZE = TEST ? 5 : 100;
const MAX_PAGES = TEST ? 1 : (() => {
  const i = args.indexOf("--pages");
  return i >= 0 ? Math.max(1, parseInt(args[i + 1], 10) || 20) : 20;
})();

/* ---- Open Food Facts category tags → Evolve's existing category names ----- */
/* matched against OFF "categories_tags" (lowercased). First hit wins. */
const CAT_MAP = [
  [/cheese/, "Cheese"],
  [/yogurt|yoghurt|milk|cream|butter|dairy|custard/, "Dairy & alternatives"],
  [/bread|bakery|bagel|roll|croissant|pastr/, "Bread & bakery"],
  [/cereal|breakfast|granola|oat|muesli|porridge/, "Cereal & breakfast"],
  [/chicken|turkey|poultry|egg/, "Poultry & egg"],
  [/beef|pork|lamb|bacon|sausage|ham|steak|mince|red-meat/, "Red meat & pork"],
  [/fish|seafood|salmon|tuna|prawn|cod|haddock|shrimp/, "Fish & seafood"],
  [/rice|pasta|noodle|grain|couscous|quinoa/, "Grains, rice & pasta"],
  [/bean|lentil|chickpea|tofu|legume|pulse/, "Legumes & plant protein"],
  [/fruit|apple|banana|berry|orange|grape/, "Fruit"],
  [/vegetable|salad|tomato|potato|carrot|broccoli|veg/, "Vegetables"],
  [/nut|seed|almond|peanut|oil|fat/, "Nuts, seeds & fats"],
  [/protein|supplement|whey|shake|bar/, "Protein & supplements"],
  [/sauce|condiment|ketchup|mayo|dressing|gravy|spread/, "Sauces & condiments"],
  [/drink|juice|soda|water|beverage|cola|squash|smoothie/, "Drinks"],
  [/snack|crisp|chocolate|sweet|biscuit|cookie|cake|candy|dessert/, "Snacks & sweets"],
  [/meal|pizza|ready|frozen|soup|curry|lasagne|sandwich|wrap|burger|pie/, "Fast food & meals"],
];
function mapCategory(tags) {
  const t = (tags || []).join(" ").toLowerCase();
  for (const [re, cat] of CAT_MAP) if (re.test(t)) return cat;
  return "Misc & extras";
}

function num(v) { const n = parseFloat(v); return isFinite(n) ? Math.round(n * 10) / 10 : null; }

/* parse a serving like "250 ml" / "30g" into grams (best effort) */
function parseServe(s) {
  if (!s) return null;
  const m = String(s).match(/([\d.]+)\s*(g|ml)/i);
  if (!m) return null;
  const grams = Math.round(parseFloat(m[1]));
  if (!grams || grams > 2000) return null;
  return { unit: String(s).trim().slice(0, 24), grams };
}

async function fetchPage(shop, page) {
  const params = new URLSearchParams({
    action: "process",
    tagtype_0: "stores", tag_contains_0: "contains", tag_0: shop.tag,
    tagtype_1: "countries", tag_contains_1: "contains", tag_1: "United Kingdom",
    fields: "product_name,brands,stores,nutriments,serving_size,categories_tags",
    json: "1", page_size: String(PAGE_SIZE), page: String(page),
  });
  const url = OFF_BASE + "?" + params.toString();
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error("OFF " + res.status + " for " + shop.id + " p" + page);
  return res.json();
}

function normaliseProduct(prod, shop) {
  const name = (prod.product_name || "").trim();
  if (!name || name.length < 2 || name.length > 70) return null;
  const nut = prod.nutriments || {};
  const kcal = num(nut["energy-kcal_100g"]);
  if (kcal == null || kcal <= 0 || kcal > 900) return null; // need real per-100g energy
  const p = num(nut["proteins_100g"]);
  const c = num(nut["carbohydrates_100g"]);
  const f = num(nut["fat_100g"]);
  if (p == null && c == null && f == null) return null;
  const brand = (prod.brands || "").split(",")[0].trim().slice(0, 24) || shop.name;
  const out = {
    n: name, b: brand, shop: shop.id,
    cat: mapCategory(prod.categories_tags),
    kcal: Math.round(kcal),
    p: p == null ? 0 : p, c: c == null ? 0 : c, f: f == null ? 0 : f,
  };
  const serve = parseServe(prod.serving_size);
  if (serve) out.serve = serve;
  return out;
}

async function buildShop(shop) {
  const seen = new Set();
  const items = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    let data;
    try { data = await fetchPage(shop, page); }
    catch (e) { console.warn("  ! " + e.message); break; }
    const products = data.products || [];
    if (!products.length) break;
    for (const prod of products) {
      const item = normaliseProduct(prod, shop);
      if (!item) continue;
      const key = (item.n + "|" + item.b).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      items.push(item);
    }
    console.log(`  ${shop.id} page ${page}: ${products.length} fetched, ${items.length} kept so far`);
    if (products.length < PAGE_SIZE) break; // last page
    await new Promise(r => setTimeout(r, 1200)); // be polite to the API
  }
  return items;
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const shopsToBuild = TEST ? [SHOPS[0]] : SHOPS;
  const manifestShops = [];

  for (const shop of shopsToBuild) {
    console.log(`\nBuilding ${shop.name}…`);
    const items = await buildShop(shop);
    if (TEST) { console.log("\n--test sample:\n", JSON.stringify(items.slice(0, 5), null, 2)); return; }
    const file = shop.id + ".json";
    const json = JSON.stringify(items);
    fs.writeFileSync(path.join(OUT_DIR, file), json);
    manifestShops.push({ id: shop.id, name: shop.name, file, count: items.length, bytes: Buffer.byteLength(json) });
    console.log(`  → ${file}: ${items.length} foods (${(Buffer.byteLength(json) / 1048576).toFixed(2)} MB)`);
  }

  const manifest = { version: new Date().toISOString().slice(0, 10), generated: new Date().toISOString(), shops: manifestShops };
  fs.writeFileSync(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`\nWrote manifest.json with ${manifestShops.length} shops.`);
}

main().catch(e => { console.error(e); process.exit(1); });
