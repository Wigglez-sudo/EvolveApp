#!/usr/bin/env node
/* ============================================================================
   Evolve — build per-shop UK food packs from Open Food Facts
   ----------------------------------------------------------------------------
   Keeps PER-SHOP files (the app downloads only the shop the user picks):
       food-db/manifest.json
       food-db/tesco.json  sainsburys.json  asda.json  aldi.json

   Each shop file: [ { n, b, shop, cat, kcal, p, c, f, serve?:{unit,grams} } ]
   (per 100 g). Brand is folded into the name in the app.

   Robustness (so a busy API doesn't leave a shop empty):
     - retries on 503 / network errors with backoff
     - high page limits + an overall target so we pull 5-10k foods
     - skips shops that come back empty, keeping any previous good file

   Config via env (used by the GitHub workflow):
     EVOLVE_FOOD_TARGET                total foods to aim for (default 8000)
     EVOLVE_FOOD_MAX_PAGES_PER_STORE   max OFF pages per shop (default 80)
     EVOLVE_FOOD_USER_AGENT            custom UA string
     EVOLVE_FOOD_PRETTY                "1" to pretty-print shop JSON

   Usage:
     node tools/build-openfoodfacts-uk-db.js          # full build
     node tools/build-openfoodfacts-uk-db.js --test   # 5 items, 1 shop (dry run)
   ========================================================================== */

const fs = require("fs");
const path = require("path");

const OFF_BASE = "https://world.openfoodfacts.org/cgi/search.pl";
const OUT_DIR = path.join(__dirname, "..", "food-db");
const USER_AGENT = process.env.EVOLVE_FOOD_USER_AGENT
  || "EvolveApp/1.0 (https://github.com/Wigglez-sudo/EvolveAppTest)";

const SHOPS = [
  { id: "tesco",      name: "Tesco",       tag: "Tesco" },
  { id: "sainsburys", name: "Sainsbury's", tag: "Sainsbury's" },
  { id: "asda",       name: "Asda",        tag: "Asda" },
  { id: "aldi",       name: "Aldi",        tag: "Aldi" },
];

const args = process.argv.slice(2);
const TEST = args.includes("--test");

const TARGET_TOTAL = TEST ? 5 : parseInt(process.env.EVOLVE_FOOD_TARGET || "8000", 10);
const MAX_PAGES = TEST ? 1 : parseInt(process.env.EVOLVE_FOOD_MAX_PAGES_PER_STORE || "80", 10);
const PAGE_SIZE = TEST ? 5 : 100;
const PRETTY = process.env.EVOLVE_FOOD_PRETTY === "1";

const PER_SHOP_TARGET = TEST ? 5 : Math.ceil((TARGET_TOTAL / SHOPS.length) * 1.6);

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

function parseServe(s) {
  if (!s) return null;
  const m = String(s).match(/([\d.]+)\s*(g|ml)/i);
  if (!m) return null;
  const grams = Math.round(parseFloat(m[1]));
  if (!grams || grams > 2000) return null;
  return { unit: String(s).trim().slice(0, 24), grams };
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchPage(shop, page, attempt = 1) {
  const MAX_ATTEMPTS = 5;
  const params = new URLSearchParams({
    action: "process",
    tagtype_0: "stores", tag_contains_0: "contains", tag_0: shop.tag,
    tagtype_1: "countries", tag_contains_1: "contains", tag_1: "United Kingdom",
    fields: "product_name,brands,stores,nutriments,serving_size,categories_tags",
    json: "1", page_size: String(PAGE_SIZE), page: String(page),
  });
  const url = OFF_BASE + "?" + params.toString();
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (res.status === 503 || res.status === 429 || res.status >= 500) {
      if (attempt >= MAX_ATTEMPTS) throw new Error("OFF " + res.status + " for " + shop.id + " p" + page + " (gave up after " + attempt + ")");
      const wait = Math.min(30000, 2000 * Math.pow(2, attempt - 1));
      console.warn("  ... " + shop.id + " p" + page + ": " + res.status + ", retry " + attempt + "/" + MAX_ATTEMPTS + " in " + (wait/1000) + "s");
      await sleep(wait);
      return fetchPage(shop, page, attempt + 1);
    }
    if (!res.ok) throw new Error("OFF " + res.status + " for " + shop.id + " p" + page);
    return res.json();
  } catch (e) {
    if (attempt < MAX_ATTEMPTS) {
      const wait = Math.min(30000, 2000 * Math.pow(2, attempt - 1));
      console.warn("  ... " + shop.id + " p" + page + ": " + e.message + ", retry " + attempt + "/" + MAX_ATTEMPTS + " in " + (wait/1000) + "s");
      await sleep(wait);
      return fetchPage(shop, page, attempt + 1);
    }
    throw e;
  }
}

function normaliseProduct(prod, shop) {
  const name = (prod.product_name || "").trim();
  if (!name || name.length < 2 || name.length > 70) return null;
  const nut = prod.nutriments || {};
  const kcal = num(nut["energy-kcal_100g"]);
  if (kcal == null || kcal <= 0 || kcal > 900) return null;
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

async function buildShop(shop, remainingTotal) {
  const seen = new Set();
  const items = [];
  const cap = Math.min(PER_SHOP_TARGET, remainingTotal);
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
    if (page % 10 === 0 || products.length < PAGE_SIZE) {
      console.log("  " + shop.id + " page " + page + ": " + items.length + " kept so far");
    }
    if (items.length >= cap) { console.log("  " + shop.id + ": hit per-shop cap (" + cap + ")"); break; }
    if (products.length < PAGE_SIZE) break;
    await sleep(700);
  }
  return items;
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const shopsToBuild = TEST ? [SHOPS[0]] : SHOPS;
  const manifestShops = [];
  let total = 0;

  for (const shop of shopsToBuild) {
    console.log("\nBuilding " + shop.name + "...");
    const remaining = Math.max(0, TARGET_TOTAL - total);
    const items = await buildShop(shop, remaining || PER_SHOP_TARGET);
    if (TEST) { console.log("\n--test sample:\n", JSON.stringify(items.slice(0, 5), null, 2)); return; }

    if (!items.length) {
      console.warn("  ! " + shop.name + ": 0 foods (API busy?) - skipping, keeping any existing file.");
      const existing = path.join(OUT_DIR, shop.id + ".json");
      if (fs.existsSync(existing)) {
        try {
          const prev = JSON.parse(fs.readFileSync(existing, "utf8"));
          if (Array.isArray(prev) && prev.length) {
            manifestShops.push({ id: shop.id, name: shop.name, file: shop.id + ".json", count: prev.length, bytes: Buffer.byteLength(JSON.stringify(prev)) });
            total += prev.length;
            console.log("    kept previous " + shop.id + ".json (" + prev.length + " foods)");
          }
        } catch (e) {}
      }
      continue;
    }

    const file = shop.id + ".json";
    const json = PRETTY ? JSON.stringify(items, null, 2) : JSON.stringify(items);
    fs.writeFileSync(path.join(OUT_DIR, file), json);
    manifestShops.push({ id: shop.id, name: shop.name, file, count: items.length, bytes: Buffer.byteLength(json) });
    total += items.length;
    console.log("  -> " + file + ": " + items.length + " foods (" + (Buffer.byteLength(json) / 1048576).toFixed(2) + " MB)");
  }

  const manifest = {
    version: new Date().toISOString().slice(0, 10),
    generated: new Date().toISOString(),
    total: total,
    shops: manifestShops,
  };
  fs.writeFileSync(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log("\nDone. " + manifestShops.length + " shops, " + total + " foods total.");
}

main().catch(function(e){ console.error(e); process.exit(1); });
