/* ============================================================================
   Evolve — Food Packs (optional, downloadable per-shop UK food databases)
   ----------------------------------------------------------------------------
   - Lists shops from food-db/manifest.json (the only network read, on demand)
   - Downloads a chosen shop's JSON and stores it in IndexedDB (on device)
   - packFoods() returns all installed-pack foods in the app's food format
       [ name, kcal, p, c, f, category ]  (brand folded into the name)
   - Nothing here is precached by the service worker; packs are fetched only
     when the user taps Download, and live entirely on the device thereafter.
   - PRIVACY: this only ever DOWNLOADS public lists. No personal data is sent.
   ========================================================================== */
(function(){
  "use strict";

  /* where the per-shop files live (same origin as the app) */
  var FOOD_DB_BASE = "./food-db/";
  var MANIFEST_URL = FOOD_DB_BASE + "manifest.json";

  /* ---- IndexedDB (packs can be a few MB — too big for localStorage) ------- */
  var DB_NAME = "evolve_food_packs_v1";
  var STORE   = "packs";
  var _dbp = null;
  function idb(){
    if(_dbp) return _dbp;
    _dbp = new Promise(function(res,rej){
      var r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = function(){ var db=r.result; if(!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE,{keyPath:"id"}); };
      r.onsuccess = function(){ res(r.result); };
      r.onerror   = function(){ rej(r.error); };
    });
    return _dbp;
  }
  function idbPut(rec){ return idb().then(function(db){ return new Promise(function(res,rej){
    var tx=db.transaction(STORE,"readwrite"); tx.objectStore(STORE).put(rec);
    tx.oncomplete=function(){res(true);}; tx.onerror=function(){rej(tx.error);};
  });}); }
  function idbGet(id){ return idb().then(function(db){ return new Promise(function(res,rej){
    var tx=db.transaction(STORE,"readonly"); var rq=tx.objectStore(STORE).get(id);
    rq.onsuccess=function(){res(rq.result||null);}; rq.onerror=function(){rej(rq.error);};
  });}); }
  function idbDel(id){ return idb().then(function(db){ return new Promise(function(res,rej){
    var tx=db.transaction(STORE,"readwrite"); tx.objectStore(STORE).delete(id);
    tx.oncomplete=function(){res(true);}; tx.onerror=function(){rej(tx.error);};
  });}); }
  function idbAll(){ return idb().then(function(db){ return new Promise(function(res,rej){
    var tx=db.transaction(STORE,"readonly"); var rq=tx.objectStore(STORE).getAll();
    rq.onsuccess=function(){res(rq.result||[]);}; rq.onerror=function(){rej(rq.error);};
  });}); }

  /* ---- in-memory cache of installed pack foods (built once, on boot) ------ */
  var _packFoods = [];          /* flat array in app food format */
  var _installed = {};          /* id -> {id,name,count,bytes,version} */
  var _ready = false;

  /* category whitelist — shop foods must map onto an existing app category.
     Anything unknown falls back to "Misc & extras". Kept in sync with data.js. */
  var APP_CATEGORIES = {
    "Bread & bakery":1,"Cereal & breakfast":1,"Cheese":1,"Dairy & alternatives":1,
    "Drinks":1,"Fast food & meals":1,"Fish & seafood":1,"Fruit":1,
    "Grains, rice & pasta":1,"Legumes & plant protein":1,"Misc & extras":1,
    "Nuts, seeds & fats":1,"Poultry & egg":1,"Protein & supplements":1,
    "Red meat & pork":1,"Sauces & condiments":1,"Snacks & sweets":1,"Vegetables":1
  };
  function safeCat(c){ return (c && APP_CATEGORIES[c]) ? c : "Misc & extras"; }

  /* turn one stored pack record's items into the app's [name,kcal,p,c,f,cat] rows */
  function recordToRows(rec){
    if(!rec || !rec.items || !rec.items.length) return [];
    var shopName = rec.name || rec.id;
    var rows = [];
    for(var i=0;i<rec.items.length;i++){
      var it = rec.items[i]; if(!it || !it.n) continue;
      var brand = it.b || shopName;
      var name = brand ? (it.n + " (" + brand + ")") : it.n;
      rows.push([ name, +it.kcal||0, +it.p||0, +it.c||0, +it.f||0, safeCat(it.cat), it.shop||rec.id ]);
    }
    return rows;
  }

  /* rebuild the in-memory food list from everything currently in IndexedDB */
  function rebuild(){
    return idbAll().then(function(recs){
      _packFoods = [];
      _installed = {};
      recs.forEach(function(rec){
        _installed[rec.id] = { id:rec.id, name:rec.name||rec.id, count:(rec.items||[]).length, bytes:rec.bytes||0, version:rec.version||"" };
        _packFoods = _packFoods.concat(recordToRows(rec));
      });
      _ready = true;
      return _packFoods;
    }).catch(function(){ _ready = true; return []; });
  }

  /* ---- public API --------------------------------------------------------- */

  /* foods from all installed packs, in the app's food row format.
     allFoods() in app.js concatenates this. Returns [] until rebuild() runs. */
  function packFoods(){ return _packFoods; }

  /* which packs are installed (for the manage screen + the shop filter) */
  function installedPacks(){ return Object.keys(_installed).map(function(k){ return _installed[k]; }); }
  function installedShopIds(){ return Object.keys(_installed); }
  function isPackInstalled(id){ return !!_installed[id]; }

  /* fetch the manifest of available shops (network — only called on the screen) */
  function loadManifest(){
    return fetch(MANIFEST_URL, {cache:"no-store"}).then(function(r){
      if(!r.ok) throw new Error("manifest "+r.status);
      return r.json();
    }).then(function(m){
      if(!m || !Array.isArray(m.shops)) throw new Error("bad manifest");
      return m;
    });
  }

  /* download one shop's pack and store it; resolves with the installed summary */
  function downloadPack(shop){
    if(!shop || !shop.id || !shop.file) return Promise.reject(new Error("bad shop"));
    var url = FOOD_DB_BASE + shop.file;
    return fetch(url, {cache:"no-store"}).then(function(r){
      if(!r.ok) throw new Error("download "+r.status);
      return r.json();
    }).then(function(items){
      if(!Array.isArray(items)) throw new Error("bad pack file");
      var rec = { id:shop.id, name:shop.name||shop.id, version:shop.version||"", bytes:shop.bytes||0, items:items };
      return idbPut(rec).then(function(){ return rebuild(); }).then(function(){ return _installed[shop.id]; });
    });
  }

  /* remove an installed pack */
  function removePack(id){ return idbDel(id).then(function(){ return rebuild(); }); }

  /* boot: load whatever is already installed so search has it immediately */
  function init(){ return rebuild(); }

  window.FoodPacks = {
    init: init,
    packFoods: packFoods,
    installedPacks: installedPacks,
    installedShopIds: installedShopIds,
    isPackInstalled: isPackInstalled,
    loadManifest: loadManifest,
    downloadPack: downloadPack,
    removePack: removePack,
    ready: function(){ return _ready; }
  };
})();
