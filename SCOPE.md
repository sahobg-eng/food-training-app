# Food and Training App - V1 Scope

Nov 16, 2026 · @Aleksandar Georgiev

## Summary

V1 is a personal, single-user Android web app that logs strength training, body measurements and daily macros against a target, at zero running cost.

- **Build:** in Claude Code, as a web app installed to the phone's home screen. A native app is not needed.
- **Cost rule:** nothing in V1 may cost money. No AI calls, no paid hosting, no paid APIs.
- **Priority order:** training log, body measurements, macro goals and food logging. Recipes are V2. Fridge suggestions are last.

## Training log

A workout is started either from a saved routine or as an empty session, and every set is stored permanently for later analysis.

- **Exercise library:** a user-managed list of exercises. Add, rename and archive. Archived exercises keep their history.
- **Saved routines:** a named, ordered list of exercises (e.g. "Push day"). Create, edit, reorder, duplicate and delete.
- **Start from routine:** pre-fills the exercises. During the session, exercises can be added, removed or swapped without changing the saved routine.
- **Free workout:** starts empty and exercises are added as you go.
- **Set entry:** reps and weight per set, any number of sets per exercise. Sets can be edited or deleted.
- **Previous values:** while logging an exercise, the app shows the sets from the last time it was performed.
- **Session timer:** starts when the workout starts and stops when it is finished. Start time, end time and duration are stored.
- **No rest timer** between sets.
- **History:** a list of past workouts, each openable and editable.
- **Data kept for later analysis:** every set is stored with its date, workout, exercise, set order, reps and weight. Graphs are not part of V1.

## Body measurements

Body measurements are dated entries against a list of measurement types that you define.

- **Measurement types:** body weight by default, plus any you add (e.g. waist, chest, arm).
- **Entry:** date and value. An entry can cover one type or several at once.
- **History:** a list per measurement type, with edit and delete.
- **Data kept for later analysis:** all entries are stored with their date. Graphs are not part of V1.

## Macro goals

There are two target sets, one for workout days and one for rest days, each with calories, protein, carbs and fat.

- **Targets:** both sets are entered manually and can be changed at any time. Changing a target does not rewrite past days.
- **Day type:** each day is either a workout day or a rest day. A weekly schedule sets the workout days, and any single day can be switched manually.
- **Daily view:** consumed against target for calories and each macro, with the remaining amount.
- **History:** past days keep the target that applied on that day, so later analysis compares intake with the right target.

## Food logging

Food is logged manually in V1: as a new entry, or by re-using a saved food.

- **Manual entry:** name, amount, calories, protein, carbs and fat. Each manually entered food is saved to a personal food list.
- **Personal food list:** saved foods with macros per 100 g or per serving. Logging one only needs the amount.
- **Recent and favourites:** one-tap re-entry of foods logged before. This is expected to carry most daily logging.
- **Editing:** logged entries can be edited or deleted, for today and for past days.
- **Not in V1:** barcode scanning and photo estimation.

## Data, storage and cost

All data is stored on the phone only, at zero cost, with export and import as the backup.

Phone-only storage works offline in the gym and needs no account. The accepted risk is data loss if the phone is lost or browser data is cleared, so regular export is the only backup.

- **Export:** a full export of all data to a file is in V1 under either option.
- **Import:** restoring from an export file is in V1.
- **Hosting:** the app itself is served from a free static host.
- **Units:** kilograms, centimetres and grams.

## Out of scope for V1

| Item | When |
| --- | --- |
| Graphs and analysis of training, measurements and macros | Later version - the data is captured from day one |
| Barcode scanning | Later version |
| Recipes: store, and log a recipe as a meal | V2 |
| Fridge-based cooking suggestions | Last priority |
| Shopping list | Not scheduled |
| Photo-based macro estimation | Dropped until paid services are allowed |
| Rest timer between sets | Not wanted |
| Training plans, wearable integrations, multiple users | Not scheduled |

## Decisions and assumptions

All scope decisions are closed and all assumptions are confirmed. V1 is ready to build.

**Decisions taken on 19 Nov 2026**

- **Storage:** phone only, with export and import.
- **Day type:** weekly schedule with a manual override per day.
- **Graphs:** not in V1.
- **Food entry:** manual only. Barcode scanning moves to a later version.

**Assumptions confirmed**

- Graphs are not in V1.
- Metric units only.
- Measurement types are user-defined, with body weight as the only default.
- Barcode data source is moot for V1, since scanning is out.
