<div align="center">

# 💪 Evolve

### Train smarter · Become next.

**A private, offline-first gym & nutrition tracker that lives entirely on your device.**

`Version 3.31` · Built by **Wigglez**

</div>

---

## 🌟 What is Evolve?

Evolve is a personal **fitness Progressive Web App (PWA)** — a full gym and nutrition tracker that runs in your browser and installs to your home screen like a native app. No accounts, no sign-ups, no ads, no servers. Everything you log stays **on your device**.

It's built for people who want a powerful training and food log *without* handing their data to a company.

---

## ✨ Features

### 🏋️ Train
- **Target a muscle group** — tap Chest, Back, Shoulders, Arms, Legs or Core to auto-build a workout; choose how many exercises, focus a sub-muscle, and swap any you don't like.
- **📋 Programs (routines)** — save a multi-day plan like **Push / Pull / Legs**, then start any day with one tap. Begin from a ready-made template (PPL, Upper/Lower, Full Body ×3) or build your own.
- **Mega workouts** — mix several muscle groups (plus optional cardio) into one session.
- **★ Favourites** — star exercises and build a session from them, or save whole workouts to repeat.
- **Gym / Home modes** — the exercise pool adapts to where you're training.
- **Live logging** — sets, reps, weights, supersets, rest timer, previous-set hints and quiet progressive-overload nudges.

### 🏃 Cardio
- Track any cardio activity with live calorie & distance estimates.
- **Ready, then Start** — a fresh cardio opens on a Ready screen and the timer only begins when you tap **▶ Start**, so you can get set up first.
- Pause, resume and finish — leave mid-session and it picks up where you left off.

### 🥩 Fuel (nutrition)
- **Plate-based logging** — add several foods to a running plate, then log the whole meal at once.
- **Floating ＋** — the Add Food button follows you as you scroll.
- **Smart portions** — common foods show a sensible portion (1 egg, 1 slice); everything else uses grams, and grams entry is always available.
- **Typo-friendly search** with your recent & favourite foods on top.
- **Your own foods** — add custom foods with macros and an optional category.
- Daily calorie ring and protein / carbs / fat / water targets.

### 📈 Progress
- **Trends** — bodyweight, lifting volume, and strength per exercise with **estimated 1RM** and a **60–95% training-percentage table** for percentage-based programming.
- **📸 Progress photos** — a private photo timeline stored **only on your device** (never uploaded, never backed up).
- **Activity calendar** — full workout, cardio and Mega history; expand any workout to repeat it.
- **Goals & milestones** — streaks, daily targets and achievements.

### 🤖 AI Coach *(optional)*
- A dedicated Coach tab powered by **your own** [OpenRouter](https://openrouter.ai) API key (free models available).
- **Chat** about your training & nutrition, **generate a workout**, or **analyse your recent logs** — grounded in your actual data.
- 🔒 **Privacy-first:** this is the *only* feature that sends data off your device, and it tells you exactly what's shared before you enable it. Your API key is stored **only on this device**, is **never** included in any backup, and is never sent anywhere except OpenRouter.

### ⚙️ Settings & personalisation
- **🎨 Themes** that recolour the whole app.
- **🔤 Heading font** — choose **Modern**, **Bold** or **Classic**.
- Units (kcal/kJ, kg/lb/stone), rest timer length + end beep & flash, keep-screen-awake, water unit, start tab, meal times and more.
- **Profile photo** — local only, never uploaded.

### 🔐 Backup & privacy
- **Encrypted backups** — lock your data with a password (AES-GCM via the Web Crypto API), then save or share the file anywhere you like (iCloud, Files, Drive, etc.). Restore with the same password.
- **Backup reminders** — Off / Daily / Weekly / Biweekly / Monthly, with optional notifications.
- **CSV export** — export your workouts or food log as a spreadsheet for your own records.
- **No tracking, no ads, no servers.** Photos and your AI key are device-only and never leave in a backup.

---

## 🔒 Privacy by design

Evolve is **offline-first** and stores everything in your browser's local storage on your own device.

- ✅ No account, no login, no email required
- ✅ No analytics, no tracking, no ads
- ✅ No backend server — there's nowhere for your data to be sent
- ✅ Backups are encrypted and only go where *you* choose to put them
- ⚠️ The **AI Coach** is the single optional exception — it sends your question and a training summary to OpenRouter *only when you ask it to*, and only after you've given clear consent

---

## 📲 Install

Evolve is a PWA, so you can install it straight from the browser:

**iPhone / iPad (Safari)**
1. Open the app's web address in Safari
2. Tap the **Share** button
3. Tap **Add to Home Screen**

**Android (Chrome)**
1. Open the app's web address in Chrome
2. Tap the **⋮** menu
3. Tap **Install app** / **Add to Home Screen**

Once installed it runs full-screen and works **offline**.

---

## 🛠️ Tech

- **Vanilla JavaScript, HTML & CSS** — no framework, no build step
- **PWA** with a service worker for offline use and home-screen install
- **localStorage** for all app data; **Web Crypto API** (AES-GCM + PBKDF2) for encrypted backups
- **OpenRouter API** for the optional AI Coach (user-supplied key)

---

## 📁 Repository contents

| File | Purpose |
| --- | --- |
| `index.html` | App shell & layout |
| `styles.css` | All styling |
| `data.js` | Exercise & food databases |
| `app.js` | All app logic |
| `sw.js` | Service worker (offline cache) |
| `manifest.json` | PWA manifest |
| `icon-*.png`, `apple-touch-icon.png`, `favicon.png` | App icons |
| `Evolve-v3.31-preview.html` | Single-file build for quick testing |

---

## 📝 Changelog highlights — v3.31

- 🤖 **AI Coach** — optional, bring-your-own-key coaching with strong privacy transparency
- 📋 **Routines / Programs** — multi-day plans with starter templates and a first-time walkthrough
- 📸 **Progress photos** — private, on-device only
- 📊 **CSV export** of workouts and food
- 🔢 **1RM training percentages** (60–95%)
- 🏃 **Cardio Ready screen** — timer waits until you tap Start
- 🔤 **Heading font** setting (Modern / Bold / Classic)
- 🍽️ **Faster food logging** — top-of-page + floating Add button, smarter portions, categorised custom foods
- 🔍 **Zoom disabled** for a more native feel
- 🛠️ Rest-timer label fix and various polish

---

<div align="center">

**Evolve** — *Created by Wigglez* 💪

*Private. Offline-first. Yours.*

</div>
