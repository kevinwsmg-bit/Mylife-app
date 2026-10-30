# MyLife App

A customizable, modular "everything" app for day-to-day life. Built for Kevin first, then for Kevin and
his father (each with their own modules and their own data). Meant to be opened constantly: a daily
log, a tracker, and eventually a replacement for many single-purpose phone apps.

## How to work with Kevin
- Kevin works mostly from his phone (Android, Chrome) and is not a developer. Explain steps plainly,
  one at a time, and say what he should see on screen.
- Commit and push to GitHub after each meaningful chunk so phone and computer sessions stay in sync.
- Update the "Status / where we left off" section below at the end of every working session.

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

## Open decisions (ask Kevin before building)
- Platform: installable web app (PWA) first, versus a native Android app. Recommended: PWA first
  for speed and one codebase across phone, computer and his father's device.
- Reliability of med alarms: PWA notifications can be unreliable when the app is closed. May need
  a small server for push notifications, or a native Android build for exact alarms.
- Where real data is stored and synced (on-device only at first; private backend later).
- Walmart: no public "add to cart" API is known. Realistic options are a shareable list, copy/paste,
  or a deep link. Needs research before promising.

## Status / where we left off
- Repo created and connected to Claude. Vision and module brainstorm written. No app code yet.
- Next step: Kevin picks platform approach and the first module (suggested: Blood Pressure log plus
  Medications), then we build a minimal working version.
