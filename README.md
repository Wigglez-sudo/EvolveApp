# Evolve — Gym & Nutrition

**Train smarter · Become next.**

> Current release: **v3.31** (final) — adds multi-day **routines**, private **progress photos**, **CSV export**, and a **1RM training-percentage** table; reworks food logging (＋ Add food at the top plus a floating ＋, smarter exact-name portions, categorised custom foods); and removes the splash logo frame.

Evolve is an all-in-one workout and nutrition tracker that runs entirely on your phone. Build and follow workouts, track your lifts, plan your week, log food and macros, and watch your progress grow — online or off, with no account and no data ever leaving your device.

It installs to your home screen on both **iPhone/iPad** and **Android** and works like a native app, fully offline.

---

## How Evolve was built

Evolve was created and directed by **Wigglez** — the ideas, the vision, the feature list, the design decisions, and the relentless on-device testing all came from one person who wanted a fitness app that actually worked the way they think.

The code itself was written in partnership with **Claude** (Anthropic's AI assistant). Wigglez described what Evolve should do and how it should feel, tested every build on real Apple and Android hardware, sent back screenshots and feedback, and drove each round of changes; Claude turned those ideas into the working app, one feature at a time.

That back-and-forth — a clear human vision plus an AI build partner — is how Evolve grew from a single idea into the app in this repository. Every screen exists because someone using it asked for it.

---

## Privacy first — by design

Evolve was built to be genuinely private. There is no clever fine print here:

- **Your data stays on your device.** Everything — workouts, food, weight, settings — is saved in your phone's local storage. It never touches a server, because there is no server.
- **No account, no sign-up, no email.** You open it and use it. Nothing to register.
- **No cloud by default, no tracking.** Evolve does not phone home, run analytics, fingerprint you, or send your information anywhere by default. Cloud backup is manual and user-controlled: Evolve creates an encrypted backup file locally, then you choose where to save/share it. Evolve does not upload it automatically or know where you store it.
- **No ads.** None, ever.
- **Works fully offline.** After the first visit it runs with no internet at all.
- **You own your data.** Export a **backup code** any time (More → Backup & restore), create a password-encrypted backup file, then save/share it to iCloud, Files, Google Drive, Proton Drive, Dropbox, OneDrive, MEGA, email, USB, or anywhere else your phone offers. Anything that leaves the phone happens only when *you* choose it.

Because your data lives locally by default, the one thing to remember is: **export a backup code or encrypted backup and keep it somewhere safe**. If you delete the app or switch phones without a backup, the data goes with it. Evolve can remind you daily, weekly, biweekly, monthly, or not at all.

---

## Features

- **Home dashboard** — a daily hub that adapts to your plan: start today's session, see your week, your fuel snapshot, streaks, and a quick bodyweight log.
- **Workout library** — muscle-group builders with sub-muscle focus, ready-made preset days, a "Mega" multi-group session, home/bodyweight routines, and saved favourites.
- **Live tracker** — a full-screen, distraction-free workout screen with set logging, rest timer (with beep + flash), warm-up generator, plate calculator, supersets, per-exercise swaps, workout notes, and tap-to-view exercise history.
- **Weekly planner** — tick the days you train and Evolve builds a balanced split with coaching advice, rest days, and bonus sessions.
- **Fuel (nutrition)** — calorie ring, protein/carbs/fat rings, water tracking, common portion chips, typo-tolerant food search, a 700+ food database, and your own custom foods.
  - Log into **Breakfast / Lunch / Dinner / Snacks**, with optional times.
  - **Recent & frequent foods** for one-tap re-logging, **favourite foods (★)**, and **repeat a meal** from another day.
- **Progress** — date-scaled bodyweight trend, lifting volume, estimated 1-rep-max, a training calendar, workout history with repeat-from-history, and streaks.
- **Themes** — recolour the whole app with one tap.
- **Built-in help** — a "How this page works" button on every main tab explains what it does and how to use it; experienced users can hide/re-enable those bars in More → Preferences.
- **Backup & restore** — portable export/import codes, password-encrypted backup files that can be saved/shared to cloud storage of the user’s choice, and backup reminders with a test notification button.

---

## How it's made (technical)

Evolve is deliberately simple under the hood:

- **Plain static files.** The app is split into `index.html`, `styles.css`, `data.js`, and `app.js` — HTML, CSS, and vanilla JavaScript. No frameworks, no build step, no dependencies, no package manager.
- **Local storage** holds all state as JSON on the device.
- **PWA** — a `manifest.json` and a service worker (`sw.js`) make it installable and fully offline.
- **Hosted free on GitHub Pages** as a static site. Nothing runs on a backend because there is no backend.

### Files in this repo

| File | What it is |
|------|------------|
| `index.html` | App shell and splash |
| `styles.css` | App styling |
| `data.js` | Exercise and food data |
| `app.js` | Main app logic |
| `manifest.json` | App name, icons, and install settings (icons are embedded) |
| `sw.js` | Service worker — offline caching |
| `EVOLVE_HANDOFF.txt` | Developer notes / project history |
| `Evolve-v3.31-preview.html` | Single-file preview build for testing |
| `evolve_code.txt` | Combined source snapshot/reference dump |
| `LICENSE` | MIT license (free to reuse with credit) |
| `README.md` | This file |

---

## Install it

Open the published link in your phone's browser:

- **iPhone / iPad (Safari):** Share button → **Add to Home Screen** → Add. *(iPhones never show an install pop-up — Add to Home Screen is the install.)*
- **Android (Chrome):** tap **Install** on the banner, or **⋮ → Install app / Add to Home screen**.

After the first online visit it works completely offline. This ZIP is a test package, so install/check it on real devices before treating it as final.

---

## Updates

New versions are published by replacing the files in this repo. Your saved data is **never** affected by an update — workouts, food, weight, and settings all carry over. To pull a new version, fully close the app and reopen it once or twice.

**Latest release — v3.31 (14 Jun 2026, final):** Adds four features drawn from a review of the leading workout trackers. **Routines** — build a multi-day program (e.g. Push/Pull/Legs) under Train → 📋 Programs and start any day with one tap. **Progress photos** — a private visual timeline in Progress → Trends, stored only on the device and never uploaded or backed up. **CSV export** — save workouts or the food log as a spreadsheet from Settings → Backup. **1RM training percentages** — the strength sheet shows 60–95% of your estimated 1RM. Food logging also improves: ＋ Add food sits at the top of Fuel with a floating ＋ that follows you as you scroll; portions now use an exact-name list (common foods show 1 egg / 1 slice, everything else uses grams, and grams entry is always available); custom foods can be tagged with a category. The splash logo no longer has a frame.

**v3.29-test (12 Jun 2026):** Simplifies cloud backup. The awkward Google Drive OAuth / Client ID flow has been removed from the main app. Evolve now creates a password-encrypted backup file locally, then opens the phone’s normal Save/Share sheet so the user can choose iCloud, Files, Google Drive, Proton Drive, Dropbox, OneDrive, MEGA, email, USB, or any other storage target. Backup reminders, notification permission, Send test notification, encrypted restore, manual backup codes, local profile photos and all v3.28 safeguards remain.

**v3.28-test (12 Jun 2026):** Added optional encrypted Google Drive backup, password-encrypted local backup files, restore from encrypted files/Drive, backup reminder frequency (Off/Daily/Weekly/Biweekly/Monthly), and a test notification button so you can see how reminders look. Google Drive backup was off by default, warned twice before enabling, and required the user to provide a Google OAuth Client ID before upload could work. This was replaced in v3.29-test by the simpler encrypted Save/Share flow.

**v3.23-test (12 Jun 2026):** A test build focused on reducing daily friction. Food logging gains common portion chips and typo-tolerant search; Progress workout history can repeat a saved session into the live tracker; Backup can now save/share a text file as well as copy the code; the live tracker gets workout notes and tap-to-view exercise history; 150s rest chips are available in-session; Preferences are split into clearer sub-sections; and the bodyweight trend spaces points by date.

**v3.22 (12 Jun 2026):** A quality-of-life polish pass across every tab. The bottom nav now puts **Home in the centre** (raised and bordered in your theme colour) with Settings on the right; the **Progress** tab groups its sections into **Trends**, **Activity** and **Goals & milestones** with **Expand / Collapse all**; **Settings** gains a profile header, colour-coded sections, and new options (**default rest timer**, rest **beep** & **flash** toggles, **keep screen awake**, **water unit & tap amount**, and which **tab opens** first); **Home** gains *Quick actions* and a tappable *At a glance* strip; the **Fuel** tab finally has its own title; every **How this page works** sheet was rewritten into quick, scannable rows (Settings has one now too); the splash *What's new* no longer overlaps the footer; and manual macro targets add up to your exact calories.

**v3.21 (12 Jun 2026):** The Fuel tab is reorganised so it's quicker to use — **Add food**, Burned and Repeat a meal sit right under your calorie ring and macros, your food log moved up, Goal & activity became a small link at the bottom, and the **Show meal times** switch moved to **More → Preferences**.

**v3.20 (12 Jun 2026):** Cardio no longer loses your progress — leave a cardio timer mid-workout (✕, Back, or switching away) and it now **resumes from where you left off** instead of restarting at zero, with the elapsed time and a **Resume** button shown on the card; progress is even kept if the app closes mid-session.

**v3.19 (12 Jun 2026):** Manual daily targets auto-fill protein/carbs/fat from your calories once you pick a focus (build muscle, lose fat, more energy or balanced); Repeat-a-meal and the favourite/saved-workout lists now show the actual foods and exercises; a set needs a weight or some reps before it logs; and backup codes import with or without the `EVOLVE1:` tag. Full notes live in-app under **More → What's new**.

---

## License

Evolve is released under the **MIT License** — see [`LICENSE`](LICENSE).

In plain English: **you are free to use, copy, modify, and share the code, including in your own projects** — commercial or not. The one condition is simple: **keep the credit.** Leave the copyright line (© 2026 Wigglez) in any copy or substantial portion you reuse, so the original work is acknowledged. That's it.

---

## ⚠️ Health & safety disclaimer

**Evolve is a personal tracking tool, not a medical device, and nothing in it is medical, dietary, or professional fitness advice.**

- All calorie targets, macro targets, calorie-burn figures, and estimated one-rep-max numbers are **estimates** generated by simple formulas. They can be wrong for your body and your goals.
- Evolve does not know your medical history. It cannot account for injuries, conditions, medications, pregnancy, allergies, or other personal factors.
- **Always consult a qualified healthcare professional, doctor, dietitian, or certified trainer** before starting, changing, or stopping any exercise or nutrition programme.
- Listen to your body. Stop and seek medical advice if you feel unwell, dizzy, or in pain.
- You use Evolve, and act on anything it suggests, **at your own risk.** The creator and contributors accept no liability for any outcome — see the warranty notice in [`LICENSE`](LICENSE).

If you have a medical condition or any doubt, talk to a professional before relying on this app.

---

*Created by Wigglez · Built with Claude · Licensed under MIT · © 2026*
