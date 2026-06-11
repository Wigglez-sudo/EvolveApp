/* ===================== EVOLVE ===================== */
"use strict";

/* ---------- MACHINE LIBRARY (machines only) ---------- */
function workoutGroupIcon(w){
  const cnt={};
  (w&&w.exercises||[]).forEach(ex=>{ if(ex.group && GICON[ex.group]) cnt[ex.group]=(cnt[ex.group]||0)+1; });
  let best=null,bestN=0;
  Object.keys(cnt).forEach(g=>{ if(cnt[g]>bestN){bestN=cnt[g];best=g;} });
  return best?GICON[best]:"🏋️";
}
function machinesIn(g){return MACHINES.filter(m=>m.g===g);}
/* ---------- SUB-MUSCLE GROUPS ---------- */
function subGroupOf(name, g){
  const n=name.toLowerCase();
  if(g==="Arms"){
    if(/wrist|forearm|reverse curl|grip/.test(n))return "Forearms";
    if(/tricep|pushdown|push-down|skull|kickback|overhead extension|close[- ]grip|dip|press-?down|french/.test(n))return "Triceps";
    if(/curl|bicep|chin|preacher|hammer/.test(n))return "Biceps";
    return "Biceps";
  }
  if(g==="Legs"){
    if(/calf|calve|raise.*(toe|seated)|toe press/.test(n))return "Calves";
    if(/glute|hip thrust|bridge|kickback|abduct/.test(n))return "Glutes";
    if(/ham|romanian|rdl|leg curl|good morning|deadlift/.test(n))return "Hamstrings";
    if(/squat|leg press|extension|lunge|hack|step[- ]up|sissy/.test(n))return "Quads";
    return "Quads";
  }
  if(g==="Shoulders"){
    if(/rear|reverse (fly|pec|delt)|face pull/.test(n))return "Rear delts";
    if(/lateral|side raise|side delt|lat raise/.test(n))return "Side delts";
    if(/front|overhead|shoulder press|military|arnold|ohp|upright/.test(n))return "Front delts";
    return "Side delts";
  }
  if(g==="Back"){
    if(/shrug|trap|upper back|reverse fly/.test(n))return "Traps / upper back";
    if(/hyper|back extension|good morning|lower back|deadlift/.test(n))return "Lower back";
    if(/pulldown|pull-?up|chin|row|lat|pullover/.test(n))return "Lats";
    return "Lats";
  }
  if(g==="Chest"){
    if(/incline/.test(n))return "Upper chest";
    if(/decline/.test(n))return "Lower chest";
    return "Mid chest";
  }
  if(g==="Core"){
    if(/oblique|side|russian|woodchop|twist/.test(n))return "Obliques";
    if(/hyper|back extension|lower back/.test(n))return "Lower back";
    return "Abs";
  }
  return null;
}
/* names of exercises in a group filtered by sub (or all) */
function poolBySub(g, sub){
  let names=gymPoolNames(g);
  if(sub && sub!=="all") names=names.filter(n=>subGroupOf(n,g)===sub);
  return names;
}
/* which sub-groups actually have exercises available */
function subGroupsAvailable(g){
  const subs=SUBGROUPS[g]||[]; const avail=[];
  const names=gymPoolNames(g);
  subs.forEach(s=>{ if(names.some(n=>subGroupOf(n,g)===s)) avail.push(s); });
  return avail;
}

/* ---------- FREE WEIGHTS (barbell / dumbbell / bodyweight-loaded) ---------- */
function freeWeightsIn(g){return FREEWEIGHTS.filter(m=>m.g===g);}
function fwEnabled(){return (DATA.prefs && DATA.prefs.gymEquip==="all");}
function gymExercisesIn(g){return fwEnabled()? machinesIn(g).concat(freeWeightsIn(g)) : machinesIn(g);}
function gymPoolNames(g){return gymExercisesIn(g).map(m=>m.n);}

/* preset day templates (machine names) */

/* ---------- HOME EXERCISES ---------- */
/* eq: array of equipment tags. tags: none,dumbbell,band,pullup,kettlebell,bench */

/* ---------- CARDIO (met = metabolic equivalent for kcal estimate) ---------- */
function cardioWeight(){ return DATA.profile?.weightKg || (DATA.weights.length?DATA.weights[DATA.weights.length-1].kg:75); }
function cardioKcal(met,seconds){ return met*3.5*cardioWeight()/200*(seconds/60); }
function strideCm(){ return DATA.profile?.strideCm || Math.round((DATA.profile?.heightCm||175)*0.415); }
function armCm(){ return DATA.profile?.armCm || Math.round((DATA.profile?.heightCm||175)*0.44); }
/* estimated distance from stride length (steps) or arm length (rowing/ski); null = not distance-based */
function cardioDistanceKm(name, seconds){
  const min=seconds/60, st=strideCm()/100, ar=armCm()/100;
  const step=(f,c)=> st*f*c*min/1000;     // stride(m) * factor * cadence(spm) * minutes
  const wheel=(kmh)=> kmh*(min/60);
  const stroke=(rate)=> ar*3.2*rate*min/1000; // arm reach drives handle travel
  const M={
   "Treadmill — walk":[step,1.0,110],"Walking":[step,1.0,110],
   "Treadmill — brisk walk":[step,1.1,120],"Brisk walking":[step,1.1,120],
   "Treadmill — incline walk":[step,0.95,105],"Hiking":[step,1.0,108],
   "Treadmill — jog":[step,1.45,150],"Treadmill — run":[step,1.75,165],
   "Running (outdoors)":[step,1.75,165],"Treadmill — sprints":[step,2.0,185],
   "Curved manual treadmill":[step,1.6,160],
   "Stair climber / stepmill":[step,0.7,95],"Stair climbing (home)":[step,0.7,95],
   "Stationary bike — light":[wheel,18],"Stationary bike — moderate":[wheel,25],
   "Stationary bike — vigorous":[wheel,32],"Recumbent bike":[wheel,20],
   "Spin bike":[wheel,30],"Assault / air bike":[wheel,22],"Cycling (outdoors)":[wheel,25],
   "Rowing machine — moderate":[stroke,28],"Rowing machine — vigorous":[stroke,34],
   "Rowing (home machine)":[stroke,28],"Ski erg":[stroke,30]
  };
  const e=M[name]; if(!e)return null;
  const fn=e[0]; return fn(...e.slice(1));
}

/* ---------- FOOD DATABASE (per 100g: kcal, protein, carb, fat) ---------- */

/* ===================== STATE & STORAGE ===================== */
const KEY="evolve_v1";
const DEFAULT_DATA = {
  profile:null, /* {name,sex,age,heightCm,weightKg,activity,goal,goalWeightKg} */
  targets:null, /* {calories,protein,carbs,fat,water} */
  prefs:{energy:"kcal", addExercise:true, showAchievements:true, liftUnit:"kg", bodyUnit:"kg", gymEquip:"machine_cardio", env:"gym", rmFormula:"epley", theme:"ember", mealTimes:false, targetMode:"auto"},
  customFoods:[], /* {name,kcal,p,c,f} per 100g, user-added */
  favFoods:[],  /* GLOBAL favourite food names */
  favMachines:[], /* legacy machine names (migrated into favExercises) */
  favExercises:[], /* GLOBAL favourites: any exercise/cardio name */
  favWorkouts:[], /* {id,name,exercises:[{name,group}],cardio:{name,met,ic}|null,cardioPos:"start"|"end"} */
  weeklyPlan:null, /* {weekStart, days:{Mon:{type,label,done}|null,...}, cardioPref} */
  cardio:[],     /* {id,date,name,type,seconds,kcal,distanceKm} */
  log:{},       /* date -> {food:[], water:0, burned:[]} */
  workouts:[],  /* {id,date,title,type,exercises:[{name,group,sets:[{kg,reps,done}]}],volume,prs:[]} */
  weights:[],   /* {date,kg} */
  ach:{workoutsDone:0,totalVolume:0,streak:0,bestStreak:0,lastWorkoutDate:null,prs:{},unlocked:[]},
  statResets:{}, /* per-stat user resets: key -> {start, since} (prs: {since}) */
  meta:{lastBackup:null, created:null}
};
let DATA = load();
function load(){
  try{const raw=localStorage.getItem(KEY); if(raw){const d=Object.assign(JSON.parse(JSON.stringify(DEFAULT_DATA)),JSON.parse(raw)); migrate(d); return d;}}catch(e){}
  const d=JSON.parse(JSON.stringify(DEFAULT_DATA)); d.meta.created=todayISO(); return d;
}
function migrate(d){
  if(!Array.isArray(d.favExercises)) d.favExercises=[];
  if(Array.isArray(d.favMachines)) d.favMachines.forEach(n=>{ if(!d.favExercises.includes(n)) d.favExercises.push(n); });
  if(!Array.isArray(d.favFoods)) d.favFoods=[];
  if(!("weeklyPlan" in d)) d.weeklyPlan=null;
  if(!d.prefs) d.prefs={}; if(!d.prefs.env) d.prefs.env="gym"; if(!d.prefs.rmFormula) d.prefs.rmFormula="epley"; if(!d.prefs.theme) d.prefs.theme="ember";
  if(typeof d.prefs.mealTimes!=="boolean") d.prefs.mealTimes=false; /* default: fast mode (times hidden, device time used) */
  if(d.prefs.targetMode!=="manual") d.prefs.targetMode="auto"; /* auto = formula targets; manual = user-set calories & macros */
  if(!d.statResets || typeof d.statResets!=="object") d.statResets={};
}
function save(){try{localStorage.setItem(KEY,JSON.stringify(DATA));}catch(e){toast("Storage full or blocked");}}

/* ===================== THEMES ===================== */
const THEMES={
  ember:  {name:"Ember",   a:"#FF6A2C", a2:"#FF9A3D"},
  ocean:  {name:"Ocean",   a:"#2E8BFF", a2:"#5AA9FF"},
  violet: {name:"Violet",  a:"#A977FF", a2:"#C49BFF"},
  crimson:{name:"Crimson", a:"#FF4D6D", a2:"#FF7A90"},
  gold:   {name:"Gold",    a:"#F5A623", a2:"#FFC857"},
  mint:   {name:"Mint",    a:"#13C39A", a2:"#2FE6A8"},
  slate:  {name:"Slate",   a:"#7C8AA5", a2:"#9AA8C2"}
};
/* Base dark palette (the literal :root values). Themes tint THESE — always
   mixed from the originals so switching themes never drifts/compounds. */
const THEME_BASE={ink:"#0C0D11",ink2:"#101218",surface:"#15171F",surface2:"#1C1F2A",surface3:"#232735",line:"#272B38",line2:"#333849"};
function _hex2rgb(h){const m=/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(h);return m?[parseInt(m[1],16),parseInt(m[2],16),parseInt(m[3],16)]:[255,106,44];}
function _rgb2hex(c){return "#"+c.map(x=>Math.max(0,Math.min(255,Math.round(x))).toString(16).padStart(2,"0")).join("");}
/* blend accent into a base colour by amt (0..1) */
function _mix(base,accent,amt){const b=_hex2rgb(base),a=_hex2rgb(accent);return _rgb2hex([0,1,2].map(i=>b[i]+(a[i]-b[i])*amt));}
function applyTheme(id){
  const t=THEMES[id]||THEMES.ember; const r=document.documentElement.style;
  /* primary accent — overriding --strength/--strength2 re-flows --grad-str & --grad-brand automatically */
  r.setProperty("--strength",t.a); r.setProperty("--strength2",t.a2);
  const a=_hex2rgb(t.a);
  r.setProperty("--strength-soft",`rgba(${a[0]},${a[1]},${a[2]},.22)`);
  /* whole-app wash: tint the dark canvas, every card surface and the borders
     toward the theme hue so the colour is felt on every screen, not just buttons.
     Kept subtle (dark stays dark); semantic colours (fuel/gold/blue) stay put. */
  r.setProperty("--ink",     _mix(THEME_BASE.ink,     t.a,.045));
  r.setProperty("--ink2",    _mix(THEME_BASE.ink2,    t.a,.05));
  r.setProperty("--surface", _mix(THEME_BASE.surface, t.a,.07));
  r.setProperty("--surface2",_mix(THEME_BASE.surface2,t.a,.085));
  r.setProperty("--surface3",_mix(THEME_BASE.surface3,t.a,.10));
  r.setProperty("--line",    _mix(THEME_BASE.line,    t.a,.16));
  r.setProperty("--line2",   _mix(THEME_BASE.line2,   t.a,.18));
  /* keep the iOS status-bar / PWA theme colour in step with the canvas */
  const tc=document.querySelector('meta[name="theme-color"]'); if(tc) tc.setAttribute("content",_mix(THEME_BASE.ink,t.a,.045));
}
applyTheme((DATA.prefs&&DATA.prefs.theme)||"ember");

/* ===================== DATE HELPERS (device clock) ===================== */
function todayISO(d){d=d||new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");}
function prettyDate(iso){const [y,m,dd]=iso.split("-").map(Number);const dt=new Date(y,m-1,dd);
  return dt.toLocaleDateString(undefined,{weekday:"long",day:"numeric",month:"long"});}
function shortDate(iso){const [y,m,dd]=iso.split("-").map(Number);const dt=new Date(y,m-1,dd);
  return dt.toLocaleDateString(undefined,{day:"numeric",month:"short"});}
function dayLog(iso){iso=iso||todayISO(); if(!DATA.log[iso])DATA.log[iso]={food:[],water:0,burned:[]}; return DATA.log[iso];}
let viewDate = todayISO();

/* ===================== CALORIE MATH (Mifflin–St Jeor) ===================== */
function computeTargets(p){
  const bmr = 10*p.weightKg + 6.25*p.heightCm - 5*p.age + (p.sex==="male"?5:-161);
  const tdee = bmr * (ACT[p.activity]?.m||1.2);
  const cals = Math.max(1200, Math.round((tdee + (GOALS[p.goal]?.adj||0))/10)*10);
  const protein = Math.round(p.weightKg * (p.goal==="gain"?2.0:1.8));
  const fat = Math.round(cals*0.25/9);
  const carbs = Math.max(0, Math.round((cals - protein*4 - fat*9)/4));
  const water = Math.round(p.weightKg*35); /* ml */
  return {calories:cals, protein, carbs, fat, water, bmr:Math.round(bmr), tdee:Math.round(tdee)};
}
function bmi(p){const m=p.heightCm/100; return p.weightKg/(m*m);}
function bmiCat(v){return v<18.5?"Underweight":v<25?"Healthy":v<30?"Overweight":"Obese";}

/* ===================== ENERGY UNIT ===================== */
function eVal(kcal){return DATA.prefs.energy==="kj"?Math.round(kcal*4.184):Math.round(kcal);}
function eUnit(){return DATA.prefs.energy==="kj"?"kJ":"kcal";}

/* ===================== WEIGHT UNITS (canonical = kg) ===================== */
const LB_PER_KG=2.2046226, KG_PER_ST=6.3502932;
function liftUnit(){return (DATA.prefs&&DATA.prefs.liftUnit)||"kg";}
function bodyUnit(){return (DATA.prefs&&DATA.prefs.bodyUnit)||"kg";}
function liftLbl(){return liftUnit()==="lb"?"LB":"KG";}
function liftStep(){return liftUnit()==="lb"?5:2.5;}
function liftFromKg(kg){return liftUnit()==="lb"?(+kg)*LB_PER_KG:+kg;}
function kgFromLift(v){return liftUnit()==="lb"?(+v)/LB_PER_KG:+v;}
function liftRound(v){return liftUnit()==="lb"?Math.round(v):Math.round(v*10)/10;}
/* display a kg weight in the lift unit, e.g. "60 kg" / "135 lb" */
function liftStr(kg,withUnit){const v=liftRound(liftFromKg(kg));return (withUnit===false?v:v+" "+(liftUnit()==="lb"?"lb":"kg"));}
/* total volume display (raw) */
function volStr(kg){return Math.round(liftFromKg(kg)).toLocaleString()+" "+(liftUnit()==="lb"?"lb":"kg");}
/* big aggregate: tonnes (kg) or thousands of lb */
function tonneVal(kg){return (liftFromKg(kg)/1000).toFixed(1);}
function tonneUnit(){return liftUnit()==="lb"?"k lb":"t";}
/* bodyweight */
function bodyLbl(){const u=bodyUnit();return u==="lb"?"lb":u==="st"?"st/lb":"kg";}
function bodyToUnit(kg){const u=bodyUnit();return u==="lb"?kg*LB_PER_KG:u==="st"?kg/KG_PER_ST:kg;}
function bodyFromUnit(v){const u=bodyUnit();return u==="lb"?v/LB_PER_KG:u==="st"?v*KG_PER_ST:v;}
function bodyStr(kg){
  if(kg==null||kg==="")return "—";
  const u=bodyUnit();
  if(u==="lb")return (kg*LB_PER_KG).toFixed(1)+" lb";
  if(u==="st"){const tot=kg*LB_PER_KG;const st=Math.floor(tot/14);const lb=Math.round(tot-st*14);return st+" st "+lb+" lb";}
  return (Math.round(kg*10)/10)+" kg";
}
/* build a bodyweight input (handles st = two fields); returns HTML. read with readBodyKg(id) */
function bodyInputHTML(id, kg){
  const u=bodyUnit();
  if(u==="st"){
    const tot=kg?kg*LB_PER_KG:0; const st=kg?Math.floor(tot/14):""; const lb=kg?Math.round(tot-Math.floor(tot/14)*14):"";
    return `<div class="row" style="gap:8px">
      <input class="input num" id="${id}_st" type="number" inputmode="numeric" value="${st}" placeholder="st" style="flex:1">
      <input class="input num" id="${id}_lb" type="number" inputmode="decimal" value="${lb}" placeholder="lb" style="flex:1"></div>`;
  }
  const v=kg?(Math.round(bodyToUnit(kg)*10)/10):"";
  return `<input class="input num" id="${id}" type="number" inputmode="decimal" value="${v}" placeholder="${u}">`;
}
function readBodyKg(id){
  const u=bodyUnit();
  if(u==="st"){const st=+($("#"+id+"_st")?.value||0),lb=+($("#"+id+"_lb")?.value||0);const tot=st*14+lb;return tot>0?tot/LB_PER_KG:0;}
  const v=+($("#"+id)?.value||0); return v>0?bodyFromUnit(v):0;
}
function eFull(kcal){return eVal(kcal)+" "+eUnit();}

/* ===================== ACHIEVEMENTS ===================== */
const BADGES=[
 {id:"first",icon:"🔥",t:"First Steps",d:"Complete 1 workout",test:a=>a.workoutsDone>=1},
 {id:"w5",icon:"💪",t:"Getting Going",d:"5 workouts done",test:a=>a.workoutsDone>=5},
 {id:"w10",icon:"⚡",t:"Committed",d:"10 workouts done",test:a=>a.workoutsDone>=10},
 {id:"w25",icon:"🏆",t:"Dedicated",d:"25 workouts done",test:a=>a.workoutsDone>=25},
 {id:"w50",icon:"👑",t:"Iron Will",d:"50 workouts done",test:a=>a.workoutsDone>=50},
 {id:"w100",icon:"💎",t:"Centurion",d:"100 workouts done",test:a=>a.workoutsDone>=100},
 {id:"streak3",icon:"📅",t:"On a Roll",d:"3-day streak",test:a=>a.bestStreak>=3},
 {id:"streak7",icon:"🗓️",t:"Week Warrior",d:"7-day streak",test:a=>a.bestStreak>=7},
 {id:"streak30",icon:"🌟",t:"Unstoppable",d:"30-day streak",test:a=>a.bestStreak>=30},
 {id:"v10k",icon:"🏋️",t:"10 Tonnes",d:"10,000 kg lifted",test:a=>a.totalVolume>=10000},
 {id:"v50k",icon:"🚛",t:"50 Tonnes",d:"50,000 kg lifted",test:a=>a.totalVolume>=50000},
 {id:"v100k",icon:"🦾",t:"100 Tonnes",d:"100,000 kg lifted",test:a=>a.totalVolume>=100000},
 {id:"v250k",icon:"🌋",t:"Quarter Million",d:"250,000 kg lifted",test:a=>a.totalVolume>=250000},
 {id:"pr5",icon:"📈",t:"Record Breaker",d:"Set 5 personal records",test:a=>Object.keys(a.prs).length>=5}
];
function checkBadges(){
  const newly=[];
  BADGES.forEach(b=>{if(b.test(DATA.ach) && !DATA.ach.unlocked.includes(b.id)){DATA.ach.unlocked.push(b.id);newly.push(b);}});
  return newly;
}

/* ===================== UI HELPERS ===================== */
const $=s=>document.querySelector(s);
const el=(t,c,h)=>{const e=document.createElement(t);if(c)e.className=c;if(h!=null)e.innerHTML=h;return e;};
function toast(msg){const t=$("#toast");t.classList.remove("has-undo");t.textContent=msg;t.classList.add("on");clearTimeout(t._t);t._t=setTimeout(()=>t.classList.remove("on"),2200);}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function shuffle(a){a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

/* modal system — every modal gets a sticky × close button and is dismissable
   via the × , the dimmed background, or the device/gesture Back button. */
let _modalOpen=false, _ignorePop=false, _modalLocked=false;
function openModal(html, opts){
  opts=opts||{};
  _modalLocked=!!opts.mandatory;
  const w=$("#modalWrap");
  const top=_modalLocked
    ? '<div class="modal-top"><span class="grab"></span></div>'
    : '<div class="modal-top"><span class="grab"></span><button class="modal-x" id="modalX" aria-label="Close">✕</button></div>';
  $("#modal").innerHTML=top+html;
  $("#modal").scrollTop=0;
  w.classList.add("on");
  const x=$("#modalX"); if(x) x.addEventListener("click",()=>closeModal());
  if(!_modalOpen){ _modalOpen=true; try{history.pushState({evolveModal:1},"");}catch(e){} }
}
function closeModal(fromPop, force){
  if(_modalLocked && !force){
    /* mandatory modal (e.g. first-run setup): can't be dismissed. If Back was
       pressed, re-trap the history entry so the app isn't accidentally left. */
    if(fromPop){ try{history.pushState({evolveModal:1},"");}catch(e){} }
    return;
  }
  const w=$("#modalWrap"); if(!w.classList.contains("on") && !_modalOpen) return;
  const wasOpen=_modalOpen; _modalOpen=false; _modalLocked=false;
  w.classList.remove("on");
  if(wasOpen && !fromPop && history.state && history.state.evolveModal){ _ignorePop=true; try{history.back();}catch(e){ _ignorePop=false; } }
}
$("#modalBg").addEventListener("click",()=>closeModal());
window.addEventListener("popstate",()=>{
  if(_ignorePop){ _ignorePop=false; return; }
  if(_modalOpen) closeModal(true);
});

/* toast with an Undo action (auto-dismisses after a few seconds) */
function toastUndo(msg, onUndo){
  const t=$("#toast");
  t.innerHTML=`<span>${esc(msg)}</span><button class="toast-undo" id="toastUndo">Undo</button>`;
  t.classList.add("on","has-undo");
  clearTimeout(t._t);
  const close=()=>{ t.classList.remove("on","has-undo"); t.innerHTML=""; };
  t._t=setTimeout(close,4500);
  const b=$("#toastUndo");
  if(b) b.addEventListener("click",()=>{ clearTimeout(t._t); close(); if(onUndo)onUndo(); });
}

/* ---- input QoL: select-on-focus, iOS "Done" bar, hold-to-repeat steppers ---- */
function isNumField(t){ return t && t.tagName==="INPUT" && (t.type==="number" || t.inputMode==="decimal" || t.inputMode==="numeric"); }
/* tap a number field → highlight its value so you can just type over it */
document.addEventListener("focusin",e=>{
  if(isNumField(e.target)){ const el=e.target; setTimeout(()=>{ try{el.select();}catch(_){}} ,0); }
});
/* iOS number keypads have no return/done key — float a Done bar above the keyboard */
(function(){
  const ua=navigator.userAgent||"";
  const isIOS=/iPhone|iPad|iPod/i.test(ua) || (navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1);
  if(!isIOS) return;
  const bar=document.getElementById("kbdDone"); if(!bar) return;
  const btn=bar.querySelector("button");
  function place(){
    const vv=window.visualViewport;
    if(vv){ bar.style.bottom=Math.max(0,(window.innerHeight-(vv.height+vv.offsetTop)))+"px"; }
    else { bar.style.bottom="0px"; }
  }
  document.addEventListener("focusin",e=>{ if(isNumField(e.target)){ place(); bar.classList.add("on"); } });
  document.addEventListener("focusout",e=>{ if(isNumField(e.target)) setTimeout(()=>{ const a=document.activeElement; if(!isNumField(a)) bar.classList.remove("on"); },120); });
  btn.addEventListener("click",()=>{ const a=document.activeElement; if(a&&a.blur)a.blur(); bar.classList.remove("on"); });
  if(window.visualViewport){ window.visualViewport.addEventListener("resize",()=>{ if(bar.classList.contains("on"))place(); }); window.visualViewport.addEventListener("scroll",()=>{ if(bar.classList.contains("on"))place(); }); }
})();
/* press-and-hold a button to fire repeatedly (used by the +/- steppers) */
function holdRepeat(btn, fn){
  let to=null, iv=null;
  const stop=()=>{ if(to)clearTimeout(to); if(iv)clearInterval(iv); to=null; iv=null; };
  btn.addEventListener("pointerdown",e=>{ e.preventDefault(); fn(); to=setTimeout(()=>{ iv=setInterval(fn,90); },420); });
  ["pointerup","pointerleave","pointercancel"].forEach(ev=>btn.addEventListener(ev,stop));
}

/* in-app confirm (native confirm() is blocked in iOS standalone PWAs) */
function confirmModal(opts){
  openModal(`<h3>${esc(opts.title)}</h3>
    ${opts.body?`<p class="muted" style="margin:2px 0 18px;font-size:14px;line-height:1.5">${esc(opts.body)}</p>`:'<div style="height:10px"></div>'}
    <button class="btn ${opts.danger?"dfill":"str"} block" id="cm_yes">${esc(opts.confirmText||"Confirm")}</button>
    <button class="btn ghost block" id="cm_no" style="margin-top:10px">Cancel</button>`);
  $("#cm_yes").addEventListener("click",()=>{ closeModal(); if(opts.onConfirm)opts.onConfirm(); });
  $("#cm_no").addEventListener("click",closeModal);
}

/* ---------- workout deletion + stat recompute ---------- */
function dayDiff(a,b){return Math.round((new Date(b+"T00:00:00")-new Date(a+"T00:00:00"))/86400000);}
function recomputeAch(){
  const a=DATA.ach;
  a.workoutsDone=DATA.workouts.length;
  a.totalVolume=DATA.workouts.reduce((s,w)=>s+(w.volume||0),0);
  const prs={};
  DATA.workouts.forEach(w=>(w.exercises||[]).forEach(ex=>(ex.sets||[]).forEach(st=>{
    if(+st.kg>0 && +st.reps>0) prs[ex.name]=Math.max(prs[ex.name]||0,+st.kg);
  })));
  a.prs=prs;
  const dates=[...new Set(DATA.workouts.map(w=>w.date))].sort();
  let best=0,cur=0,prev=null;
  dates.forEach(d=>{ cur = prev && dayDiff(prev,d)===1 ? cur+1 : 1; best=Math.max(best,cur); prev=d; });
  a.bestStreak=best;
  if(dates.length){
    const last=dates[dates.length-1];
    a.lastWorkoutDate=last;
    a.streak = dayDiff(last,todayISO())<=1 ? cur : 0;
  } else { a.streak=0; a.lastWorkoutDate=null; }
  a.unlocked = BADGES.filter(b=>b.test(DATA.ach)).map(b=>b.id);
}

/* ---------- user-resettable stat displays ---------- */
function srGet(k){ return (DATA.statResets&&DATA.statResets[k])||null; }
function workoutStreaksSince(since){
  const dates=[...new Set(DATA.workouts.map(w=>w.date))].filter(d=>!since||d>=since).sort();
  let best=0,run=0,prev=null;
  dates.forEach(d=>{ run=prev&&dayDiff(prev,d)===1?run+1:1; best=Math.max(best,run); prev=d; });
  let current=0;
  if(dates.length){ const last=dates[dates.length-1]; current=dayDiff(last,todayISO())<=1?run:0; }
  return {best,current};
}
function dispVolume(){ const r=srGet("volume"); if(!r)return DATA.ach.totalVolume;
  return (r.start||0)+Math.max(0, DATA.ach.totalVolume-(r.snap||0)); }
function dispWorkouts(){ const r=srGet("workouts"); if(!r)return DATA.ach.workoutsDone;
  return (r.start||0)+Math.max(0, DATA.ach.workoutsDone-(r.snap||0)); }
function dispBestStreak(){ const r=srGet("bestStreak"); if(!r)return DATA.ach.bestStreak;
  return Math.max(r.start||0, workoutStreaksSince(r.since).best); }
function dispWorkoutStreak(){ const r=srGet("workoutStreak"); if(!r)return DATA.ach.streak;
  return Math.max(r.start||0, workoutStreaksSince(r.since).current); }
function dispProteinStreak(){ const r=srGet("protein"); const live=targetStreak("protein", r?r.since:null); return r?Math.max(r.start||0,live):live; }
function dispHydrationStreak(){ const r=srGet("hydration"); const live=targetStreak("water", r?r.since:null); return r?Math.max(r.start||0,live):live; }

const STAT_DEFS={
  volume:{label:"Total lifted", kind:"workout", manual:true, get:()=>tonneVal(dispVolume())+" "+tonneUnit()},
  workouts:{label:"Total workouts", kind:"workout", manual:true, get:()=>dispWorkouts()},
  bestStreak:{label:"Best streak", kind:"workout", manual:true, get:()=>dispBestStreak()+" days"},
  workoutStreak:{label:"Workout streak", kind:"workout", manual:true, get:()=>dispWorkoutStreak()+" days"},
  protein:{label:"Protein streak", kind:"food", manual:true, get:()=>dispProteinStreak()+" days"},
  hydration:{label:"Hydration streak", kind:"water", manual:true, get:()=>dispHydrationStreak()+" days"},
  prs:{label:"Personal records", kind:"workout", manual:false, get:()=>Object.keys(DATA.ach.prs||{}).length+" records"}
};
function applyStatKeep(key,start){
  if(!DATA.statResets)DATA.statResets={};
  if(key==="prs"){ DATA.ach.prs={}; DATA.statResets.prs={since:todayISO()}; save(); return; }
  if(key==="volume"){ DATA.statResets.volume={start:start||0, snap:DATA.ach.totalVolume}; save(); return; }
  if(key==="workouts"){ DATA.statResets.workouts={start:start||0, snap:DATA.ach.workoutsDone}; save(); return; }
  DATA.statResets[key]={start:start||0, since:todayISO()}; save();
}
function doStatDelete(key){
  const def=STAT_DEFS[key];
  if(def.kind==="workout"){
    const n=DATA.workouts.length;
    confirmModal({title:"Delete workout history?",danger:true,confirmText:"Delete "+n+" workout"+(n===1?"":"s"),
      body:"This permanently deletes all "+n+" logged workouts and resets Total lifted, Best streak, Workout streak, Total workouts and PRs together. Your food, water and bodyweight are kept. This can't be undone.",
      onConfirm:()=>{ DATA.workouts=[];
        ["volume","workouts","bestStreak","workoutStreak","prs"].forEach(k=>{ if(DATA.statResets)delete DATA.statResets[k]; });
        recomputeAch(); save(); toast("Workout history cleared"); renderMore(); }});
  } else if(def.kind==="food"){
    confirmModal({title:"Delete food history?",danger:true,confirmText:"Delete all food",
      body:"This permanently deletes every food entry from your diary — your calorie history and protein streak reset. Water, workouts and weight are kept. This can't be undone.",
      onConfirm:()=>{ Object.keys(DATA.log).forEach(d=>{ if(DATA.log[d])DATA.log[d].food=[]; });
        if(DATA.statResets)delete DATA.statResets.protein;
        save(); toast("Food history cleared"); renderMore(); }});
  } else {
    confirmModal({title:"Delete water history?",danger:true,confirmText:"Delete all water",
      body:"This permanently deletes all logged water — your hydration streak resets. Everything else is kept. This can't be undone.",
      onConfirm:()=>{ Object.keys(DATA.log).forEach(d=>{ if(DATA.log[d])DATA.log[d].water=0; });
        if(DATA.statResets)delete DATA.statResets.hydration;
        save(); toast("Water history cleared"); renderMore(); }});
  }
}
function openStatReset(key){
  const def=STAT_DEFS[key];
  openModal(`
    <h3>Reset ${def.label}</h3>
    <p class="muted tiny" style="margin-bottom:14px">Current: <b>${def.get()}</b></p>
    ${def.manual?`
    <div class="field"><label>New value</label>
      <div class="seg" id="sr_mode"><button data-v="zero" class="on">Zero</button><button data-v="custom">Custom number</button></div></div>
    <div class="field" id="sr_customwrap" style="display:none"><label>Custom starting number</label>
      <input class="input num" id="sr_custom" type="number" inputmode="numeric" value="0" placeholder="0"></div>`
    :`<p class="tiny muted" style="margin-bottom:14px">This clears your current PR records so new lifts register as fresh personal bests.</p>`}
    <div class="field"><label>How</label>
      <div class="seg vstack" id="sr_how">
        <button data-v="keep" class="on">Start fresh — keep my history</button>
        <button data-v="delete">Delete the data behind it</button></div></div>
    <p class="tiny" id="sr_note" style="margin:-4px 0 14px;line-height:1.5;color:var(--muted)"></p>
    <button class="btn str block" id="sr_go">Reset ${def.label}</button>`);
  if($("#sr_mode"))segBind("sr_mode");
  segBind("sr_how");
  const note=$("#sr_note");
  function refresh(){
    const custom = $("#sr_mode") && segVal("sr_mode")==="custom";
    if($("#sr_customwrap")) $("#sr_customwrap").style.display = custom?"block":"none";
    const how=segVal("sr_how");
    if(how==="delete"){
      note.innerHTML = def.kind==="workout"
        ? "⚠️ Deletes your <b>entire workout history</b> — this also resets Total lifted, Best streak, Workout streak, Total workouts and PRs together. Can't be undone."
        : def.kind==="food"
        ? "⚠️ Deletes <b>all logged food</b> from your diary (your calorie history resets too). Can't be undone."
        : "⚠️ Deletes <b>all logged water</b>. Can't be undone.";
    } else {
      note.textContent = "Keeps everything you've logged — the number just starts counting again from today.";
    }
  }
  refresh();
  if($("#sr_mode")) $("#sr_mode").querySelectorAll("button").forEach(b=>b.addEventListener("click",refresh));
  $("#sr_how").querySelectorAll("button").forEach(b=>b.addEventListener("click",refresh));
  $("#sr_go").addEventListener("click",()=>{
    if(segVal("sr_how")==="delete"){ closeModal(); doStatDelete(key); return; }
    let start=0;
    if(def.manual && segVal("sr_mode")==="custom"){ start=Math.max(0, Math.round(+$("#sr_custom").value||0)); }
    applyStatKeep(key,start);
    closeModal(); toast(def.label+" reset"); renderMore();
  });
}
function deleteWorkout(id, after){
  const w=DATA.workouts.find(x=>x.id===id);
  confirmModal({title:"Delete workout?",danger:true,confirmText:"Delete",
    body:(w?`“${w.title}” (${volStr(w.volume)}) `:"")+"will be removed and your stats updated. This can't be undone.",
    onConfirm:()=>{
      DATA.workouts=DATA.workouts.filter(x=>x.id!==id);
      recomputeAch(); save(); toast("Workout deleted"); if(after)after();
    }});
}

/* ring svg generator */
function ringSVG(pct,color,size,track){
  size=size||170; const sw=size*0.085, r=(size-sw)/2, c=2*Math.PI*r, off=c*(1-Math.max(0,Math.min(1,pct)));
  track=track||"#1C1F2A";
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
   <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${track}" stroke-width="${sw}"/>
   <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}"
     stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}"
     transform="rotate(-90 ${size/2} ${size/2})"/></svg>`;
}

/* simple line chart (SVG) */
function lineChart(points,color,opts){
  opts=opts||{}; const W=opts.w||500,H=opts.h||180,pad=28;
  if(!points.length) return `<div class="empty">No data yet</div>`;
  const xs=points.map(p=>p.x), ys=points.map(p=>p.y);
  let minY=Math.min(...ys),maxY=Math.max(...ys); if(minY===maxY){minY-=1;maxY+=1;}
  const pyer=(maxY-minY)*0.12; minY-=pyer; maxY+=pyer;
  const minX=Math.min(...xs),maxX=Math.max(...xs);
  const sx=x=>maxX===minX?W/2:pad+(x-minX)/(maxX-minX)*(W-pad*2);
  const sy=y=>H-pad-(y-minY)/(maxY-minY)*(H-pad*2);
  let d="",area="";
  points.forEach((p,i)=>{const X=sx(p.x),Y=sy(p.y);d+=(i?"L":"M")+X.toFixed(1)+" "+Y.toFixed(1)+" ";});
  area=`M${sx(points[0].x).toFixed(1)} ${(H-pad).toFixed(1)} `+points.map(p=>"L"+sx(p.x).toFixed(1)+" "+sy(p.y).toFixed(1)).join(" ")+` L${sx(points[points.length-1].x).toFixed(1)} ${(H-pad)} Z`;
  const dots=points.map(p=>`<circle cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="3" fill="${color}"/>`).join("");
  const gid="g"+Math.random().toString(36).slice(2,7);
  const lblMin=`<text x="2" y="${H-pad+4}" fill="#5C6273" font-size="11">${Math.round(minY)}</text>`;
  const lblMax=`<text x="2" y="${pad+4}" fill="#5C6273" font-size="11">${Math.round(maxY)}</text>`;
  return `<div class="chart-wrap"><svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${color}" stop-opacity="0.28"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
    <path d="${area}" fill="url(#${gid})"/>
    <path d="${d}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
    ${dots}${lblMin}${lblMax}</svg></div>`;
}

/* ===================== NAVIGATION ===================== */
function switchTab(tab){
  document.querySelectorAll(".screen").forEach(s=>s.classList.remove("active"));
  $("#view-"+tab).classList.add("active");
  document.querySelectorAll("#nav button").forEach(b=>b.classList.toggle("on",b.dataset.tab===tab));
  window.scrollTo(0,0);
  if(tab==="home")renderHome();
  if(tab==="train")renderTrain();
  if(tab==="cardio")renderCardio();
  if(tab==="fuel")renderFuel();
  if(tab==="stats")renderStats();
  if(tab==="more")renderMore();
}
document.querySelectorAll("#nav button").forEach(b=>b.addEventListener("click",()=>switchTab(b.dataset.tab)));

/* ===================== STAY AWAKE (Wake Lock) ===================== */
let wakeLock=null;
async function requestWakeLock(){
  try{
    if("wakeLock" in navigator){
      wakeLock=await navigator.wakeLock.request("screen");
      wakeLock.addEventListener&&wakeLock.addEventListener("release",()=>{});
    }
  }catch(e){/* unsupported or denied — best effort */}
}
document.addEventListener("visibilitychange",()=>{
  if(document.visibilityState==="visible" && $("#app").classList.contains("on")) requestWakeLock();
});

/* ===================== DAY ROLLOVER ===================== */
/* Keep the date current if the app is left open across midnight or comes back
   into focus on a new day. Refreshes the header + active tab; if the user was
   viewing "today" in Fuel, advances them to the new today. */
let _dayStamp=todayISO();
function checkDayRollover(){
  const now=todayISO();
  if(now!==_dayStamp){
    const wasToday = (viewDate===_dayStamp);
    _dayStamp=now;
    if(wasToday) viewDate=now;
    if($("#app").classList.contains("on")){ try{ updateHeader(); refreshCurrentTab(); }catch(e){} }
  }
}
document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="visible") checkDayRollover(); });
window.addEventListener("focus",checkDayRollover);
setInterval(checkDayRollover,30000);

/* ===================== SPLASH / BOOT ===================== */
$("#enterBtn").addEventListener("click",()=>{
  unlockAudio();
  requestWakeLock();
  $("#splash").classList.add("gone");
  $("#app").classList.add("on");
  $("#nav").classList.remove("hidden");
  if(!DATA.profile){ openSetup(true); }
  else { switchTab("home"); maybeResumeWorkout(); }
});

/* ===================== SETUP WIZARD ===================== */
let setupDraft=null;
function setupHeader(first){
  return first?`<div class="su-hero"><div class="su-ic">⚡</div>
    <div class="su-t">Welcome to Evolve</div>
    <div class="su-s">30 seconds of setup — then we'll build your targets and your first workout.</div></div>`:`<h3>Your details & targets</h3>`;
}
function openSetup(first){
  const p=DATA.profile||{sex:"male",activity:"mod",goal:"maintain"};
  const d=setupDraft||{};
  const wKg = d.weightKg!=null ? d.weightKg : p.weightKg;
  const gwKg = d.goalWeightKg!=null ? d.goalWeightKg : p.goalWeightKg;
  openModal(`
   ${setupHeader(first)}
   <p class="muted tiny" style="margin-bottom:16px">${first?"Everything stays on your device. You can change these any time.":"Update your stats — targets recalculate automatically."}</p>
   <div class="field"><label>Name (optional)</label><input class="input" id="su_name" value="${esc(d.name!=null?d.name:(p.name||""))}" placeholder="Your name"></div>
   <div class="field"><label>Sex (for calorie formula)</label>
     <div class="seg" id="su_sex">
       <button data-v="male" class="${(d.sex||p.sex)==="male"?"on":""}">Male</button>
       <button data-v="female" class="${(d.sex||p.sex)==="female"?"on":""}">Female</button></div></div>
   <div class="su-units">
     <div class="field"><label>Lifting weight unit</label>
       <div class="seg" id="su_lift"><button data-v="kg" class="${liftUnit()==="kg"?"on":""}">kg</button><button data-v="lb" class="${liftUnit()==="lb"?"on":""}">lb</button></div></div>
     <div class="field"><label>Bodyweight unit</label>
       <div class="seg" id="su_body"><button data-v="kg" class="${bodyUnit()==="kg"?"on":""}">kg</button><button data-v="lb" class="${bodyUnit()==="lb"?"on":""}">lb</button><button data-v="st" class="${bodyUnit()==="st"?"on":""}">st</button></div></div>
   </div>
   <div class="grid2">
     <div class="field"><label>Age</label><input class="input num" id="su_age" type="number" inputmode="numeric" value="${d.age!=null?d.age:(p.age||"")}" placeholder="25"></div>
     <div class="field"><label>Height (cm)</label><input class="input num" id="su_h" type="number" inputmode="decimal" value="${d.heightCm!=null?d.heightCm:(p.heightCm||"")}" placeholder="178"></div>
   </div>
   <div class="grid2">
     <div class="field"><label>Weight (${bodyLbl()})</label>${bodyInputHTML("su_w", wKg)}</div>
     <div class="field"><label>Goal weight (${bodyLbl()})</label>${bodyInputHTML("su_gw", gwKg)}</div>
   </div>
   <div class="field"><label>Activity level</label>
     <select class="input" id="su_act">${Object.entries(ACT).map(([k,v])=>`<option value="${k}" ${(d.activity||p.activity)===k?"selected":""}>${v.l}</option>`).join("")}</select></div>
   <div class="field"><label>Goal</label>
     <div class="seg" id="su_goal">${Object.entries(GOALS).map(([k,v])=>`<button data-v="${k}" class="${(d.goal||p.goal)===k?"on":""}">${v.l}</button>`).join("")}</div></div>
   <div class="field"><label>Gym equipment you'll use</label>
     <div class="seg vstack" id="su_equip">
       <button data-v="machine_cardio" class="${DATA.prefs.gymEquip!=="all"?"on":""}">Machines + Cardio only</button>
       <button data-v="all" class="${DATA.prefs.gymEquip==="all"?"on":""}">Machines + Free Weights + Cardio</button></div></div>
   <div class="grid2">
     <div class="field"><label>Stride length (cm) · optional</label><input class="input num" id="su_stride" type="number" inputmode="decimal" value="${d.strideCm!=null?d.strideCm:(p.strideCm||"")}" placeholder="auto"></div>
     <div class="field"><label>Arm length (cm) · optional</label><input class="input num" id="su_arm" type="number" inputmode="decimal" value="${d.armCm!=null?d.armCm:(p.armCm||"")}" placeholder="auto"></div>
   </div>
   <p class="muted tiny" style="margin:-6px 0 14px">Stride & arm length are used to estimate cardio distance — always approximate.</p>
   <button class="btn str block" id="su_save" style="margin-top:4px">${first?"Start training":"Save"}</button>
  `, {mandatory:!!first});
  segBind("su_sex"); segBind("su_goal"); segBind("su_lift");
  /* helper: capture current inputs into draft before a unit re-render */
  function capture(){
    setupDraft={
      name:$("#su_name").value, sex:segVal("su_sex"),
      age:+$("#su_age").value||null, heightCm:+$("#su_h").value||null,
      weightKg:readBodyKg("su_w")||null, goalWeightKg:readBodyKg("su_gw")||null,
      activity:$("#su_act").value, goal:segVal("su_goal"),
      strideCm:+$("#su_stride").value||null, armCm:+$("#su_arm").value||null
    };
  }
  $("#su_lift").querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>{DATA.prefs.liftUnit=btn.dataset.v;save();}));
  $("#su_body").querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>{
    capture(); DATA.prefs.bodyUnit=btn.dataset.v; save(); openSetup(first);  /* re-render so weight fields match */
  }));
  $("#su_equip").querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>{
    $("#su_equip").querySelectorAll("button").forEach(x=>x.classList.remove("on"));btn.classList.add("on");
    DATA.prefs.gymEquip=btn.dataset.v;}));
  $("#su_save").addEventListener("click",()=>{
    const age=+$("#su_age").value, h=+$("#su_h").value, w=readBodyKg("su_w");
    if(!age||!h||!w){toast("Add age, height and weight");return;}
    const prof={name:$("#su_name").value.trim(),sex:segVal("su_sex"),age,heightCm:h,weightKg:w,
      goalWeightKg:readBodyKg("su_gw")||w, activity:$("#su_act").value, goal:segVal("su_goal"),
      strideCm:+$("#su_stride").value||0, armCm:+$("#su_arm").value||0};
    DATA.profile=prof;
    if(DATA.prefs.targetMode==="manual" && DATA.targets){
      const c=computeTargets(prof); DATA.targets.bmr=c.bmr; DATA.targets.tdee=c.tdee; /* keep manual cals/macros, refresh info only */
    } else {
      DATA.targets=computeTargets(prof);
    }
    save();
    if(!DATA.weights.length || DATA.weights[DATA.weights.length-1].kg!==w){
      DATA.weights.push({date:todayISO(),kg:w});
    }
    setupDraft=null; save(); closeModal(false,true);
    updateHeader();
    if(first){switchTab("home"); toast("You're all set 💪"); setTimeout(()=>openWelcomeFlow(),500);}
    else{renderMore(); toast("Saved");}
  });
}
function segBind(id){const seg=$("#"+id);seg.querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{
  seg.querySelectorAll("button").forEach(x=>x.classList.remove("on"));b.classList.add("on");}));}
function segVal(id){const b=$("#"+id).querySelector("button.on");return b?b.dataset.v:null;}

function updateHeader(){
  const name=DATA.profile?.name;
  const h=new Date().getHours();
  const part = h<5?"Late night grind":h<12?"Good morning":h<17?"Good afternoon":h<21?"Good evening":"Night moves";
  $("#helloTxt").textContent = name?`${part}, ${name} 👋`:part+" 👋";
  $("#avInit").textContent = (name?name[0]:"E").toUpperCase();
  if(!$("#avInit")._wired){ $("#avInit")._wired=1; $("#avInit").style.cursor="pointer"; $("#avInit").addEventListener("click",()=>switchTab("more")); }
  $("#dateTxt").textContent = prettyDate(todayISO());
}

/* ===================== HOME (TODAY) SCREEN ===================== */
/* ===================== PER-TAB HELP ===================== */
const TAB_HELP={
  home:{t:"Home",b:`<div class="help-body">
    <p><b>Your day at a glance.</b> The big card at the top tells you what's on today — start your planned workout, kick off a quick session, or plan your week and let Evolve coach you.</p>
    <p><b>Week strip:</b> tap any day to start that day's workout. Tap <b>Edit</b> to open the weekly planner.</p>
    <p><b>Quick actions:</b> Quick start, Favourites, Cardio and Log food — one tap each.</p>
    <p><b>Fuel card</b> shows calories left, protein and water; tap <b>Open</b> for the full Fuel tab. Below it: your streak, total workouts and volume, a quick <b>bodyweight log</b>, and everything you've completed today.</p></div>`},
  train:{t:"Train",b:`<div class="help-body">
    <p><b>Your workout library.</b> Use the <b>Gym / Home</b> toggle to switch where you're training.</p>
    <p><b>Muscle tiles:</b> tap one to build a workout — choose how many exercises, focus a sub-muscle, swap any you don't fancy, then <b>Start</b>. You can also <b>save it as a favourite</b>.</p>
    <p><b>Preset days</b> are ready-made sessions; <b>Mega</b> mixes several muscle groups with optional cardio; the green <b>Cardio</b> card opens cardio.</p>
    <p>Tap the <b>★</b> on any exercise to favourite it, then the <b>★ Favs</b> pill to build a session from your favourites.</p></div>`},
  cardio:{t:"Cardio",b:`<div class="help-body">
    <p><b>Track any cardio.</b> Tap an activity tile to begin — each shows a rough calories & distance estimate per 30 minutes.</p>
    <p>Pick a <b>stopwatch</b> (counts up) or a <b>timer</b> (counts down to a target). Evolve estimates calories burned, and distance if you set your stride length in setup.</p>
    <p>When you finish it's logged to your day. Tap <b>‹</b> at the top to go back to Train.</p></div>`},
  fuel:{t:"Fuel",b:`<div class="help-body">
    <p><b>Your nutrition for the day.</b> The big ring shows calories left; the three smaller rings track <b style="color:#FF6A2C">protein</b>, <b style="color:#5AA9FF">carbs</b> and <b style="color:#FFC857">fat</b>; below that is water.</p>
    <p><b>＋ Add food</b> logs into Breakfast, Lunch, Dinner or Snacks — your <b>recent</b> and <b>favourite ★</b> foods sit at the top for one-tap logging. Tap any logged item to edit, duplicate or remove it.</p>
    <p><b>Repeat a meal</b> copies a meal from another day. <b>🔥 Burned</b> adds exercise calories back to your budget. The <b>‹ ›</b> arrows switch days, and the <b>Meal times</b> switch shows or hides a time on each item.</p></div>`},
  stats:{t:"Progress",b:`<div class="help-body">
    <p><b>Your trends over time.</b> Your <b>Last 30 days</b> summary and key stats (weight, BMI, best streak, total lifted) stay pinned at the top. Everything else is a <b>drop-down section</b> — tap a heading to open it.</p>
    <p>Sections include your <b>bodyweight</b> chart, <b>lifting volume</b> per session, <b>per-exercise strength</b> with an estimated 1-rep-max, the <b>calendar</b> (orange = lifts, green = cardio), <b>streaks</b>, a <b>Mega workouts</b> summary, plus your full <b>workout</b> and <b>cardio history</b> and <b>achievements</b>.</p>
    <p>In <b>Workout history</b> (and Cardio and Mega) tap any entry to expand it and see the date and every exercise with the weights you lifted. Long lists show 5 at a time with <b>Prev / Next</b> paging.</p></div>`}
};
function openTabHelp(k){ const h=TAB_HELP[k]; if(!h)return;
  openModal(`<h3>${h.t} — how it works</h3><div style="max-height:62vh;overflow:auto;margin-top:6px">${h.b}</div>
    <button class="btn block" id="th_ok" style="margin-top:6px">Got it</button>`);
  const ok=$("#th_ok"); if(ok)ok.addEventListener("click",closeModal); }
function helpBar(k){ const btn=el("button","help-bar");
  btn.innerHTML=`<span class="hb-l"><span class="hb-i">ⓘ</span> How this page works</span><span class="hb-go">›</span>`;
  btn.addEventListener("click",()=>openTabHelp(k)); return btn; }

function renderHome(){
  updateHeader();
  const b=$("#homeBody"); b.innerHTML="";
  b.appendChild(helpBar("home"));
  maybeBackupBanner(b);
  const todayIdx=(new Date().getDay()+6)%7, todayName=DOW[todayIdx];
  const plan = DATA.weeklyPlan && DATA.weeklyPlan.weekStart===curWeekStart() ? DATA.weeklyPlan : null;
  const td = plan ? plan.days[todayName] : null;
  const doneToday = DATA.workouts.filter(w=>w.date===todayISO());

  /* ---- HERO: what's happening today ---- */
  const hero=el("div","hero");
  let heroTitle, heroSub, heroBtn, heroAct;
  if(td && td.done){ heroTitle="Done for today ✅"; heroSub=`${td.label} day complete — nice work. Recover well.`; heroBtn="＋ Bonus session"; heroAct=()=>openBonusDay(todayName); }
  else if(td && td.type==="strength"){ heroTitle="Today: "+td.label+" day"; heroSub="Your planned session is ready — one tap to start."; heroBtn="▶ Start "+td.label+" day"; heroAct=()=>startPlannedDay(todayName); }
  else if(td && td.type==="cardio"){ heroTitle="Today: Cardio 🏃"; heroSub="A scheduled cardio day — pick any activity."; heroBtn="▶ Start cardio"; heroAct=()=>switchTab("cardio"); }
  else if(plan){ heroTitle="Rest day 🧘"; heroSub="Recovery is where the growth happens. Hit your protein and water."; heroBtn="＋ Bonus session anyway"; heroAct=()=>openBonusDay(todayName); }
  else { heroTitle="Ready to move?"; heroSub="Start a quick workout, or plan your week and let Evolve coach you."; heroBtn="⚡ Quick start"; heroAct=openQuickStart; }
  hero.innerHTML=`<div class="hero-eyebrow">${prettyDate(todayISO())}</div>
    <div class="hero-title">${heroTitle}</div>
    <div class="hero-sub">${heroSub}</div>`;
  const hb=el("button","btn str block hero-btn",heroBtn); hb.addEventListener("click",heroAct); hero.appendChild(hb);
  if(!plan){ const pb=el("button","btn ghost block","🧠 Plan my week"); pb.style.marginTop="10px"; pb.addEventListener("click",openWeekPlanner); hero.appendChild(pb); }
  b.appendChild(hero);

  /* ---- week strip (if planned) ---- */
  if(plan){
    const wk=el("div","plan-card"); wk.style.marginTop="14px";
    let strip=`<div class="row" style="justify-content:space-between;align-items:center;margin-bottom:2px">
      <div class="eyebrow" style="margin:0">This week</div><button class="btn sm" id="hm_editplan">Edit</button></div><div class="plan-strip">`;
    DOW.forEach((dn,i)=>{ const d=plan.days[dn]; const cls=["plan-day"];
      if(i===todayIdx)cls.push("today"); if(!d||d.type==="rest")cls.push("rest"); if(d&&d.done)cls.push("done");
      strip+=`<div class="${cls.join(" ")}" data-day="${dn}"><div class="dn">${dn}</div><div class="dl">${d?(d.type==="rest"?"Rest":d.type==="cardio"?"Cardio":d.label):"Rest"}</div></div>`; });
    strip+=`</div>`;
    wk.innerHTML=strip; b.appendChild(wk);
    $("#hm_editplan").addEventListener("click",openWeekPlanner);
    wk.querySelectorAll("[data-day]").forEach(c=>c.addEventListener("click",()=>startPlannedDay(c.getAttribute("data-day"))));
  }

  /* ---- quick actions ---- */
  const qa=el("div","qa-grid");
  const actions=[
    ["⚡","Quick start",openQuickStart,"str"],
    ["★","Favourites",openFavHub,"gold"],
    ["🏃","Cardio",()=>switchTab("cardio"),"blue"],
    ["🍎","Log food",()=>{viewDate=todayISO();switchTab("fuel");setTimeout(()=>{try{openFoodSearch();}catch(e){}},80);},"fuel"]
  ];
  actions.forEach(([ic,label,fn,ac])=>{ const a=el("button","qa qa-"+ac); a.innerHTML=`<span class="qi">${ic}</span><span class="ql">${label}</span>`; a.addEventListener("click",fn); qa.appendChild(a); });
  b.appendChild(qa);

  /* ---- fuel snapshot ---- */
  if(DATA.targets){
    const L=dayLog(todayISO());
    const eaten=(L.food||[]).reduce((a,f)=>a+(f.kcal||0),0);
    const burned=DATA.prefs.addExercise?(L.burned||[]).reduce((a,x)=>a+(x.kcal||0),0):0;
    const budget=DATA.targets.calories+burned;
    const left=Math.round(budget-eaten);
    const pct=Math.max(0,Math.min(100,Math.round(eaten/budget*100)));
    const pro=(L.food||[]).reduce((a,f)=>a+(f.p||0),0);
    const water=L.water||0;
    const fc=el("div","card snap"); 
    fc.innerHTML=`<div class="row" style="justify-content:space-between;align-items:center;margin-bottom:10px">
        <div class="eyebrow" style="margin:0">Fuel today</div><button class="btn sm" id="hm_fuel">Open</button></div>
      <div class="bar" style="margin-bottom:10px"><i style="width:${pct}%;background:var(--grad-fuel)"></i></div>
      <div class="snap-row">
        <div><div class="sv num" style="color:${left>=0?"var(--fuel)":"var(--danger)"}">${eVal(Math.abs(left))}</div><div class="sk">${eUnit()} ${left>=0?"left":"over"}</div></div>
        <div><div class="sv num">${Math.round(pro)}g</div><div class="sk">protein</div></div>
        <div><div class="sv num">${water}</div><div class="sk">water 💧</div></div>
      </div>`;
    b.appendChild(fc);
    $("#hm_fuel").addEventListener("click",()=>{viewDate=todayISO();switchTab("fuel");});
  }

  /* ---- streak / totals strip ---- */
  const strip=el("div","grid3");
  strip.innerHTML=`
   <div class="stat"><div class="k">Streak</div><div class="v">${dispWorkoutStreak()}<small> days</small></div></div>
   <div class="stat"><div class="k">Workouts</div><div class="v">${dispWorkouts()}</div></div>
   <div class="stat"><div class="k">Volume</div><div class="v">${tonneVal(dispVolume())}<small> ${tonneUnit()}</small></div></div>`;
  strip.style.marginTop="14px";
  b.appendChild(strip);

  /* ---- quick bodyweight log ---- */
  if(DATA.profile){
    const lastW=DATA.weights.length?DATA.weights[DATA.weights.length-1]:null;
    const loggedToday=lastW&&lastW.date===todayISO();
    const wc=el("div","card"); wc.style.marginTop="14px";
    wc.innerHTML=`<div class="row" style="justify-content:space-between;align-items:center">
        <div class="lrow" style="padding:0;border:none;gap:12px"><div class="ico">⚖️</div>
          <div class="main"><div class="t">Bodyweight</div>
          <div class="s num">${lastW?bodyStr(lastW.kg)+(loggedToday?" · today":" · "+shortDate(lastW.date)):"Not logged yet"}</div></div></div>
        <button class="btn sm ${loggedToday?"":"fuel"}" id="hm_weight">${loggedToday?"Update":"＋ Log"}</button></div>`;
    wc.querySelector("#hm_weight").addEventListener("click",openLogWeight);
    b.appendChild(wc);
  }

  /* ---- today's completed activity ---- */
  const cardioToday=DATA.cardio.filter(c=>c.date===todayISO());
  if(doneToday.length||cardioToday.length){
    b.appendChild(el("div","sect-h",`<h3>Completed today</h3>`));
    const card=el("div","card");
    doneToday.forEach(w=>{
      const r=el("div","lrow");
      r.innerHTML=`<div class="ico">✅</div><div class="main"><div class="t">${esc(w.title)}</div>
        <div class="s">${w.exercises.length} exercise${w.exercises.length===1?"":"s"} · ${volStr(w.volume)}${w.prs&&w.prs.length?` · ${w.prs.length} PR${w.prs.length>1?"s":""} 🏅`:""}</div></div>`;
      const del=el("button","del","×"); del.addEventListener("click",()=>deleteWorkout(w.id,renderHome));
      r.appendChild(del); card.appendChild(r);
    });
    cardioToday.forEach(c=>{
      const r=el("div","lrow");
      r.innerHTML=`<div class="ico">${(CARDIO.find(x=>x.n===c.name)||{}).ic||"🏃"}</div><div class="main"><div class="t">${esc(c.name)}</div>
        <div class="s">${fmtClock(c.seconds*1000)} · ${eVal(c.kcal)} ${eUnit()}</div></div>`;
      card.appendChild(r);
    });
    b.appendChild(card);
  }
}

/* ===================== TRAIN SCREEN (library) ===================== */
function renderTrain(){
  const b=$("#trainBody"); b.innerHTML="";
  b.appendChild(helpBar("train"));
  if(!DATA.prefs.env)DATA.prefs.env="gym";

  /* environment toggle + favourites pill */
  const envRow=el("div","env-row");
  envRow.innerHTML=`<div class="env-seg" id="envSeg">
      <button data-v="gym" class="${DATA.prefs.env==="gym"?"on":""}">🏋️ Gym</button>
      <button data-v="home" class="${DATA.prefs.env==="home"?"on":""}">🏠 Home</button></div>
    <button class="fav-pill" id="favPill">★ Favs</button>`;
  b.appendChild(envRow);
  $("#envSeg").querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>{
    DATA.prefs.env=btn.dataset.v;save();renderTrain();}));
  $("#favPill").addEventListener("click",openFavHub);

  if(DATA.prefs.env==="gym") renderGymZone(b); else renderHomeZone(b);

  /* saved favourite workouts */
  if(DATA.favWorkouts&&DATA.favWorkouts.length){
    const shF=el("div","sect-h",`<h3>★ Saved workouts</h3>`); b.appendChild(shF);
    const fwCard=el("div","card");
    DATA.favWorkouts.forEach(f=>{
      const r=el("div","lrow");
      const cardioTxt=f.cardio?` + ${f.cardio.ic} cardio`:"";
      r.innerHTML=`<div class="ico">★</div><div class="main"><div class="t">${esc(f.name)}</div>
        <div class="s">${f.exercises.length} exercise${f.exercises.length===1?"":"s"}${cardioTxt}</div></div>`;
      const go=el("button","btn sm str","Start"); go.addEventListener("click",()=>startFavWorkout(f));
      const del=el("button","del","×"); del.addEventListener("click",()=>deleteFavWorkout(f.id));
      const end=el("div","row"); end.style.gap="6px"; end.append(go,del);
      r.appendChild(end); fwCard.appendChild(r);
    });
    b.appendChild(fwCard);
  }
}
function cardioEntryCard(){
  const cc=el("button","mega-card cardio-card");
  cc.innerHTML=`<div class="mega-glow" style="background:radial-gradient(120% 120% at 0% 0%,rgba(47,230,168,.3),transparent 50%),radial-gradient(120% 120% at 100% 100%,rgba(90,169,255,.22),transparent 50%)"></div>
    <div style="position:relative;z-index:2"><div class="nm disp">CARDIO 🏃</div>
    <div class="ct">${CARDIO.length} activities · timers, calories & distance</div></div>`;
  cc.addEventListener("click",()=>switchTab("cardio"));
  return cc;
}
function renderGymZone(b){
  const sh=el("div","sect-h",`<h3>Target a muscle group</h3>`); b.appendChild(sh);
  const grid=el("div","mg-grid");
  GROUPS.forEach(g=>{
    const card=el("button","mg");
    const n=gymExercisesIn(g).length;
    card.innerHTML=`<div class="glow" style="background:radial-gradient(135% 120% at 82% 8%, ${GROUP_GLOW[g]}, transparent 62%)"></div>
      <div class="go">›</div><div class="gi">${GICON[g]||"🏋️"}</div>
      <div class="ct">${n} ${fwEnabled()?"exercises":"machines"}</div><div class="nm">${g}</div>`;
    card.addEventListener("click",()=>openGroupBuilder(g));
    grid.appendChild(card);
  });
  b.appendChild(grid);
  const mega=el("button","mega-card");
  mega.innerHTML=`<div class="mega-glow"></div><div style="position:relative;z-index:2"><div class="nm disp">MEGA WORKOUT 💥</div>
    <div class="ct">Muscle groups + cardio in one — random or your choice</div></div>`;
  mega.addEventListener("click",openMegaBuilder); b.appendChild(mega);
  b.appendChild(cardioEntryCard());
  const sh2=el("div","sect-h",`<h3>Preset days</h3>`); b.appendChild(sh2);
  b.appendChild(el("div","muted tiny","Ready-made one-tap sessions — tap one to start straight away.")).style.cssText="margin:-6px 0 10px";
  const PICON={Push:"🫷",Pull:"🪢",Legs:"🦵",Upper:"🙆",["Full Body"]:"🔥"};
  const days=el("div","preset-scroll");
  Object.keys(PRESET_DAYS).forEach(d=>{
    const list=PRESET_DAYS[d];
    const groups=[...new Set(list.map(n=>EX_BY_NAME[n]?.g).filter(Boolean))];
    const c=el("button","preset-card");
    c.innerHTML=`<div class="pi">${PICON[d]||"🏋️"}</div><div class="pn">${d}</div>
      <div class="ps">${list.length} exercise${list.length===1?"":"s"}</div><div class="pg">${groups.slice(0,3).join(" · ")}</div>`;
    c.addEventListener("click",()=>startSession(d+" Day","preset",PRESET_DAYS[d].map(n=>mkExercise(n))));
    days.appendChild(c);
  });
  b.appendChild(days);
}
function renderHomeZone(b){
  const sh3=el("div","sect-h",`<h3>At home</h3>`); b.appendChild(sh3);
  const home=el("div","card");
  home.innerHTML=`<div class="lrow" style="padding-top:0"><div class="ico">🏠</div>
    <div class="main"><div class="t">No machines? No problem.</div><div class="s">Pick your equipment — we'll build the routine.</div></div></div>`;
  const hb=el("button","btn block","Build a home routine"); hb.style.marginTop="6px";
  hb.addEventListener("click",openHomeBuilder); home.appendChild(hb); b.appendChild(home);
  /* quick bodyweight */
  const qc=el("div","card");
  qc.innerHTML=`<div class="lrow" style="padding-top:0"><div class="ico">⚡</div>
    <div class="main"><div class="t">Quick bodyweight circuit</div><div class="s">A fast no-equipment session, built instantly.</div></div></div>`;
  const qb=el("button","btn str block","Start 15-min circuit"); qb.style.marginTop="6px";
  qb.addEventListener("click",()=>{
    const pool=HOME.filter(h=>h.eq.includes("none"));
    const ex=shuffle(pool.slice()).slice(0,6).map(h=>({name:h.n,group:h.t,home:h,sets:[blankSet()]}));
    if(!ex.length){toast("No bodyweight moves found");return;}
    startSession("Quick circuit","home",ex);
  });
  qc.appendChild(qb); b.appendChild(qc);
  /* home mega */
  const mega=el("button","mega-card");
  mega.innerHTML=`<div class="mega-glow"></div><div style="position:relative;z-index:2"><div class="nm disp">HOME MEGA 💥</div>
    <div class="ct">Full-body home session + cardio finisher</div></div>`;
  mega.addEventListener("click",()=>{DATA.prefs.env="home";openMegaBuilder();}); b.appendChild(mega);
  b.appendChild(cardioEntryCard());
}

/* ===================== WEEKLY PLANNER ===================== */
const DOW=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const SPLIT_TEMPLATES={
  1:["Full Body"],
  2:["Upper","Lower"],
  3:["Push","Pull","Legs"],
  4:["Upper","Lower","Upper","Lower"],
  5:["Upper","Lower","Push","Pull","Legs"],
  6:["Push","Pull","Legs","Push","Pull","Legs"],
  7:["Push","Pull","Legs","Upper","Lower","Active Recovery","Active Recovery"]
};
const COACH={
  1:"🧠 One focused session. We'll make it full-body (or target your most neglected muscle) so nothing gets missed.",
  2:"⚖️ Two days — we'll run an Upper/Lower split so you still hit everything across the week.",
  3:"🔥 The classic Push / Pull / Legs. Hits every muscle once with great recovery.",
  4:"💪 The hypertrophy sweet spot: Upper/Lower twice each — every muscle trained twice a week.",
  5:"🏋️ Advanced 5-day split with two built-in rest days for recovery.",
  6:"⚡ High volume (PPL ×2). We've kept one rest day — listen to your joints.",
  7:"⚠️ Seven days is a lot. We've turned two days into Active Recovery (mobility / light cardio) to prevent burnout."
};
function curWeekStart(){ const d=new Date(); const day=(d.getDay()+6)%7; d.setDate(d.getDate()-day); d.setHours(0,0,0,0); return d.toISOString().slice(0,10); }
function neglectedGroup(){
  const since=Date.now()-28*86400000; const cnt={};
  GROUPS.forEach(g=>cnt[g]=0);
  DATA.workouts.forEach(w=>{ if(new Date(w.date).getTime()>=since)(w.exercises||[]).forEach(e=>{ if(cnt[e.group]!=null)cnt[e.group]++; }); });
  let min=null,minG=null; GROUPS.forEach(g=>{ if(min===null||cnt[g]<min){min=cnt[g];minG=g;} });
  return {group:minG,count:min};
}
function activeTabId(){ const s=document.querySelector(".screen.active"); return s?s.id.replace("view-",""):"home"; }
function refreshCurrentTab(){ const t=activeTabId();
  if(t==="home")renderHome(); else if(t==="train")renderTrain(); else if(t==="cardio")renderCardio();
  else if(t==="fuel")renderFuel(); else if(t==="stats")renderStats(); else if(t==="more")renderMore(); }
function refreshActive(){ if($("#view-home").classList.contains("active"))renderHome(); else if($("#view-train").classList.contains("active"))renderTrain(); }
function renderPlanCard(b){
  const card=el("div","plan-card");
  const plan=DATA.weeklyPlan && DATA.weeklyPlan.weekStart===curWeekStart() ? DATA.weeklyPlan : null;
  const todayIdx=(new Date().getDay()+6)%7, todayName=DOW[todayIdx];
  if(plan){
    const td=plan.days[todayName];
    const head=`<div class="row" style="justify-content:space-between;align-items:center">
      <div><div class="eyebrow" style="margin:0">This week ${infoBtn("planner")}</div>
      <div style="font-weight:700;margin-top:2px">${td?(td.type==="rest"?"🧘 Rest day today":td.type==="cardio"?"🏃 Cardio today":"Today: "+td.label+" day"):"No session today"}</div></div>
      <button class="btn sm" id="plan_edit">Edit</button></div>`;
    let strip=`<div class="plan-strip">`;
    DOW.forEach((dn,i)=>{ const d=plan.days[dn]; const cls=["plan-day"];
      if(i===todayIdx)cls.push("today"); if(!d||d.type==="rest")cls.push("rest"); if(d&&d.done)cls.push("done");
      strip+=`<div class="${cls.join(" ")}" data-day="${dn}"><div class="dn">${dn}</div><div class="dl">${d?(d.type==="rest"?"Rest":d.type==="cardio"?"Cardio":d.label):"Rest"}</div></div>`; });
    strip+=`</div>`;
    card.innerHTML=head+strip;
    b.appendChild(card);
    $("#plan_edit").addEventListener("click",openWeekPlanner);
    card.querySelectorAll("[data-day]").forEach(c=>c.addEventListener("click",()=>startPlannedDay(c.getAttribute("data-day"))));
  } else {
    card.innerHTML=`<div class="row" style="justify-content:space-between;align-items:center">
      <div><div class="eyebrow" style="margin:0">Plan your week ${infoBtn("planner")}</div>
      <div class="muted tiny" style="margin-top:3px">Build a balanced routine around the days you can train.</div></div></div>
      <button class="btn str block" id="plan_make" style="margin-top:12px">🧠 Plan my week</button>`;
    b.appendChild(card);
    $("#plan_make").addEventListener("click",openWeekPlanner);
  }
  bindInfo(card);
}
function openWeekPlanner(){
  const picked=new Set();
  if(DATA.weeklyPlan&&DATA.weeklyPlan.weekStart===curWeekStart()){
    DOW.forEach(dn=>{const d=DATA.weeklyPlan.days[dn]; if(d&&d.type!=="rest")picked.add(dn);});
  } else { ["Mon","Wed","Fri"].forEach(d=>picked.add(d)); }
  let cardioPref=(DATA.weeklyPlan&&DATA.weeklyPlan.cardioPref)||"after";
  function paint(){
    const nb=picked.size;
    const neglect=neglectedGroup();
    let coach=COACH[nb]||"Pick the days you can train.";
    if(nb===1 && DATA.workouts.length) coach=`🧠 Neglect detector: over the last 4 weeks your least-trained area is <b style="color:var(--text)">${neglect.group}</b>. We'll make your one day a ${neglect.group}-focused or full-body session.`;
    if(nb===0) coach="Tap the days you can train this week.";
    openModal(`<h3>Plan my week ${infoBtn("planner")}</h3>
      <p class="muted tiny" style="margin-bottom:12px">Tap the days you can train. We'll build a balanced split and slot in rest & cardio.</p>
      <div class="day-pick" id="wp_days">${DOW.map(d=>`<button data-d="${d}" class="${picked.has(d)?"on":""}">${d}</button>`).join("")}</div>
      <div class="coach" id="wp_coach">${coach}</div>
      <div class="mg-sub" style="margin-top:14px">Cardio</div>
      <div class="seg" id="wp_cardio">
        <button data-v="after" class="${cardioPref==="after"?"on":""}">After lifting</button>
        <button data-v="rest" class="${cardioPref==="rest"?"on":""}">Rest days</button>
        <button data-v="skip" class="${cardioPref==="skip"?"on":""}">Skip</button></div>
      <button class="btn str block" id="wp_build" style="margin-top:16px">Build my week</button>
      ${(DATA.weeklyPlan&&DATA.weeklyPlan.weekStart===curWeekStart())?`<button class="btn ghost block" id="wp_clear" style="margin-top:10px">Clear this week's plan</button>`:""}`);
    bindInfo($("#modal"));
    const clr=$("#wp_clear"); if(clr)clr.addEventListener("click",()=>{
      confirmModal({title:"Clear weekly plan?",danger:true,confirmText:"Clear it",body:"This removes this week's plan. You can build a new one any time.",
        onConfirm:()=>{DATA.weeklyPlan=null;save();closeModal();switchTab("home");toast("Plan cleared");}});
    });
    $("#wp_days").querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>{
      const d=btn.dataset.d; if(picked.has(d))picked.delete(d); else picked.add(d); paint();}));
    $("#wp_cardio").querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>{cardioPref=btn.dataset.v;
      $("#wp_cardio").querySelectorAll("button").forEach(x=>x.classList.remove("on"));btn.classList.add("on");}));
    $("#wp_build").addEventListener("click",()=>buildWeek([...picked].sort((a,b)=>DOW.indexOf(a)-DOW.indexOf(b)),cardioPref));
  }
  paint();
}
function buildWeek(trainDays, cardioPref){
  if(!trainDays.length){toast("Pick at least one day");return;}
  const tmpl=SPLIT_TEMPLATES[Math.min(trainDays.length,7)].slice();
  if(trainDays.length===1 && DATA.workouts.length){ const ng=neglectedGroup().group; tmpl[0]=["Chest","Shoulders","Arms"].includes(ng)?"Push":["Back"].includes(ng)?"Pull":["Legs","Glutes"].includes(ng)?"Legs":"Full Body"; }
  const days={}; DOW.forEach(d=>days[d]=null);
  trainDays.forEach((d,i)=>{ const label=tmpl[i%tmpl.length];
    days[d]= label==="Active Recovery" ? {type:"cardio",label:"Cardio",done:false} : {type:"strength",label,done:false}; });
  if(cardioPref==="after"){ trainDays.forEach(d=>{ if(days[d]&&days[d].type==="strength")days[d].cardio=true; }); }
  else if(cardioPref==="rest"){ DOW.forEach(d=>{ if(!days[d]) {/* leave some rest as cardio */} }); 
    const rest=DOW.filter(d=>!days[d]); if(rest.length){ days[rest[Math.floor(rest.length/2)]]={type:"cardio",label:"Cardio",done:false}; } }
  DATA.weeklyPlan={weekStart:curWeekStart(),days,cardioPref};
  save(); closeModal(); switchTab("home"); toast("Week planned 🗓️");
}
function dayExercises(label){
  const map={Push:["Chest","Shoulders","Arms"],Pull:["Back","Arms"],Legs:["Legs","Core"],
    Upper:["Chest","Back","Shoulders","Arms"],Lower:["Legs","Core"],"Full Body":GROUPS.slice()};
  const groups=map[label]||GROUPS.slice();
  const favs=favList("gym").filter(x=>x.kind!=="cardio").map(x=>x.n);
  let ex=[];
  groups.forEach(g=>{
    const favInG=favs.filter(n=>EX_BY_NAME[n]&&EX_BY_NAME[n].g===g);
    let picks=favInG.slice(0,2);
    if(picks.length<2){ const pool=shuffle(gymPoolNames(g)).filter(n=>!picks.includes(n)); picks=picks.concat(pool.slice(0,2-picks.length)); }
    picks.forEach(n=>ex.push(mkExercise(n)));
  });
  return ex;
}
function startPlannedDay(dn){
  const plan=DATA.weeklyPlan; if(!plan){toast("No plan yet");return;}
  const d=plan.days[dn];
  if(!d || d.type==="rest"){ openBonusDay(dn); return; }
  if(d.type==="cardio"){ switchTab("cardio"); toast("Cardio day — pick an activity"); return; }
  let ex=dayExercises(d.label);
  if(d.cardio){ const c=CARDIO.filter(x=>x.t==="machine"); ex.push(mkCardioCard(c[Math.floor(Math.random()*c.length)])); }
  plannedDayRef={dn}; startSession(d.label+" day","planned",ex);
}
function suggestedLabelFor(group){
  return ["Chest","Shoulders","Arms"].includes(group)?"Push":group==="Back"?"Pull":["Legs","Glutes","Core"].includes(group)?"Legs":"Full Body";
}
function openBonusDay(dn){
  const plan=DATA.weeklyPlan;
  const ng=neglectedGroup(); const label=DATA.workouts.length?suggestedLabelFor(ng.group):"Full Body";
  const todayIdx=(new Date().getDay()+6)%7;
  const future=DOW.slice(DOW.indexOf(dn)+1).filter(x=>plan&&plan.days[x]&&plan.days[x].type==="strength");
  const clash=future.find(x=>plan.days[x].label===label);
  openModal(`<h3>Bonus workout 💪 ${infoBtn("planner")}</h3>
    <p style="line-height:1.55;color:var(--text)">Got extra time on <b>${dn}</b>? ${DATA.workouts.length?`Over the last 4 weeks your least-trained area is <b style="color:var(--strength)">${ng.group}</b>, so a <b>${label}</b> session would balance you out.`:`A <b>${label}</b> session is a solid choice.`}</p>
    ${clash?`<div class="coach" style="margin-top:12px">⚠️ You already have <b>${label}</b> planned for ${clash}. Rebalancing will reshuffle the rest of the week so you don't double up.</div>`:""}
    <button class="btn str block" id="bn_add" style="margin-top:16px">Add ${label} today — keep the rest</button>
    <button class="btn block" id="bn_bal" style="margin-top:10px">Add it & rebalance my week 🔄</button>
    <button class="btn ghost block" id="bn_cancel" style="margin-top:10px">Not now</button>`);
  bindInfo($("#modal"));
  $("#bn_cancel").addEventListener("click",closeModal);
  $("#bn_add").addEventListener("click",()=>{
    plan.days[dn]={type:"strength",label,done:false,bonus:true};
    if(plan.cardioPref==="after")plan.days[dn].cardio=true;
    save(); closeModal();
    let ex=dayExercises(label); if(plan.days[dn].cardio){const c=CARDIO.filter(x=>x.t==="machine");ex.push(mkCardioCard(c[Math.floor(Math.random()*c.length)]));}
    plannedDayRef={dn}; startSession(label+" day","planned",ex);
  });
  $("#bn_bal").addEventListener("click",()=>{
    /* gather all training days incl the bonus, preserve completed days, rebalance the rest */
    const doneDays={}; DOW.forEach(x=>{ if(plan.days[x]&&plan.days[x].done)doneDays[x]=plan.days[x]; });
    const train=DOW.filter(x=>x===dn || (plan.days[x]&&plan.days[x].type!=="rest")).sort((a,b)=>DOW.indexOf(a)-DOW.indexOf(b));
    const tmpl=SPLIT_TEMPLATES[Math.min(train.length,7)].slice();
    const newDays={}; DOW.forEach(x=>newDays[x]=null);
    train.forEach((x,i)=>{ const lab=tmpl[i%tmpl.length];
      newDays[x]= doneDays[x] ? doneDays[x] : (lab==="Active Recovery"?{type:"cardio",label:"Cardio",done:false}:{type:"strength",label:lab,done:false}); });
    if(plan.cardioPref==="after")train.forEach(x=>{ if(newDays[x]&&newDays[x].type==="strength"&&!newDays[x].done)newDays[x].cardio=true; });
    plan.days=newDays; save(); closeModal(); refreshActive(); toast("Week rebalanced 🔄");
    const td=plan.days[dn]; if(td&&td.type==="strength"){ let ex=dayExercises(td.label); if(td.cardio){const c=CARDIO.filter(y=>y.t==="machine");ex.push(mkCardioCard(c[Math.floor(Math.random()*c.length)]));} plannedDayRef={dn}; startSession(td.label+" day","planned",ex); }
  });
}
let plannedDayRef=null;

function mkExercise(name){const m=EX_BY_NAME[name]; return {name, group:m?m.g:"", sets:[blankSet()]};}
function mkCardioCard(act, suggestMin){
  const name=act.name||act.n;
  return {cardio:true, name, group:"Cardio", activity:{name, met:act.met, ic:act.ic}, suggestMin:suggestMin||15, done:false, result:null, sets:[]};
}
function openLiveCardioTimer(ex, onDone){
  const act=ex.activity;
  const st={elapsedMs:0, running:true, lastTs:Date.now(), tick:null};
  function startTick(){ if(!st.tick)st.tick=setInterval(()=>{ if(st.running){const n=Date.now();st.elapsedMs+=n-st.lastTs;st.lastTs=n;upd();} },250); }
  function stop(){ if(st.tick){clearInterval(st.tick);st.tick=null;} }
  function upd(){
    const secs=st.elapsedMs/1000, kcal=cardioKcal(act.met,secs), dist=cardioDistanceKm(act.name,secs);
    const clk=$("#lct_clock"); if(clk)clk.textContent=fmtClock(st.elapsedMs);
    const burn=$("#lct_burn"); if(burn)burn.innerHTML=`~${eVal(kcal)} ${eUnit()}${dist!=null?` · ~${dist.toFixed(2)} km <span class="muted" style="font-weight:400">(est.)</span>`:""}`;
  }
  function doFinish(){
    stop(); const secs=Math.max(0,Math.round(st.elapsedMs/1000));
    const kcal=Math.round(cardioKcal(act.met,secs)), dist=cardioDistanceKm(act.name,secs);
    DATA.cardio.push({id:Date.now(),date:todayISO(),name:act.name,type:act.met>=8?"intense":"steady",seconds:secs,kcal,distanceKm:dist!=null?+dist.toFixed(2):null});
    if(DATA.prefs.addExercise) dayLog(todayISO()).burned.push({name:act.name+" ("+fmtClock(secs*1000)+")",kcal,time:Date.now()});
    ex.done=true; ex.result={seconds:secs,kcal,dist:dist!=null?+dist.toFixed(2):null};
    save(); closeModal(); toast("Cardio logged 🔥"); if(onDone)onDone();
  }
  openModal(`<div class="center"><div style="font-size:40px">${act.ic}</div>
    <div class="eyebrow" style="margin:6px 0 12px">${esc(act.name)}</div>
    <div class="disp" id="lct_clock" style="font-size:64px;line-height:1">00:00</div>
    <div class="num" id="lct_burn" style="color:var(--fuel);font-weight:700;margin-top:6px"></div>
    <div class="row" style="gap:10px;margin-top:18px">
      <button class="btn" id="lct_toggle" style="flex:1">Pause</button>
      <button class="btn fuel" id="lct_done" style="flex:1">Finish</button></div>
    <button class="btn ghost block" id="lct_cancel" style="margin-top:10px">Discard</button></div>`);
  $("#lct_toggle").addEventListener("click",()=>{
    st.running=!st.running; st.lastTs=Date.now(); if(st.running)startTick();
    const t=$("#lct_toggle"); t.textContent=st.running?"Pause":"Resume"; t.className="btn"+(st.running?"":" str"); t.style.flex="1";
  });
  $("#lct_done").addEventListener("click",doFinish);
  $("#lct_cancel").addEventListener("click",()=>{ stop(); closeModal(); });
  startTick(); upd();
}
function buildCardioLiveCard(ex,xi){
  const c=el("div","ex-card"); c.style.borderColor="rgba(47,230,168,.4)";
  const head=el("div","eh");
  head.innerHTML=`<div class="nm">${ex.activity.ic} ${esc(ex.name)} <span class="tiny" style="color:var(--fuel)">· cardio</span></div>`;
  const rm=el("button","del","×"); rm.addEventListener("click",()=>removeLiveExercise(xi));
  head.appendChild(rm); c.appendChild(head);
  if(ex.done && ex.result){
    const r=ex.result;
    const done=el("div","set-block done"); done.style.cursor="default";
    done.innerHTML=`<div class="sb-top"><span class="sl" style="color:var(--fuel)">DONE · ${fmtClock(r.seconds*1000)}</span>
      <div class="sb-done">✓</div></div>
      <div class="num" style="color:var(--fuel);font-weight:700">${eVal(r.kcal)} ${eUnit()}${r.dist!=null?` · ${r.dist} km`:""}</div>`;
    c.appendChild(done);
  } else {
    const tip=el("div","ex-tip"); tip.textContent="Suggested: ~"+ex.suggestMin+" min · time, calories & distance tracked";
    c.appendChild(tip);
    const start=el("button","btn fuel block","▶ Start cardio");
    start.addEventListener("click",()=>openLiveCardioTimer(ex,renderLive));
    c.appendChild(start);
  }
  return c;
}
function blankSet(prev){return {kg:prev?prev.kg:"", reps:prev?prev.reps:"", done:false};}

function openQuickStart(){
  const favCount=(DATA.favExercises||[]).filter(n=>{const k=favKind(n);return k.kind!=="cardio";}).length;
  openModal(`<h3>Start a workout</h3>
   ${favCount>=3?`<button class="btn gold block" id="qs_randfav" style="margin-bottom:14px">🎲 Randomise from favourites (${favCount})</button>`:""}
   <div class="eyebrow" style="margin-bottom:8px">Target a muscle group</div>
   <div class="row wrap" style="gap:8px">
     ${GROUPS.map(g=>`<button class="chip" data-g="${g}">${g}</button>`).join("")}
   </div>
   <div class="divider"></div>
   <div class="eyebrow" style="margin-bottom:8px">Preset days</div>
   <div class="row wrap" style="gap:8px">
     ${Object.keys(PRESET_DAYS).map(d=>`<button class="chip str" data-d="${d}">${d}</button>`).join("")}
   </div>
   <button class="btn block" id="qs_home" style="margin-top:16px">Home workout builder</button>`);
  if(favCount>=3) $("#qs_randfav").addEventListener("click",()=>{closeModal();randomizeFavWorkout();});
  $("#modal").querySelectorAll("[data-g]").forEach(b=>b.addEventListener("click",()=>{closeModal();openGroupBuilder(b.dataset.g);}));
  $("#modal").querySelectorAll("[data-d]").forEach(b=>b.addEventListener("click",()=>{closeModal();
    startSession(b.dataset.d+" Day","preset",PRESET_DAYS[b.dataset.d].map(n=>mkExercise(n)));}));
  $("#qs_home").addEventListener("click",()=>{closeModal();openHomeBuilder();});
}

/* ===================== FAVOURITES ===================== */
function isFav(n){return (DATA.favExercises||[]).includes(n);}
function toggleFav(n){
  if(!DATA.favExercises)DATA.favExercises=[];
  const i=DATA.favExercises.indexOf(n);
  if(i>=0){DATA.favExercises.splice(i,1);toast("Removed from favourites");}
  else{DATA.favExercises.push(n);toast("★ Favourited "+n);}
  save();
}
/* legacy aliases */
function isFavMachine(n){return isFav(n);}
function toggleFavMachine(n){toggleFav(n);}
/* classify a favourite name into its kind for the hub */
function favKind(n){
  if(MACHINE_BY_NAME[n]) return {kind:"machine", group:MACHINE_BY_NAME[n].g, env:"gym", ic:"🏋️"};
  if(FW_BY_NAME[n]) return {kind:"freeweight", group:FW_BY_NAME[n].g, env:"gym", ic:"🏋️"};
  const h=(typeof HOME!=='undefined')?HOME.find(x=>x.n===n):null;
  if(h) return {kind:"home", group:h.t, env:"home", ic:"🏠"};
  const c=(typeof CARDIO!=='undefined')?CARDIO.find(x=>x.n===n):null;
  if(c) return {kind:"cardio", group:"Cardio", env:c.t==="home"?"home":"gym", ic:c.ic};
  return {kind:"other", group:"", env:"gym", ic:"⭐"};
}
function saveFavWorkout(exercises, cardio, cardioPos, defaultName){
  openModal(`<h3>Save as favourite</h3>
    <p class="muted tiny" style="margin-bottom:12px">${exercises.filter(e=>!e.cardio).length} exercise${exercises.filter(e=>!e.cardio).length===1?"":"s"}${cardio?` + ${cardio.name}`:""} — give it a name to reuse any time.</p>
    <div class="field"><label>Name</label><input class="input" id="fw_n" value="${esc(defaultName||"")}" placeholder="e.g. My push day"></div>
    <button class="btn str block" id="fw_save">Save favourite</button>`);
  $("#fw_save").addEventListener("click",()=>{
    const name=$("#fw_n").value.trim(); if(!name){toast("Give it a name");return;}
    if(!DATA.favWorkouts)DATA.favWorkouts=[];
    DATA.favWorkouts.unshift({id:Date.now(),name,
      exercises:exercises.filter(e=>!e.cardio).map(e=>({name:e.name,group:e.group,home:e.home||null})),
      cardio:cardio||null, cardioPos:cardioPos||"end"});
    save(); closeModal(); toast("★ Saved “"+name+"”");
    refreshActive();
  });
}
function startFavWorkout(fav){
  const strength=fav.exercises.map(e=>e.home?{name:e.name,group:e.group,home:e.home,sets:[blankSet()]}:mkExercise(e.name));
  let ex=strength.slice();
  if(fav.cardio){ const cc=mkCardioCard(fav.cardio);
    if(fav.cardioPos==="start")ex=[cc,...ex]; else ex=[...ex,cc]; }
  startSession(fav.name,"favourite",ex);
}
function deleteFavWorkout(id){
  confirmModal({title:"Delete favourite?",danger:true,confirmText:"Delete",
    onConfirm:()=>{DATA.favWorkouts=DATA.favWorkouts.filter(f=>f.id!==id);save();renderTrain();toast("Deleted");}});
}

/* ---------- 1RM ESTIMATION ---------- */
const RM_FORMULAS={
  epley:{l:"Epley",f:(w,r)=>w*(1+r/30)},
  brzycki:{l:"Brzycki",f:(w,r)=>r>=37?w:w*36/(37-r)},
  lander:{l:"Lander",f:(w,r)=>r>=20?w:(100*w)/(101.3-2.67123*r)},
  lombardi:{l:"Lombardi",f:(w,r)=>w*Math.pow(r,0.10)}
};
function rmFormula(){return (DATA.prefs&&DATA.prefs.rmFormula)||"epley";}
function est1RMkg(kg,reps){ if(!kg||!reps)return 0; if(reps<=1)return kg;
  const f=(RM_FORMULAS[rmFormula()]||RM_FORMULAS.epley).f; return f(+kg,+reps); }

/* ---------- PROGRESSIVE-OVERLOAD GHOST TEXT ---------- */
function lastSetFor(name){
  const ws=DATA.workouts.slice().sort((a,b)=>b.id-a.id);
  for(const w of ws){ const ex=(w.exercises||[]).find(e=>e.name===name);
    if(ex){ const good=(ex.sets||[]).filter(s=>!s.warmup && +s.kg>0); const s=good.length?good[good.length-1]:(ex.sets||[])[ (ex.sets||[]).length-1 ];
      if(s) return s; } }
  return null;
}

/* ---------- INFO ⓘ POPOVERS ---------- */
const INFO_TEXT={
  ghost:"The faint text in the KG/REPS boxes shows what you lifted here last time. Try to beat it!",
  rir:"RIR = Reps In Reserve. 0 = total failure (no more reps). 2 = you could have done 2 more with good form. It tracks how hard a set really was.",
  superset:"Link two exercises to do them back-to-back with no rest in between. The rest timer starts only after you finish both.",
  plates:"Shows exactly which plates to load on each side of a standard 20kg Olympic barbell to hit your target weight.",
  warmup:"Adds 2–3 lighter prep sets before your working weight to warm the muscle up. Warm-ups don't count toward PRs, volume or 1RM.",
  oneRM:"Your estimated max for a single rep, worked out from your best set. Change the formula in More → Preferences.",
  randfav:"Instantly builds a workout using only the exercises you've starred — no scrolling.",
  planner:"Tick the days you can train and we'll build a balanced week that hits every muscle group and schedules cardio. Tap today's block to start it.",
  swap:"Machine taken? Get a quick same-muscle alternative and swap it into your workout without losing your place.",
  exrest:"Set a custom rest time for this exercise — heavy lifts may want longer than your default.",
  streak:"Hit your daily target several days in a row to build a streak. Keeps you accountable even on rest days."
};
function infoBtn(key){return `<button class="iconbtn info ihelp" data-info-key="${key}" title="What's this?">ⓘ</button>`;}
function openRMInfo(){
  const row=(name,desc)=>`<div style="margin-bottom:12px"><div style="font-weight:700;color:var(--strength);margin-bottom:2px">${name}</div><div class="muted" style="font-size:13.5px;line-height:1.55">${desc}</div></div>`;
  openModal(`<h3>Estimated 1-rep max</h3>
    <div style="max-height:64vh;overflow:auto;margin-top:6px">
    <p class="muted" style="font-size:14px;line-height:1.6;margin:0 0 14px">Your <b>1RM</b> is the heaviest weight you could lift for a single rep. Rather than asking you to actually test a true max (which is hard and risky), Evolve <b>estimates</b> it from a normal set — the weight and the reps you did. More reps means a rougher estimate, so these are guides, not gospel. You choose which maths to use:</p>
    ${row("Epley","The most common one. Simple and reliable across most rep ranges — a safe default if you're unsure.")}
    ${row("Brzycki","Tends to read slightly lower than Epley, and is often considered more accurate for low reps (around 1–10).")}
    ${row("Lander","A scientific formula that sits close to Brzycki; a good alternative for lower-rep, heavier sets.")}
    ${row("Lombardi","Uses a gentler curve, so it usually gives the highest estimate of the four — especially as reps climb higher.")}
    <p class="muted" style="font-size:13px;line-height:1.55;margin:6px 0 0">Tip: pick one and stick with it, so your numbers stay comparable over time. They all agree closely at low reps and spread apart as reps get high.</p>
    </div>
    <button class="btn block" id="rm_ok" style="margin-top:14px">Got it</button>`);
  $("#rm_ok").addEventListener("click",closeModal);
}
function bindInfo(scope){ (scope||document).querySelectorAll("[data-info-key]").forEach(b=>{
  if(b._ib)return; b._ib=1; b.addEventListener("click",e=>{e.stopPropagation();
    const k=b.getAttribute("data-info-key");
    if(k==="oneRM"){ openRMInfo(); return; }
    openModal(`<h3>Quick tip</h3><p style="line-height:1.6;color:var(--text)">${esc(INFO_TEXT[k]||"")}</p><button class="btn block" id="ib_ok" style="margin-top:16px">Got it</button>`);
    $("#ib_ok").addEventListener("click",closeModal); }); }); }

/* ---------- GLOBAL FAVOURITES HUB ---------- */
function favList(env){ return (DATA.favExercises||[]).map(n=>({n,...favKind(n)})).filter(x=>env?x.env===env:true); }
function openFavHub(){
  const gym=favList("gym"), home=favList("home");
  const section=(title,arr)=>`<div class="eyebrow" style="margin:14px 0 8px">${title} <span class="muted">(${arr.length})</span></div>`+
    (arr.length? `<div class="fav-grid">`+arr.map(x=>`<div class="fav-chip"><span>${x.ic} ${esc(x.n)}</span><button class="iconbtn star on" data-unfav="${esc(x.n)}">★</button></div>`).join("")+`</div>` 
      : `<p class="muted tiny" style="margin:0 0 4px">Nothing yet — tap the ☆ on any exercise, machine or cardio to add it.</p>`);
  openModal(`<h3>★ Favourites <span style="font-size:13px">${infoBtn("randfav")}</span></h3>
    <p class="muted tiny" style="margin-bottom:6px">Your starred exercises. Build a workout from just these.</p>
    ${(gym.length+home.length)>=2?`<button class="btn gold block" id="fh_rand" style="margin:10px 0 4px">🎲 Build from favourites</button>`:""}
    ${section("🏋️ Gym",gym)}
    ${section("🏠 Home",home)}`);
  bindInfo($("#modal"));
  const fhr=$("#fh_rand"); if(fhr)fhr.addEventListener("click",()=>{closeModal();randomizeFavWorkout();});
  $("#modal").querySelectorAll("[data-unfav]").forEach(b=>b.addEventListener("click",()=>{toggleFav(b.getAttribute("data-unfav"));openFavHub();}));
}
function randomizeFavWorkout(){
  const pool=favList().filter(x=>x.kind!=="cardio");
  if(pool.length<1){toast("Star a few exercises first");return;}
  openModal(`<h3>🎲 Build from favourites</h3>
    <p class="muted tiny" style="margin-bottom:12px">How many exercises today? We'll pull them at random from your ${pool.length} starred move${pool.length===1?"":"s"}.</p>
    <div class="seg" id="rf_n">${[4,6,8].map((n,i)=>`<button data-v="${n}" class="${i===1?"on":""}">${n}</button>`).join("")}</div>
    <label style="display:flex;align-items:center;gap:10px;margin:14px 0;font-size:14px">
      <input type="checkbox" id="rf_cardio" style="width:20px;height:20px"> Add a cardio finisher from favourites</label>
    <button class="btn str block" id="rf_go">Build it</button>`);
  let n=6; $("#rf_n").querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{
    $("#rf_n").querySelectorAll("button").forEach(x=>x.classList.remove("on"));b.classList.add("on");n=+b.dataset.v;}));
  $("#rf_go").addEventListener("click",()=>{
    const chosen=shuffle(pool.slice()).slice(0,Math.min(n,pool.length));
    const ex=chosen.map(x=>{ if(x.kind==="home"){const h=HOME.find(z=>z.n===x.n);return {name:x.n,group:h?h.t:"",home:h,sets:[blankSet()]};} return mkExercise(x.n); });
    if($("#rf_cardio").checked){ const cfav=favList().filter(x=>x.kind==="cardio"); const cardios=cfav.length?cfav:CARDIO.map(c=>({n:c.n}));
      const pick=CARDIO.find(c=>c.n===shuffle(cardios.slice())[0].n); if(pick)ex.push(mkCardioCard(pick)); }
    if(!ex.length){toast("Nothing to build");return;}
    closeModal(); startSession("Favourites mix","fav",ex);
  });
}

/* ===================== GROUP BUILDER ===================== */
let buildState=null; /* {group, picked:[names], rest} */
function openGroupBuilder(group){
  buildState={group, picked:[], count:5, sub:"all"};
  rollMachines();
  renderBuilder();
}
function rollMachines(){
  const pool=poolBySub(buildState.group, buildState.sub);
  buildState.picked = shuffle(pool).slice(0, Math.min(buildState.count,pool.length));
}
function renderBuilder(){
  const g=buildState.group;
  const subs=subGroupsAvailable(g);
  const counts=[3,5,7];
  openModal(`
   <h3>${g} session</h3>
   <p class="muted tiny" style="margin-bottom:12px">Pick a focus and how many exercises — we'll randomise them. Add, remove or re-roll before you start.</p>
   ${subs.length>1?`<label class="mg-sub">Focus</label>
   <div class="row wrap" style="gap:6px;margin-bottom:12px" id="gb_sub">
     <button class="chip sm ${buildState.sub==="all"?"str on":""}" data-s="all">All ${g.toLowerCase()}</button>
     ${subs.map(s=>`<button class="chip sm ${buildState.sub===s?"str on":""}" data-s="${esc(s)}">${esc(s)}</button>`).join("")}
   </div>`:""}
   <div class="seg" id="gb_count">
     ${counts.map(c=>`<button data-v="${c}" class="${buildState.count===c?"on":""}">${c}</button>`).join("")}
     <button data-v="manual" class="${buildState.count==="manual"?"on":""}">Manual</button>
   </div>
   <div class="row" style="gap:8px;margin:12px 0">
     <button class="btn sm" id="gb_roll" style="flex:1">🎲 Re-roll</button>
     <button class="btn sm" id="gb_add" style="flex:1">＋ Add exercise</button>
   </div>
   <div id="gb_list"></div>
   <button class="btn str block" id="gb_start" style="margin-top:14px">Start ${g} workout</button>
   <button class="btn ghost block" id="gb_fav" style="margin-top:10px">★ Save as favourite</button>
  `);
  paintBuilderList();
  if(subs.length>1) $("#gb_sub").querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>{
    buildState.sub=btn.dataset.s;
    $("#gb_sub").querySelectorAll("button").forEach(x=>x.classList.remove("str","on"));btn.classList.add("str","on");
    if(buildState.count!=="manual")rollMachines(); paintBuilderList();
  }));
  $("#gb_count").querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>{
    const v=btn.dataset.v;
    $("#gb_count").querySelectorAll("button").forEach(x=>x.classList.remove("on"));btn.classList.add("on");
    if(v==="manual"){buildState.count="manual"; buildState.picked=[];}
    else{buildState.count=+v; rollMachines();}
    paintBuilderList();
  }));
  $("#gb_roll").addEventListener("click",()=>{
    if(buildState.count==="manual"){toast("Manual mode — add exercises below");return;}
    rollMachines(); paintBuilderList(); toast("Re-rolled");
  });
  $("#gb_add").addEventListener("click",()=>openMachinePicker(g));
  $("#gb_start").addEventListener("click",()=>{
    if(!buildState.picked.length){toast("Add at least one exercise");return;}
    const ex=buildState.picked.map(n=>mkExercise(n));
    const title = buildState.sub&&buildState.sub!=="all" ? buildState.sub+" day" : g+" Day";
    closeModal(); startSession(title,"group",ex);
  });
  $("#gb_fav").addEventListener("click",()=>{
    if(!buildState.picked.length){toast("Add at least one exercise first");return;}
    saveFavWorkout(buildState.picked.map(n=>mkExercise(n)),null,"end",g+" Day");
  });
}
function paintBuilderList(){
  const wrap=$("#gb_list"); if(!wrap)return;
  if(!buildState.picked.length){wrap.innerHTML=`<div class="empty">No exercises yet — hit “Add exercise”.</div>`;return;}
  wrap.innerHTML="";
  buildState.picked.forEach((n,i)=>{
    const r=el("div","lrow");
    const sg=subGroupOf(n,EX_BY_NAME[n]?.g||buildState.group);
    r.innerHTML=`<div class="ico">${i+1}</div>
      <div class="main"><div class="t">${esc(n)}</div><div class="s">${EX_BY_NAME[n]?.g||""}${sg?" · "+sg:""}</div></div>`;
    const info=el("button","iconbtn info","ⓘ"); info.addEventListener("click",()=>showHowTo(n));
    const swap=el("button","iconbtn","⇄"); swap.title="Swap"; swap.addEventListener("click",()=>{
      const pool=poolBySub(buildState.group,buildState.sub).filter(x=>!buildState.picked.includes(x));
      if(!pool.length){toast("No other exercises left");return;}
      buildState.picked[i]=shuffle(pool)[0]; paintBuilderList();
    });
    const del=el("button","del","×"); del.addEventListener("click",()=>{buildState.picked.splice(i,1);paintBuilderList();});
    const end=el("div","row"); end.style.gap="6px"; end.append(info,swap,del);
    r.appendChild(end); wrap.appendChild(r);
  });
}
function openMachinePicker(group){
  const inLive = !!liveSession && !buildState;
  const showFW = fwEnabled();
  openModal(`<h3>Add exercise</h3>
    <input class="input" id="mp_search" placeholder="Search…" style="margin:8px 0 4px">
    <div class="row wrap" style="gap:6px;margin-bottom:8px">
      <button class="chip sm gold-chip" data-g="FAV">★ Favourites</button>
      ${showFW?`<button class="chip sm" data-g="FW">🏋️ Free weights</button>`:""}
      ${inLive?`<button class="chip sm" data-g="CARDIO">🏃 Cardio</button>`:""}
      ${GROUPS.map(g=>`<button class="chip sm ${g===group?"on":""}" data-g="${g}">${g}</button>`).join("")}
    </div>
    <div class="search-list" id="mp_list"></div>`);
  let curG=group;
  function addStrength(n){
    if(buildState){ if(!buildState.picked.includes(n))buildState.picked.push(n); if($("#gb_list"))paintBuilderList(); toast("Added "+n); }
    else if(liveSession){ liveSession.exercises.push(mkExercise(n)); renderLive(); toast("Added "+n); }
  }
  function paint(){
    const q=$("#mp_search").value.toLowerCase();
    if(curG==="CARDIO"){
      const list=CARDIO.filter(c=>c.n.toLowerCase().includes(q));
      $("#mp_list").innerHTML=list.map(c=>`<div class="food-opt"><div><div class="fn">${c.ic} ${esc(c.n)}</div><div class="fm">${c.t==="machine"?"Machine cardio":"At-home cardio"}</div></div>
        <button class="btn sm fuel" data-cardio="${esc(c.n)}">Add</button></div>`).join("")||`<div class="empty">No matches</div>`;
      $("#mp_list").querySelectorAll("[data-cardio]").forEach(btn=>btn.addEventListener("click",()=>{
        const c=CARDIO.find(x=>x.n===btn.getAttribute("data-cardio"));
        if(liveSession){ liveSession.exercises.push(mkCardioCard(c)); renderLive(); toast("Added "+c.n); }
      }));
      return;
    }
    let pool;
    if(curG==="FAV") pool=MACHINES.filter(m=>isFavMachine(m.n));
    else if(curG==="FW") pool=FREEWEIGHTS;
    else pool=(showFW?gymExercisesIn(curG):machinesIn(curG));
    const list=pool.filter(m=>m.n.toLowerCase().includes(q));
    $("#mp_list").innerHTML=list.map(m=>`<div class="food-opt" data-n="${esc(m.n)}">
      <div><div class="fn">${esc(m.n)}${m.fw?' <span class="tiny" style="color:var(--gold)">· free weight</span>':''}</div><div class="fm">${m.g}</div></div>
      <div class="row" style="gap:6px">
        <button class="iconbtn info" data-info="${esc(m.n)}">ⓘ</button>
        <button class="iconbtn star ${isFavMachine(m.n)?"on":""}" data-fav="${esc(m.n)}">${isFavMachine(m.n)?"★":"☆"}</button>
        <button class="btn sm str" data-add="${esc(m.n)}">Add</button></div></div>`).join("")||`<div class="empty">${curG==="FAV"?"No favourites yet — tap ☆ to add some.":"No matches"}</div>`;
    $("#mp_list").querySelectorAll("[data-add]").forEach(btn=>btn.addEventListener("click",()=>addStrength(btn.getAttribute("data-add"))));
    $("#mp_list").querySelectorAll("[data-fav]").forEach(btn=>btn.addEventListener("click",()=>{toggleFavMachine(btn.getAttribute("data-fav"));paint();}));
    $("#mp_list").querySelectorAll("[data-info]").forEach(btn=>btn.addEventListener("click",()=>showHowTo(btn.getAttribute("data-info"))));
  }
  $("#mp_search").addEventListener("input",paint);
  $("#modal").querySelectorAll("[data-g]").forEach(b=>b.addEventListener("click",()=>{
    $("#modal").querySelectorAll("[data-g]").forEach(x=>x.classList.remove("on"));b.classList.add("on");curG=b.dataset.g;paint();}));
  paint();
}

/* ===================== HOW-TO ===================== */
function showHowTo(name){
  const m=EX_BY_NAME[name]; if(!m){toast("No guide for this one");return;}
  const h=m.h;
  openModal(`<h3>${esc(m.n)}</h3><div class="eyebrow">${m.g} · ${m.fw?"free weights":"how to use"}</div>
    <div class="howto-block setup"><div class="lab">Set up</div><p>${esc(h.setup)}</p></div>
    <div class="howto-block move"><div class="lab">The movement</div><p>${esc(h.move)}</p></div>
    <div class="howto-block cue"><div class="lab">Form cue</div><p>${esc(h.cue)}</p></div>
    <div class="howto-block avoid"><div class="lab">Avoid</div><p>${esc(h.avoid)}</p></div>
    <button class="btn ${isFavMachine(name)?"gold":"ghost"} block" id="ht_fav" style="margin-top:16px">${isFavMachine(name)?"★ Favourited":"☆ Add to favourites"}</button>
    <button class="btn block" id="ht_close" style="margin-top:10px">Got it</button>`);
  $("#ht_fav").addEventListener("click",()=>{toggleFavMachine(name);showHowTo(name);});
  $("#ht_close").addEventListener("click",closeModal);
}

/* ===================== HOME BUILDER ===================== */
function openHomeBuilder(){
  const sel=new Set(["none"]);
  openModal(`<h3>Home workout</h3>
    <p class="muted tiny" style="margin-bottom:12px">Tick what you've got. We'll pick the best exercises for it.</p>
    <div class="field"><label>Available equipment</label>
      <div class="row wrap" style="gap:8px" id="hb_eq">
       ${HOME_EQUIP.map(e=>`<button class="chip ${e.id==="none"?"on":""}" data-id="${e.id}">${e.label}</button>`).join("")}
      </div></div>
    <div class="field"><label>Focus</label>
      <select class="input" id="hb_focus">
        <option value="Full">Full body</option><option value="Upper">Upper body</option>
        <option value="Lower">Lower body</option><option value="Core">Core</option></select></div>
    <div class="field"><label>How many exercises</label>
      <div class="seg" id="hb_count"><button data-v="4" class="on">4</button><button data-v="6">6</button><button data-v="8">8</button></div></div>
    <button class="btn fuel block" id="hb_go" style="margin-top:6px">Build routine</button>`);
  $("#hb_eq").querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{
    const id=b.dataset.id;
    if(id==="none"){sel.clear();sel.add("none");$("#hb_eq").querySelectorAll("button").forEach(x=>x.classList.toggle("on",x.dataset.id==="none"));return;}
    if(sel.has(id)){sel.delete(id);b.classList.remove("on");}else{sel.add(id);b.classList.add("on");}
    sel.delete("none"); $("#hb_eq").querySelector('[data-id="none"]').classList.remove("on");
    if(!sel.size){sel.add("none");$("#hb_eq").querySelector('[data-id="none"]').classList.add("on");}
  }));
  segBind("hb_count");
  $("#hb_go").addEventListener("click",()=>{
    const focus=$("#hb_focus").value, count=+segVal("hb_count");
    const upper=["Chest","Shoulders","Back","Arms","Triceps","Biceps"];
    const lower=["Legs","Glutes","Hamstrings","Calves"];
    let pool=HOME.filter(h=>h.eq.some(e=>sel.has(e)));
    if(focus==="Upper")pool=pool.filter(h=>upper.includes(h.t)||h.t==="Full Body");
    if(focus==="Lower")pool=pool.filter(h=>lower.includes(h.t)||h.t==="Full Body");
    if(focus==="Core")pool=pool.filter(h=>h.t==="Core");
    /* Full body: no muscle filter (keep all matching equipment) */
    if(!pool.length){toast("No exercises match — add equipment or change focus");return;}
    const chosen=shuffle(pool).slice(0,Math.min(count,pool.length));
    const ex=chosen.map(h=>({name:h.n,group:h.t,home:h,sets:[blankSet()]}));
    closeModal(); startSession("Home · "+focus,"home",ex);
    if(chosen.length<count) toast(`Built ${chosen.length} — that's all that fit your equipment & focus`);
  });
}

/* ===================== MEGA WORKOUT ===================== */
function openMegaBuilder(){
  const st={place:(DATA.prefs.env==="home"?"home":"gym"), mode:"random", groups:new Set(["Chest","Back","Legs"]), perGroup:3,
            homeFocus:"Full", homeCount:6, homeEq:new Set(["none"]),
            doCardio:true, cardioName:"", cardioPos:"end"};
  function cardioPool(){return CARDIO.filter(c=>c.t===(st.place==="gym"?"machine":"home"));}
  function render(){
    const cp=cardioPool();
    if(!st.cardioName && cp.length) st.cardioName=cp[Math.floor(cp.length/3)].n;
    openModal(`<h3>Mega workout 💥</h3>
      <p class="muted tiny" style="margin-bottom:16px">Train several muscle groups and finish with cardio — all in one session.</p>
      <div class="mg-step"><div class="mg-lab">1 · Where are you?</div>
        <div class="seg" id="mg_place"><button data-v="gym" class="${st.place==="gym"?"on":""}">🏋️ Gym</button><button data-v="home" class="${st.place==="home"?"on":""}">🏠 Home</button></div></div>
      <div class="mg-step"><div class="mg-lab">2 · How to pick exercises</div>
        <div class="seg" id="mg_mode"><button data-v="random" class="${st.mode==="random"?"on":""}">🎲 Surprise me</button><button data-v="choose" class="${st.mode==="choose"?"on":""}">✋ I'll choose</button></div>
        <div id="mg_choose" style="margin-top:12px"></div></div>
      <div class="mg-step"><div class="mg-lab">3 · Cardio</div>
        <div class="seg" id="mg_docardio"><button data-v="yes" class="${st.doCardio?"on":""}">Include cardio</button><button data-v="no" class="${!st.doCardio?"on":""}">Skip it</button></div>
        <div id="mg_cardiocfg" style="margin-top:12px"></div></div>
      <div class="mg-preview" id="mg_preview"></div>
      <button class="btn str block" id="mg_build" style="margin-top:8px">Build mega workout</button>`);
    paintChoose(); paintCardioCfg(); paintPreview();
    $("#mg_place").querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{st.place=b.dataset.v;st.cardioName="";render();}));
    $("#mg_mode").querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{st.mode=b.dataset.v;render();}));
    $("#mg_docardio").querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{st.doCardio=b.dataset.v==="yes";render();}));
    $("#mg_build").addEventListener("click",buildMega);
  }
  function paintCardioCfg(){
    const wrap=$("#mg_cardiocfg"); if(!wrap)return;
    if(!st.doCardio){ wrap.innerHTML=""; return; }
    const cp=cardioPool();
    wrap.innerHTML=`<div class="field"><label>${st.mode==="random"?"Cardio (randomised — or pick one)":"Which cardio?"}</label>
        <select class="input" id="mg_cardio">
          ${st.mode==="random"?`<option value="">🎲 Randomised</option>`:""}
          ${cp.map(c=>`<option value="${esc(c.n)}" ${st.cardioName===c.n?"selected":""}>${c.ic} ${esc(c.n)}</option>`).join("")}
        </select></div>
      <div class="field" style="margin-bottom:0"><label>When?</label>
        <div class="seg" id="mg_pos"><button data-v="start" class="${st.cardioPos==="start"?"on":""}">Warm-up (start)</button><button data-v="end" class="${st.cardioPos==="end"?"on":""}">Finisher (end)</button></div></div>`;
    $("#mg_cardio").addEventListener("change",e=>{st.cardioName=e.target.value;paintPreview();});
    $("#mg_pos").querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{
      $("#mg_pos").querySelectorAll("button").forEach(x=>x.classList.remove("on"));b.classList.add("on");st.cardioPos=b.dataset.v;paintPreview();}));
  }
  function paintPreview(){
    const pv=$("#mg_preview"); if(!pv)return;
    let n=0, desc="";
    if(st.place==="gym"){
      const groups = st.mode==="random" ? ["random groups"] : [...st.groups];
      const per = st.perGroup;
      n = st.mode==="random" ? "~6–9" : (st.groups.size*per);
      desc = st.mode==="random" ? "random muscle groups" : (st.groups.size?[...st.groups].join(", "):"no groups yet");
    } else {
      n = st.mode==="random" ? 6 : st.homeCount;
      desc = st.mode==="random" ? "a random home mix" : ("home "+st.homeFocus.toLowerCase());
    }
    const cardioBit = st.doCardio ? ` + ${st.cardioName?st.cardioName:"cardio"} as a ${st.cardioPos==="start"?"warm-up":"finisher"}` : "";
    pv.innerHTML=`<b style="color:var(--text)">${n} exercise${n===1?"":"s"}</b> · ${esc(desc)}${esc(cardioBit)}`;
  }
  function paintChoose(){
    const wrap=$("#mg_choose"); if(!wrap)return;
    if(st.mode==="random"){ wrap.innerHTML=`<p class="muted tiny" style="margin:0">We'll randomly pick the muscle groups${st.place==="gym"?(fwEnabled()?", machines & free weights":" & machines"):" & exercises"}.</p>`; return; }
    if(st.place==="gym"){
      wrap.innerHTML=`<label class="mg-sub">Tap the muscle groups to include</label>
        <div class="row wrap" style="gap:7px;margin-bottom:12px" id="mg_groups">
          ${GROUPS.map(g=>`<button class="chip sm ${st.groups.has(g)?"str on":""}" data-g="${g}">${g}</button>`).join("")}</div>
        <label class="mg-sub">Exercises per group</label>
        <div class="seg" id="mg_per">${[2,3,4,5].map(n=>`<button data-v="${n}" class="${st.perGroup===n?"on":""}">${n}</button>`).join("")}</div>
        ${fwEnabled()?`<p class="muted tiny" style="margin:8px 0 0">Free weights are included with machines (your gym setting).</p>`:""}`;
      $("#mg_groups").querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{
        const g=b.dataset.g; if(st.groups.has(g)){st.groups.delete(g);b.classList.remove("str","on");}else{st.groups.add(g);b.classList.add("str","on");} paintPreview();}));
      $("#mg_per").querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{
        $("#mg_per").querySelectorAll("button").forEach(x=>x.classList.remove("on"));b.classList.add("on");st.perGroup=+b.dataset.v;paintPreview();}));
    } else {
      wrap.innerHTML=`<label class="mg-sub">Equipment you have</label>
        <div class="row wrap" style="gap:7px;margin-bottom:12px" id="mg_eq">${HOME_EQUIP.map(e=>`<button class="chip sm ${st.homeEq.has(e.id)?"on":""}" data-id="${e.id}">${e.label}</button>`).join("")}</div>
        <label class="mg-sub">Focus</label>
        <div class="seg" id="mg_focus2" style="margin-bottom:12px">${["Full","Upper","Lower","Core"].map(f=>`<button data-v="${f}" class="${st.homeFocus===f?"on":""}">${f}</button>`).join("")}</div>
        <label class="mg-sub">How many exercises</label>
        <div class="seg" id="mg_hc">${[4,6,8,10].map(n=>`<button data-v="${n}" class="${st.homeCount===n?"on":""}">${n}</button>`).join("")}</div>`;
      $("#mg_eq").querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{
        const id=b.dataset.id;
        if(id==="none"){st.homeEq.clear();st.homeEq.add("none");}
        else{if(st.homeEq.has(id))st.homeEq.delete(id);else st.homeEq.add(id);st.homeEq.delete("none");}
        if(!st.homeEq.size)st.homeEq.add("none"); paintChoose();}));
      $("#mg_focus2").querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{
        $("#mg_focus2").querySelectorAll("button").forEach(x=>x.classList.remove("on"));b.classList.add("on");st.homeFocus=b.dataset.v;paintPreview();}));
      $("#mg_hc").querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{
        $("#mg_hc").querySelectorAll("button").forEach(x=>x.classList.remove("on"));b.classList.add("on");st.homeCount=+b.dataset.v;paintPreview();}));
    }
  }
  function buildMega(){
    let exercises=[], title="";
    if(st.place==="gym"){
      let groups = st.mode==="random" ? shuffle(GROUPS).slice(0,2+Math.floor(Math.random()*2)) : [...st.groups];
      if(!groups.length){toast("Pick at least one muscle group");return;}
      const per = st.mode==="random" ? 2+Math.floor(Math.random()*2) : st.perGroup;
      groups.forEach(g=>{ shuffle(gymPoolNames(g)).slice(0,per).forEach(n=>exercises.push(mkExercise(n))); });
      title="Mega · "+groups.join("/");
    } else {
      const upper=["Chest","Shoulders","Back","Arms","Triceps","Biceps"], lower=["Legs","Glutes","Hamstrings","Calves"];
      let pool=HOME.filter(h=>h.eq.some(e=>st.homeEq.has(e)));
      const focus = st.mode==="random" ? "Full" : st.homeFocus;
      if(focus==="Upper")pool=pool.filter(h=>upper.includes(h.t)||h.t==="Full Body");
      if(focus==="Lower")pool=pool.filter(h=>lower.includes(h.t)||h.t==="Full Body");
      if(focus==="Core")pool=pool.filter(h=>h.t==="Core");
      if(!pool.length){toast("No exercises match — add equipment");return;}
      const cnt = st.mode==="random" ? 6 : st.homeCount;
      shuffle(pool).slice(0,Math.min(cnt,pool.length)).forEach(h=>exercises.push({name:h.n,group:h.t,home:h,sets:[blankSet()]}));
      title="Mega · Home "+focus;
    }
    if(st.doCardio){
      let act=null; const cp=cardioPool();
      if(st.mode==="random" && !st.cardioName) act=cp[Math.floor(Math.random()*cp.length)];
      else if(st.cardioName) act=CARDIO.find(c=>c.n===st.cardioName);
      if(act){ const cc=mkCardioCard(act); if(st.cardioPos==="start")exercises=[cc,...exercises]; else exercises=[...exercises,cc]; }
    }
    if(!exercises.length){toast("Nothing to build — check your choices");return;}
    closeModal(); startSession(title,"mega",exercises);
  }
  render();
}

/* ===================== LIVE TRACKER ===================== */
let liveSession=null; /* {title,type,exercises,restSec,startedAt} */
const LIVE_KEY="evolve_live_v1";
function persistLive(){ try{ if(liveSession&&liveSession.exercises&&liveSession.exercises.length){ localStorage.setItem(LIVE_KEY, JSON.stringify(liveSession)); } }catch(e){} }
function clearLive(){ try{ localStorage.removeItem(LIVE_KEY); }catch(e){} }
function loadLive(){ try{ const s=localStorage.getItem(LIVE_KEY); return s?JSON.parse(s):null; }catch(e){ return null; } }
function resumeLive(saved){
  buildState=null; liveSession=saved; stopRest();
  $("#live").classList.add("on");
  $("#liveTitle").textContent=saved.title||"Workout";
  renderLive();
}
/* offered on app open if a workout was left unfinished */
function maybeResumeWorkout(){
  const saved=loadLive();
  if(!saved || !saved.exercises || !saved.exercises.length){ clearLive(); return; }
  const mins = saved.startedAt ? Math.round((Date.now()-saved.startedAt)/60000) : 0;
  const done = saved.exercises.reduce((a,ex)=>a+((ex.sets||[]).filter(s=>s.done).length),0);
  openModal(`<h3>Resume your workout?</h3>
    <p class="muted" style="margin:2px 0 16px;font-size:14px;line-height:1.5">You left <b style="color:var(--text)">${esc(saved.title||"a workout")}</b> unfinished${mins>0&&mins<1440?` about ${mins} min ago`:""}${done?` — ${done} set${done===1?"":"s"} logged`:""}. Pick up where you left off, or discard it.</p>
    <button class="btn str block" id="rw_resume">Resume workout</button>
    <button class="btn block" id="rw_discard" style="margin-top:10px">Discard it</button>`);
  $("#rw_resume").addEventListener("click",()=>{ closeModal(); resumeLive(saved); });
  $("#rw_discard").addEventListener("click",()=>{ clearLive(); closeModal(); toast("Discarded"); });
}
function startSession(title,type,exercises){
  buildState=null; /* clear any leftover builder so Add-exercise targets the live session */
  liveSession={title,type,exercises,restSec:90,startedAt:Date.now()};
  stopRest();
  $("#live").classList.add("on");
  $("#liveTitle").textContent=title;
  renderLive();
  persistLive();
}
$("#liveClose").addEventListener("click",()=>{
  if(!liveSession){ stopRest(); $("#live").classList.remove("on"); return; }
  const hasData = liveSession.exercises.some(ex=>ex.cardio || (ex.sets||[]).some(s=>s.done||+s.kg>0||+s.reps>0));
  confirmModal({title:"Leave this workout?",danger:true,confirmText:"Leave",
    body:hasData?"Anything you've logged won't be saved. Tap “Finish” instead to keep it.":"You'll lose this session. Tap “Finish” to save it instead.",
    onConfirm:()=>{ stopRest(); $("#live").classList.remove("on"); liveSession=null; clearLive(); }});
});
$("#liveFinish").addEventListener("click",finishWorkout);
$("#liveFav").addEventListener("click",()=>{
  if(!liveSession){return;}
  const cardioCard=liveSession.exercises.find(e=>e.cardio);
  const cardio=cardioCard?cardioCard.activity:null;
  const pos=cardioCard&&liveSession.exercises[0]&&liveSession.exercises[0].cardio?"start":"end";
  saveFavWorkout(liveSession.exercises, cardio, pos, liveSession.title);
});

function updateLiveProg(){
  if(!liveSession)return;
  let tot=0,done=0;
  liveSession.exercises.forEach(e=>{ if(e.cardio)return; (e.sets||[]).forEach(st=>{tot++; if(st.done)done++;}); });
  const n=$("#lp_num"), bar=$("#lp_bar");
  if(n)n.textContent=`${done} / ${tot} sets`;
  if(bar)bar.style.width=(tot?Math.round(done/tot*100):0)+"%";
}
function ssMembers(xi){
  const ex=liveSession.exercises[xi]; if(!ex||!ex.ss)return null;
  const idx=liveSession.exercises.map((e,i)=>e.ss===ex.ss?i:-1).filter(i=>i>=0);
  return {group:ex.ss, idx, isFirst:idx[0]===xi, isLast:idx[idx.length-1]===xi};
}
function toggleSuperset(xi){
  const a=liveSession.exercises[xi], b2=liveSession.exercises[xi+1];
  if(!a||!b2||a.cardio||b2.cardio)return;
  if(a.ss && a.ss===b2.ss){ /* unlink: clear both (and any wider group stays only if 3+, keep simple) */
    const g=a.ss; liveSession.exercises.forEach(e=>{if(e.ss===g)delete e.ss;});
  } else {
    const g=a.ss||b2.ss||("ss"+Date.now()); a.ss=g; b2.ss=g;
  }
  renderLive();
}
function swapExercise(xi){
  const ex=liveSession.exercises[xi]; if(!ex||ex.cardio)return;
  const g=ex.group;
  const alts=(fwEnabled()?gymPoolNames(g):machinesIn(g).map(m=>m.n)).filter(n=>n!==ex.name);
  if(!alts.length){toast("No alternatives for this muscle");return;}
  const list=shuffle(alts).slice(0,6);
  openModal(`<h3>Swap exercise ${infoBtn("swap")}</h3>
    <p class="muted tiny" style="margin-bottom:12px">Machine taken? Pick a ${g} alternative — your sets so far stay.</p>
    <div class="search-list">${list.map(n=>`<div class="food-opt"><div><div class="fn">${esc(n)}</div><div class="fm">${EX_BY_NAME[n]?.g||g}</div></div><button class="btn sm str" data-sw="${esc(n)}">Swap in</button></div>`).join("")}</div>`);
  bindInfo($("#modal"));
  $("#modal").querySelectorAll("[data-sw]").forEach(btn=>btn.addEventListener("click",()=>{
    const n=btn.getAttribute("data-sw"); const m=EX_BY_NAME[n];
    ex.name=n; ex.group=m?m.g:g; delete ex.home; closeModal(); renderLive(); toast("Swapped to "+n);
  }));
}
function openExerciseRest(ex){
  openModal(`<h3>Rest for this exercise ${infoBtn("exrest")}</h3>
    <p class="muted tiny" style="margin-bottom:12px">Override your default rest just for ${esc(ex.name)}.</p>
    <div class="seg" id="er_seg" style="flex-wrap:wrap">${[0,45,60,90,120,180,240].map(s=>`<button data-v="${s}" class="${(ex.restSec!=null?ex.restSec:'')===s?'on':''}">${s===0?"Off":s+"s"}</button>`).join("")}</div>
    <button class="btn ghost block" id="er_clear" style="margin-top:12px">Use default (${liveSession.restSec}s)</button>`);
  bindInfo($("#modal"));
  $("#er_seg").querySelectorAll("button").forEach(b=>b.addEventListener("click",()=>{ex.restSec=+b.dataset.v;save();closeModal();toast("Rest set to "+(+b.dataset.v===0?"off":b.dataset.v+"s")+" for "+ex.name);}));
  $("#er_clear").addEventListener("click",()=>{delete ex.restSec;closeModal();toast("Using default rest");});
}
function openPlateCalc(ex){
  const bar=20, plates=[25,20,15,10,5,2.5,1.25];
  let target = ex.sets.map(s=>+s.kg||0).filter(Boolean).pop() || 60;
  function paint(){
    let perSide=(target-bar)/2; const used=[];
    if(perSide<0)perSide=0;
    let rem=perSide; plates.forEach(p=>{ while(rem>=p-1e-9){used.push(p);rem=Math.round((rem-p)*100)/100;} });
    const colors={25:"#e23b3b",20:"#2f7de2",15:"#e2a52f",10:"#2fb84a","5":"#dcdce2","2.5":"#9aa0ad","1.25":"#6b7280"};
    const vis=used.length?used.map(p=>`<span class="plate" style="background:${colors[p]||'#888'};height:${34+p*1.4}px">${p}</span>`).join(""):`<span class="muted tiny">Just the bar</span>`;
    openModal(`<h3>Plate calculator ${infoBtn("plates")}</h3>
      <div class="field"><label>Target weight (total, kg)</label>
        <input class="input num" id="pc_t" type="number" inputmode="decimal" value="${target}"></div>
      <div class="muted tiny">Olympic bar ${bar}kg · load each side:</div>
      <div class="plate-vis">${vis}</div>
      <div class="center" style="font-weight:700">Each side: ${used.length?used.join(" + ")+" kg":"—"}</div>
      ${rem>0.01?`<div class="center tiny" style="color:var(--gold);margin-top:6px">Closest with standard plates (${Math.round(rem*100)/100}kg short)</div>`:""}
      <button class="btn block" id="pc_ok" style="margin-top:16px">Done</button>`);
    bindInfo($("#modal"));
    $("#pc_t").addEventListener("change",e=>{target=+e.target.value||bar;paint();});
    $("#pc_ok").addEventListener("click",closeModal);
  }
  paint();
}
function genWarmups(ex){
  const work=ex.sets.find(s=>!s.warmup && +s.kg>0);
  if(!work){toast("Enter your first working weight first");return;}
  const top=+work.kg;
  const scheme=[[0.5,8],[0.7,5],[0.85,3]];
  const warm=scheme.map(([pct,reps])=>({kg:Math.round((top*pct)/2.5)*2.5, reps, done:false, warmup:true}));
  ex.sets=warm.concat(ex.sets.filter(s=>!s.warmup));
  renderLive(); toast("Added "+warm.length+" warm-up sets");
}
function renderLive(){
  const body=$("#liveBody"); body.innerHTML="";

  /* sticky header: single rest control + always-visible session progress */
  const sticky=el("div","live-sticky");
  const rest=el("div","rest-pick");
  rest.innerHTML=`<span class="rp-lab">Rest between sets · auto-starts when you tick a set</span>`;
  const seg=el("div","rp-chips"); seg.style.marginTop="8px";
  [0,30,60,90,120,180].forEach(s=>{const bn=el("button","rp-chip"+(liveSession.restSec===s?" on":""),s===0?"Off":s+"s");
    bn.addEventListener("click",()=>{liveSession.restSec=s; seg.querySelectorAll(".rp-chip").forEach(x=>x.classList.remove("on"));bn.classList.add("on");});
    seg.appendChild(bn);});
  rest.appendChild(seg); sticky.appendChild(rest);
  const prog=el("div"); prog.innerHTML=`<div class="lp2"><span class="l">Session progress</span><span class="n" id="lp_num"></span></div>
    <div class="bar"><i id="lp_bar" style="background:var(--grad-str)"></i></div>`;
  sticky.appendChild(prog);
  body.appendChild(sticky);
  updateLiveProg();

  const strengthN = liveSession.exercises.filter(e=>!e.cardio).length;
  let strengthI = 0;
  liveSession.exercises.forEach((ex,xi)=>{
    if(ex.cardio){ body.appendChild(buildCardioLiveCard(ex,xi)); return; }
    const ss=ssMembers(xi);
    const nx=liveSession.exercises[xi+1], pv=liveSession.exercises[xi-1];
    const linkedNext = nx && !nx.cardio && ex.ss && ex.ss===nx.ss;
    const linkedPrev = pv && !pv.cardio && ex.ss && ex.ss===pv.ss;
    const wrap=el("div","ex-wrap"+(ss?" linked":"")+(linkedPrev?" linked-prev":""));
    const c=el("div","ex-card"+(ss?" ss":""));
    strengthI++;
    c.appendChild(el("div","exi",`Exercise ${strengthI} of ${strengthN}${ex.group?" · "+esc(ex.group):""}`));
    const head=el("div","eh");
    head.innerHTML=`<div class="nm">${esc(ex.name)}${ss?`<span class="ss-badge">Superset</span>`:""}</div>`;
    const more=el("button","more","⋯"); more.title="More"; more.addEventListener("click",()=>openExerciseMenu(ex,xi));
    head.append(more); c.appendChild(head);

    /* ghost text hint */
    const last=lastSetFor(ex.name);
    if(last && (+last.kg>0||+last.reps>0)){
      const gh=el("div","ghost-hint"); gh.innerHTML=`👻 Last time: ${last.kg?liftStr(+last.kg):"—"} × ${last.reps||"—"} reps`;
      c.appendChild(gh);
    }
    if(ex.home){ const tip=el("div","ex-tip"); tip.textContent="Suggested: "+ex.home.reps; c.appendChild(tip); }

    c.appendChild(buildSetList(ex,xi));

    const add=el("button","btn ghost add-set","＋ Add set");
    add.addEventListener("click",()=>{
      const ns=blankSet(ex.sets[ex.sets.length-1]); ex.sets.push(ns); ex._active=ex.sets.length-1;
      renderLive();
    });
    c.appendChild(add);

    /* superset link — lives ON the card (footer), never floating between */
    if(nx && !nx.cardio){
      const foot=el("div","ss-foot");
      const lb=el("button","",linkedNext?"🔗 Linked with next · tap to unlink":"🔗 Superset with next exercise");
      lb.addEventListener("click",()=>toggleSuperset(xi));
      foot.appendChild(lb); c.appendChild(foot);
    }
    wrap.appendChild(c); body.appendChild(wrap);
    if(linkedNext){
      const conn=el("div","ss-connector");
      conn.innerHTML=`<span class="ln"></span>🔗 superset · no rest between<span class="ln"></span>`;
      body.appendChild(conn);
    }
  });

  const addEx=el("button","btn block add-ex","＋ Add exercise");
  addEx.addEventListener("click",()=>{
    const g=liveSession.exercises.find(e=>!e.cardio)?.group||"Chest";
    openMachinePicker(GROUPS.includes(g)?g:"Chest");
  });
  body.appendChild(addEx);
  persistLive();
}

/* a compact, scannable set list: done rows collapse, the current set expands,
   upcoming sets sit dimmed, and completing one auto-advances to the next. */
function buildSetList(ex,xi){
  const wrap=el("div","setlist");
  function activeIdx(){
    if(ex._active!=null && ex.sets[ex._active] && !ex.sets[ex._active].done) return ex._active;
    return ex.sets.findIndex(s=>!s.done);
  }
  function paint(){
    wrap.innerHTML="";
    const hdr=el("div","sl-head"); hdr.innerHTML=`<span>Set</span><span>Weight</span><span>Reps</span><span>✓</span>`; wrap.appendChild(hdr);
    const act=activeIdx();
    const last=lastSetFor(ex.name);
    ex.sets.forEach((st,si)=>{
      if(st.done){
        const r=el("div","sl-row done");
        r.innerHTML=`<span class="sn">${st.warmup?"W":si+1}</span><span class="v num">${liftStr(+st.kg||0)}</span><span class="v num">${st.reps||0}</span><span class="chk">✓</span>`;
        r.addEventListener("click",()=>{ st.done=false; ex._active=si; paint(); updateLiveProg(); persistLive(); });
        wrap.appendChild(r);
      } else if(si===act){
        const r=el("div","sl-row active");
        const ah=el("div","sl-ah"); ah.innerHTML=`<span class="sn">${st.warmup?"Warm-up":"Set "+(si+1)}</span><span class="now">· now</span>`; r.appendChild(ah);
        const steps=el("div","sl-steps");
        const kgDisp=(st.kg===""||st.kg==null)?"":liftRound(liftFromKg(+st.kg));
        const kgPh = last&&+last.kg>0 ? String(liftRound(liftFromKg(+last.kg))) : "0";
        const repPh = last&&+last.reps>0 ? String(last.reps) : "0";
        steps.appendChild(stepper(liftLbl(), kgDisp, liftStep(), v=>{ st.kg=(v===""||v==null)?"":kgFromLift(+v); }, kgPh));
        steps.appendChild(stepper("REPS", st.reps, 1, v=>st.reps=v, repPh));
        r.appendChild(steps);
        if(!st.warmup){
          const rir=el("div","sl-rir"); rir.innerHTML=`<span class="rl">Effort · RIR ${infoBtn("rir")}</span>`;
          [["0","0"],["1","1"],["2","2"],["3","3+"],["F","Fail"]].forEach(([v,lbl])=>{
            const chip=el("button","rir-chip"+(st.rir===v?" on":""),lbl);
            chip.addEventListener("click",()=>{ st.rir=(st.rir===v?null:v); rir.querySelectorAll(".rir-chip").forEach(x=>x.classList.remove("on")); if(st.rir===v)chip.classList.add("on"); persistLive(); });
            rir.appendChild(chip);
          });
          r.appendChild(rir); bindInfo(rir);
        }
        const comp=el("button","sl-complete","✓  Complete set "+(si+1));
        comp.addEventListener("click",()=>{
          if(st.reps===""||st.reps==null||+st.reps===0){ st.reps = last&&last.reps?last.reps:(+st.reps||0); }
          st.done=true;
          const ssm=ssMembers(xi); const rsec=(ex.restSec!=null?ex.restSec:liveSession.restSec);
          const skip = ssm && !ssm.isLast;
          if(!skip && rsec>0) startRest(rsec);
          if(navigator.vibrate) try{navigator.vibrate(12);}catch(e){}
          const nxt=ex.sets.findIndex((s,i)=>i>si && !s.done); ex._active = nxt>=0?nxt:null;
          paint(); updateLiveProg(); persistLive();
        });
        r.appendChild(comp);
        wrap.appendChild(r);
      } else {
        const r=el("div","sl-row todo");
        const tgt = (st.reps&&+st.reps>0) ? st.reps : (last&&last.reps?("target "+last.reps):"—");
        r.innerHTML=`<span class="sn">${st.warmup?"W":si+1}</span><span class="v num">${(+st.kg>0)?liftStr(+st.kg):"—"}</span><span class="v num">${tgt}</span><span class="chk"></span>`;
        r.addEventListener("click",()=>{ ex._active=si; paint(); });
        wrap.appendChild(r);
      }
    });
  }
  paint();
  return wrap;
}

/* per-exercise actions, consolidated into one ⋯ menu instead of a crowded tools row */
function openExerciseMenu(ex,xi){
  const isFW=FW_BY_NAME[ex.name];
  openModal(`<h3 style="margin-bottom:14px">${esc(ex.name)}</h3>
    <div class="menu-list">
      <button class="menu-item" data-a="fav">${isFav(ex.name)?"★ Remove from favourites":"☆ Save as favourite"}</button>
      <button class="menu-item" data-a="info">ⓘ How to perform</button>
      ${!ex.home?`<button class="menu-item" data-a="swap">🔄 Swap exercise</button>`:""}
      <button class="menu-item" data-a="warm">🔥 Add warm-up sets</button>
      ${isFW?`<button class="menu-item" data-a="plates">⚖️ Plate calculator</button>`:""}
      <button class="menu-item" data-a="rest">⏱️ Rest for this exercise${ex.restSec!=null?` · ${ex.restSec===0?"off":ex.restSec+"s"}`:""}</button>
      <button class="menu-item danger" data-a="remove">× Remove exercise</button>
    </div>`);
  const act=(a)=>{
    if(a==="fav"){ toggleFav(ex.name); closeModal(); renderLive(); return; }
    if(a==="info"){ closeModal(); ex.home?showHomeHowTo(ex.home):showHowTo(ex.name); return; }
    if(a==="swap"){ closeModal(); swapExercise(xi); return; }
    if(a==="warm"){ closeModal(); genWarmups(ex); return; }
    if(a==="plates"){ closeModal(); openPlateCalc(ex); return; }
    if(a==="rest"){ closeModal(); openExerciseRest(ex); return; }
    if(a==="remove"){ closeModal(); removeLiveExercise(xi); return; }
  };
  $("#modal").querySelectorAll("[data-a]").forEach(btn=>btn.addEventListener("click",()=>act(btn.dataset.a)));
}

/* remove an exercise from the live session, with confirmation */
function removeLiveExercise(xi){
  const ex=liveSession.exercises[xi]; if(!ex)return;
  const nm = ex.cardio ? (ex.name||"this cardio") : (ex.name||"this exercise");
  const logged = !ex.cardio && (ex.sets||[]).some(s=>s.done);
  confirmModal({title:"Remove exercise?",danger:true,confirmText:"Remove",
    body:`Remove ${nm} from this workout?${logged?" Any sets you've ticked off for it will be lost.":""}`,
    onConfirm:()=>{ liveSession.exercises.splice(xi,1); renderLive(); toast("Removed"); }});
}
/* a single roomy set block with KG / REPS steppers + RIR (updates in place) */
function setSummary(ex,st){
  const kg = (st.kg!==""&&st.kg!=null) ? liftStr(+st.kg) : "";
  const reps = (st.reps!==""&&st.reps!=null&&+st.reps>0) ? (+st.reps) : "";
  if(kg&&reps!=="") return `${kg} × ${reps}`;
  if(kg) return kg;
  if(reps!=="") return `${reps} reps`;
  return "";
}
function buildSetBlock(ex,st,si){
  const block=el("div","set-block");
  function paint(){
    block.className="set-block"+(st.done?" done":"")+(st.warmup?" warmup":"");
    block.innerHTML="";
    const head=el("div","sb-top");
    head.innerHTML=`<span class="sl">${st.warmup?"WARM-UP":"SET "+(si+1)}${st.warmup?'<span class="warm-tag">prep</span>':""}</span>`;
    block.appendChild(head);

    if(st.done){
      /* compact, tidy summary once logged */
      const sum=el("div","sb-summary");
      const s=setSummary(ex,st);
      sum.innerHTML=`<span class="sv">${s||"Completed ✓"}</span>${(st.rir&&!st.warmup)?`<span class="sb-rir">RIR ${st.rir==="F"?"Failure":st.rir}</span>`:""}`;
      block.appendChild(sum);
      const btn=el("button","sb-complete done","✓  Done · tap to edit");
      btn.addEventListener("click",()=>{ st.done=false; paint(); updateLiveProg(); persistLive(); });
      block.appendChild(btn);
      return;
    }

    /* edit view: weight → reps → effort → complete (natural top-to-bottom flow) */
    const grid=el("div","sb-grid");
    const kgDisp = (st.kg===""||st.kg==null) ? "" : liftRound(liftFromKg(+st.kg));
    const last=lastSetFor(ex.name);
    const kgPh = last&&+last.kg>0 ? String(liftRound(liftFromKg(+last.kg))) : "0";
    const repPh = last&&+last.reps>0 ? String(last.reps) : "0";
    grid.appendChild(stepper(liftLbl(), kgDisp, liftStep(), v=>{ st.kg = (v===""||v==null||v==="") ? "" : kgFromLift(+v); }, kgPh));
    grid.appendChild(stepper("REPS", st.reps, 1, v=>st.reps=v, repPh));
    block.appendChild(grid);

    if(!st.warmup){
      const rir=el("div","rir-row");
      rir.innerHTML=`<span class="rl">EFFORT · RIR ${infoBtn("rir")}</span>`;
      [["0","0"],["1","1"],["2","2"],["3","3+"],["F","Fail"]].forEach(([v,lbl])=>{
        const chip=el("button","rir-chip"+(st.rir===v?" on":""),lbl);
        chip.addEventListener("click",()=>{ st.rir=(st.rir===v?null:v); rir.querySelectorAll(".rir-chip").forEach(x=>x.classList.remove("on")); if(st.rir===v)chip.classList.add("on"); });
        rir.appendChild(chip);
      });
      block.appendChild(rir); bindInfo(rir);
    }

    const btn=el("button","sb-complete","◯  Complete set");
    btn.addEventListener("click",()=>{
      st.done=true;
      const ss=ssMembers(liveSession.exercises.indexOf(ex));
      const rsec=(ex.restSec!=null?ex.restSec:liveSession.restSec);
      const skip = ss && !ss.isLast; /* superset: rest only after last member */
      if(!skip && rsec>0) startRest(rsec);
      if(navigator.vibrate) try{navigator.vibrate(12);}catch(e){}
      paint(); updateLiveProg(); persistLive();
    });
    block.appendChild(btn);
  }
  paint();
  return block;
}
function stepper(cap,val,step,onset,ph){
  const wrap=el("div","stepper");
  wrap.innerHTML=`<div class="cap">${cap}</div>`;
  const ctl=el("div","ctl");
  const minus=el("button","",""); minus.textContent="–";
  const inp=el("input"); inp.type="number"; inp.inputMode="decimal"; inp.value=val; inp.placeholder=ph||"0";
  const plus=el("button","",""); plus.textContent="+";
  const setv=v=>{ if(v<0)v=0; v=Math.round(v*100)/100; inp.value=v===0?"":v; onset(inp.value); };
  holdRepeat(minus,()=>setv((+inp.value||0)-step));
  holdRepeat(plus,()=>setv((+inp.value||0)+step));
  inp.addEventListener("input",()=>onset(inp.value));
  ctl.append(minus,inp,plus); wrap.appendChild(ctl);
  return wrap;
}
function showHomeHowTo(h){
  openModal(`<h3>${esc(h.n)}</h3><div class="eyebrow">${h.t} · how to</div>
    <div class="howto-block move"><div class="lab">How to do it</div><p>${esc(h.d)}</p></div>
    <div class="howto-block cue"><div class="lab">Suggested</div><p>${esc(h.reps)}</p></div>
    <button class="btn block" id="ht_close" style="margin-top:16px">Got it</button>`);
  $("#ht_close").addEventListener("click",closeModal);
}

/* ---------- REST TIMER ---------- */
let restState=null, restTick=null, audioCtx=null;
function unlockAudio(){
  try{
    audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();
    if(audioCtx.state==="suspended")audioCtx.resume();
    const o=audioCtx.createOscillator(),g=audioCtx.createGain();
    g.gain.value=0; o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime+0.01);
  }catch(e){}
}
function startRest(sec){
  stopRest();
  restState={total:sec,left:sec};
  $("#restBar").classList.remove("hidden");
  paintRest();
  restTick=setInterval(()=>{
    restState.left--; 
    if(restState.left<=0){ stopRest(); restAlert(); }
    else paintRest();
  },1000);
}
function paintRest(){
  const s=restState; if(!s)return;
  const pct=s.left/s.total;
  $("#restBar").innerHTML=`<div class="rest-card">
     <div class="rest-ring">${ringSVG(pct,"#FF6A2C",62)}<div class="t">${s.left}</div></div>
     <div class="ri"><div class="l">Resting</div><div class="b">${s.left}s of ${s.total}s</div></div>
     <button class="btn sm" id="rest_add">+15s</button>
     <button class="btn sm str" id="rest_skip">Skip</button></div>`;
  $("#rest_add").addEventListener("click",()=>{restState.left+=15;restState.total+=15;paintRest();});
  $("#rest_skip").addEventListener("click",stopRest);
}
function stopRest(){ if(restTick)clearInterval(restTick); restTick=null; restState=null; const rb=$("#restBar"); if(rb){rb.classList.add("hidden");rb.innerHTML="";} }
function restAlert(){
  flashScreen();
  beep();
  toast("Rest over — next set 💪");
}
function flashScreen(){const f=$("#flash");f.classList.remove("go");void f.offsetWidth;f.classList.add("go");}
function beep(){
  try{
    audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();
    if(audioCtx.state==="suspended")audioCtx.resume();
    const now=audioCtx.currentTime;
    [0,0.28,0.56].forEach(t=>{
      const o=audioCtx.createOscillator(),g=audioCtx.createGain();
      o.type="sine"; o.frequency.value=880;
      g.gain.setValueAtTime(0.0001,now+t);
      g.gain.exponentialRampToValueAtTime(0.4,now+t+0.02);
      g.gain.exponentialRampToValueAtTime(0.0001,now+t+0.22);
      o.connect(g).connect(audioCtx.destination); o.start(now+t); o.stop(now+t+0.24);
    });
  }catch(e){}
}

/* ---------- FINISH & SAVE ---------- */
function finishWorkout(){
  const s=liveSession; if(!s)return;
  let doneSets=0;
  s.exercises.forEach(ex=>ex.sets.forEach(st=>{ if(st.done && !st.warmup && +st.kg>0 && +st.reps>0) doneSets++; }));
  if(doneSets===0){
    confirmModal({title:"Finish with no sets?",confirmText:"Finish anyway",
      body:"You haven't ticked any sets as done, so this won't count volume or PRs.",
      onConfirm:()=>saveWorkout(s)});
    return;
  }
  saveWorkout(s);
}
function saveWorkout(s){
  let volume=0; const prs=[];
  s.exercises.forEach(ex=>{
    let best=0;
    ex.sets.forEach(st=>{ if(st.done && !st.warmup && +st.kg>0 && +st.reps>0){ volume+=(+st.kg)*(+st.reps); best=Math.max(best,+st.kg);} });
    if(best>0){
      const prev=DATA.ach.prs[ex.name]||0;
      if(best>prev){ DATA.ach.prs[ex.name]=best; if(prev>0)prs.push({name:ex.name,kg:best,prev}); }
      else if(!(ex.name in DATA.ach.prs)){ DATA.ach.prs[ex.name]=best; }
    }
  });
  let topKg=0, topName="";
  s.exercises.forEach(ex=>ex.sets.forEach(st=>{ if(st.done&&!st.warmup&&+st.kg>topKg){topKg=+st.kg;topName=ex.name;} }));
  const wk={id:Date.now(),date:todayISO(),title:s.title,type:s.type,
    durationMin: s.startedAt?Math.max(1,Math.round((Date.now()-s.startedAt)/60000)):null,
    topKg, topName,
    exercises:s.exercises.filter(e=>!e.cardio).map(e=>({name:e.name,group:e.group,sets:e.sets.filter(x=>x.done).map(x=>({kg:+x.kg||0,reps:+x.reps||0,warmup:!!x.warmup,rir:x.rir||null}))})),
    volume,prs};
  DATA.workouts.push(wk);
  DATA.ach.workoutsDone++;
  DATA.ach.totalVolume+=volume;
  updateStreak(wk.date);
  /* mark planned day complete */
  if(plannedDayRef && DATA.weeklyPlan && DATA.weeklyPlan.days[plannedDayRef.dn]){
    DATA.weeklyPlan.days[plannedDayRef.dn].done=true;
  }
  plannedDayRef=null;
  const newBadges=checkBadges();
  save();
  stopRest(); $("#live").classList.remove("on"); liveSession=null; clearLive();
  switchTab("home");
  showFinishSummary(wk,prs,newBadges);
}
function updateStreak(date){
  const last=DATA.ach.lastWorkoutDate;
  if(last===date){/* same day, keep streak */}
  else{
    const y=new Date(date); y.setDate(y.getDate()-1); const yISO=todayISO(y);
    if(last===yISO) DATA.ach.streak++;
    else DATA.ach.streak=1;
    DATA.ach.lastWorkoutDate=date;
  }
  DATA.ach.bestStreak=Math.max(DATA.ach.bestStreak,DATA.ach.streak);
}
function showFinishSummary(wk,prs,badges){
  const showAch=DATA.prefs.showAchievements!==false;
  openModal(`<div class="fin-hero"><div class="fin-check">✓</div>
      <div class="fin-t">Workout complete</div>
      <div class="fin-s">${esc(wk.title)}${wk.durationMin?` · ${wk.durationMin} min`:""}</div></div>
    <div class="grid2" style="margin:14px 0 12px">
      <div class="stat"><div class="k">Volume</div><div class="v num">${volStr(wk.volume)}</div></div>
      <div class="stat"><div class="k">Exercises</div><div class="v">${wk.exercises.length}</div></div>
    </div>
    ${showAch&&prs.length?`<div class="banner"><div class="bx">🏅 <b>${prs.length} new personal record${prs.length>1?"s":""}!</b><br>${prs.map(p=>esc(p.name)+" — "+liftStr(p.kg)).join("<br>")}</div></div>`:""}
    ${showAch&&badges.length?`<div class="banner"><div class="bx">${badges.map(b=>b.icon+" <b>"+b.t+"</b> unlocked").join("<br>")}</div></div>`:""}
    <p class="muted tiny" style="margin:6px 0 14px">${showAch?`Current streak: ${dispWorkoutStreak()} day${dispWorkoutStreak()===1?"":"s"} · ${dispWorkouts()} total workouts`:`${dispWorkouts()} total workouts logged`}</p>
    <button class="btn str block" id="fs_close">Done</button>
    <button class="btn ghost block" id="fs_share" style="margin-top:10px">📸 Share summary card</button>`);
  $("#fs_close").addEventListener("click",closeModal);
  $("#fs_share").addEventListener("click",()=>makeFlexCard(wk,prs,badges));
}
function rr(x,X,Y,w,h,r){x.beginPath();x.moveTo(X+r,Y);x.arcTo(X+w,Y,X+w,Y+h,r);x.arcTo(X+w,Y+h,X,Y+h,r);x.arcTo(X,Y+h,X,Y,r);x.arcTo(X,Y,X+w,Y,r);x.closePath();}
function makeFlexCard(wk,prs,badges){
  const draw=()=>{
  const W=1080,H=1350; const cv=document.createElement("canvas"); cv.width=W; cv.height=H;
  const x=cv.getContext("2d");
  const BEBAS=`"Bebas Neue", Impact, sans-serif`, INTER=`"Inter", system-ui, sans-serif`;
  const g=x.createLinearGradient(0,0,W,H); g.addColorStop(0,"#15100b"); g.addColorStop(.55,"#0c0f17"); g.addColorStop(1,"#0a1411");
  x.fillStyle=g; x.fillRect(0,0,W,H);
  const rg=x.createRadialGradient(160,180,0,160,180,560); rg.addColorStop(0,"rgba(255,106,44,.55)"); rg.addColorStop(1,"rgba(255,106,44,0)");
  x.fillStyle=rg; x.fillRect(0,0,W,H);
  const rg2=x.createRadialGradient(W-120,H-180,0,W-120,H-180,620); rg2.addColorStop(0,"rgba(47,230,168,.42)"); rg2.addColorStop(1,"rgba(47,230,168,0)");
  x.fillStyle=rg2; x.fillRect(0,0,W,H);
  x.textAlign="left";
  /* brand wordmark in Bebas to match the app */
  x.fillStyle="#fff"; x.font=`96px ${BEBAS}`; x.fillText("EVOLVE", 78, 158);
  x.fillStyle="rgba(255,255,255,.6)"; x.font=`600 28px ${INTER}`; x.fillText("TRAIN SMARTER · BECOME NEXT", 82, 202);
  x.fillStyle="#fff";
  const title=(wk.title||"Workout").toUpperCase();
  let tsize=108; x.font=`${tsize}px ${BEBAS}`;
  while(x.measureText(title).width > W-156 && tsize>52){ tsize-=4; x.font=`${tsize}px ${BEBAS}`; }
  x.fillText(title, 78, 350);
  x.fillStyle="rgba(255,255,255,.55)"; x.font=`600 34px ${INTER}`; x.fillText(prettyDate(wk.date), 82, 404);
  /* 2x2 stat grid */
  const pad=78, gap=28, cardW=(W-pad*2-gap)/2, cardH=210, top=470;
  function cell(cx,cy,label,val,accent){
    x.fillStyle="rgba(255,255,255,.06)"; rr(x,cx,cy,cardW,cardH,30); x.fill();
    x.fillStyle="rgba(255,255,255,.55)"; x.font=`700 28px ${INTER}`; x.textAlign="left"; x.fillText(label,cx+34,cy+62);
    x.fillStyle=accent||"#FF6A2C"; x.font=`96px ${BEBAS}`; x.fillText(val,cx+32,cy+162);
  }
  cell(pad,        top,          "TOTAL VOLUME", volStr(wk.volume), "#FF6A2C");
  cell(pad+cardW+gap, top,       "EXERCISES", String(wk.exercises.length), "#5AA9FF");
  cell(pad,        top+cardH+gap,"TOP LIFT", wk.topKg?liftStr(wk.topKg):"—", "#2FE6A8");
  cell(pad+cardW+gap, top+cardH+gap, wk.durationMin?"DURATION":"PRS", wk.durationMin?wk.durationMin+" MIN":String(prs.length), "#FFC857");
  /* PR / streak ribbon */
  let ry=top+cardH*2+gap*2+30;
  x.fillStyle="rgba(255,255,255,.06)"; rr(x,pad,ry,W-pad*2,150,30); x.fill();
  x.textAlign="left"; x.fillStyle="rgba(255,255,255,.55)"; x.font=`700 28px ${INTER}`; x.fillText("THIS SESSION",pad+34,ry+58);
  x.fillStyle="#fff"; x.font=`600 34px ${INTER}`;
  const ribbon = (prs.length?`🏅 ${prs.length} PR${prs.length>1?"s":""}   `:"")+`🔥 ${dispWorkoutStreak()} day streak   💪 ${dispWorkouts()} total`;
  x.fillText(ribbon, pad+34, ry+112);
  x.fillStyle="rgba(255,255,255,.4)"; x.font=`600 28px ${INTER}`; x.textAlign="center";
  x.fillText("Created with Evolve", W/2, H-64);
  const url=cv.toDataURL("image/png");
  openModal(`<h3>Your summary card 📸</h3>
    <img src="${url}" style="width:100%;border-radius:14px;margin:8px 0 12px">
    <button class="btn str block" id="fc_share">⬇️ Save / share image</button>
    <p class="muted tiny center" style="margin:10px 2px 0">Tip: tap above to add it to Photos or share it — or just screenshot this card.</p>
    <button class="btn ghost block" id="fc_close" style="margin-top:12px">Close</button>`);
  $("#fc_close").addEventListener("click",()=>showFinishSummary(wk,prs,badges||[]));
  $("#fc_share").addEventListener("click",async()=>{
    try{
      const blob=await (await fetch(url)).blob();
      const file=new File([blob],`evolve-${wk.date}.png`,{type:"image/png"});
      if(navigator.canShare && navigator.canShare({files:[file]})){
        await navigator.share({files:[file], title:"My Evolve workout"});
        return;
      }
    }catch(e){ if(e&&e.name==="AbortError") return; }
    /* fallback: open the image full-screen so it can be long-pressed → Save to Photos */
    try{ const w=window.open(); if(w){ w.document.write(`<img src="${url}" style="width:100%">`); w.document.title="Evolve card"; return; } }catch(e){}
    /* last resort (desktop): direct download */
    try{ const a=document.createElement("a"); a.href=url; a.download=`evolve-${wk.date}.png`; document.body.appendChild(a); a.click(); a.remove(); }catch(e){ toast("Screenshot this card to save it"); }
  });
  };
  /* wait for web fonts so the card text renders in the brand fonts, not a fallback */
  if(document.fonts && document.fonts.ready){
    Promise.race([document.fonts.ready, new Promise(r=>setTimeout(r,800))]).then(draw);
  } else draw();
}

/* ===================== FUEL SCREEN ===================== */
/* Meals: each logged food carries a `meal` (breakfast/lunch/dinner/snack) and a
   `time` timestamp. Legacy items (no meal) are sorted by their timestamp. */
const MEALS=[
  {id:"breakfast",name:"Breakfast",ic:"🌅"},
  {id:"lunch",    name:"Lunch",    ic:"☀️"},
  {id:"dinner",   name:"Dinner",   ic:"🌙"},
  {id:"snack",    name:"Snacks",   ic:"🍿"}
];
function mealById(id){return MEALS.find(m=>m.id===id)||MEALS[3];}
function suggestMeal(d){const h=(d||new Date()).getHours(); if(h<11)return"breakfast"; if(h<15)return"lunch"; if(h<21)return"dinner"; return"snack";}
function mealOf(f){ if(f && f.meal && MEALS.some(m=>m.id===f.meal)) return f.meal; return suggestMeal(f&&f.time?new Date(f.time):new Date()); }
function mealClock(ts){ if(ts==null)return""; const d=new Date(ts); if(isNaN(d.getTime()))return""; let h=d.getHours(),m=d.getMinutes(); const ap=h<12?"AM":"PM"; let h12=h%12; if(h12===0)h12=12; return h12+":"+String(m).padStart(2,"0")+" "+ap; }
function nowHHMM(){const d=new Date();return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");}
function clockHHMM(ts){const d=ts?new Date(ts):new Date();return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");}
function tsFromTime(iso,hhmm){const p=(iso||todayISO()).split("-").map(Number);const t=(hhmm||"12:00").split(":").map(Number);return new Date(p[0],(p[1]||1)-1,p[2]||1,t[0]||0,t[1]||0,0,0).getTime();}
/* meal picker (chips) + an OPTIONAL time field, shown only in "meal times On" mode */
function mealPickerHTML(selMeal,timeVal){
  const timeField = DATA.prefs.mealTimes
    ? `<div class="field"><label>Time</label><input class="input num" id="meal_time" type="time" value="${timeVal}"></div>` : "";
  return `<div class="field"><label>Meal</label>
    <div class="row wrap" id="meal_pick" style="gap:7px">${MEALS.map(m=>`<button class="chip sm ${m.id===selMeal?"on":""}" data-m="${m.id}">${m.ic} ${m.name}</button>`).join("")}</div></div>
    ${timeField}`;
}
function wireMealPicker(){ const r=$("#modal"); if(!r)return; r.querySelectorAll("#meal_pick [data-m]").forEach(b=>b.addEventListener("click",()=>{ r.querySelectorAll("#meal_pick [data-m]").forEach(x=>x.classList.remove("on")); b.classList.add("on"); })); }
function readMeal(){ const on=$("#modal")&&$("#modal").querySelector("#meal_pick .on"); return on?on.dataset.m:"snack"; }
/* resolve the timestamp to store: device "now" in fast mode, or the chosen time when meal-times is On */
function readMealTime(fallbackHHMM){
  if(DATA.prefs.mealTimes && $("#meal_time")) return tsFromTime(viewDate,$("#meal_time").value||fallbackHHMM||nowHHMM());
  return tsFromTime(viewDate,fallbackHHMM||nowHHMM());
}

/* favourite foods (★) */
function isFavFood(name){ return (DATA.favFoods||[]).includes(name); }
function toggleFavFood(name){ if(!DATA.favFoods)DATA.favFoods=[]; const i=DATA.favFoods.indexOf(name); if(i>=0)DATA.favFoods.splice(i,1); else DATA.favFoods.unshift(name); save(); }

/* recent & frequent foods — derived from the log, no extra storage.
   score = recency rank + frequency, so regulars and just-eaten items surface. */
function recentFoods(limit){
  const stat={}; /* name -> {last, count} */
  const logs=DATA.log||{};
  Object.keys(logs).forEach(date=>{
    (logs[date].food||[]).forEach(f=>{
      if(!f||!f.name)return;
      const t=f.time||tsFromTime(date,"12:00");
      const s=stat[f.name]||(stat[f.name]={last:0,count:0});
      s.count++; if(t>s.last)s.last=t;
    });
  });
  const known=new Set(allFoods().map(f=>f[0])); /* only re-loggable foods */
  return Object.keys(stat).filter(n=>known.has(n))
    .sort((a,b)=> (stat[b].last-stat[a].last) || (stat[b].count-stat[a].count))
    .slice(0,limit||8);
}

/* "Your usuals" — the foods you log most often (ranked by count, then recency).
   Optionally scoped to a meal so each meal section can show its own usuals. */
function usualFoods(limit, mealId){
  const stat={}; const logs=DATA.log||{};
  Object.keys(logs).forEach(date=>{
    (logs[date].food||[]).forEach(f=>{
      if(!f||!f.name)return;
      if(mealId && mealOf(f)!==mealId) return;
      const t=f.time||tsFromTime(date,"12:00");
      const s=stat[f.name]||(stat[f.name]={last:0,count:0});
      s.count++; if(t>s.last)s.last=t;
    });
  });
  const known=new Set(allFoods().map(f=>f[0]));
  return Object.keys(stat).filter(n=>known.has(n))
    .sort((a,b)=> (stat[b].count-stat[a].count) || (stat[b].last-stat[a].last))
    .slice(0,limit||10);
}
/* the grams you last logged for a food (so re-logging defaults to your portion, not 100g) */
function lastPortion(name){
  let best=null, bestT=-1; const logs=DATA.log||{};
  Object.keys(logs).forEach(date=>{
    (logs[date].food||[]).forEach(f=>{
      if(f&&f.name===name){ const t=f.time||tsFromTime(date,"12:00"); if(t>bestT){bestT=t;best=f;} }
    });
  });
  return (best&&best.grams>0)?best.grams:100;
}
/* the meal you most often log a food into (falls back to time-of-day) */
function usualMealFor(name){
  const c={}; const logs=DATA.log||{};
  Object.keys(logs).forEach(date=>{ (logs[date].food||[]).forEach(f=>{ if(f&&f.name===name){ const m=mealOf(f); c[m]=(c[m]||0)+1; } }); });
  let best=null,bn=0; Object.keys(c).forEach(m=>{ if(c[m]>bn){bn=c[m];best=m;} });
  return best||suggestMeal();
}
/* one-tap re-log: add a food at your last-used portion, with an Undo */
function logFoodQuick(name, meal){
  const f=allFoods().find(x=>x[0]===name); if(!f){toast("Food not found");return;}
  const g=lastPortion(name), r=g/100;
  const mealId=meal||usualMealFor(name);
  const entry={name, grams:g, kcal:f[1]*r, p:f[2]*r, c:f[3]*r, f:f[4]*r, meal:mealId, time:Date.now()};
  const L=dayLog(viewDate); L.food.push(entry); save(); renderFuel();
  toastUndo(`Added ${name.split(",")[0]} · ${g}g`, ()=>{ const LL=dayLog(viewDate); const ix=LL.food.lastIndexOf(entry); const jx=ix>=0?ix:LL.food.indexOf(entry); if(jx>=0)LL.food.splice(jx,1); save(); renderFuel(); });
}

/* coloured macro string — letters match the tracking rings: P orange, C blue, F gold */
function macroHTML(p,c,f){
  return `<span style="color:#FF6A2C;font-weight:700">P${p}</span> <span style="color:#5AA9FF;font-weight:700">C${c}</span> <span style="color:#FFC857;font-weight:700">F${f}</span>`;
}

/* Quick goal + activity editor — recomputes targets without a reset.
   Reachable from the Fuel tab; the full profile editor lives in Settings. */
function openGoalActivity(){
  const p=DATA.profile;
  if(!p){ openSetup(false); return; }
  /* targets can only be calculated with valid height, weight and age —
     without them every goal floors at the 1200 minimum and nothing changes */
  const incomplete = !(p.weightKg>0) || !(p.heightCm>0) || !(p.age>0);
  let mode = DATA.prefs.targetMode==="manual" ? "manual" : "auto";
  openModal(`
    <h3>Daily targets</h3>
    <div class="seg" id="ga_mode" style="margin-bottom:14px">
      <button data-v="auto" class="${mode==="auto"?"on":""}">Auto</button>
      <button data-v="manual" class="${mode==="manual"?"on":""}">Manual</button>
    </div>
    <div id="ga_modebody"></div>
  `);
  segBind("ga_mode");
  function renderMode(){
    const host=$("#ga_modebody");
    if(mode==="auto"){
      host.innerHTML=`
        ${incomplete?`<div class="card" style="border:1px solid #FFC857;background:rgba(255,200,87,.08);margin-bottom:14px">
           <p class="tiny" style="line-height:1.55">⚠️ Your targets can't be calculated yet — your <b>height, weight or age is missing</b>, so every goal shows the same minimum (${eVal(1200)} ${eUnit()}). Add those details, or switch to <b>Manual</b> to set your own numbers.</p>
           <button class="btn str block" id="ga_fix" style="margin-top:10px">Update my details</button></div>`:``}
        <p class="muted tiny" style="margin-bottom:16px">Evolve works out your calories &amp; macros from your goal. Change these any time — your food log and history are <b>not</b> affected.</p>
        <div class="field"><label>Goal</label>
          <div class="seg" id="ga_goal">${Object.entries(GOALS).map(([k,v])=>`<button data-v="${k}" class="${p.goal===k?"on":""}">${v.l}</button>`).join("")}</div></div>
        <div class="field"><label>Activity level</label>
          <select class="input" id="ga_act">${Object.entries(ACT).map(([k,v])=>`<option value="${k}" ${p.activity===k?"selected":""}>${v.l}</option>`).join("")}</select></div>
        <div class="card" id="ga_preview" style="margin:4px 0 14px"></div>
        <button class="btn str block" id="ga_save">Save &amp; update targets</button>`;
      segBind("ga_goal");
      if(incomplete){ const f=$("#ga_fix"); if(f) f.addEventListener("click",()=>{ closeModal(); openSetup(false); }); }
      function preview(){
        const goal=segVal("ga_goal")||p.goal, activity=$("#ga_act").value||p.activity;
        const t=computeTargets({...p,goal,activity});
        $("#ga_preview").innerHTML=`<div class="tiny muted" style="margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em">New daily targets</div>
          <div class="row" style="justify-content:space-around;text-align:center">
            <div><div class="num" style="font-weight:800;font-size:21px">${eVal(t.calories)}</div><div class="tiny muted">${eUnit()}</div></div>
            <div><div class="num" style="font-weight:800;font-size:21px;color:#FF6A2C">${t.protein}<small>g</small></div><div class="tiny muted">protein</div></div>
            <div><div class="num" style="font-weight:800;font-size:21px;color:#5AA9FF">${t.carbs}<small>g</small></div><div class="tiny muted">carbs</div></div>
            <div><div class="num" style="font-weight:800;font-size:21px;color:#FFC857">${t.fat}<small>g</small></div><div class="tiny muted">fat</div></div>
          </div>`;
      }
      preview();
      $("#ga_goal").querySelectorAll("button").forEach(btn=>btn.addEventListener("click",preview));
      $("#ga_act").addEventListener("change",preview);
      $("#ga_save").addEventListener("click",()=>{
        p.goal=segVal("ga_goal")||p.goal;
        p.activity=$("#ga_act").value||p.activity;
        DATA.targets=computeTargets(p);
        DATA.prefs.targetMode="auto";
        save(); closeModal(); renderFuel();
        toast("Targets updated 🎯");
      });
    } else {
      /* manual — full control of calories + protein/carbs/fat */
      const t=DATA.targets||computeTargets(incomplete?{...p,weightKg:p.weightKg||70,heightCm:p.heightCm||175,age:p.age||30}:p);
      const isKj=DATA.prefs.energy==="kj";
      const calShown = isKj ? Math.round((t.calories||0)*4.184) : Math.round(t.calories||0);
      host.innerHTML=`
        <p class="muted tiny" style="margin-bottom:16px">Set your own numbers — Evolve won't change them. Switch back to <b>Auto</b> any time to use the calculated targets again.</p>
        <div class="field"><label>Daily calories (${eUnit()})</label>
          <input class="input num" id="m_cal" type="number" inputmode="numeric" value="${calShown}" placeholder="2200"></div>
        <div class="grid2">
          <div class="field"><label>Protein (g)</label><input class="input num" id="m_p" type="number" inputmode="numeric" value="${Math.round(t.protein||0)}"></div>
          <div class="field"><label>Carbs (g)</label><input class="input num" id="m_c" type="number" inputmode="numeric" value="${Math.round(t.carbs||0)}"></div>
        </div>
        <div class="field"><label>Fat (g)</label><input class="input num" id="m_f" type="number" inputmode="numeric" value="${Math.round(t.fat||0)}"></div>
        <div class="card" id="m_check" style="margin:2px 0 14px"></div>
        <button class="btn str block" id="m_save">Save my targets</button>`;
      function kcalFromInput(){ const v=+$("#m_cal").value||0; return isKj? v/4.184 : v; }
      function check(){
        const cals=kcalFromInput();
        const pr=+$("#m_p").value||0, cb=+$("#m_c").value||0, ft=+$("#m_f").value||0;
        const macroKcal=pr*4+cb*4+ft*9;
        const diff=Math.round(macroKcal-cals);
        const ok=Math.abs(diff)<=50;
        $("#m_check").innerHTML=`<div class="tiny muted" style="margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">Your macros add up to</div>
          <div class="row" style="justify-content:space-between;align-items:center">
            <div class="num" style="font-weight:800;font-size:20px">${eVal(macroKcal)} <small style="font-weight:500;color:var(--muted)">${eUnit()}</small></div>
            <div class="tiny" style="color:${ok?"var(--fuel)":(diff>0?"#FFC857":"var(--blue)")};font-weight:700">${ok?"✓ matches your calories":(diff>0?`+${eVal(Math.abs(diff))} over your calorie target`:`${eVal(Math.abs(diff))} ${eUnit()} under your calorie target`)}</div>
          </div>
          <div class="tiny muted" style="margin-top:6px">Protein &amp; carbs = 4 ${eUnit()}/g, fat = 9 ${eUnit()}/g. They don't have to match exactly — it's your call.</div>`;
      }
      check();
      ["m_cal","m_p","m_c","m_f"].forEach(id=>$("#"+id).addEventListener("input",check));
      $("#m_save").addEventListener("click",()=>{
        const cals=Math.round(kcalFromInput());
        if(!(cals>0)){ toast("Enter your daily calories"); return; }
        const pr=Math.max(0,Math.round(+$("#m_p").value||0));
        const cb=Math.max(0,Math.round(+$("#m_c").value||0));
        const ft=Math.max(0,Math.round(+$("#m_f").value||0));
        const water=(DATA.targets&&DATA.targets.water)|| (p.weightKg?Math.round(p.weightKg*35):2000);
        let extra={}; if(!incomplete){ const c=computeTargets(p); extra={bmr:c.bmr,tdee:c.tdee}; }
        DATA.targets={calories:cals, protein:pr, carbs:cb, fat:ft, water, ...extra};
        DATA.prefs.targetMode="manual";
        save(); closeModal(); renderFuel();
        toast("Your targets are set 🎯");
      });
    }
  }
  $("#ga_mode").querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>{ mode=btn.dataset.v; renderMode(); }));
  renderMode();
}

function renderFuel(){
  const b=$("#fuelBody"); b.innerHTML="";
  if(!DATA.targets){
    b.innerHTML=`<div class="topbar"><div><div class="hello">Nutrition</div><div class="date">Fuel</div></div></div>
      <div class="card center"><p class="muted">Set up your details first to get calorie & macro targets.</p>
      <button class="btn str block" id="f_setup" style="margin-top:10px">Set up now</button></div>`;
    $("#f_setup").addEventListener("click",()=>openSetup(true)); return;
  }
  const t=DATA.targets, log=dayLog(viewDate);
  const eaten=log.food.reduce((s,f)=>({c:s.c+f.kcal,p:s.p+f.p,cb:s.cb+f.c,ft:s.ft+f.f}),{c:0,p:0,cb:0,ft:0});
  const burned=log.burned.reduce((s,x)=>s+x.kcal,0);
  const budget=t.calories + (DATA.prefs.addExercise?burned:0);
  const remaining=budget-eaten.c;
  const pct=Math.min(1,eaten.c/budget);
  const isToday=viewDate===todayISO();

  /* header with date switcher */
  b.appendChild(helpBar("fuel"));
  const head=el("div","topbar");
  head.innerHTML=`<button class="iconbtn" id="f_prev">‹</button>
    <div class="center"><div class="hello">${isToday?"Today":""}</div><div class="date" style="font-size:24px">${shortDate(viewDate)}</div></div>
    <button class="iconbtn" id="f_next" ${isToday?'style="opacity:.3"':""}>›</button>`;
  b.appendChild(head);
  $("#f_prev").addEventListener("click",()=>{const d=new Date(viewDate);d.setDate(d.getDate()-1);viewDate=todayISO(d);renderFuel();});
  $("#f_next").addEventListener("click",()=>{if(isToday)return;const d=new Date(viewDate);d.setDate(d.getDate()+1);viewDate=todayISO(d);renderFuel();});

  /* calorie ring */
  const ringCard=el("div","card center fuel-hero");
  ringCard.innerHTML=`<div class="ring-wrap">${ringSVG(pct, remaining<0?"#FF5470":"#2FE6A8",170)}
     <div class="lbl"><div class="big num">${eVal(Math.abs(remaining))}</div>
     <div class="sub">${remaining<0?"over":"left"} · ${eUnit()}</div></div></div>
     <div class="row" style="justify-content:space-around;margin-top:14px">
       <div><div class="tiny muted">EATEN</div><div class="num" style="font-weight:700">${eVal(eaten.c)}</div></div>
       <div><div class="tiny muted">TARGET</div><div class="num" style="font-weight:700">${eVal(budget)}</div></div>
       <div><div class="tiny muted">BURNED</div><div class="num" style="font-weight:700">${eVal(burned)}</div></div>
     </div>`;
  b.appendChild(ringCard);

  /* goal & activity — quick edit (recomputes targets, no reset needed) */
  const pf=DATA.profile;
  if(pf){
    const ga=el("div","card");
    const manual=DATA.prefs.targetMode==="manual";
    ga.innerHTML=`<div class="lrow" style="padding-top:0"><div class="ico">🎯</div><div class="main">
      <div class="t">${manual?"Daily targets":"Goal &amp; activity"}</div>
      <div class="s">${manual?"Set manually · tap to edit":`${GOALS[pf.goal]?.l||"—"} · ${ACT[pf.activity]?.l||"—"}`}</div></div></div>`;
    const gab=el("button","btn block",manual?"Edit my targets":"Adjust goal &amp; activity"); gab.style.marginTop="4px";
    gab.addEventListener("click",openGoalActivity);
    ga.appendChild(gab); b.appendChild(ga);
  }

  /* ---- Your usuals: one-tap re-log at your last-used portion ---- */
  const usuals=usualFoods(10);
  if(usuals.length){
    const sh=el("div","sect-h"); sh.style.marginBottom="8px";
    sh.innerHTML=`<h3>Your usuals <span class="muted" style="font-weight:600;font-size:12px">· one tap</span></h3>`;
    b.appendChild(sh);
    const rail=el("div","usuals-rail");
    usuals.forEach(name=>{
      const f=allFoods().find(x=>x[0]===name); if(!f)return;
      const g=lastPortion(name), r=g/100;
      const card=el("button","ucard");
      card.innerHTML=`<div class="uadd">＋</div>
        <div class="un">${esc(name)}</div>
        <div class="um num">${eVal(f[1]*r)} ${eUnit()} · P${Math.round(f[2]*r)}</div>
        <div class="up num">${g} g</div>`;
      card.addEventListener("click",()=>{ card.classList.add("flash"); setTimeout(()=>card.classList.remove("flash"),450); logFoodQuick(name); });
      rail.appendChild(card);
    });
    const more=el("button","ucard add-tile"); more.innerHTML=`<div class="plus">＋</div><div class="tiny">Find a food</div>`;
    more.addEventListener("click",()=>openFoodSearch()); rail.appendChild(more);
    b.appendChild(rail);
  }

  /* macros — three mini rings */
  const macros=[["Protein","🥩",eaten.p,t.protein,"#FF6A2C"],["Carbs","🌾",eaten.cb,t.carbs,"#5AA9FF"],["Fat","🥑",eaten.ft,t.fat,"#FFC857"]];
  const mc=el("div","card");
  mc.innerHTML=`<div class="eyebrow" style="margin-bottom:12px">Macros</div>`;
  const mr=el("div","macro-rings");
  macros.forEach(([nm,ic,have,goal,col])=>{
    const pct=Math.min(1,have/goal);
    const d=el("div","mring");
    d.innerHTML=`<div class="mr-wrap">${ringSVG(pct,col,84)}<div class="mr-ic">${ic}</div></div>
      <div class="mr-v num">${Math.round(have)}<small>/${goal}g</small></div>
      <div class="mr-k">${nm}</div>`;
    mr.appendChild(d);
  });
  mc.appendChild(mr);
  b.appendChild(mc);

  /* water */
  const wc=el("div","card");
  const wpct=Math.min(100,log.water/t.water*100);
  wc.innerHTML=`<div class="lrow" style="padding:0 0 10px"><div class="ico">💧</div>
    <div class="main"><div class="t">Water</div><div class="s num">${log.water} / ${t.water} ml</div></div>
    <div class="num" style="font-family:'Bebas Neue';font-size:30px;color:#5AA9FF">${Math.round(wpct)}%</div></div>
    <div class="bar"><i style="width:${wpct}%;background:#5AA9FF"></i></div>
    <div class="row" style="gap:8px;margin-top:12px">
     <button class="btn sm" data-w="250" style="flex:1">+250</button>
     <button class="btn sm" data-w="500" style="flex:1">+500</button>
     <button class="btn sm" data-w="-250" style="flex:1">−250</button></div>`;
  wc.querySelectorAll("[data-w]").forEach(btn=>btn.addEventListener("click",()=>{
    log.water=Math.max(0,log.water+(+btn.dataset.w));save();renderFuel();}));
  b.appendChild(wc);

  /* add buttons */
  const addRow=el("div","row"); addRow.style.margin="14px 0 0"; addRow.style.gap="10px";
  const af=el("button","btn fuel","＋ Add food"); af.style.flex="1"; af.addEventListener("click",()=>openFoodSearch());
  const ab=el("button","btn","🔥 Burned"); ab.style.flex="1"; ab.addEventListener("click",openBurned);
  addRow.append(af,ab); b.appendChild(addRow);

  /* repeat a meal (from any day incl. today) — shown once any food has been logged */
  const hasPast=Object.keys(DATA.log||{}).some(d=>(DATA.log[d].food||[]).length);
  if(hasPast){
    const rep=el("button","btn block","⟳ Repeat a meal"); rep.style.marginTop="10px";
    rep.addEventListener("click",openRepeatMeal); b.appendChild(rep);
  }

  /* meal-times toggle (tab-wide): Off = fast mode (device time, hidden); On = pick/show times */
  const mtCard=el("div","card"); mtCard.style.marginTop="14px";
  mtCard.innerHTML=`<div class="row" style="justify-content:space-between;align-items:center">
      <div><div class="t" style="font-weight:600">⏱️ Show meal times</div>
      <div class="tiny muted">${DATA.prefs.mealTimes?"On · set & show a time on each food":"Off · quicker logging, no times shown"}</div></div>
      <div class="seg" id="mt_seg" style="width:128px">
        <button data-mt="off" class="${!DATA.prefs.mealTimes?"on":""}">Off</button>
        <button data-mt="on" class="${DATA.prefs.mealTimes?"on":""}">On</button></div></div>`;
  mtCard.querySelectorAll("[data-mt]").forEach(btn=>btn.addEventListener("click",()=>{
    DATA.prefs.mealTimes=(btn.dataset.mt==="on"); save(); renderFuel(); }));
  b.appendChild(mtCard);

  /* food list — grouped by meal (Breakfast / Lunch / Dinner / Snacks) */
  if(log.food.length){
    MEALS.forEach(m=>{
      const items=log.food.filter(f=>mealOf(f)===m.id).sort((a,b)=>(a.time||0)-(b.time||0));
      if(!items.length)return;
      const sub=items.reduce((s,f)=>s+(f.kcal||0),0);
      const sh=el("div","sect-h");
      sh.innerHTML=`<h3>${m.ic} ${m.name} <span class="muted" style="font-weight:600;font-size:13px">· ${eVal(sub)} ${eUnit()}</span></h3>`;
      const addBtn=el("button","iconbtn","＋"); addBtn.title="Add to "+m.name; addBtn.style.alignSelf="center";
      addBtn.addEventListener("click",()=>openFoodSearch(m.id)); sh.appendChild(addBtn);
      b.appendChild(sh);
      const fc=el("div","card");
      items.forEach(f=>{
        const r=el("div","lrow");
        const tm=DATA.prefs.mealTimes?mealClock(f.time):"";
        r.innerHTML=`<div class="ico">🍽️</div><div class="main"><div class="t">${esc(f.name)}</div>
          <div class="s num">${tm?tm+" · ":""}${f.grams}g · ${macroHTML(Math.round(f.p),Math.round(f.c),Math.round(f.f))}</div></div>
          <div class="end"><div class="num" style="font-weight:700">${eVal(f.kcal)}</div><div class="tiny muted">${eUnit()}</div></div>`;
        r.querySelector(".main").style.cursor="pointer";
        r.querySelector(".main").addEventListener("click",()=>editFoodEntry(f));
        const del=el("button","del","×"); del.addEventListener("click",e=>{e.stopPropagation();const ix=log.food.indexOf(f);if(ix>=0){const removed=log.food.splice(ix,1)[0];save();renderFuel();toastUndo("Removed "+(removed.name||"food"),()=>{const L=dayLog(viewDate);L.food.splice(Math.min(ix,L.food.length),0,removed);save();renderFuel();});}});
        r.appendChild(del); fc.appendChild(r);
      });
      /* contextual quick-add: foods you usually eat at this meal */
      const mealUsuals=usualFoods(5,m.id).filter(n=>!items.some(it=>it.name===n));
      if(mealUsuals.length){
        const mini=el("div","mini-add");
        mini.appendChild(el("span","lead","Usual"));
        mealUsuals.forEach(n=>{
          const chip=el("button","mini-chip"); chip.innerHTML=`${esc(n.split(",")[0])}<span class="mc-plus">＋</span>`;
          chip.addEventListener("click",()=>logFoodQuick(n,m.id)); mini.appendChild(chip);
        });
        fc.appendChild(mini);
      }
      b.appendChild(fc);
    });
  }
  /* burned list */
  if(log.burned.length){
    const sh=el("div","sect-h",`<h3>Calories burned</h3>`); b.appendChild(sh);
    const bc=el("div","card");
    log.burned.forEach((x,i)=>{
      const r=el("div","lrow");
      r.innerHTML=`<div class="ico">🔥</div><div class="main"><div class="t">${esc(x.name||"Exercise")}</div>
        <div class="s">${DATA.prefs.addExercise?"Added to budget":"Logged only"}</div></div>
        <div class="end"><div class="num" style="font-weight:700">${eVal(x.kcal)}</div><div class="tiny muted">${eUnit()}</div></div>`;
      const del=el("button","del","×"); del.addEventListener("click",()=>{const removed=log.burned.splice(i,1)[0];save();renderFuel();toastUndo("Removed burned entry",()=>{const L=dayLog(viewDate);L.burned.splice(Math.min(i,L.burned.length),0,removed);save();renderFuel();});});
      r.appendChild(del); bc.appendChild(r);
    });
    b.appendChild(bc);
  }
}

let foodCat="All";
function allFoods(){
  const custom=(DATA.customFoods||[]).map(c=>[c.name,c.kcal,c.p,c.c,c.f,"My foods"]);
  return custom.concat(FOODS);
}
function openFoodSearch(presetMeal){
  const base=Array.from(new Set(FOODS.map(f=>f[5])));
  const hasFav=(DATA.favFoods&&DATA.favFoods.length);
  const cats=["All",...(hasFav?["★ Favourites"]:[]),...((DATA.customFoods&&DATA.customFoods.length)?["My foods"]:[]),...base];
  openModal(`<h3>Add food</h3>
    <input class="input" id="fs_q" placeholder="Search 700+ foods…" style="margin:6px 0 8px">
    <button class="btn block" id="fs_custom" style="margin-bottom:10px">＋ Add your own food</button>
    <div id="fs_recent"></div>
    <div class="row wrap" style="gap:6px;margin-bottom:8px">${cats.map(c=>`<button class="chip sm ${c==="All"?"on":""}" data-c="${c}">${c}</button>`).join("")}</div>
    <div class="search-list" id="fs_list"></div>`);
  foodCat="All";
  /* recent & frequent quick-add chips (hidden while searching / when filtering) */
  function paintRecent(){
    const host=$("#fs_recent"); if(!host)return;
    const q=$("#fs_q").value.trim();
    const recents=recentFoods(8);
    if(q||foodCat!=="All"||!recents.length){ host.innerHTML=""; return; }
    host.innerHTML=`<div class="eyebrow" style="margin:2px 0 8px">Recent & frequent</div>
      <div class="row wrap" style="gap:7px;margin-bottom:12px">${recents.map(n=>`<button class="chip sm" data-recent="${esc(n)}">${isFavFood(n)?"★ ":""}${esc(n)}</button>`).join("")}</div>`;
    host.querySelectorAll("[data-recent]").forEach(b=>b.addEventListener("click",()=>pickFood(b.getAttribute("data-recent"),presetMeal)));
  }
  function paint(){
    const q=$("#fs_q").value.toLowerCase();
    let pool=allFoods();
    if(foodCat==="★ Favourites") pool=pool.filter(f=>isFavFood(f[0]));
    else if(foodCat!=="All") pool=pool.filter(f=>f[5]===foodCat);
    const list=pool.filter(f=>f[0].toLowerCase().includes(q)).slice(0,150);
    $("#fs_list").innerHTML=list.map(f=>`<div class="food-opt" data-n="${esc(f[0])}">
      <div style="flex:1"><div class="fn">${esc(f[0])}${f[5]==="My foods"?' <span class="tiny" style="color:var(--fuel)">· custom</span>':''}</div><div class="fm num">${eVal(f[1])} ${eUnit()} · ${macroHTML(f[2],f[3],f[4])} /100g</div></div>
      <button class="iconbtn star ${isFavFood(f[0])?"on":""}" data-fav="${esc(f[0])}" title="Favourite">${isFavFood(f[0])?"★":"☆"}</button>
      <button class="btn sm fuel" data-pick="${esc(f[0])}" style="margin-left:6px">Add</button></div>`).join("")||`<div class="empty">${foodCat==="★ Favourites"?"No favourites yet — tap ☆ on any food to save it.":"No matches — try “Add your own food”."}</div>`;
    $("#fs_list").querySelectorAll("[data-pick]").forEach(btn=>btn.addEventListener("click",()=>pickFood(btn.getAttribute("data-pick"),presetMeal)));
    $("#fs_list").querySelectorAll("[data-fav]").forEach(btn=>btn.addEventListener("click",()=>{ const n=btn.getAttribute("data-fav"); toggleFavFood(n); const on=isFavFood(n); btn.classList.toggle("on",on); btn.textContent=on?"★":"☆"; }));
  }
  $("#fs_q").addEventListener("input",()=>{paintRecent();paint();});
  $("#fs_custom").addEventListener("click",()=>openCustomFood(presetMeal));
  $("#modal").querySelectorAll("[data-c]").forEach(b=>b.addEventListener("click",()=>{
    $("#modal").querySelectorAll("[data-c]").forEach(x=>x.classList.remove("on"));b.classList.add("on");foodCat=b.dataset.c;paintRecent();paint();}));
  paintRecent(); paint();
}
function openCustomFood(presetMeal){
  openModal(`<h3>Add your own food</h3>
    <p class="muted tiny" style="margin-bottom:12px">Enter the values <b>per 100g</b> (check the packet). It's saved so you can reuse it any time.</p>
    <div class="field"><label>Food name</label><input class="input" id="cf_n" placeholder="e.g. My protein flapjack"></div>
    <div class="grid2">
      <div class="field"><label>Calories (kcal /100g)</label><input class="input num" id="cf_k" type="number" inputmode="decimal" placeholder="420"></div>
      <div class="field"><label>Protein (g /100g)</label><input class="input num" id="cf_p" type="number" inputmode="decimal" placeholder="25"></div>
    </div>
    <div class="grid2">
      <div class="field"><label>Carbs (g /100g)</label><input class="input num" id="cf_c" type="number" inputmode="decimal" placeholder="45"></div>
      <div class="field"><label>Fat (g /100g)</label><input class="input num" id="cf_f" type="number" inputmode="decimal" placeholder="16"></div>
    </div>
    <button class="btn fuel block" id="cf_save">Save & use food</button>`);
  $("#cf_save").addEventListener("click",()=>{
    const n=$("#cf_n").value.trim(); if(!n){toast("Give it a name");return;}
    let k=+$("#cf_k").value; if(DATA.prefs.energy==="kj")k=k/4.184;
    const food={name:n,kcal:Math.max(0,k||0),p:+$("#cf_p").value||0,c:+$("#cf_c").value||0,f:+$("#cf_f").value||0};
    if(!DATA.customFoods)DATA.customFoods=[];
    const ex=DATA.customFoods.findIndex(x=>x.name.toLowerCase()===n.toLowerCase());
    if(ex>=0)DATA.customFoods[ex]=food; else DATA.customFoods.unshift(food);
    save(); pickFood(n,presetMeal); toast("Saved “"+n+"”");
  });
}
function pickFood(name,presetMeal){
  const f=allFoods().find(x=>x[0]===name); if(!f)return;
  const isCustom=f[5]==="My foods";
  const defGrams=lastPortion(name);
  const selMeal=presetMeal||usualMealFor(name);
  openModal(`<h3 style="display:flex;align-items:center;gap:8px"><span style="flex:1">${esc(name)}</span><button class="iconbtn star ${isFavFood(name)?"on":""}" id="pf_fav" title="Favourite">${isFavFood(name)?"★":"☆"}</button></h3>
    <p class="muted tiny" style="margin-bottom:12px">Per 100g: ${eVal(f[1])} ${eUnit()} · ${macroHTML(f[2],f[3],f[4])}${isCustom?' · <span style="color:var(--fuel)">custom</span>':''}</p>
    <div class="field"><label>How many grams?</label><input class="input num" id="pf_g" type="number" inputmode="decimal" value="${defGrams}" placeholder="grams"></div>
    ${mealPickerHTML(selMeal,nowHHMM())}
    <div id="pf_preview" class="card" style="margin-bottom:14px"></div>
    <button class="btn fuel block" id="pf_add">Add to ${shortDate(viewDate)}</button>
    ${isCustom?'<button class="btn danger block" id="pf_del" style="margin-top:10px">Delete this custom food</button>':''}`);
  wireMealPicker();
  $("#pf_fav").addEventListener("click",()=>{ toggleFavFood(name); const on=isFavFood(name); const btn=$("#pf_fav"); btn.classList.toggle("on",on); btn.textContent=on?"★":"☆"; toast(on?"Added to favourites":"Removed"); });
  function upd(){
    const g=+$("#pf_g").value||0, r=g/100;
    $("#pf_preview").innerHTML=`<div class="row" style="justify-content:space-around">
      <div class="center"><div class="tiny muted">${eUnit()}</div><div class="num" style="font-weight:700">${eVal(f[1]*r)}</div></div>
      <div class="center"><div class="tiny" style="color:#FF6A2C;font-weight:600">PROTEIN</div><div class="num" style="font-weight:700">${(f[2]*r).toFixed(1)}g</div></div>
      <div class="center"><div class="tiny" style="color:#5AA9FF;font-weight:600">CARBS</div><div class="num" style="font-weight:700">${(f[3]*r).toFixed(1)}g</div></div>
      <div class="center"><div class="tiny" style="color:#FFC857;font-weight:600">FAT</div><div class="num" style="font-weight:700">${(f[4]*r).toFixed(1)}g</div></div></div>`;
  }
  $("#pf_g").addEventListener("input",upd); upd();
  $("#pf_add").addEventListener("click",()=>{
    const g=+$("#pf_g").value; if(!g){toast("Enter grams");return;}
    const r=g/100; const meal=readMeal(); const time=readMealTime(nowHHMM());
    dayLog(viewDate).food.push({name,grams:g,kcal:f[1]*r,p:f[2]*r,c:f[3]*r,f:f[4]*r,meal,time});
    save(); closeModal(); renderFuel(); toast("Added to "+mealById(meal).name);
  });
  if(isCustom)$("#pf_del").addEventListener("click",()=>{
    DATA.customFoods=DATA.customFoods.filter(x=>x.name!==name); save(); closeModal(); openFoodSearch(presetMeal); toast("Deleted");
  });
}
/* edit an already-logged entry: change its meal, time, grams, duplicate, or remove it */
function editFoodEntry(f){
  const log=dayLog(viewDate); if(log.food.indexOf(f)<0)return;
  const per100=f.grams>0?{k:f.kcal/(f.grams/100),p:f.p/(f.grams/100),c:f.c/(f.grams/100),ft:f.f/(f.grams/100)}:{k:0,p:0,c:0,ft:0};
  openModal(`<h3>${esc(f.name)}</h3>
    <div class="field"><label>Grams</label><input class="input num" id="ef_g" type="number" inputmode="decimal" value="${f.grams}"></div>
    ${mealPickerHTML(mealOf(f),clockHHMM(f.time))}
    <button class="btn fuel block" id="ef_save">Save changes</button>
    <button class="btn block" id="ef_dup" style="margin-top:10px">⟳ Duplicate this entry</button>
    <button class="btn danger block" id="ef_del" style="margin-top:10px">Remove this entry</button>`);
  wireMealPicker();
  $("#ef_save").addEventListener("click",()=>{
    const g=+$("#ef_g").value; if(!g){toast("Enter grams");return;}
    const r=g/100;
    f.grams=g; f.kcal=per100.k*r; f.p=per100.p*r; f.c=per100.c*r; f.f=per100.ft*r;
    f.meal=readMeal(); f.time=readMealTime(clockHHMM(f.time));
    save(); closeModal(); renderFuel(); toast("Updated");
  });
  $("#ef_dup").addEventListener("click",()=>{
    log.food.push({name:f.name,grams:f.grams,kcal:f.kcal,p:f.p,c:f.c,f:f.f,meal:mealOf(f),time:Date.now()});
    save(); closeModal(); renderFuel(); toast("Duplicated");
  });
  $("#ef_del").addEventListener("click",()=>{
    const ix=log.food.indexOf(f); if(ix>=0)log.food.splice(ix,1); save(); closeModal(); renderFuel(); toast("Removed");
  });
}
function openRepeatMeal(){
  const days=Object.keys(DATA.log||{}).filter(d=>(DATA.log[d].food||[]).length).sort();
  if(!days.length){toast("No meals to copy yet");return;}
  const defaultDay=days[days.length-1];
  const defMeal=suggestMeal();
  openModal(`<h3>Repeat a meal</h3>
    <p class="muted tiny" style="margin-bottom:12px">Copy a meal you've logged — from any day, including today — into ${shortDate(viewDate)}.</p>
    <div class="field"><label>From day</label><input class="input num" id="rm_day" type="date" value="${defaultDay}" max="${todayISO()}"></div>
    <div class="field"><label>Copy this meal</label><div class="row wrap" id="rm_from" style="gap:7px">${MEALS.map(m=>`<button class="chip sm ${m.id===defMeal?"on":""}" data-m="${m.id}">${m.ic} ${m.name}</button>`).join("")}</div></div>
    <div class="field"><label>Into (on ${shortDate(viewDate)})</label><div class="row wrap" id="rm_to" style="gap:7px">${MEALS.map(m=>`<button class="chip sm ${m.id===defMeal?"on":""}" data-m="${m.id}">${m.ic} ${m.name}</button>`).join("")}</div></div>
    <div id="rm_preview" class="tiny muted" style="margin:4px 0 12px"></div>
    <button class="btn fuel block" id="rm_go">Copy to ${shortDate(viewDate)}</button>`);
  function pickVal(id){ const on=$("#modal").querySelector("#"+id+" .on"); return on?on.dataset.m:"snack"; }
  function srcItems(){ const L=DATA.log[$("#rm_day").value]; return L?(L.food||[]).filter(f=>mealOf(f)===pickVal("rm_from")):[]; }
  function upd(){ const items=srcItems(); const kcal=items.reduce((a,f)=>a+(f.kcal||0),0); $("#rm_preview").textContent=items.length?`${items.length} item${items.length>1?"s":""} · ${eVal(kcal)} ${eUnit()} → ${mealById(pickVal("rm_to")).name}`:"Nothing logged for that meal on that day."; }
  function bindPick(id){ $("#modal").querySelectorAll("#"+id+" [data-m]").forEach(bt=>bt.addEventListener("click",()=>{
    $("#modal").querySelectorAll("#"+id+" [data-m]").forEach(x=>x.classList.remove("on")); bt.classList.add("on"); upd(); })); }
  bindPick("rm_from"); bindPick("rm_to");
  $("#rm_day").addEventListener("input",upd); upd();
  $("#rm_go").addEventListener("click",()=>{
    const items=srcItems(); if(!items.length){toast("Nothing to copy");return;}
    const meal=pickVal("rm_to");
    items.forEach(f=>{ dayLog(viewDate).food.push({name:f.name,grams:f.grams,kcal:f.kcal,p:f.p,c:f.c,f:f.f,meal,time:tsFromTime(viewDate,nowHHMM())}); });
    save(); closeModal(); renderFuel(); toast("Copied "+items.length+" item"+(items.length>1?"s":"")+" to "+mealById(meal).name);
  });
}
function openBurned(){
  openModal(`<h3>Calories burned</h3>
    <p class="muted tiny" style="margin-bottom:12px">From your watch, cardio machine, or an estimate. ${DATA.prefs.addExercise?"<b style='color:var(--fuel)'>Currently added back to your budget.</b>":"Currently logged for info only."}</p>
    <div class="field"><label>Activity (optional)</label><input class="input" id="bn_n" placeholder="e.g. Apple Watch · Run"></div>
    <div class="field"><label>Calories burned (${eUnit()})</label><input class="input num" id="bn_k" type="number" inputmode="numeric" placeholder="300"></div>
    <button class="btn block" id="bn_add">Log burned ${eUnit()}</button>`);
  $("#bn_add").addEventListener("click",()=>{
    let v=+$("#bn_k").value; if(!v){toast("Enter a number");return;}
    if(DATA.prefs.energy==="kj")v=v/4.184; /* store kcal internally */
    dayLog(viewDate).burned.push({name:$("#bn_n").value.trim(),kcal:v,time:Date.now()});
    save(); closeModal(); renderFuel(); toast("Logged");
  });
}

/* ===================== CARDIO SCREEN ===================== */
let cardioFilter="machine";
let cardioMode="up"; /* "up" stopwatch | "down" countdown */
let cardioSession=null; /* {name,met,ic,mode,targetMs,elapsedMs,running,tickId,lastTs} */
function renderCardio(){
  const b=$("#cardioBody"); b.innerHTML="";
  const tb=el("div","topbar");
  tb.innerHTML=`<div class="row" style="gap:12px;align-items:center"><button class="iconbtn" id="cd_back" style="font-size:18px">‹</button>
    <div><div class="hello">Get the heart going</div><div class="date">Cardio</div></div></div>`;
  b.appendChild(tb);
  $("#cd_back").addEventListener("click",()=>switchTab("train"));

  if(cardioSession){ renderCardioSession(b); return; }
  b.appendChild(helpBar("cardio"));

  /* mode: stopwatch / countdown */
  const modeSeg=el("div","seg"); modeSeg.style.marginBottom="10px";
  [["up","⏱ Stopwatch"],["down","⏳ Countdown"]].forEach(([v,l])=>{
    const x=el("button",cardioMode===v?"on":"",l);
    x.addEventListener("click",()=>{cardioMode=v;renderCardio();}); modeSeg.appendChild(x);
  });
  b.appendChild(modeSeg);

  /* machines / home filter */
  const seg=el("div","seg"); seg.style.marginBottom="14px";
  [["machine","Machines"],["home","At home"]].forEach(([v,l])=>{
    const x=el("button",cardioFilter===v?"on":"",l);
    x.addEventListener("click",()=>{cardioFilter=v;renderCardio();}); seg.appendChild(x);
  });
  b.appendChild(seg);

  const grid=el("div","cardio-grid");
  CARDIO.filter(c=>c.t===cardioFilter).forEach(c=>{
    const per30=Math.round(cardioKcal(c.met,30*60));
    const dist=cardioDistanceKm(c.n,30*60);
    const tile=el("button","cardio-tile");
    tile.innerHTML=`<div class="cti">${c.ic}</div><div class="ctn">${esc(c.n)}</div>
      <div class="cts num">~${eVal(per30)} ${eUnit()}${dist?` · ${dist.toFixed(1)}km`:""}<span class="per"> /30m</span></div>`;
    tile.addEventListener("click",()=>askCardioStart(c));
    grid.appendChild(tile);
  });
  b.appendChild(grid);
  b.appendChild(el("div","center muted tiny",`Calories & distance are estimates from your bodyweight (${cardioWeight()} kg) and height — not measured. Editable before you log.`)).style.padding="14px 6px 0";
}
function askCardioStart(c){
  if(cardioMode==="up"){ startCardio(c,0); return; }
  openModal(`<h3>Countdown timer</h3>
    <p class="muted tiny" style="margin-bottom:12px">${c.ic} ${esc(c.n)} — set how long you'll go.</p>
    <div class="field"><label>Minutes</label><input class="input num" id="cd_min" type="number" inputmode="numeric" value="20"></div>
    <button class="btn str block" id="cd_begin">Start countdown</button>`);
  $("#cd_begin").addEventListener("click",()=>{
    const m=+$("#cd_min").value||0; if(m<=0){toast("Enter minutes");return;}
    closeModal(); startCardio(c, m*60000);
  });
}
function startCardio(c,targetMs){
  cardioSession={name:c.n,met:c.met,ic:c.ic,mode:cardioMode,targetMs:targetMs||0,
    elapsedMs:0,running:true,lastTs:Date.now(),tickId:null};
  cardioSession.tickId=setInterval(cardioTick,250);
  requestWakeLock&&requestWakeLock();
  renderCardio();
}
function cardioTick(){
  const s=cardioSession; if(!s||!s.running)return;
  const now=Date.now(); s.elapsedMs+=now-s.lastTs; s.lastTs=now;
  if(s.mode==="down" && s.elapsedMs>=s.targetMs){
    s.elapsedMs=s.targetMs; s.running=false;
    clearInterval(s.tickId); s.tickId=null;
    flashScreen(); beep(); toast("Time's up — nice work 🔥");
    updateCardioDynamic(); finishCardio();
    return;
  }
  updateCardioDynamic();
}
function fmtClock(ms){
  const t=Math.max(0,Math.floor(ms/1000)), h=Math.floor(t/3600), m=Math.floor((t%3600)/60), sec=t%60;
  const mm=String(m).padStart(2,"0"), ss=String(sec).padStart(2,"0");
  return h>0?`${h}:${mm}:${ss}`:`${mm}:${ss}`;
}
function renderCardioSession(b){
  const s=cardioSession;
  const panel=el("div","card center"); panel.id="cardioPanel";
  panel.innerHTML=`
    <div style="font-size:42px;margin-bottom:2px">${s.ic}</div>
    <div class="eyebrow" style="margin-bottom:6px">${esc(s.name)}</div>
    <div class="tiny muted" style="margin-bottom:8px">${s.mode==="down"?`Counting down · ${fmtClock(s.targetMs)} set`:"Stopwatch"}</div>
    <div class="disp" id="cd_clock" style="font-size:74px;line-height:1">${fmtClock(s.mode==="down"?Math.max(0,s.targetMs-s.elapsedMs):s.elapsedMs)}</div>
    <div class="num" id="cd_burn" style="margin-top:8px;color:var(--fuel);font-weight:700;font-size:17px"></div>
    <div class="row" style="gap:10px;margin-top:20px">
      <button class="btn" id="cd_toggle" style="flex:1"></button>
      <button class="btn fuel" id="cd_finish" style="flex:1">Finish & log</button>
    </div>
    <button class="btn ghost block" id="cd_cancel" style="margin-top:10px">Discard</button>`;
  b.appendChild(panel);
  /* handlers attached ONCE so taps never land mid-repaint */
  $("#cd_toggle").addEventListener("click",()=>{
    const s=cardioSession; if(!s)return;
    s.running=!s.running; s.lastTs=Date.now();
    if(s.running && !s.tickId) s.tickId=setInterval(cardioTick,250);
    setCardioToggleLabel();
  });
  $("#cd_finish").addEventListener("click",finishCardio);
  $("#cd_cancel").addEventListener("click",()=>{
    confirmModal({title:"Stop this cardio?",danger:true,confirmText:"Discard it",body:"Are you sure? This session won't be logged.",
      onConfirm:()=>{ stopCardio(); renderCardio(); }});
  });
  setCardioToggleLabel(); updateCardioDynamic();
  const note=el("div","center muted tiny",`Keep this screen open — it stays awake during cardio.`);
  note.style.padding="16px 6px 0"; b.appendChild(note);
}
function setCardioToggleLabel(){
  const t=$("#cd_toggle"); const s=cardioSession; if(!t||!s)return;
  t.textContent=s.running?"Pause":"Resume";
  t.className="btn"+(s.running?"":" str"); t.style.flex="1";
}
function updateCardioDynamic(){
  const s=cardioSession; const clk=$("#cd_clock"); if(!s||!clk)return;
  const secs=s.elapsedMs/1000, kcal=cardioKcal(s.met,secs), dist=cardioDistanceKm(s.name,secs);
  const showMs = s.mode==="down" ? Math.max(0,s.targetMs-s.elapsedMs) : s.elapsedMs;
  clk.textContent=fmtClock(showMs);
  const burn=$("#cd_burn"); if(burn)burn.innerHTML=`~${eVal(kcal)} ${eUnit()}${dist!=null?` · ~${dist.toFixed(2)} km <span class="muted" style="font-weight:400">(est.)</span>`:""}`;
}
function stopCardio(){ if(cardioSession&&cardioSession.tickId)clearInterval(cardioSession.tickId); cardioSession=null; }
function finishCardio(){
  const s=cardioSession; if(!s)return;
  s.running=false; if(s.tickId){clearInterval(s.tickId);s.tickId=null;}
  const secs=Math.max(0,Math.round(s.elapsedMs/1000));
  const estKcal=Math.round(cardioKcal(s.met,secs));
  const dist=cardioDistanceKm(s.name,secs);
  openModal(`<h3>Log cardio</h3>
    <p class="muted tiny" style="margin-bottom:14px">${s.ic} ${esc(s.name)} · ${fmtClock(s.elapsedMs)}${dist!=null?` · ~${dist.toFixed(2)} km (est.)`:""}</p>
    <div class="field"><label>Calories burned (${eUnit()})</label>
      <input class="input num" id="cd_k" type="number" inputmode="numeric" value="${eVal(estKcal)}"></div>
    <label style="display:flex;align-items:center;gap:10px;margin:4px 0 16px;font-size:14px">
      <input type="checkbox" id="cd_budget" ${DATA.prefs.addExercise?"checked":""} style="width:20px;height:20px">
      Add to today's burned total${DATA.prefs.addExercise?" (counts toward your calorie budget)":""}</label>
    <button class="btn fuel block" id="cd_log">Log it</button>
    <button class="btn ghost block" id="cd_skip" style="margin-top:10px">Don't log</button>`);
  $("#cd_log").addEventListener("click",()=>{
    let v=+$("#cd_k").value||0; if(DATA.prefs.energy==="kj")v=v/4.184;
    const rec={id:Date.now(),date:todayISO(),name:s.name,type:s.met>=8?"intense":"steady",
      seconds:secs,kcal:Math.round(v),distanceKm:dist!=null?+dist.toFixed(2):null};
    DATA.cardio.push(rec);
    if($("#cd_budget").checked){
      dayLog(todayISO()).burned.push({name:s.name+" ("+fmtClock(s.elapsedMs)+")",kcal:v,time:Date.now()});
    }
    save(); stopCardio(); closeModal(); switchTab("fuel"); toast("Cardio logged 🔥");
  });
  $("#cd_skip").addEventListener("click",()=>{ stopCardio(); closeModal(); renderCardio(); });
}
function deleteCardio(id, after){
  const ix=DATA.cardio.findIndex(c=>c.id===id); if(ix<0)return;
  const removed=DATA.cardio[ix];
  DATA.cardio.splice(ix,1); save(); if(after)after();
  toastUndo("Cardio session removed",()=>{ DATA.cardio.splice(Math.min(ix,DATA.cardio.length),0,removed); save(); if(after)after(); });
}

/* ===================== STATS SCREEN ===================== */
let statMachine=null;
let calMonth=null; /* Date of first of viewed month */
function renderCalendar(b, noHeader){
  if(calMonth===null){const d=new Date();calMonth=new Date(d.getFullYear(),d.getMonth(),1);}
  const y=calMonth.getFullYear(), m=calMonth.getMonth();
  /* map date -> {str,car,sched} */
  const map={};
  DATA.workouts.forEach(w=>{ (map[w.date]=map[w.date]||{}).str=true; });
  DATA.cardio.forEach(c=>{ (map[c.date]=map[c.date]||{}).car=true; });
  Object.keys(DATA.log||{}).forEach(d=>{ const L=DATA.log[d]; if(L&&L.burned&&L.burned.length){(map[d]=map[d]||{}).car=true;} });
  if(!noHeader) b.appendChild(el("div","sect-h",`<h3>Calendar</h3>`));
  const card=el("div","card");
  const monthName=calMonth.toLocaleDateString(undefined,{month:"long",year:"numeric"});
  const head=el("div","cal-head");
  head.innerHTML=`<button class="iconbtn" id="cal_prev">‹</button><div style="font-weight:700">${monthName}</div><button class="iconbtn" id="cal_next">›</button>`;
  card.appendChild(head);
  const grid=el("div","cal-grid");
  ["M","T","W","T","F","S","S"].forEach(d=>{const c=el("div","cal-dow",d);grid.appendChild(c);});
  const firstDow=(new Date(y,m,1).getDay()+6)%7;
  const days=new Date(y,m+1,0).getDate();
  for(let i=0;i<firstDow;i++) grid.appendChild(el("div","cal-cell"));
  const todayStr=todayISO();
  for(let d=1;d<=days;d++){
    const ds=`${y}-${String(m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
    const info=map[ds];
    const cell=el("div","cal-cell"+(info?" has":"")+(ds===todayStr?" today":""));
    let dot=""; if(info){ const cls=info.str&&info.car?"both":info.str?"str":"car"; dot=`<div class="cal-dot ${cls}"></div>`; }
    cell.innerHTML=`${d}${dot}`;
    if(info) cell.addEventListener("click",()=>showDaySummary(ds));
    grid.appendChild(cell);
  }
  card.appendChild(grid);
  const legend=el("div","row","" ); legend.style.cssText="gap:14px;margin-top:10px;justify-content:center";
  legend.innerHTML=`<span class="tiny muted"><span class="cal-dot str" style="display:inline-block;vertical-align:middle"></span> Lifting</span>
    <span class="tiny muted"><span class="cal-dot car" style="display:inline-block;vertical-align:middle"></span> Cardio</span>
    <span class="tiny muted"><span class="cal-dot both" style="display:inline-block;vertical-align:middle"></span> Both</span>`;
  card.appendChild(legend);
  b.appendChild(card);
  $("#cal_prev").addEventListener("click",()=>{calMonth=new Date(y,m-1,1);renderStats();});
  $("#cal_next").addEventListener("click",()=>{calMonth=new Date(y,m+1,1);renderStats();});
}
function showDaySummary(ds){
  const ws=DATA.workouts.filter(w=>w.date===ds);
  const cs=DATA.cardio.filter(c=>c.date===ds);
  let html=`<h3>${prettyDate(ds)}</h3>`;
  if(!ws.length&&!cs.length){ html+=`<p class="muted">Nothing logged this day.</p>`; }
  ws.forEach(w=>{ html+=`<div class="card" style="margin:10px 0"><div class="t" style="font-weight:700">${esc(w.title)}</div>
    <div class="s muted tiny" style="margin:2px 0 8px">${volStr(w.volume)} · ${w.exercises.length} exercise${w.exercises.length===1?"":"s"}${w.prs&&w.prs.length?` · ${w.prs.length} PR${w.prs.length>1?"s":""}`:""}</div>
    <div class="tiny">${w.exercises.map(e=>esc(e.name)).join(" · ")}</div></div>`; });
  if(cs.length){ const tot=cs.reduce((a,c)=>a+c.seconds,0); const kc=cs.reduce((a,c)=>a+(c.kcal||0),0);
    html+=`<div class="card" style="margin:10px 0"><div class="t" style="font-weight:700">🏃 Cardio</div>
    <div class="s muted tiny" style="margin-top:2px">${fmtClock(tot*1000)} · ${eVal(kc)} ${eUnit()} · ${cs.map(c=>esc(c.name)).join(", ")}</div></div>`; }
  html+=`<button class="btn block" id="ds_close" style="margin-top:8px">Close</button>`;
  openModal(html); $("#ds_close").addEventListener("click",closeModal);
}
function targetStreak(kind, sinceISO){
  /* count consecutive days up to today hitting protein/water target */
  if(!DATA.targets)return 0;
  let streak=0;
  for(let i=0;i<60;i++){
    const d=new Date(); d.setDate(d.getDate()-i); const ds=todayISO(d);
    if(sinceISO && ds<sinceISO) break;
    const L=DATA.log[ds]; if(!L){ if(i===0)continue; else break; }
    let hit=false;
    if(kind==="water"){ hit=(L.water||0)>=(DATA.targets.water||9); }
    else { const pro=(L.food||[]).reduce((a,f)=>a+(f.p||0),0); hit=pro>=(DATA.targets.protein||0)*0.9; }
    if(hit)streak++; else { if(i===0)continue; break; }
  }
  return streak;
}
function renderStreaks(b, noHeader){
  if(!DATA.targets)return;
  if(!noHeader) b.appendChild(el("div","sect-h",`<h3>Streaks ${infoBtn("streak")}</h3>`));
  const ps=dispProteinStreak(), wsk=dispHydrationStreak();
  const card=el("div","streak-grid");
  card.innerHTML=`
    <div class="streak-tile"><div class="big" style="color:var(--strength)">${dispWorkoutStreak()}</div><div class="tiny muted">Workout days</div></div>
    <div class="streak-tile"><div class="big" style="color:#E94f8a">${ps}</div><div class="tiny muted">Protein 🥩</div></div>
    <div class="streak-tile"><div class="big" style="color:#5AA9FF">${wsk}</div><div class="tiny muted">Hydration 💧</div></div>`;
  b.appendChild(card);
  if(noHeader){ const inf=el("div","tiny muted center"); inf.style.marginTop="10px"; inf.innerHTML=`What counts as a streak? ${infoBtn("streak")}`; b.appendChild(inf); bindInfo(inf); }
  else bindInfo(b.lastChild.previousSibling);
}
/* ---------- paginated + expandable history lists ---------- */
let listPages={};
function paginatedList(container, id, items, perPage, rowFn){
  const inner=el("div"); container.appendChild(inner);
  function paint(){
    inner.innerHTML="";
    const total=items.length, pages=Math.max(1, Math.ceil(total/perPage));
    let pg=listPages[id]||0; if(pg>=pages)pg=pages-1; if(pg<0)pg=0; listPages[id]=pg;
    const start=pg*perPage;
    items.slice(start, start+perPage).forEach((it,i)=> inner.appendChild(rowFn(it, start+i)));
    if(pages>1){
      const nav=el("div","pager");
      const prev=el("button","pager-btn","‹ Prev"); prev.disabled=pg===0;
      const lab=el("div","pager-lab",`Page ${pg+1} / ${pages} · ${total} total`);
      const next=el("button","pager-btn","Next ›"); next.disabled=pg>=pages-1;
      prev.addEventListener("click",()=>{ listPages[id]=pg-1; paint(); });
      next.addEventListener("click",()=>{ listPages[id]=pg+1; paint(); });
      nav.append(prev,lab,next); inner.appendChild(nav);
    }
  }
  paint();
}
function workoutHistRow(w){
  const wrap=el("div","hist-item");
  const head=el("div","lrow hist-head");
  head.innerHTML=`<div class="ico">${workoutGroupIcon(w)}</div><div class="main"><div class="t">${esc(w.title)}</div>
    <div class="s">${shortDate(w.date)} · ${w.exercises.length} exercise${w.exercises.length===1?"":"s"} · ${volStr(w.volume)}${w.prs&&w.prs.length?` · ${w.prs.length} PR${w.prs.length>1?"s":""} 🏅`:""}</div></div>
    <span class="hist-x">▾</span>`;
  const del=el("button","del","×"); del.addEventListener("click",(e)=>{ e.stopPropagation(); deleteWorkout(w.id,renderStats); });
  head.appendChild(del);
  const body=el("div","hist-body"); body.style.display="none";
  let html=`<div class="hist-date">${prettyDate(w.date)}${w.durationMin?` · ${w.durationMin} min`:""}</div>`;
  if((w.exercises||[]).length){
    (w.exercises||[]).forEach(ex=>{
      const work=(ex.sets||[]).filter(s=>!s.warmup && +s.kg>=0 && +s.reps>0);
      const setsStr = work.length ? work.map(s=>`${liftStr(s.kg)} × ${s.reps}`).join(", ") : "—";
      html+=`<div class="hist-ex"><div class="hx-n">${esc(ex.name)}</div><div class="hx-s">${setsStr}</div></div>`;
    });
  } else { html+=`<div class="hist-empty">No exercise detail saved for this session.</div>`; }
  body.innerHTML=html;
  head.addEventListener("click",()=>{
    const open=body.style.display==="none";
    body.style.display=open?"block":"none";
    const x=head.querySelector(".hist-x"); if(x)x.style.transform=open?"rotate(180deg)":"";
  });
  wrap.append(head,body); return wrap;
}
function cardioHistRow(c){
  const r=el("div","hist-item");
  const head=el("div","lrow");
  head.innerHTML=`<div class="ico">${(CARDIO.find(x=>x.n===c.name)||{}).ic||"🏃"}</div>
    <div class="main"><div class="t">${esc(c.name)}</div>
    <div class="s num">${shortDate(c.date)} · ${fmtClock(c.seconds*1000)} · ${eVal(c.kcal)} ${eUnit()}${c.distanceKm?` · ~${c.distanceKm} km`:""}</div></div>`;
  const del=el("button","del","×"); del.addEventListener("click",()=>deleteCardio(c.id,renderStats));
  head.appendChild(del); r.appendChild(head); return r;
}
function renderStats(){
  const b=$("#statsBody"); b.innerHTML="";
  b.appendChild(helpBar("stats"));
  b.appendChild(el("div","topbar",`<div><div class="hello">Keep the line climbing</div><div class="date">Progress</div></div>`));
  maybeBackupBanner(b);

  /* ===== PINNED SUMMARY ===== */
  /* last 30 days summary hero */
  {
    const since=Date.now()-30*86400000;
    const recent=DATA.workouts.filter(w=>new Date(w.date).getTime()>=since);
    const rc=DATA.cardio.filter(c=>new Date(c.date).getTime()>=since);
    const vol=recent.reduce((a,w)=>a+(w.volume||0),0);
    const prs=recent.reduce((a,w)=>a+((w.prs||[]).length),0);
    const mh=el("div","mini-hero");
    mh.innerHTML=`<div class="mh-t">Last 30 days</div><div class="mh-row">
      <div><div class="v" style="color:var(--strength)">${recent.length}</div><div class="k">Workouts</div></div>
      <div><div class="v" style="color:var(--blue)">${tonneVal(vol)}${tonneUnit()}</div><div class="k">Volume</div></div>
      <div><div class="v" style="color:var(--gold)">${prs}</div><div class="k">PRs</div></div>
      <div><div class="v" style="color:var(--fuel)">${rc.length}</div><div class="k">Cardio</div></div></div>`;
    b.appendChild(mh);
  }
  const p=DATA.profile;
  const curW=DATA.weights.length?DATA.weights[DATA.weights.length-1].kg:(p?.weightKg||0);
  const bmiV=p?bmi({heightCm:p.heightCm,weightKg:curW}):0;
  const wTile = !curW ? "—" : (bodyUnit()==="st" ? bodyStr(curW) : `${Math.round(bodyToUnit(curW)*10)/10}<small> ${bodyLbl()}</small>`);
  const ov=el("div","grid2");
  ov.innerHTML=`
   <div class="stat"><div class="k">Weight</div><div class="v num">${wTile}</div></div>
   <div class="stat"><div class="k">BMI</div><div class="v num">${bmiV?bmiV.toFixed(1):"—"}<small> ${bmiV?bmiCat(bmiV):""}</small></div></div>
   <div class="stat"><div class="k">Best streak</div><div class="v">${dispBestStreak()}<small> days</small></div></div>
   <div class="stat"><div class="k">Total lifted</div><div class="v num">${tonneVal(dispVolume())}<small> ${tonneUnit()}</small></div></div>`;
  ov.style.marginBottom="6px";
  b.appendChild(ov);
  b.appendChild(el("div","tiny muted center","Tap a section below to open it"))
   .style.cssText="margin:4px 0 14px;letter-spacing:.03em";

  /* ===== DROPDOWN SECTIONS ===== */
  function buildGoal(body){
    const start=DATA.weights[0].kg, goal=p.goalWeightKg, now=curW;
    const totalChange=Math.abs(goal-start)||1, doneChange=Math.abs(now-start);
    const prog=Math.min(100,Math.round(doneChange/totalChange*100));
    const gc=el("div","card");
    gc.innerHTML=`<div class="lrow" style="padding:0 0 10px"><div class="main">
      <div class="t">Goal weight</div><div class="s num">${bodyStr(now)} → ${bodyStr(goal)}</div></div>
      <div class="num" style="font-family:'Bebas Neue';font-size:30px;color:var(--fuel)">${prog}%</div></div>
      <div class="bar"><i style="width:${prog}%;background:var(--grad-fuel)"></i></div>`;
    body.appendChild(gc);
  }
  function buildWeight(body){
    const logW=el("button","btn sm","＋ Log weight"); logW.style.marginBottom="12px"; logW.addEventListener("click",openLogWeight); body.appendChild(logW);
    const wc=el("div","card");
    if(DATA.weights.length>=2){
      const pts=DATA.weights.map((w,i)=>({x:i,y:Math.round(bodyToUnit(w.kg)*10)/10}));
      wc.innerHTML=lineChart(pts,"#2FE6A8",{h:170});
      wc.innerHTML+=`<div class="row" style="justify-content:space-between;margin-top:6px"><span class="tiny muted">${shortDate(DATA.weights[0].date)} · ${bodyStr(DATA.weights[0].kg)}</span><span class="tiny muted">${shortDate(DATA.weights[DATA.weights.length-1].date)} · ${bodyStr(DATA.weights[DATA.weights.length-1].kg)}</span></div>`;
    }else if(DATA.weights.length===1){
      const w=DATA.weights[0];
      wc.innerHTML=`<div class="center" style="padding:8px 0"><div class="tiny muted" style="letter-spacing:.1em">LATEST · ${shortDate(w.date)}</div>
        <div class="disp" style="font-size:48px;color:var(--fuel)">${bodyStr(w.kg)}</div>
        <div class="tiny muted" style="margin-top:4px">Log again on another day to see your trend line.</div></div>`;
    }else{ wc.innerHTML=`<div class="empty">Tap ＋ Log weight to record your weight.</div>`; }
    body.appendChild(wc);
  }
  function buildVolume(body){
    const vc=el("div","card");
    const vw=DATA.workouts.filter(w=>w.volume>0);
    if(vw.length>=2){
      const pts=vw.map((w,i)=>({x:i,y:Math.round(liftFromKg(w.volume))}));
      vc.innerHTML=lineChart(pts,"#FF6A2C",{h:170});
      vc.innerHTML+=`<div class="row" style="justify-content:space-between;margin-top:6px"><span class="tiny muted">${shortDate(vw[0].date)}</span><span class="tiny muted">${shortDate(vw[vw.length-1].date)}</span></div>`;
    }else{ vc.innerHTML=`<div class="empty">Finish a couple of workouts to track your lifting trend.</div>`; }
    body.appendChild(vc);
  }
  function buildStrength(body){
    const machineHist={};
    DATA.workouts.slice().sort((a,b2)=>a.id-b2.id).forEach(w=>{
      (w.exercises||[]).forEach(ex=>{
        let best=0,bestReps=0; (ex.sets||[]).forEach(st=>{ if(!st.warmup && +st.kg>0){ if(+st.kg>best){best=+st.kg;bestReps=+st.reps||0;} } });
        if(best>0){ (machineHist[ex.name]=machineHist[ex.name]||[]).push({date:w.date,kg:best,reps:bestReps}); }
      });
    });
    const machineNames=Object.keys(machineHist).sort((a,c)=>machineHist[c].length-machineHist[a].length);
    const mc=el("div","card");
    if(machineNames.length){
      if(!statMachine || !machineHist[statMachine]) statMachine=machineNames[0];
      const sel=el("select","input"); sel.style.marginBottom="12px";
      sel.innerHTML=machineNames.map(n=>`<option value="${esc(n)}" ${n===statMachine?"selected":""}>${esc(n)} (${machineHist[n].length})</option>`).join("");
      sel.addEventListener("change",()=>{ statMachine=sel.value; renderStats(); });
      mc.appendChild(sel);
      const hist=machineHist[statMachine];
      const chartHost=el("div");
      if(hist.length>=2){
        const pts=hist.map((h,i)=>({x:i,y:Math.round(liftFromKg(h.kg)*10)/10}));
        chartHost.innerHTML=lineChart(pts,"#5AA9FF",{h:160})
          +`<div class="row" style="justify-content:space-between;margin-top:6px"><span class="tiny muted">${shortDate(hist[0].date)}</span><span class="tiny muted">${shortDate(hist[hist.length-1].date)}</span></div>`;
      } else {
        const top=hist[hist.length-1];
        chartHost.innerHTML=`<div class="empty">Best so far: <b style="color:var(--text)">${liftStr(top.kg)}</b>.<br>Log this again to see the trend.</div>`;
      }
      mc.appendChild(chartHost);
      let bestH=hist[0]; hist.forEach(h=>{ if(h.kg>bestH.kg)bestH=h; });
      const rm=bestH.reps?est1RMkg(bestH.kg,bestH.reps):0;
      const line=el("div","tiny muted");
      line.innerHTML=`Best set: <b style="color:var(--text)">${liftStr(bestH.kg)}${bestH.reps?" × "+bestH.reps:""}</b>`+
        (rm?` · Est. 1RM: <b style="color:var(--strength)">${liftStr(rm)}</b> ${infoBtn("oneRM")}`:"")+
        ` · ${hist.length} session${hist.length>1?"s":""}`;
      line.style.marginTop="8px"; mc.appendChild(line); bindInfo(line);
    } else { mc.innerHTML=`<div class="empty">Log workouts to track weight per exercise here.</div>`; }
    body.appendChild(mc);
  }
  function buildTargets(body){
    const t=DATA.targets;
    const tc=el("div","card");
    tc.innerHTML=`<div class="grid2">
      <div class="stat"><div class="k">Calories</div><div class="v num">${eVal(t.calories)}<small> ${eUnit()}</small></div></div>
      <div class="stat"><div class="k">Protein</div><div class="v num">${t.protein}<small> g</small></div></div>
      <div class="stat"><div class="k">Carbs</div><div class="v num">${t.carbs}<small> g</small></div></div>
      <div class="stat"><div class="k">Fat</div><div class="v num">${t.fat}<small> g</small></div></div></div>
      <p class="tiny muted" style="margin-top:10px">${DATA.prefs.targetMode==="manual"?"You set these manually (More → Profile, or the Fuel tab)":(t.bmr?`BMR ${eVal(t.bmr)} · maintenance ${eVal(t.tdee)} ${eUnit()} (Mifflin–St Jeor)`:"")}</p>`;
    body.appendChild(tc);
  }
  function buildWorkouts(body){
    const hc=el("div","card");
    if(DATA.workouts.length){
      const sorted=DATA.workouts.slice().sort((a,b2)=>b2.id-a.id);
      paginatedList(hc, "workoutHist", sorted, 5, workoutHistRow);
    } else { hc.innerHTML=`<div class="empty">No workouts logged yet.</div>`; }
    body.appendChild(hc);
  }
  function buildCardio(body){
    if(DATA.cardio.length){
      const totSec=DATA.cardio.reduce((s,c)=>s+c.seconds,0);
      const totKcal=DATA.cardio.reduce((s,c)=>s+c.kcal,0);
      const totKm=DATA.cardio.reduce((s,c)=>s+(c.distanceKm||0),0);
      const sum=el("div","grid3");
      sum.innerHTML=`
        <div class="stat"><div class="k">Sessions</div><div class="v">${DATA.cardio.length}</div></div>
        <div class="stat"><div class="k">Time</div><div class="v num">${Math.round(totSec/60)}<small> min</small></div></div>
        <div class="stat"><div class="k">Burned</div><div class="v num">${eVal(totKcal)}<small> ${eUnit()}</small></div></div>`;
      body.appendChild(sum);
      if(totKm>0){
        const km=el("div","card"); km.style.marginTop="12px";
        km.innerHTML=`<div class="lrow" style="padding:0"><div class="ico">📍</div><div class="main"><div class="t">Total distance (estimated)</div><div class="s">across all cardio sessions</div></div><div class="num" style="font-family:'Bebas Neue';font-size:30px;color:var(--blue)">${totKm.toFixed(1)} km</div></div>`;
        body.appendChild(km);
      }
      const cc=el("div","card"); cc.style.marginTop="12px";
      const sortedC=DATA.cardio.slice().sort((a,c)=>c.id-a.id);
      paginatedList(cc, "cardioHist", sortedC, 5, cardioHistRow);
      body.appendChild(cc);
    } else {
      body.appendChild(el("div","empty","No cardio logged yet — start a session on the Cardio tab."));
    }
  }
  function buildBadges(body){
    const note=el("div","tiny muted");
    note.style.cssText="line-height:1.5;margin-bottom:12px";
    note.innerHTML=`🚧 <b>More badges on the way</b> — achievements are still being added to, so keep an eye out for new ones to unlock.`;
    body.appendChild(note);
    const bg=el("div","badge-grid");
    BADGES.forEach(bd=>{const un=DATA.ach.unlocked.includes(bd.id);
      const c=el("div","badge"+(un?" un":""));
      c.innerHTML=`<div class="bi">${un?bd.icon:"🔒"}</div><div class="bt">${bd.t}</div><div class="bd">${bd.d}</div>`;
      bg.appendChild(c);});
    body.appendChild(bg);
  }
  function buildMega(body){
    const megas=DATA.workouts.filter(w=>w.type==="mega");
    if(!megas.length){ body.appendChild(el("div","empty","No Mega workouts yet — build one on the Train tab (look for MEGA WORKOUT 💥). It mixes several muscle groups in one session.")); return; }
    const totalVol=megas.reduce((s,w)=>s+(w.volume||0),0);
    /* favourite = most-repeated mega (by title) */
    const titleCount={}; megas.forEach(w=>{ titleCount[w.title]=(titleCount[w.title]||0)+1; });
    let favTitle=null,favN=0; Object.keys(titleCount).forEach(t=>{ if(titleCount[t]>favN){favN=titleCount[t];favTitle=t;} });
    /* most-trained groups across megas */
    const gc={}; megas.forEach(w=>(w.exercises||[]).forEach(ex=>{ if(ex.group)gc[ex.group]=(gc[ex.group]||0)+1; }));
    const topGroups=Object.keys(gc).sort((a,c)=>gc[c]-gc[a]).slice(0,3).map(g=>`${GICON[g]||""} ${g}`).join("  ")||"—";
    const sum=el("div","grid2");
    sum.innerHTML=`
      <div class="stat"><div class="k">Mega workouts</div><div class="v">${megas.length}</div></div>
      <div class="stat"><div class="k">Mega volume</div><div class="v num">${tonneVal(totalVol)}<small> ${tonneUnit()}</small></div></div>`;
    body.appendChild(sum);
    const info=el("div","card"); info.style.marginTop="12px";
    info.innerHTML=`<div class="lrow" style="padding:0 0 9px"><div class="ico">💥</div><div class="main"><div class="t">Favourite mega</div>
      <div class="s">${favN>=2?esc(favTitle)+` · done ${favN}×`:"No repeats yet — do the same mega twice to set a favourite"}</div></div></div>
      <div class="tiny muted">Most-trained in megas: ${topGroups}</div>`;
    body.appendChild(info);
    const lab=el("div","tiny muted"); lab.style.cssText="text-transform:uppercase;letter-spacing:.05em;margin:16px 0 6px"; lab.textContent="Recent mega sessions";
    body.appendChild(lab);
    const hc=el("div","card");
    paginatedList(hc,"megaHist",megas.slice().sort((a,c)=>c.id-a.id),3,workoutHistRow);
    body.appendChild(hc);
  }

  const secs=[];
  if(p&&p.goalWeightKg&&DATA.weights.length) secs.push(moreAcc("pg_goal","🎯","Goal weight", "How close you are to your goal weight", buildGoal));
  secs.push(moreAcc("pg_calendar","🗓️","Calendar", "Your training days, month by month", (body)=>renderCalendar(body,true)));
  if(DATA.targets) secs.push(moreAcc("pg_streaks","🔥","Streaks", "Day runs for workouts, protein & water", (body)=>renderStreaks(body,true)));
  secs.push(moreAcc("pg_weight","⚖️","Bodyweight", "Your weight trend over time", buildWeight));
  secs.push(moreAcc("pg_volume","📊","Lifting volume", "Total weight lifted each session", buildVolume));
  secs.push(moreAcc("pg_strength","💪","Strength per exercise", "Best sets & estimated 1-rep-max per lift", buildStrength));
  if(DATA.targets) secs.push(moreAcc("pg_targets","🍎","Daily targets", "Your calorie & macro goals", buildTargets));
  secs.push(moreAcc("pg_workouts","🏋️","Workout history", `${DATA.workouts.length} logged · tap any to see its sets`, buildWorkouts));
  secs.push(moreAcc("pg_mega","💥","Mega workouts", `${DATA.workouts.filter(w=>w.type==="mega").length} done · totals & recent mega sessions`, buildMega));
  secs.push(moreAcc("pg_cardio","🏃","Cardio", `${DATA.cardio.length} session${DATA.cardio.length===1?"":"s"} · runs, rides & calories burned`, buildCardio));
  if(DATA.prefs.showAchievements!==false) secs.push(moreAcc("pg_badges","🏅","Achievements", `${DATA.ach.unlocked.length}/${BADGES.length} unlocked · milestones you've earned`, buildBadges));
  secs.forEach(s=>b.appendChild(s));
  secs.forEach(s=>s._openIfRemembered());
}
function openLogWeight(){
  const cur=DATA.weights.length?DATA.weights[DATA.weights.length-1].kg:(DATA.profile?.weightKg||0);
  openModal(`<h3>Log bodyweight</h3>
    <div class="field"><label>Weight today (${bodyLbl()})</label>${bodyInputHTML("lw", cur)}</div>
    <button class="btn fuel block" id="lw_add">Save weight</button>`);
  $("#lw_add").addEventListener("click",()=>{
    const v=readBodyKg("lw"); if(!v){toast("Enter weight");return;}
    const today=todayISO(), last=DATA.weights[DATA.weights.length-1];
    if(last&&last.date===today)last.kg=v; else DATA.weights.push({date:today,kg:v});
    if(DATA.profile){DATA.profile.weightKg=v;
      if(DATA.prefs.targetMode==="manual" && DATA.targets){ const c=computeTargets(DATA.profile); DATA.targets.bmr=c.bmr; DATA.targets.tdee=c.tdee; }
      else { DATA.targets=computeTargets(DATA.profile); }
    }
    save(); closeModal(); updateHeader(); refreshCurrentTab(); toast("Weight logged · "+bodyStr(v));
  });
}

/* ===================== MORE / SETTINGS ===================== */
function maybeBackupBanner(container){
  const created=DATA.meta.lastBackup||DATA.meta.created;
  const days=created?Math.floor((Date.now()-new Date(created).getTime())/86400000):0;
  const hasData=DATA.workouts.length||Object.keys(DATA.log).length;
  if(hasData && days>=7){
    const ban=el("div","banner");
    ban.innerHTML=`<div style="font-size:22px">🛟</div><div class="bx"><b>Back up your data</b><br>It's been a while. Export a code so you never lose your progress.</div>`;
    const go=el("button","btn sm gold","Backup"); go.addEventListener("click",()=>{switchTab("more");setTimeout(openExport,200);});
    ban.appendChild(go); container.appendChild(ban);
  }
}
function detectOS(){
  const ua=navigator.userAgent||"";
  if(/iPhone|iPad|iPod/i.test(ua) || (navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1)) return "ios";
  if(/Android/i.test(ua)) return "android";
  return "other";
}
function openWelcomeFlow(){
  /* Step 1: install (skip if already installed as a PWA) */
  if(isStandalone()){ backupReminder(); return; }
  const os=detectOS();
  const iosSteps=`<ol class="wf-steps">
      <li>Tap the <b>Share</b> button in Safari <span class="muted">(the square with an ↑ arrow)</span></li>
      <li>Scroll down and tap <b>Add to Home Screen</b></li>
      <li>Tap <b>Add</b> — done!</li></ol>
      <p class="muted tiny" style="margin-top:10px">iPhone doesn't show an automatic install pop-up — this is how every web app installs on iOS.</p>`;
  const androidSteps=`<ol class="wf-steps">
      <li>Tap <b>Install</b> on Chrome's banner — or tap the <b>⋮</b> menu (top-right)</li>
      <li>Tap <b>Add to Home screen</b> / <b>Install app</b></li>
      <li>Tap <b>Install</b> — done!</li></ol>`;
  const generic=`<p style="line-height:1.6;color:var(--text)"><b>iPhone (Safari):</b> Share button → Add to Home Screen → Add.</p>
      <p style="line-height:1.6;color:var(--text);margin-top:8px"><b>Android (Chrome):</b> ⋮ menu → Add to Home screen / Install app → Install.</p>`;
  openModal(`<div class="wf-hero"><div class="wf-ic">📲</div>
      <div class="wf-t">Install Evolve</div>
      <div class="wf-s">Add Evolve to your home screen so it opens like a real app — full screen, and it works offline at the gym.</div></div>
    ${os==="ios"?iosSteps:os==="android"?androidSteps:generic}
    <button class="btn str block" id="wf_next" style="margin-top:16px">Next — one important tip</button>
    <button class="btn ghost block" id="wf_skip" style="margin-top:10px">Skip for now</button>`);
  $("#wf_next").addEventListener("click",()=>{closeModal();setTimeout(backupReminder,180);});
  $("#wf_skip").addEventListener("click",()=>{closeModal();setTimeout(backupReminder,180);});
}
function backupReminder(){
  openModal(`<div class="wf-hero"><div class="wf-ic" style="background:var(--grad-fuel)">💾</div>
      <div class="wf-t">Keep your data safe</div>
      <div class="wf-s">Everything you log lives <b>only on this device</b> — there's no cloud and no account. That keeps your data private, but it means:</div></div>
    <div class="wf-warn">
      <div class="wf-warn-row">📤 <span>In <b>More → Backup &amp; restore</b>, tap <b>Export backup code</b> and save the code somewhere safe — your Notes app, an email to yourself, anywhere you won't lose it.</span></div>
      <div class="wf-warn-row">🔑 <span><b>That code is the only way to get your data back</b> if you change phone, clear Safari, or delete the app. Don't lose it.</span></div>
      <div class="wf-warn-row">🔁 <span>A code is a <b>snapshot</b> of right now — it doesn't update itself. After a big session or once a week, export a <b>fresh</b> code so your saved backup isn't out of date.</span></div>
    </div>
    <button class="btn str block" id="wf_backup" style="margin-top:16px">Export my first backup now</button>
    <button class="btn ghost block" id="wf_later" style="margin-top:10px">I'll do it later</button>`);
  $("#wf_backup").addEventListener("click",()=>{closeModal();setTimeout(()=>{try{openExport();}catch(e){switchTab("more");}},180);});
  $("#wf_later").addEventListener("click",closeModal);
}
const LAST_UPDATED="11 June 2026";
const LATEST_NUM="3.18";
const LATEST_TITLE="Faster food + a clearer workout screen";
const LATEST_ITEMS=[
  "<b>Your usuals on Fuel</b> — your most-logged foods sit in a one-tap row at the top, and tap re-logs them at the <b>portion you last used</b> (not a flat 100g). Each meal also shows its own quick-add chips",
  "<b>Repeat a meal — now including today</b> — copy any meal from any day (or earlier today) into another meal, e.g. last night's dinner into tonight",
  "<b>Redesigned workout screen</b> — sets are now a clean checklist: the set you're on opens up with the weight/reps steppers, finished sets tick green, and the next one opens automatically. Your progress bar and rest timer stay pinned on screen as you scroll",
  "<b>Supersets join up</b> — linked exercises now connect visually with a clear “no rest between” marker, and each exercise's tools (warm-up, plates, swap, rest, remove) tuck into a single ⋯ menu",
  "<b>Never lose a session</b> — if you close Evolve mid-workout, it offers to pick up exactly where you left off"
];
function openChangelog(){
  const v=(num,name,items)=>`<div style="margin-bottom:20px">
    <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:7px">
      <span style="font-family:'Bebas Neue';font-size:22px;color:var(--strength)">v${num}</span>
      <span style="font-weight:700;font-size:14px">${name}</span></div>
    <div class="muted" style="font-size:13px;line-height:1.65">${items.map(i=>"• "+i).join("<br>")}</div></div>`;
  openModal(`<h3>Changelog 📜</h3>
    <div class="tiny muted" style="margin:-4px 0 10px">Last updated ${LAST_UPDATED}</div>
    <div style="max-height:62vh;overflow:auto;margin-top:4px">
    ${v(LATEST_NUM,LATEST_TITLE,LATEST_ITEMS)}
    ${v("3.17","Quality-of-life polish",[
      "<b>Every pop-up now has a × close button</b> (top-right), and the phone's Back gesture closes a pop-up instead of leaving Evolve",
      "<b>Undo deletes</b> — remove a food, burned or cardio entry by mistake and tap <b>Undo</b> to bring it straight back",
      "<b>Easier typing</b> — tap a number field and it highlights so you can type over it, a <b>Done</b> button now sits above the number keypad, and you can <b>hold</b> the +/− buttons to count up fast",
      "<b>Backup reminder</b> now also shows on Home when it's been a while"
    ])}
    ${v("3.16","Your targets, your way",[
      "<b>Set your own targets</b> — the Daily targets editor now has a <b>Manual</b> mode: type your own calories and your own protein, carbs &amp; fat, with a live check of how they add up. <b>Auto</b> (Lose / Maintain / Gain) still works exactly as before",
      "<b>Colour-coded quick actions</b> on Home — Quick start, Favourites, Cardio and Log food each get their own accent",
      "<b>Cardio moved up</b> on the Train tab — it now sits above the preset days",
      "<b>Clearer menus</b> — every drop-down on Progress and in Settings now has a one-line description of what it does"
    ])}
    ${v("3.15","Mega summary + What's new on the splash",[
      "<b>Mega workouts have their own section</b> on Progress — total sessions & volume, your most-repeated (favourite) mega, your most-trained muscle groups, and recent sessions you can tap open",
      "<b>What's new on the splash</b> — see the latest changes the moment you open Evolve, with the full history one tap away",
      "Tidied up — Mega moved out of Streaks, and the in-app guide & help now cover everything new"
    ])}
    ${v("3.14","A calmer Progress page",[
      "<b>Progress is now drop-downs</b> — your <b>Last 30 days</b> summary and key stats stay pinned at the top, and everything else (calendar, charts, history, cardio, achievements) tucks into tidy sections you tap to open",
      "<b>New Mega streak</b> — a streak tile for back-to-back days doing a Mega multi-group workout, sitting alongside Protein &amp; Hydration (and resettable in Settings)",
      "<b>Smarter history icons</b> — each past workout shows an emoji for the muscle group you trained (arms, chest, legs…), or a dumbbell if it's a mix"
    ])}
    ${v("3.13","Tap to see your sessions",[
      "<b>Workout history opens up</b> — tap any past workout to see the date, duration and every exercise with the sets &amp; weights you did",
      "<b>Paged history</b> — your most recent 5 show first, with Prev / Next to page through the rest (workouts and cardio both), so long lists stay tidy",
      "Every entry clearly shows the date it was completed"
    ])}
    ${v("3.12","Make it yours",[
      "<b>Reset your stats</b> — Total lifted, streaks, total workouts and PRs can each be reset to zero or a custom number from <b>Settings → Stats &amp; resets</b> (with a lock so it can't happen by accident); choose to keep your history or clear it",
      "<b>1RM formula explained</b> — tap the ⓘ to see what each formula (Epley, Brzycki, Lander, Lombardi) does and when it's most accurate",
      "<b>Tidier Settings</b> — everything's now grouped into neat drop-down sections",
      "<b>Livelier splash</b> — returning to Evolve now shows your day at a glance (calories left, streaks, a workout to try) instead of the intro blurbs",
      "Sharing a workout card now returns you to your <b>workout summary</b> when you close it"
    ])}
    ${v("3.11","Change your goal any time",[
      "New <b>🎯 Goal &amp; activity</b> card on the Fuel tab — switch between <b>Lose weight</b>, <b>Maintain</b> and <b>Gain muscle</b>, or change your activity level, in a couple of taps",
      "A live preview shows your <b>new calorie &amp; macro targets</b> before you save",
      "Targets recalculate instantly — <b>no reset needed</b>, and your workouts, food log and history are untouched",
      "(The full profile editor still lives in <b>Settings → Edit details &amp; targets</b>.)"
    ])}
    ${v("3.10","Safer reset",[
      "<b>Reset all data</b> now takes two deliberate steps: unlock it first, then confirm — so it can never be triggered by accident"
    ])}
    ${v("3.9","Settings tidy-up",[
      "Backup &amp; restore, import, and Install &amp; backup tips are now grouped together with one consistent button style",
      "<b>Reset all data</b> is now bright red and sits at the very bottom, on its own, so it's harder to hit by accident"
    ])}
    ${v("3.8","Help & clarity",[
      "<b>How this page works:</b> a help button at the top of Home, Train, Cardio, Fuel and Progress explains what the page does and how to use everything on it",
      "Protein / carbs / fat letters are now <b style='color:#FF6A2C'>colour</b>-<b style='color:#5AA9FF'>coded</b> <b style='color:#FFC857'>everywhere</b> to match the tracking rings",
      "Clearer <b>Show meal times</b> switch: Off hides times for quicker logging, On shows & lets you set a time per food"
    ])}
    ${v("3.7","Faster food logging",[
      "<b>Recent & frequent foods</b> appear at the top of Add Food for one-tap re-logging",
      "<b>Favourite foods:</b> tap ☆ on any food to save it, then filter to ★ Favourites",
      "<b>Repeat a meal:</b> copy a meal from another day, or duplicate a single entry",
      "<b>Show meal times On/Off:</b> a switch on the Fuel tab — Off hides times for quicker logging, On lets you set a time on each food",
      "<b>Quick weight log</b> right on the Home screen",
      "Date now updates itself if the app is left open past midnight",
      "Clearer splash-screen footer text"
    ])}
    ${v("3.6","Meals & times",[
      "Log food into <b>Breakfast, Lunch, Dinner or Snacks</b> — the meal is auto-suggested from the time of day",
      "Each entry now records a <b>time</b> you can adjust, shown next to the food",
      "Fuel tab groups your day into meal sections, each with its own calorie total",
      "Tap a logged item to change its meal, time or amount",
      "Older entries are sorted into meals automatically by when they were logged"
    ])}
    ${v("3.5","Full-app themes",[
      "Themes now recolour the <b>whole app</b> — the background, every card and the borders pick up your chosen colour, not just the buttons",
      "Seven moods to switch between in More → Preferences → App colour theme",
      "Nutrition (teal), favourites (gold) and info (blue) keep their meaning colours on purpose"
    ])}
    ${v("3.4","Onboarding & safety",[
      "First-run walkthrough: how to install on your phone (auto-detects iPhone vs Android), then a clear backup reminder",
      "Reach it any time from More → “Install & backup tips”",
      "<b>Clearer backup wording:</b> a code is a snapshot of that moment — it doesn't update itself, so export a fresh one after logging more",
      "Backup screen now shows the date the snapshot was taken"
    ])}
    ${v("3.2","Final polish & fixes",[
      "Cardio redesigned as a grid of activity tiles with calorie & distance estimates",
      "Celebration screen when you finish a workout (animated ✓, title & duration)",
      "Welcome hero on first-time setup",
      "Frosted-glass rest timer to match the floating nav",
      "Cleaner splash screen, nicer empty states, tap your avatar to open Settings",
      "Haptic buzz on set completion (Android)",
      "<b>Fix:</b> logging food from Home could save to a previously-viewed date — now always logs to today",
      "In-app guide rewritten to match the new layout"
    ])}
    ${v("3.1","Look & feel",[
      "Floating glass bottom navigation with active-tab pill",
      "Time-aware greeting (Good morning / evening, your name)",
      "Emoji icons on muscle tiles · presets became swipeable cards showing the muscles they hit",
      "Macros shown as three progress rings (🥩 🌾 🥑)",
      "Settings grouped into labelled sections"
    ])}
    ${v("3.0","The big redesign",[
      "New <b>Home</b> tab: an adaptive Today card (your planned session, rest day, or quick start), week strip, quick actions and a fuel snapshot",
      "Train became a clean workout library · Cardio folded into Train · Stats renamed Progress",
      "Floating Quick Start button removed — it lives on Home now",
      "Finishing a workout returns you to Home with the day marked done"
    ])}
    ${v("2.5","Install anywhere",[
      "Evolve became an installable app on Android & iPhone (home-screen icon, full screen)",
      "Works fully offline once loaded — built for bad gym signal",
      "Custom app icon"
    ])}
    ${v("2.0","The feature pack",[
      "Weekly planner: pick your days, get a balanced split, bonus days & auto-rebalance, neglect detector",
      "Live tracker tools: last-time ghost text, RIR effort chips, warm-up generator, plate calculator, per-exercise rest, supersets, machine swap",
      "Star any exercise · Favourites hub · build a random workout from your stars",
      "Sub-muscle focus (biceps/triceps, quads/hamstrings…) in every builder",
      "Estimated 1RM (4 formulas) · training calendar · protein & hydration streaks",
      "Shareable summary card after workouts · 7 colour themes",
      "Safety: confirmations before leaving a workout, removing an exercise, or clearing a plan",
      "Session progress bar and a clearer Complete-set flow"
    ])}
    ${v("1.0","Where it started",[
      "Guided gym & home workouts with a big-button live tracker and rest timer",
      "92 machines · 53 free weights · 58 home moves · 40 cardio activities · 726 foods",
      "Calorie & macro targets from your profile · water tracking · burned-calorie credit",
      "Mega workouts, preset days, progress charts, PRs & badges",
      "kg / lb / stone everywhere · backup & restore codes · everything stored on your device"
    ])}
    </div>
    <button class="btn str block" id="cl_close" style="margin-top:8px">Close</button>`);
  $("#cl_close").addEventListener("click",closeModal);
}
function openGuide(){
  const sec=(icon,title,body)=>`<div style="margin-bottom:16px"><div style="font-weight:700;margin-bottom:4px">${icon} ${title}</div><div class="muted" style="font-size:13.5px;line-height:1.55">${body}</div></div>`;
  openModal(`<h3>How to use Evolve 📖</h3>
    <div style="max-height:64vh;overflow:auto;margin-top:6px">
    ${sec("🏠","Home tab","Your day at a glance. The big card tells you what's on — your planned session, a rest day, or a quick start — with one tap to begin. Below it: your week strip, quick actions (<b>⚡ Quick start</b>, ★ Favourites, 🏃 Cardio, 🍎 Log food), today's fuel summary, and what you've completed.")}
    ${sec("🏋️","Train tab","Your workout library. Switch between <b>Gym</b> and <b>Home</b> at the top. Tap a muscle group to build a session — pick a focus like Biceps or Quads, choose how many exercises, then re-roll, add or remove before starting. <b>Mega Workout</b> mixes several groups plus cardio, preset days start with one tap, and the green <b>Cardio</b> card opens all 40 cardio activities.")}
    ${sec("🗓️","Plan my week","Tap the days you can train and Evolve builds a balanced split (Push/Pull/Legs, Upper/Lower…) with rest and cardio slotted in. Tap <b>today's block</b> to start it. Got unexpected free time? Tap a rest day to add a <b>bonus workout</b> and optionally rebalance the rest of the week. Edit or clear the plan any time.")}
    ${sec("⭐","Favourites","Tap the ☆ on any exercise, machine or cardio to favourite it. Open the <b>★ Favs</b> hub to see them split by Gym/Home and hit <b>🎲 Build from favourites</b> for an instant session of moves you love.")}
    ${sec("▶️","Live tracker","Log weight & reps with the steppers. <b>👻 Last time</b> shows your previous numbers to beat. Tools per exercise: <b>⚖️ Plates</b> (barbell math), <b>🔥 Warm-up</b> (auto prep sets), <b>🔄 Swap</b> (busy machine), <b>⏱️ Rest</b> (custom timer), and <b>🔗 Superset</b> to pair two moves. Log <b>RIR</b> (reps in reserve) to track effort.")}
    ${sec("🍎","Fuel tab","Set targets in your profile, then log food from the 700+ database (or add your own). Track water and see calories, protein, carbs and fat against your daily goal. Burned calories from cardio can roll into your budget (toggle in Preferences).")}
    ${sec("📊","Progress tab","Your <b>Last 30 days</b> summary and key stats stay pinned at the top; everything else sits in tidy <b>drop-down sections</b> you tap to open — weight trend, lifting volume, strength per exercise with an <b>Est. 1RM</b>, the <b>calendar</b> (orange = lifting, green = cardio), streaks, a <b>Mega workouts</b> summary, and your full history. Tap any workout in your history to expand its exercises &amp; weights; long lists page 5 at a time.")}
    ${sec("📸","After a workout","Get a summary with your volume, PRs and badges, then tap <b>Share summary card</b> for a branded image to save or post.")}
    ${sec("💾","Your data & settings","Everything is stored on your device. <b>More</b> is organised into drop-down sections: <b>Profile</b>, <b>Units</b>, <b>Preferences</b> (incl. your 1RM formula — tap the ⓘ to learn each one), <b>Stats &amp; resets</b> (reset any stat to zero or a custom number, keeping or clearing its history — unlock it first), <b>Backup</b> (export a code to keep safe or restore on another device), <b>Help</b>, and the <b>Danger zone</b>. New here? Tap <b>📜 What's new</b> on the welcome screen any time to see the latest changes.")}
    </div>
    <button class="btn str block" id="gd_close" style="margin-top:8px">Got it</button>`);
  $("#gd_close").addEventListener("click",closeModal);
}
let moreOpenSections = new Set();
function moreAcc(id, icon, title, sub, buildFn, danger){
  const wrap=el("div","acc"+(danger?" acc-danger":""));
  const head=el("button","acc-head");
  head.innerHTML=`<span><span class="acc-ic">${icon}</span>${title}${sub?`<span class="acc-sub">${sub}</span>`:""}</span><span class="acc-x">▾</span>`;
  const body=el("div","acc-body"); body.style.display="none";
  let built=false;
  function open(){ if(!built){ buildFn(body); built=true; } body.style.display="block"; head.classList.add("open"); }
  function close(){ body.style.display="none"; head.classList.remove("open"); }
  head.addEventListener("click",()=>{
    if(body.style.display==="none"){ moreOpenSections.add(id); open(); }
    else { moreOpenSections.delete(id); close(); }
  });
  wrap.append(head,body);
  wrap._openIfRemembered=()=>{ if(moreOpenSections.has(id)) open(); };
  return wrap;
}
function renderMore(){
  const b=$("#moreBody"); b.innerHTML="";
  b.appendChild(el("div","topbar",`<div><div class="hello">Make Evolve yours</div><div class="date">Settings</div></div>`));
  maybeBackupBanner(b);
  const p=DATA.profile;

  /* ---- PROFILE ---- */
  function buildProfile(body){
    const pc=el("div");
    pc.innerHTML=`<div class="lrow" style="padding-top:0"><div class="ico">👤</div><div class="main">
      <div class="t">${p?esc(p.name||"Your profile"):"Set up profile"}</div>
      <div class="s">${p?`${p.age||"—"}y · ${p.heightCm||"—"}cm · ${bodyStr(p.weightKg)} · ${GOALS[p.goal]?.l||"—"}`:"Tap to add your details"}</div></div></div>`;
    const ed=el("button","btn block","Edit details & targets"); ed.style.marginTop="4px";
    ed.addEventListener("click",()=>openSetup(false)); pc.appendChild(ed); body.appendChild(pc);
  }

  /* ---- UNITS ---- */
  function buildUnits(body){
    const u=el("div"); u.style.marginBottom="14px";
    u.innerHTML=`<div class="tiny muted" style="margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">Energy unit</div>
      <div class="seg" id="pf_energy"><button data-v="kcal" class="${DATA.prefs.energy==="kcal"?"on":""}">kcal</button><button data-v="kj" class="${DATA.prefs.energy==="kj"?"on":""}">kJ</button></div>`;
    body.appendChild(u);
    const lu=el("div"); lu.style.marginBottom="14px";
    lu.innerHTML=`<div class="tiny muted" style="margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">Lifting weight unit</div>
      <div class="seg" id="pf_lift"><button data-v="kg" class="${liftUnit()==="kg"?"on":""}">kg</button><button data-v="lb" class="${liftUnit()==="lb"?"on":""}">lb</button></div>`;
    body.appendChild(lu);
    const bu=el("div");
    bu.innerHTML=`<div class="tiny muted" style="margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">Bodyweight unit</div>
      <div class="seg" id="pf_body"><button data-v="kg" class="${bodyUnit()==="kg"?"on":""}">kg</button><button data-v="lb" class="${bodyUnit()==="lb"?"on":""}">lb</button><button data-v="st" class="${bodyUnit()==="st"?"on":""}">stone</button></div>`;
    body.appendChild(bu);
    $("#pf_energy").querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>{
      DATA.prefs.energy=btn.dataset.v;save();renderMore();}));
    $("#pf_lift").querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>{
      DATA.prefs.liftUnit=btn.dataset.v;save();renderMore();toast("Lifting unit: "+btn.dataset.v);}));
    $("#pf_body").querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>{
      DATA.prefs.bodyUnit=btn.dataset.v;save();renderMore();toast("Bodyweight unit updated");}));
  }

  /* ---- PREFERENCES ---- */
  function buildPrefs(body){
    const ex=el("div"); ex.style.marginBottom="14px";
    ex.innerHTML=`<div class="tiny muted" style="margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">Add burned calories to daily budget</div>
      <div class="seg" id="pf_addex"><button data-v="yes" class="${DATA.prefs.addExercise?"on":""}">Yes</button><button data-v="no" class="${!DATA.prefs.addExercise?"on":""}">No</button></div>`;
    body.appendChild(ex);
    const ac=el("div"); ac.style.marginBottom="14px";
    ac.innerHTML=`<div class="tiny muted" style="margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">Show achievements</div>
      <div class="seg" id="pf_ach"><button data-v="yes" class="${DATA.prefs.showAchievements!==false?"on":""}">On</button><button data-v="no" class="${DATA.prefs.showAchievements===false?"on":""}">Off</button></div>`;
    body.appendChild(ac);
    const ge=el("div"); ge.style.marginBottom="14px";
    ge.innerHTML=`<div class="tiny muted" style="margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">Gym equipment</div>
      <div class="seg vstack" id="pf_equip"><button data-v="machine_cardio" class="${DATA.prefs.gymEquip!=="all"?"on":""}">Machines + Cardio only</button><button data-v="all" class="${DATA.prefs.gymEquip==="all"?"on":""}">Machines + Free Weights + Cardio</button></div>`;
    body.appendChild(ge);
    const rm=el("div"); rm.style.marginBottom="16px";
    rm.innerHTML=`<div class="tiny muted" style="margin-bottom:6px;text-transform:uppercase;letter-spacing:.05em">1RM formula <span style="text-transform:none">${infoBtn("oneRM")}</span></div>
      <div class="seg" id="pf_rm">${Object.keys(RM_FORMULAS).map(k=>`<button data-v="${k}" class="${rmFormula()===k?"on":""}">${RM_FORMULAS[k].l}</button>`).join("")}</div>`;
    body.appendChild(rm);
    const th=el("div");
    th.innerHTML=`<div class="tiny muted" style="margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em">App colour theme</div>
      <div class="theme-row" id="pf_theme">${Object.keys(THEMES).map(k=>`<button class="theme-sw ${(DATA.prefs.theme||'ember')===k?'on':''}" data-v="${k}" title="${THEMES[k].name}" style="background:linear-gradient(135deg,${THEMES[k].a2},${THEMES[k].a})"></button>`).join("")}</div>
      <div class="tiny muted" id="pf_theme_lab" style="margin-top:8px">${THEMES[DATA.prefs.theme||'ember'].name}</div>`;
    body.appendChild(th);
    bindInfo(body);
    $("#pf_addex").querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>{
      DATA.prefs.addExercise=btn.dataset.v==="yes";save();renderMore();toast(DATA.prefs.addExercise?"Burned calories now add to your budget":"Burned calories logged for info only");}));
    $("#pf_ach").querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>{
      DATA.prefs.showAchievements=btn.dataset.v==="yes";save();renderMore();toast(DATA.prefs.showAchievements?"Achievements on":"Achievements hidden");}));
    $("#pf_equip").querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>{
      DATA.prefs.gymEquip=btn.dataset.v;save();renderMore();toast(btn.dataset.v==="all"?"Free weights enabled at the gym":"Machines + Cardio only");}));
    $("#pf_rm").querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>{
      DATA.prefs.rmFormula=btn.dataset.v;save();renderMore();toast("1RM formula: "+RM_FORMULAS[btn.dataset.v].l);}));
    $("#pf_theme").querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>{
      DATA.prefs.theme=btn.dataset.v; applyTheme(btn.dataset.v); save();
      $("#pf_theme").querySelectorAll("button").forEach(x=>x.classList.remove("on")); btn.classList.add("on");
      $("#pf_theme_lab").textContent=THEMES[btn.dataset.v].name; toast(THEMES[btn.dataset.v].name+" theme");}));
  }

  /* ---- STATS & RESETS ---- */
  function buildStatsResets(body){
    const intro=el("div","tiny","Reset a stat to zero or a custom number. “Keep history” restarts the count from today; “delete” removes the entries behind it. Unlock first so nothing resets by accident.");
    intro.style.cssText="line-height:1.55;color:var(--muted);margin-bottom:12px"; body.appendChild(intro);
    let unlocked=false;
    const unlock=el("button","btn block","🔒 Unlock stat resets"); body.appendChild(unlock);
    const list=el("div"); list.style.marginTop="6px"; body.appendChild(list);
    const keys=["volume","workouts","bestStreak","workoutStreak","protein","hydration","prs"];
    const rowBtns=[];
    keys.forEach(k=>{
      const def=STAT_DEFS[k];
      const row=el("div"); row.style.cssText="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 0;border-top:1px solid var(--line)";
      row.innerHTML=`<div style="min-width:0"><div class="t" style="font-size:14.5px;font-weight:600">${def.label}</div><div class="tiny muted">${def.get()}</div></div>`;
      const rb=el("button","btn sm ghost","Reset"); rb.disabled=true; rb.style.flex="0 0 auto";
      rb.addEventListener("click",()=>{ if(!rb.disabled) openStatReset(k); });
      rowBtns.push(rb); row.appendChild(rb); list.appendChild(row);
    });
    unlock.addEventListener("click",()=>{
      unlocked=!unlocked; rowBtns.forEach(rb=>rb.disabled=!unlocked);
      unlock.textContent=unlocked?"🔓 Unlocked — tap a Reset above":"🔒 Unlock stat resets";
      if(unlocked)toast("Stat resets unlocked");
    });
  }

  /* ---- BACKUP & RESTORE ---- */
  function buildBackup(body){
    body.appendChild(el("p","tiny muted","Your data lives on this device only. Export a code and paste it somewhere safe (or into Evolve on another device).")).style.margin="0 0 12px";
    const exb=el("button","btn block","Export backup code"); exb.addEventListener("click",openExport);
    const imb=el("button","btn block","Import / restore from code"); imb.style.marginTop="10px"; imb.addEventListener("click",openImport);
    const tipsB=el("button","btn block","📲 Install & backup tips"); tipsB.style.marginTop="10px"; tipsB.addEventListener("click",openWelcomeFlow);
    body.append(exb,imb,tipsB);
  }

  /* ---- HELP & GUIDE ---- */
  function buildHelp(body){
    const g=el("div");
    g.innerHTML=`<div class="lrow" style="padding-top:0"><div class="ico">📖</div><div class="main"><div class="t">How to use Evolve</div><div class="s">A quick tour of every feature.</div></div></div>`;
    const gb=el("button","btn block","Open the guide"); gb.style.marginTop="4px"; gb.addEventListener("click",openGuide); g.appendChild(gb); body.appendChild(g);
    const c=el("div"); c.style.marginTop="14px";
    c.innerHTML=`<div class="lrow" style="padding-top:0"><div class="ico">📜</div><div class="main"><div class="t">What's new</div><div class="s">Every update, from day one to now.</div></div></div>`;
    const cb=el("button","btn block","View changelog"); cb.style.marginTop="4px"; cb.addEventListener("click",openChangelog); c.appendChild(cb); body.appendChild(c);
  }

  /* ---- DANGER ZONE ---- */
  function buildDanger(body){
    body.appendChild(el("p","tiny muted","Erasing wipes everything on this device and can't be undone. Unlock first, then confirm — two steps so it can't happen by accident.")).style.margin="0 0 12px";
    let resetUnlocked=false;
    const unlockBtn=el("button","btn block","🔒 Unlock reset");
    const reset=el("button","btn danger-solid block","Reset all data"); reset.style.marginTop="10px"; reset.disabled=true;
    unlockBtn.addEventListener("click",()=>{
      resetUnlocked=!resetUnlocked; reset.disabled=!resetUnlocked;
      unlockBtn.textContent=resetUnlocked?"🔓 Unlocked — tap to re-lock":"🔒 Unlock reset";
      if(resetUnlocked)toast("Reset unlocked — tap the red button to continue");
    });
    reset.addEventListener("click",()=>{
      if(reset.disabled)return;
      confirmModal({title:"Erase all data?",danger:true,confirmText:"Erase everything",
        body:"This wipes all Evolve data on this device — workouts, food, weight and settings — and can't be undone. Export a backup first if you're unsure.",
        onConfirm:()=>{
          try{localStorage.removeItem(KEY);}catch(e){}
          try{localStorage.clear();}catch(e){}
          DATA=JSON.parse(JSON.stringify(DEFAULT_DATA)); DATA.meta.created=todayISO();
          location.reload();
        }});
    });
    body.append(unlockBtn,reset);
  }

  const secs=[
    moreAcc("profile","👤","Profile", "Your body stats, goal & activity level", buildProfile),
    moreAcc("units","📏","Units", "How weights & energy are shown", buildUnits),
    moreAcc("prefs","⚙️","Preferences", "Theme, energy unit, 1RM formula & more", buildPrefs),
    moreAcc("stats","📊","Stats & resets", "Reset or adjust your tracked numbers", buildStatsResets),
    moreAcc("backup","💾","Backup & restore", "Export or import your data as a code", buildBackup),
    moreAcc("help","📖","Help & guide", "How every part of Evolve works", buildHelp),
    moreAcc("danger","⚠️","Danger zone", "Erase all data — handle with care", buildDanger, true)
  ];
  secs.forEach(s=>b.appendChild(s));
  secs.forEach(s=>s._openIfRemembered());

  b.appendChild(el("div","center muted tiny",`Evolve · Created by Wigglez · Version 3.18`));
  b.lastChild.style.padding="18px 0 4px";
}
function openExport(){
  const code="EVOLVE1:"+btoa(unescape(encodeURIComponent(JSON.stringify(DATA))));
  DATA.meta.lastBackup=todayISO(); save();
  openModal(`<h3>Backup code</h3>
    <p class="tiny muted" style="margin-bottom:10px">This is a <b>snapshot of your data right now</b> (${prettyDate(todayISO())}). It won't update on its own — export a fresh code after you log more. Copy the whole thing and keep it safe; paste it into “Import” to restore on this or any device.</p>
    <textarea class="input" id="ex_code" rows="6" readonly style="font-family:ui-monospace,monospace;font-size:12px;resize:none">${code}</textarea>
    <button class="btn str block" id="ex_copy" style="margin-top:12px">Copy code</button>`);
  $("#ex_copy").addEventListener("click",()=>{
    const ta=$("#ex_code"); ta.select(); ta.setSelectionRange(0,99999);
    let ok=false; try{ok=document.execCommand("copy");}catch(e){}
    if(navigator.clipboard){navigator.clipboard.writeText(ta.value).then(()=>toast("Copied to clipboard")).catch(()=>toast(ok?"Copied":"Select & copy manually"));}
    else toast(ok?"Copied":"Select & copy manually");
  });
}
function openImport(){
  openModal(`<h3>Import / restore</h3>
    <p class="tiny muted" style="margin-bottom:10px">Paste a backup code. This replaces all current data on this device.</p>
    <textarea class="input" id="im_code" rows="6" placeholder="EVOLVE1:..." style="font-family:ui-monospace,monospace;font-size:12px;resize:none"></textarea>
    <button class="btn block" id="im_go" style="margin-top:12px">Restore data</button>`);
  $("#im_go").addEventListener("click",()=>{
    let raw=$("#im_code").value.trim();
    if(raw.startsWith("EVOLVE1:"))raw=raw.slice(8);
    try{
      const obj=JSON.parse(decodeURIComponent(escape(atob(raw))));
      if(!obj||typeof obj!=="object"||!("workouts" in obj)) throw new Error("bad");
      DATA=Object.assign(JSON.parse(JSON.stringify(DEFAULT_DATA)),obj);
      save(); closeModal(); updateHeader(); switchTab("stats"); toast("Data restored ✓");
    }catch(e){ toast("That code didn't work — check you copied all of it"); }
  });
}

/* ===================== BOOT ===================== */
/* Dynamic splash tiles for returning users (first-ever run keeps the feature chips). */
function renderSplashFeats(){
  const host=document.querySelector(".splash-feats"); if(!host) return;
  if(!DATA.profile) return; /* first run: keep the "what the app does" chips */
  const dayN=Math.floor((Date.now()-new Date().getTimezoneOffset()*60000)/86400000);
  const today=todayISO();
  const tiles=[];
  /* always lead with a suggested workout based on the week so far */
  if(DATA.workouts.length){ const ng=neglectedGroup(); tiles.push({ic:"🎯",t:`Try a ${ng.group} session today`}); }
  else { tiles.push({ic:"🎯",t:"Start with a full-body day"}); }
  const pool=[];
  if(DATA.targets){
    const L=DATA.log[today]||{food:[],water:0,burned:[]};
    const eaten=(L.food||[]).reduce((s,f)=>s+(f.kcal||0),0);
    const burned=(L.burned||[]).reduce((s,x)=>s+(x.kcal||0),0);
    const left=(DATA.targets.calories+(DATA.prefs.addExercise?burned:0))-eaten;
    pool.push({ic:"🍎",t: left>=0?`${eVal(left)} ${eUnit()} left today`:`${eVal(-left)} ${eUnit()} over today`});
    pool.push({ic:"💧",t:`${L.water||0} / ${DATA.targets.water} ml water today`});
    pool.push({ic:"🥩",t:`Protein streak: ${dispProteinStreak()} day${dispProteinStreak()===1?"":"s"}`});
  }
  const ws=dispWorkoutStreak();
  pool.push({ic:"🔥",t: ws>0?`${ws}-day workout streak`:"Ready to start a streak?"});
  pool.push({ic:"🏆",t:`Best streak: ${dispBestStreak()} day${dispBestStreak()===1?"":"s"}`});
  const thisWeek=DATA.workouts.filter(w=>w.date>=curWeekStart()).length;
  pool.push({ic:"📅",t:`${thisWeek} workout${thisWeek===1?"":"s"} this week`});
  if(DATA.weights.length){ pool.push({ic:"⚖️",t:`Bodyweight: ${bodyStr(DATA.weights[DATA.weights.length-1].kg)}`}); }
  const enc=["Train smarter · become next","Small sessions still count","Consistency beats intensity","Show up for today","One more rep than yesterday","Your only competition is you"];
  pool.push({ic:"✨",t:enc[dayN%enc.length]});
  const off=pool.length?dayN%pool.length:0;
  const rotated=pool.slice(off).concat(pool.slice(0,off));
  tiles.push(...rotated.slice(0,3));
  host.innerHTML=tiles.map(x=>`<div class="sf"><span>${x.ic}</span>${x.t}</div>`).join("");
}
renderSplashFeats();
function renderSplashNews(){
  const nt=document.getElementById("newsToggle"), body=document.getElementById("newsBody");
  if(!nt||!body) return;
  body.innerHTML=`<div style="font-weight:700;color:var(--text);margin-bottom:7px">v${LATEST_NUM} · ${LATEST_TITLE}</div>
    ${LATEST_ITEMS.map(i=>"• "+i).join("<br>")}
    <button class="btn ghost block" id="newsFull" style="margin-top:12px">View full history</button>
    <div class="tiny muted center" style="margin-top:8px">Last updated ${LAST_UPDATED}</div>`;
  nt.addEventListener("click",()=>{ const open=body.classList.toggle("open"); nt.classList.toggle("open",open); });
  document.getElementById("newsFull").addEventListener("click",openChangelog);
}
renderSplashNews();
updateHeader();

/* ---- PWA: install prompt (Android/Chrome) + offline service worker ---- */
let deferredInstall=null;
function isStandalone(){ return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone===true; }
window.addEventListener("beforeinstallprompt",(e)=>{ e.preventDefault(); deferredInstall=e;
  if($("#view-more") && $("#view-more").classList.contains("active")) renderMore(); });
window.addEventListener("appinstalled",()=>{ deferredInstall=null; toast("Evolve installed 🎉");
  if($("#view-more") && $("#view-more").classList.contains("active")) renderMore(); });
async function tryInstall(){
  if(deferredInstall){ deferredInstall.prompt(); try{await deferredInstall.userChoice;}catch(e){} deferredInstall=null; renderMore(); return; }
  /* no native prompt available (e.g. iOS, or already installable via menu) */
  openModal(`<h3>Add Evolve to your home screen</h3>
    <div style="line-height:1.6;color:var(--text);font-size:14.5px">
      <p style="margin:0 0 10px"><b>Android (Chrome):</b> tap the <b>⋮</b> menu (top-right) → <b>Add to Home screen</b> / <b>Install app</b> → <b>Install</b>.</p>
      <p style="margin:0"><b>iPhone/iPad (Safari):</b> tap the <b>Share</b> button → <b>Add to Home Screen</b> → <b>Add</b>.</p>
    </div>
    <button class="btn str block" id="inst_ok" style="margin-top:16px">Got it</button>`);
  $("#inst_ok").addEventListener("click",closeModal);
}
if("serviceWorker" in navigator){
  window.addEventListener("load",()=>{ navigator.serviceWorker.register("sw.js").catch(()=>{}); });
}

/* keep number inputs from zooming weirdly handled by viewport; ready. */
