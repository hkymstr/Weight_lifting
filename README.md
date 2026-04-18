# Push / Pull / Legs — Workout Tracker for Google Sheets

A fully-featured gym workout tracker built with Google Apps Script. One-time setup, then use it every day at the gym straight from your phone or laptop.

## What it does

- **Pre-fills your workout** from editable Push / Pull / Legs templates — just open the menu and tap Load
- **Tracks weight, reps, and notes** per set, with auto-calculated estimated 1-rep max (Epley formula)
- **Shows your strength progress** over time with a chart for any exercise
- **All-time PR board** on the Dashboard — best weight and best estimated 1RM per exercise
- **Add any exercise or machine** in seconds via the Workout menu; dropdowns update automatically
- Color-coded by workout type (Push = red, Pull = teal, Legs = blue) for fast visual scanning

---

## Installation

1. **Create a new Google Sheet** at [sheets.google.com](https://sheets.google.com)
2. Click **Extensions → Apps Script**
3. Delete the placeholder code in `Code.gs`, then paste the entire contents of [`Code.gs`](./Code.gs) from this repo
4. Click **Save** (disk icon or `Ctrl+S`)
5. In the top toolbar, select the function **`setup`** from the dropdown and click **Run**
6. When prompted, click **Review permissions → Allow** (the script only accesses your own spreadsheet)
7. Close the Apps Script tab and return to your Google Sheet — it's ready

> **Note:** If your timezone is not `America/New_York`, open `appsscript.json` in the Apps Script editor and update the `timeZone` field before running setup. A list of valid values is [here](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones).

---

## Sheets overview

| Sheet | Purpose |
|---|---|
| **Dashboard** | All-time PRs per exercise + recent workout history |
| **Log** | Daily workout data entry — one row per set |
| **Templates** | Default exercises and set counts for Push, Pull, and Legs — edit freely |
| **Exercises** | Full exercise library with type, muscle group, and equipment |
| **Progress** | Select any exercise to see a strength progress chart over time |

---

## Daily use

### Loading a workout
1. Open your sheet
2. Click **Workout → Load Push / Pull / Legs** from the top menu
3. Today's session is pre-filled in the **Log** sheet — one row per set, cursor lands on the Weight column
4. Fill in **Weight (lbs)** and **Reps** as you complete each set
5. **Est. 1RM** calculates automatically using the Epley formula: `weight × (1 + reps / 30)`
6. Add anything to **Notes** (e.g. "paused reps", "felt easy", "left shoulder tight")

### Checking progress
1. Go to the **Progress** tab
2. Click the yellow cell next to **Exercise:** and pick any exercise from the dropdown
3. Click **Workout → Refresh Progress Chart**
4. The chart shows **Best Weight** and **Best Est. 1RM** per session over time

---

## Adding exercises and machines

**Option A — Menu prompt (recommended):**
1. Click **Workout → Add Exercise / Machine**
2. Follow the 4-step prompt: name → type (Push/Pull/Legs) → muscle group → equipment
3. The exercise is added to the library and immediately available in all dropdowns

**Option B — Edit the Exercises sheet directly:**
- Add a row with: Exercise name, Type, Muscle Group, Equipment
- Then run **Workout → Add Exercise / Machine** once (and cancel it) to trigger a dropdown refresh — or simply reload the sheet

---

## Customising templates

Open the **Templates** sheet. Each workout type has three columns: Exercise, Sets, Target Reps. Edit any row, add rows, or change set counts. Changes take effect the next time you load that workout.

---

## Re-running setup

Running `setup()` again rebuilds all sheets from scratch. **Your existing log data will be deleted.** Back up the Log sheet first if you want to keep it.

---

## How Est. 1RM works

The tracker uses the **Epley formula** — one of the most widely used 1RM estimators:

```
Est. 1RM = Weight × (1 + Reps / 30)
```

This lets you compare performance across different rep ranges. For example, 185 lbs × 10 reps estimates to ~246 lbs 1RM, which you can track improving over time even without ever doing a true 1-rep max.

---

## Pre-loaded exercises

**Push** — Bench Press, Incline Bench Press, Overhead Press, Dumbbell Shoulder Press, Lateral Raises, Cable Fly, Chest Press Machine, Tricep Pushdown, Skull Crushers, Overhead Tricep Extension, Dips

**Pull** — Deadlift, Barbell Row, Pull-ups, Lat Pulldown, Seated Cable Row, Face Pull, Barbell Curl, Dumbbell Curl, Hammer Curl, Shrugs, T-Bar Row

**Legs** — Barbell Squat, Romanian Deadlift, Leg Press, Leg Curl, Leg Extension, Calf Raise, Bulgarian Split Squat, Hack Squat, Hip Thrust
