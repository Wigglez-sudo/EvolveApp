#!/usr/bin/env node
/* ============================================================================
   Evolve — build per-shop UK food packs from Open Food Facts
   ----------------------------------------------------------------------------
   ROUND-ROBIN with persistence:
     - cycles the shops one page at a time (a "lap")
     - if a shop's page errors (503 etc.), it's skipped THIS lap and retried
       on the NEXT lap — a failing shop never blocks or starves the others,
       and is never abandoned
     - keeps lapping until every shop hits its target OR a whole lap adds zero
       new foods (genuinely exhausted) OR the job time limit
   Per request, on 503/429/5xx: waits 10s -> 20s -> 30s -> 60s (then skip page,
   try that shop again next lap).

   Output (PER-SHOP — the app downloads only the shop the user picks):
     food-db/manifest.json
     food-db/tesco.json  sainsburys.json  asda.json  aldi.json
   Each file: [ { n, b, shop, cat, kcal, p, c, f, serve?:{unit,grams} } ] /100g

   Config via env:
     EVOLVE_FOOD_PER_SHOP_TARGET   foods to aim for per shop (default 2500)
     EVOLVE_FOOD_MAX_PAGES_PER_STORE  hard page ceiling per shop (default 120)
     EVOLVE_FOOD_USER_AGENT        custom UA
     EVOLVE_FOOD_PRETTY            "1" to pretty-print shop JSON

   Usage:
     node tools/build-openfoodfacts-uk-db.js          # full build
     node tools/build-openfoodfacts-uk-db.js --test   # 5 items, 1 shop (dry run)
   ========================================================================== */

const fs = require("fs");
const path = require("path");

const OUT_DIR = path.join(__dirname, "..", "food-db");
const USER_AGENT = process.env.EVOLVE_FOOD_USER_AGENT
  || "EvolveAppTest food database builder - https://github.com/Wigglez-sudo/EvolveAppTest";

/* 4 shops; multiple search terms per shop catch more products */
const SHOPS = [
  { id: "tesco",      name: "Tesco",       terms: ["tesco"] },
  { id: "sainsburys", name: "Sainsbury's", terms: ["sainsbury", "sainsburys"] },
  { id: "asda",       name: "Asda",        terms: ["asda"] },
  { id: "aldi",       name: "Aldi",        terms: ["aldi"] },
];

const args = process.argv.slice(2);
const TEST = args.includes("--test");

const PAGE_SIZE = TEST ? 5 : 100;
const PER_SHOP_TARGET = TEST ? 5 : parseInt(process.env.EVOLVE_FOOD_PER_SHOP_TARGET || "2500", 10);
const MAX_PAGES = TEST ? 1 : parseInt(process.env.EVOLVE_FOOD_MAX_PAGES_PER_STORE || "120", 10);
const PRETTY = process.env.EVOLVE_FOOD_PRETTY === "1";

/* retry backoff after a 503/5xx (ms) */
const BACKOFF = TEST ? [200] : [10000, 20000, 30000, 60000];
const THROTTLE = TEST ? 0 : 300; /* polite gap between successful pages */

/* ---- OFF category tags -> Evolve's existing category names --------------- */
const CAT_MAP = [
  [/cheese/, "Cheese"],
  [/yogurt|yoghurt|milk|cream|butter|dairy|custard/, "Dairy & alternatives"],
  [/bread|bakery|bagel|roll|croissant|pastr/, "Bread & bakery"],
  [/cereal|breakfast|granola|oat|muesli|porridge/, "Cereal & breakfast"],
  [/chicken|turkey|poultry|egg/, "Poultry & egg"],
  [/beef|pork|lamb|bacon|sausage|ham|steak|mince|red.?meat/, "Red meat & pork"],
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
function mapCategory(catStr) {
  const t = String(catStr || "").toLowerCase();
  for (const [re, cat] of CAT_MAP) if (re.test(t)) return cat;
  return "Misc & extras";
}

function num(v) { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 10) / 10 : null; }
function clean(s) { return String(s || "").replace(/\s+/g, " ").trim(); }
function firstCsv(s) { return clean(s).split(",").map(clean).filter(Boolean)[0] || ""; }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function parseServe(s) {
  if (!s) return null;
  const m = String(s).match(/([\d.]+)\s*(g|ml)/i);
  if (!m) return null;
  const grams = Math.round(parseFloat(m[1]));
  if (!grams || grams > 2000) return null;
  return { unit: clean(s).slice(0, 24), grams };
}

/* lighter "search_simple" query (country tag + keyword) — easier on OFF than
   the heavy stores-tag filter, which cuts the 503 rate */
function searchUrl(term, page) {
  const params = new URLSearchParams({
    search_simple: "1", action: "process", json: "1",
    page_size: String(PAGE_SIZE), page: String(page), search_terms: term,
    tagtype_0: "countries", tag_contains_0: "contains", tag_0: "united-kingdom",
    fields: ["code","product_name","product_name_en","brands","categories","categories_tags","pnns_groups_2","serving_size","nutriments"].join(","),
  });
  return "https://world.openfoodfacts.org/cgi/search.pl?" + params.toString();
}

/* fetch ONE page. Returns {ok:true, products} OR {ok:false} after exhausting
   backoff (caller then skips this page and retries the shop next lap). */
async function fetchPage(term, page, label) {
  for (let attempt = 0; attempt <= BACKOFF.length; attempt++) {
    try {
      const res = await fetch(searchUrl(term, page), { headers: { "User-Agent": USER_AGENT, "Accept": "application/json" } });
      if (res.status === 503 || res.status === 429 || res.status >= 500) {
        if (attempt >= BACKOFF.length) {
          console.warn("  ! " + label + " p" + page + ": " + res.status + " — skipping page, will retry shop next lap");
          return { ok: false };
        }
        const wait = BACKOFF[attempt];
        console.warn("  ... " + label + " p" + page + ": " + res.status + ", waiting " + (wait/1000) + "s before retry");
        await sleep(wait);
        continue;
      }
      if (!res.ok) { console.warn("  ! " + label + " p" + page + ": " + res.status); return { ok: false }; }
      const data = await res.json();
      return { ok: true, products: Array.isArray(data.products) ? data.products : [] };
    } catch (e) {
      if (attempt >= BACKOFF.length) { console.warn("  ! " + label + " p" + page + ": " + e.message); return { ok: false }; }
      const wait = BACKOFF[attempt];
      console.warn("  ... " + label + " p" + page + ": " + e.message + ", waiting " + (wait/1000) + "s");
      await sleep(wait);
    }
  }
  return { ok: false };
}

function mapProduct(p) {
  const name = clean(p.product_name_en) || clean(p.product_name);
  if (!name || name.length < 2 || name.length > 70) return null;
  const nut = p.nutriments || {};
  const kcal = num(nut["energy-kcal_100g"] != null ? nut["energy-kcal_100g"] : nut["energy-kcal"]);
  const pr = num(nut.proteins_100g), ca = num(nut.carbohydrates_100g), fa = num(nut.fat_100g);
  /* require all four macros (quality bar, matches their script) */
  if (kcal == null || pr == null || ca == null || fa == null) return null;
  /* 900 kcal/100g is the physical max (pure fat). Anything above it is bad OFF
     data (per-serving/per-pack mislabelled as per-100g, or a typo). Must match
     the validator's ceiling (validate-food-db.js) or the build writes items CI
     will always reject. */
  if (kcal < 0 || kcal > 900) return null;
  if ([pr, ca, fa].some(v => v < 0 || v > 100)) return null;
  /* belt-and-braces: the validator requires finite numbers, so never let a
     NaN/Infinity slip through into a written file (would fail CI otherwise). */
  if (![kcal, pr, ca, fa].every(Number.isFinite)) return null;
  const catRaw = firstCsv(p.categories) || firstCsv(p.categories_tags) || firstCsv(p.pnns_groups_2);
  const out = {
    n: name,
    b: firstCsv(p.brands),
    cat: mapCategory(catRaw),
    kcal: Math.round(kcal), p: pr, c: ca, f: fa,
  };
  const serve = parseServe(p.serving_size);
  if (serve) out.serve = serve;
  return out;
}

function itemKey(it) { return (it.n + "|" + it.b).toLowerCase(); }

async function main() {
  if (typeof fetch !== "function") throw new Error("Needs Node 18+ (global fetch).");
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  /* per-shop collection state */
  const state = SHOPS.map(s => ({
    shop: s,
    items: new Map(),   /* key -> item */
    termIdx: 0,         /* which search term we're on */
    page: 1,            /* next page to fetch for the current term */
    done: false,        /* exhausted or hit target */
  }));

  if (TEST) {
    const st = state[0];
    const r = await fetchPage(st.shop.terms[0], 1, st.shop.name);
    const sample = (r.products || []).map(mapProduct).filter(Boolean).slice(0, 5);
    console.log("--test sample:\n", JSON.stringify(sample, null, 2));
    return;
  }

  let lap = 0;
  /* round-robin laps until all shops done, or a whole lap adds nothing */
  while (true) {
    lap++;
    let addedThisLap = 0;
    let anyActive = false;

    for (const st of state) {
      if (st.done) continue;
      if (st.items.size >= PER_SHOP_TARGET) { st.done = true; continue; }
      if (st.page > MAX_PAGES) {
        /* try next search term for this shop, if any */
        if (st.termIdx < st.shop.terms.length - 1) { st.termIdx++; st.page = 1; }
        else { st.done = true; continue; }
      }
      anyActive = true;
      const term = st.shop.terms[st.termIdx];
      const before = st.items.size;
      const r = await fetchPage(term, st.page, st.shop.name);

      if (!r.ok) {
        /* leave page as-is → retried next lap (persistence). nudge only after
           a successful read; here we just move on to the next shop. */
        continue;
      }
      if (!r.products.length) {
        /* this term is exhausted; advance to next term or finish the shop */
        if (st.termIdx < st.shop.terms.length - 1) { st.termIdx++; st.page = 1; }
        else { st.done = true; }
        continue;
      }
      for (const p of r.products) {
        const it = mapProduct(p);
        if (!it) continue;
        const k = itemKey(it);
        if (!st.items.has(k)) st.items.set(k, it);
        if (st.items.size >= PER_SHOP_TARGET) break;
      }
      st.page++;
      const gained = st.items.size - before;
      addedThisLap += gained;
      console.log("  lap " + lap + " · " + st.shop.name + " p" + (st.page-1) + ": +" + gained + " (" + st.items.size + "/" + PER_SHOP_TARGET + ")");
      await sleep(THROTTLE);
    }

    if (!anyActive) { console.log("\nAll shops finished."); break; }
    if (addedThisLap === 0) { console.log("\nLap " + lap + " added 0 new foods — data exhausted, stopping."); break; }
  }

  /* write per-shop files + manifest */
  const manifestShops = [];
  let total = 0;
  for (const st of state) {
    const items = Array.from(st.items.values())
      .map(it => Object.assign({ shop: st.shop.id }, it))
      .sort((a, b) => String(a.cat).localeCompare(b.cat) || String(a.n).localeCompare(b.n));
    if (!items.length) {
      console.warn("  ! " + st.shop.name + ": 0 foods — keeping any existing file.");
      const existing = path.join(OUT_DIR, st.shop.id + ".json");
      if (fs.existsSync(existing)) {
        try {
          const prev = JSON.parse(fs.readFileSync(existing, "utf8"));
          if (Array.isArray(prev) && prev.length) {
            manifestShops.push({ id: st.shop.id, name: st.shop.name, file: st.shop.id + ".json", count: prev.length, bytes: Buffer.byteLength(JSON.stringify(prev)) });
            total += prev.length;
          }
        } catch (e) {}
      }
      continue;
    }
    const file = st.shop.id + ".json";
    const json = PRETTY ? JSON.stringify(items, null, 2) : JSON.stringify(items);
    fs.writeFileSync(path.join(OUT_DIR, file), json);
    manifestShops.push({ id: st.shop.id, name: st.shop.name, file, count: items.length, bytes: Buffer.byteLength(json) });
    total += items.length;
    console.log("  -> " + file + ": " + items.length + " foods (" + (Buffer.byteLength(json)/1048576).toFixed(2) + " MB)");
  }

  const manifest = {
    version: new Date().toISOString().slice(0, 10),
    generated: new Date().toISOString(),
    total: total,
    attribution: "Contains information from Open Food Facts contributors, reused under the Open Database License (ODbL).",
    shops: manifestShops,
  };
  fs.writeFileSync(path.join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log("\nDone. " + manifestShops.length + " shops, " + total + " foods total.");
}

main().catch(function(e){ console.error(e && e.stack ? e.stack : e); process.exit(1); });
