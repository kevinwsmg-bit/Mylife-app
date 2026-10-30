# Module ideas ("boardroom" brainstorm)

Fifty ideas, grouped by theme. Legend: **[Kevin]** = Kevin asked for it, **[MVP]** = suggested for the
first working version, **[Later]** = good idea, not urgent. Nothing here is committed to; Kevin picks.

## Health and medical
1. **Medications [Kevin][MVP]**: custom alarm per dose, daily/weekly schedules, long-term vs temporary
   (with an end date), "taken / skipped / snoozed" history, missed-dose report.
2. **Blood pressure and heart rate [Kevin][MVP]**: one-tap or voice entry ("128 over 82, pulse 71"),
   time of day, arm/position notes, 7/30/90-day averages, trend chart, highs and lows.
3. **Doctor report [Kevin][MVP]**: one page export (PDF or text) of readings, averages and med adherence
   for a date range to hand to a doctor.
4. **Weight [Kevin]**: daily weigh-in, trend line, day-to-day swings.
5. **Symptom log**: quick tags (dizzy, headache, nausea) with severity and time, linked to readings and meds.
6. **Appointments**: upcoming visits, questions to ask, notes afterward.
7. **Refill tracker**: pills remaining, "refill in 5 days" reminder, pharmacy notes.
8. **Medication list card**: current meds and doses on one screen, for ER or a new doctor.
9. **Cross-correlation view [Kevin]**: overlay BP, weight, meds taken, sleep and food on one timeline.
10. **Lab results log [Later]**: numbers from blood work over time (A1C, cholesterol, etc.).
11. **Allergies and conditions card [Later]**.
12. **Caregiver alerts [Later]**: if a dose is missed, notify the other person (Kevin and his father).

## Fitness and body
13. **Workouts**: type, duration, how it felt.
14. **Steps and walking**: manual or imported.
15. **Water intake**: tap to add a glass.
16. **Sleep log**: bedtime, wake time, quality.
17. **Food log [Kevin]**: quick meals, optional photos, simple notes (no calorie obsession required).
18. **Stretching / physical therapy routine**: especially useful with back pain; checklist with a timer.
19. **Pain tracker**: location and level, so patterns show up.
20. **Energy and mood check-in**: one tap, 1 to 5.

## Daily life and organization
21. **Daily journal [Kevin]**: free text or voice, with a "how was today" summary.
22. **Today screen [Kevin]**: the home screen. Next med, tasks due, readings still to take, what's on TV tonight.
23. **Tasks and to-dos**: simple lists with due dates and repeats.
24. **Reminders**: one-off and recurring, not just meds.
25. **Habit streaks**: small daily wins with a streak counter.
26. **Notes and quick capture**: voice memo to text.
27. **Calendar view**: everything with a date, in one place.
28. **Contacts and important numbers**: doctors, pharmacy, insurance.
29. **Documents vault [Later]**: insurance cards, prescriptions (needs strong security).

## Groceries and home
30. **Voice grocery list [Kevin][MVP]**: tap the mic, say "out of eggs," and it's added. De-duplicates.
31. **Fridge/pantry check**: what's on hand vs low.
32. **Grocery export [Kevin]**: copy or share the list to Walmart (see open decision in `CLAUDE.md`).
33. **Meal planner and recipes**: week plan that generates the grocery list.
34. **Regulars list**: the items you buy every time, one tap to add.
35. **Household chores**: repeating tasks (trash day, laundry).
36. **Pet care [Later]**: meds, vet visits, feeding.

## Entertainment and interests
37. **TV and movies [Kevin]**: shows you follow, next episode and premiere dates, "new episode tomorrow"
    reminders (e.g. Dexter).
38. **Watchlist**: things to watch with notes on who recommended them.
39. **Sports tracker [Kevin, father]**: team schedule and scores (e.g. Reds games).
40. **Music and podcast queue [Later]**.
41. **Books and reading log [Later]**.
42. **Shared "watch together" list**: Kevin and his father's shared shows.

## Money and admin
43. **Budget and spending log**: quick expense entry, monthly summary.
44. **Bills and due dates**: reminder before each bill is due.
45. **Medical expenses and claims**: copays, receipts, claim status.
46. **Subscriptions tracker**: what you pay for and when it renews.

## Family and sharing
47. **Profiles [Kevin]**: Kevin and his father each have their own modules, settings and data.
48. **Shared lists**: groceries or shows visible to both.
49. **Module store**: turn modules on or off per person, add new ones over time.

## Platform features
50. **Voice-first entry everywhere [Kevin]**: a mic button on every module. Backup, export and
    big-text/accessibility settings are part of this item too.

## Suggested build order
1. App shell with profiles and the Today screen.
2. Blood pressure log (with voice entry and averages).
3. Medications with reminders.
4. Doctor report export.
5. Voice grocery list.
6. TV/movie reminders, weight, journal, then everything else as Kevin thinks of it.
