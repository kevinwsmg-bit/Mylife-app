# MyLife App

A customizable, modular "everything" app for day-to-day life. Built for Kevin first, then for Kevin and
his father (each with their own modules and their own data). Meant to be opened constantly: a daily
log, a tracker, and eventually a replacement for many single-purpose phone apps.

## How to work with Kevin
- Kevin works mostly from his phone (Android, Chrome) and is not a developer. Explain steps plainly,
  one at a time, and say what he should see on screen.
- Commit and push to GitHub after each meaningful chunk so phone and computer sessions stay in sync.
- Update the "Status / where we left off" section below at the end of every working session.

## Research
See `docs/research.md` (Walmart cart hand-off, open smartwatch options, health-sensing limits). Never present watch readings as medical-grade.

## Core principles
1. **Modular.** Each feature is a self-contained module (Meds, Blood Pressure, Groceries, TV, ...).
   Adding a module must not require rewriting the others. Each user chooses which modules are on.
2. **Fast capture.** Logging something should take one tap or one spoken sentence.
3. **Privacy first.** This repo holds CODE only. Never commit real personal or medical data
   (readings, medication names/doses, names of doctors, etc.). Use fake sample data in the repo.
   Real data lives on the user's own device (later: a private, secured sync).
4. **Not medical advice.** The app logs and reminds. It does not diagnose or change doses. Medication
   reminders are a convenience, so Kevin should keep a backup alarm until the reminders are proven reliable.
5. **Multi-user ready.** Design data with a "profile" from day one so Kevin and his father can each have
   their own modules, settings and data.

## Planned modules
See `docs/modules.md` for the full brainstorm. Priority order Kevin described:
1. Medications: scheduled reminders/alarms, temporary vs long-term meds, taken/missed history.
2. Blood pressure and heart rate: voice or tap entry (systolic/diastolic/pulse), timestamped,
   averages over 7/30 days, day-to-day trends, doctor-ready export.
3. Weight: daily weigh-in, trend line.
4. Groceries: voice-added "I'm out of X" list; later export or hand-off to the Walmart app.
5. Daily journal / log with a food log.
6. TV and movies: release dates and episode reminders (Dexter, etc.).
7. Interest modules per person (e.g. Reds games for his father).

## Architecture (v0.1)
- Installable web app (PWA): plain HTML, CSS and JavaScript modules. No build step, no dependencies.
  Open `index.html` through any static web server (for example `python3 -m http.server`).
- `js/core/`: `store.js` (profiles and per-profile data in localStorage), `dom.js` (h(), mount(), modal),
  `voice.js` (speech input), `reminders.js` + `notify.js` (med alarms), `charts.js`, `util.js` (dates, spoken-text parsing).
- `js/modules/`: one file per module. Each exports `{ id, name, tab?, icon, blurb, render(root), todayCard?() }`.
  To add a module: create the file, add its id to `ALL_MODULES` in `core/store.js`, register it in `modules/index.js`.
- Built so far: Today, Meds (scheduled reminders, adherence, .ics export; as-needed meds with one-tap "Take now" log, optional wait-hours confirm, shown on Today and in the doctor report), Blood Pressure (voice entry, averages, chart),
  Activity & How I Feel (activity, minutes, pain level/area, mood, notes; one-tap pain log on Today), Oxygen & Pulse (voice, fingertip vs experimental watch readings; watch readings are excluded from the doctor report), Weight, Groceries (voice, regulars, copy/share/Walmart search links), To-Do (voice, due dates),
  Calendar (events plus to-do and TV dates), Journal and Food, TV and Movies, App Ideas, Doctor Report (per-section and per-medication toggles, PDF/share/copy/CSV, optional every-reading detail), Settings
  (profiles, module toggles, backup/restore).
- All data stays in the browser (localStorage), per profile. Backup/restore is a JSON file in Settings.
- Lessons learned: `replaceChildren` stringifies arrays and null, so always use `mount()` from `core/dom.js`.

## Known limits
- Med reminders only fire while the app is open in the browser (no server push yet). Backup: Meds -> export .ics to phone calendar.
- No cloud sync between devices yet; each device keeps its own data. Use backup/restore to move data.
- TV dates are entered by hand. Walmart is a list hand-off (copy/share/search links), not automatic add-to-cart.

## Open decisions (ask Kevin before building)
- Hosting: DECIDED. Repo is public (code only) and served by GitHub Pages at https://kevinwsmg-bit.github.io/Mylife-app/ (deploys from main, root).
- Reliability of med alarms: PWA notifications can be unreliable when the app is closed. May need
  a small server for push notifications, or a native Android build for exact alarms.
- Where real data is stored and synced (on-device only at first; private backend later).
- Walmart: no public "add to cart" API is known. Realistic options are a shareable list, copy/paste,
  or a deep link. Needs research before promising.

## Status / where we left off
- v0.1 built, tested in a headless browser, and live on GitHub Pages. Kevin confirmed it loads and works on his phone.
- Every push to main redeploys the site in 1-2 minutes. The service worker is network-first, so reloads pick up updates.
- Kevin likes the idea of a Bangle.js 2 watch prototype (meds alarms on the wrist, tap-to-log). He asked for SpO2, BP and irregular-rhythm detection; research says
  those are not feasible or safe on a DIY watch (see docs/research.md). Proposed instead: watch for heart rate, alarms and quick logging; validated devices for BP/SpO2.
- Added Oxygen & Pulse module (v0.2). Store now migrates: new module ids in ALL_MODULES are switched on once for existing profiles (see migrate() in core/store.js).
  Kevin confirmed voice entry works on his phone. He is ordering a Bangle.js 2; watch app (alarms, heart rate, tap-to-log) is the next big piece.
- v0.3: scheduled doses record the actual time taken (Taken now / Taken at… / Skip, shows how early or late); Activity & How I Feel module; Doctor Report rebuilt with toggles and sharing.
  Sharing is user-initiated only (Share sheet, PDF, copy, CSV); the app cannot send directly to a doctor's system.
- Next: Kevin installs it to his home screen and uses it for a few days, then reports what to change or add
  (he can use the App Ideas module and paste the list into a session). Likely next steps: reliable alarms
  (push server or native Android), cross-device sync, TV release dates from an API, Walmart hand-off research.
