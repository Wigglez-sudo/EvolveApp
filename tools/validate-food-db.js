#!/usr/bin/env node
/* ============================================================================
   Evolve — validate generated food packs
   Checks food-db/manifest.json and each shop file for sane structure & macros.
   Exits non-zero (fails the build) if anything is broken.
   ========================================================================== */
const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "food-db");
const APP_CATEGORIES = new Set([
  "Bread & bakery","Cereal & breakfast","Cheese","Dairy & alternatives","Drinks",
  "Fast food & meals","Fish & seafood","Fruit","Grains, rice & pasta",
  "Legumes & plant protein","Misc & extras","Nuts, seeds & fats","Poultry & egg",
  "Protein & supplements","Red meat & pork","Sauces & condiments","Snacks & sweets","Vegetables",
]);

let errors = 0, warnings = 0;
function err(m) { console.error("  ✗ " + m); errors++; }
function warn(m) { console.warn("  ! " + m); warnings++; }

function validateItem(it, where) {
  if (!it || typeof it !== "object") return err(where + ": not an object");
  if (!it.n || typeof it.n !== "string") return err(where + ": missing name");
  if (typeof it.kcal !== "number" || it.kcal < 0 || it.kcal > 900) err(where + ` (${it.n}): kcal out of range (${it.kcal})`);
  ["p", "c", "f"].forEach(k => {
    if (typeof it[k] !== "number" || it[k] < 0 || it[k] > 100) err(where + ` (${it.n}): ${k} out of range (${it[k]})`);
  });
  if (it.cat && !APP_CATEGORIES.has(it.cat)) warn(where + ` (${it.n}): unknown category "${it.cat}"`);
  if (it.serve && (typeof it.serve.grams !== "number" || it.serve.grams <= 0)) warn(where + ` (${it.n}): bad serve grams`);
}

function main() {
  if (!fs.existsSync(DIR)) { console.error("No food-db/ directory — nothing to validate (run the build first)."); process.exit(0); }
  const manPath = path.join(DIR, "manifest.json");
  if (!fs.existsSync(manPath)) { console.error("No manifest.json"); process.exit(1); }

  let man;
  try { man = JSON.parse(fs.readFileSync(manPath, "utf8")); }
  catch (e) { console.error("manifest.json is not valid JSON: " + e.message); process.exit(1); }
  if (!Array.isArray(man.shops)) { console.error("manifest.shops is not an array"); process.exit(1); }

  console.log(`Manifest version ${man.version} · ${man.shops.length} shops`);
  for (const shop of man.shops) {
    if (!shop.id || !shop.file) { err(`shop missing id/file: ${JSON.stringify(shop)}`); continue; }
    const fp = path.join(DIR, shop.file);
    if (!fs.existsSync(fp)) { err(`${shop.file} listed in manifest but missing`); continue; }
    let items;
    try { items = JSON.parse(fs.readFileSync(fp, "utf8")); }
    catch (e) { err(`${shop.file} invalid JSON: ${e.message}`); continue; }
    if (!Array.isArray(items)) { err(`${shop.file} is not an array`); continue; }
    console.log(`\n${shop.name} (${shop.file}): ${items.length} items`);
    if (items.length !== shop.count) warn(`manifest count ${shop.count} ≠ actual ${items.length}`);
    /* Check EVERY item (it's just arithmetic — fast even for 10k rows) so the
       report lists the exact file + index of every bad row. That's what lets you
       open food-db/<shop>.json, find that index, and delete the offending entry. */
    items.forEach((it, i) => validateItem(it, `${shop.file}[${i}]`));
  }

  console.log(`\nDone. ${errors} error(s), ${warnings} warning(s).`);
  /* In CI this runs AFTER the commit (see the workflow), so a hard failure here
     turns the run RED without losing the build — that's the signal to open the
     committed food-db/<shop>.json, delete the flagged row(s), and commit.
     Optional --report (or EVOLVE_VALIDATE_REPORT=1) prints problems but exits 0,
     handy for a local dry-run that shouldn't fail. */
  const reportOnly = process.argv.includes("--report") || process.env.EVOLVE_VALIDATE_REPORT === "1";
  if (errors && reportOnly) {
    console.error(`\n⚠ ${errors} validation error(s) found (report-only mode — not failing). Listed above with their file + index so you can delete them.`);
    return;
  }
  if (errors) process.exit(1);
}
main();
