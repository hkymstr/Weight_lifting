/**
 * ═══════════════════════════════════════════════════════
 *  PUSH / PULL / LEGS — Workout Tracker for Google Sheets
 * ═══════════════════════════════════════════════════════
 *
 *  SETUP (one-time):
 *  1. Create a new Google Sheet
 *  2. Extensions → Apps Script
 *  3. Paste this entire file into Code.gs and save
 *  4. Run → setup  (grant permissions when prompted)
 *  5. Return to your sheet — it's ready!
 *
 *  DAILY USE:
 *  "Workout" menu → Load Push / Pull / Legs
 *  The workout pre-fills in the Log sheet.
 *  Fill in Weight (lbs) and Reps as you train.
 *  Est. 1RM auto-calculates (Epley formula).
 *
 *  ADDING EXERCISES / MACHINES:
 *  "Workout" menu → Add Exercise  (or edit the Exercises sheet directly)
 *
 *  PROGRESS:
 *  Go to Progress tab → pick any exercise → Workout menu → Refresh Progress Chart
 */

// ── Colour palette ────────────────────────────────────
const CLR = {
  push:   '#FF8A80',
  pull:   '#80CBC4',
  legs:   '#81D4FA',
  hdr:    '#263238',
  white:  '#FFFFFF',
  row2:   '#F5F5F5',
  muted:  '#78909C',
  yellow: '#FFF9C4',
  light:  '#ECEFF1',
};

// ── Pre-loaded exercise library ───────────────────────
// [Name, Type, Muscle Group, Equipment]
const EXERCISE_DATA = [
  ['Bench Press',              'Push', 'Chest',          'Barbell'   ],
  ['Incline Bench Press',      'Push', 'Chest',          'Barbell'   ],
  ['Overhead Press',           'Push', 'Shoulders',      'Barbell'   ],
  ['Dumbbell Shoulder Press',  'Push', 'Shoulders',      'Dumbbell'  ],
  ['Lateral Raises',           'Push', 'Shoulders',      'Dumbbell'  ],
  ['Cable Fly',                'Push', 'Chest',          'Cable'     ],
  ['Chest Press Machine',      'Push', 'Chest',          'Machine'   ],
  ['Tricep Pushdown',          'Push', 'Triceps',        'Cable'     ],
  ['Skull Crushers',           'Push', 'Triceps',        'Barbell'   ],
  ['Overhead Tricep Extension','Push', 'Triceps',        'Cable'     ],
  ['Dips',                     'Push', 'Chest/Triceps',  'Bodyweight'],
  ['Deadlift',                 'Pull', 'Back',           'Barbell'   ],
  ['Barbell Row',              'Pull', 'Back',           'Barbell'   ],
  ['Pull-ups',                 'Pull', 'Back',           'Bodyweight'],
  ['Lat Pulldown',             'Pull', 'Back',           'Machine'   ],
  ['Seated Cable Row',         'Pull', 'Back',           'Cable'     ],
  ['Face Pull',                'Pull', 'Rear Delts',     'Cable'     ],
  ['Barbell Curl',             'Pull', 'Biceps',         'Barbell'   ],
  ['Dumbbell Curl',            'Pull', 'Biceps',         'Dumbbell'  ],
  ['Hammer Curl',              'Pull', 'Biceps',         'Dumbbell'  ],
  ['Shrugs',                   'Pull', 'Traps',          'Barbell'   ],
  ['T-Bar Row',                'Pull', 'Back',           'Machine'   ],
  ['Barbell Squat',            'Legs', 'Quads',          'Barbell'   ],
  ['Romanian Deadlift',        'Legs', 'Hamstrings',     'Barbell'   ],
  ['Leg Press',                'Legs', 'Quads',          'Machine'   ],
  ['Leg Curl',                 'Legs', 'Hamstrings',     'Machine'   ],
  ['Leg Extension',            'Legs', 'Quads',          'Machine'   ],
  ['Calf Raise',               'Legs', 'Calves',         'Machine'   ],
  ['Bulgarian Split Squat',    'Legs', 'Quads',          'Dumbbell'  ],
  ['Hack Squat',               'Legs', 'Quads',          'Machine'   ],
  ['Hip Thrust',               'Legs', 'Glutes',         'Barbell'   ],
];

// ── Default workout templates ─────────────────────────
// [Exercise Name, Sets, Target Rep Range]
const TEMPLATES = {
  Push: [
    ['Bench Press',             4, '4-6'  ],
    ['Overhead Press',          4, '6-8'  ],
    ['Incline Bench Press',     3, '8-10' ],
    ['Lateral Raises',          3, '12-15'],
    ['Tricep Pushdown',         3, '10-12'],
  ],
  Pull: [
    ['Deadlift',                3, '3-5'  ],
    ['Barbell Row',             4, '6-8'  ],
    ['Lat Pulldown',            3, '8-10' ],
    ['Face Pull',               3, '15-20'],
    ['Barbell Curl',            3, '8-10' ],
  ],
  Legs: [
    ['Barbell Squat',           4, '4-6'  ],
    ['Romanian Deadlift',       3, '8-10' ],
    ['Leg Press',               3, '10-12'],
    ['Leg Curl',                3, '10-12'],
    ['Calf Raise',              4, '15-20'],
  ],
};


// ════════════════════════════════════════════════════════
// ENTRY POINTS
// ════════════════════════════════════════════════════════

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Idempotent: delete existing tracker sheets before rebuilding
  ['Dashboard', 'Log', 'Exercises', 'Templates', 'Progress'].forEach(name => {
    const s = ss.getSheetByName(name);
    if (s) ss.deleteSheet(s);
  });

  _buildExercisesSheet(ss);
  _buildTemplatesSheet(ss);
  _buildLogSheet(ss);
  _buildProgressSheet(ss);
  _buildDashboardSheet(ss);

  const blank = ss.getSheetByName('Sheet1');
  if (blank) ss.deleteSheet(blank);

  ss.setActiveSheet(ss.getSheetByName('Dashboard'));
  SpreadsheetApp.getUi().alert(
    'Workout Tracker is ready!\n\n' +
    'Use the "Workout" menu to load today\'s session.\n\n' +
    'Tip: Edit the Templates sheet to customise your exercises.'
  );
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Workout')
    .addItem('Load Push Workout', 'loadPush')
    .addItem('Load Pull Workout', 'loadPull')
    .addItem('Load Legs Workout', 'loadLegs')
    .addSeparator()
    .addItem('Add Exercise / Machine', 'addExercisePrompt')
    .addSeparator()
    .addItem('Refresh Progress Chart', 'refreshProgress')
    .addToUi();
}


// ════════════════════════════════════════════════════════
// BUILD: EXERCISES SHEET
// ════════════════════════════════════════════════════════

function _buildExercisesSheet(ss) {
  const sh = ss.insertSheet('Exercises');

  sh.getRange(1, 1, 1, 5)
    .setValues([['Exercise', 'Type', 'Muscle Group', 'Equipment', 'Notes']])
    .setBackground(CLR.hdr).setFontColor(CLR.white)
    .setFontWeight('bold').setHorizontalAlignment('center');

  sh.getRange(2, 1, EXERCISE_DATA.length, 4).setValues(EXERCISE_DATA);

  EXERCISE_DATA.forEach((row, i) => {
    const r = i + 2;
    sh.getRange(r, 1, 1, 5).setBackground(i % 2 === 0 ? CLR.white : CLR.row2);
    sh.getRange(r, 2)
      .setBackground(row[1] === 'Push' ? CLR.push : row[1] === 'Pull' ? CLR.pull : CLR.legs)
      .setFontWeight('bold').setHorizontalAlignment('center');
  });

  sh.getRange('B2:B1000').setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['Push', 'Pull', 'Legs'], true)
      .setAllowInvalid(false).build()
  );

  [220, 75, 140, 110, 200].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.setFrozenRows(1);
}


// ════════════════════════════════════════════════════════
// BUILD: TEMPLATES SHEET
// ════════════════════════════════════════════════════════

function _buildTemplatesSheet(ss) {
  const sh = ss.insertSheet('Templates');

  sh.getRange('A1:I1').merge()
    .setValue('Edit your default workout templates here. Changes take effect the next time you load a workout.')
    .setFontStyle('italic').setFontColor(CLR.muted).setBackground(CLR.light);
  sh.setRowHeight(1, 30);

  const types     = ['Push', 'Pull', 'Legs'];
  const startCols = [1, 4, 7]; // columns A, D, G

  types.forEach((type, ti) => {
    const sc    = startCols[ti];
    const color = type === 'Push' ? CLR.push : type === 'Pull' ? CLR.pull : CLR.legs;

    sh.getRange(2, sc, 1, 3).merge()
      .setValue(type).setBackground(color)
      .setFontWeight('bold').setFontSize(13).setHorizontalAlignment('center');

    sh.getRange(3, sc, 1, 3)
      .setValues([['Exercise', 'Sets', 'Target Reps']])
      .setFontWeight('bold').setBackground(CLR.light).setHorizontalAlignment('center');

    TEMPLATES[type].forEach((row, ri) => {
      sh.getRange(4 + ri, sc, 1, 3).setValues([row])
        .setBackground(ri % 2 === 0 ? CLR.white : CLR.row2);
    });

    [200, 50, 100].forEach((w, i) => sh.setColumnWidth(sc + i, w));
  });

  sh.setFrozenRows(3);
}


// ════════════════════════════════════════════════════════
// BUILD: LOG SHEET
// ════════════════════════════════════════════════════════

function _buildLogSheet(ss) {
  const sh = ss.insertSheet('Log');

  sh.getRange(1, 1, 1, 8)
    .setValues([['Date', 'Workout', 'Exercise', 'Set', 'Weight (lbs)', 'Reps', 'Est. 1RM', 'Notes']])
    .setBackground(CLR.hdr).setFontColor(CLR.white)
    .setFontWeight('bold').setHorizontalAlignment('center');

  [100, 70, 200, 45, 105, 55, 80, 220].forEach((w, i) => sh.setColumnWidth(i + 1, w));

  // Workout type dropdown
  sh.getRange('B2:B2000').setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(['Push', 'Pull', 'Legs'], true)
      .setAllowInvalid(false).build()
  );

  // Exercise dropdown (all exercises; stays in sync when exercises are added)
  sh.getRange('C2:C2000').setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(EXERCISE_DATA.map(r => r[0]), true)
      .setAllowInvalid(true).build() // allow custom entries not in the list
  );

  // Column formats
  sh.getRange('A2:A2000').setNumberFormat('MM/dd/yyyy');
  sh.getRange('E2:E2000').setNumberFormat('0.0');
  sh.getRange('G2:G2000').setFontColor(CLR.muted).setFontStyle('italic').setNumberFormat('0.0');

  // Conditional formatting: colour the Workout column by type
  const cfRules = ['Push', 'Pull', 'Legs'].map((t, i) =>
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(t)
      .setBackground(i === 0 ? CLR.push : i === 1 ? CLR.pull : CLR.legs)
      .setRanges([sh.getRange('B2:B2000')])
      .build()
  );
  sh.setConditionalFormatRules(cfRules);

  sh.setFrozenRows(1);
}


// ════════════════════════════════════════════════════════
// BUILD: PROGRESS SHEET
// ════════════════════════════════════════════════════════

function _buildProgressSheet(ss) {
  const sh = ss.insertSheet('Progress');

  // Exercise selector
  sh.getRange('A1').setValue('Exercise:').setFontWeight('bold');
  sh.getRange('B1').setValue('Bench Press')
    .setBackground(CLR.yellow).setFontWeight('bold').setFontSize(13);
  sh.getRange('B1').setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(EXERCISE_DATA.map(r => r[0]), true)
      .setAllowInvalid(true).build()
  );

  sh.getRange('A2:D2').merge()
    .setValue('^ Select an exercise above, then use Workout \u2192 Refresh Progress Chart')
    .setFontStyle('italic').setFontColor(CLR.muted);

  // Data table headers
  sh.getRange(4, 1, 1, 3)
    .setValues([['Date', 'Best Weight (lbs)', 'Best Est. 1RM']])
    .setBackground(CLR.light).setFontWeight('bold').setHorizontalAlignment('center');

  // QUERY pulls best weight and best estimated 1RM per session for the selected exercise
  sh.getRange('A5').setFormula(
    '=IFERROR(' +
    'QUERY(Log!A:G,' +
    '"SELECT A, MAX(E), MAX(G) ' +
    'WHERE C=\'"&B1&"\' AND E IS NOT NULL ' +
    'GROUP BY A ORDER BY A"' +
    ',0),' +
    '{"No data yet — log some sets first!"})'
  );

  sh.getRange('A5:A500').setNumberFormat('MM/dd/yyyy');
  sh.getRange('B5:C500').setNumberFormat('0.0');
  [110, 150, 130].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.setFrozenRows(1);

  _buildProgressChart(sh);
}


// ════════════════════════════════════════════════════════
// BUILD: DASHBOARD SHEET
// ════════════════════════════════════════════════════════

function _buildDashboardSheet(ss) {
  const sh = ss.insertSheet('Dashboard');

  // Title banner
  sh.getRange('A1:G1').merge()
    .setValue('WORKOUT TRACKER  \u00b7  Push / Pull / Legs')
    .setFontSize(18).setFontWeight('bold').setFontColor(CLR.hdr)
    .setHorizontalAlignment('center').setBackground(CLR.light)
    .setVerticalAlignment('middle');
  sh.setRowHeight(1, 55);

  // ── Stats (left column) ──────────────────────────────
  sh.getRange('A3').setValue('STATS').setFontWeight('bold').setFontColor(CLR.muted);

  const stats = [
    ['Last workout',
      '=IFERROR(TEXT(MAX(Log!A:A),"MMM DD, YYYY"),"No workouts yet")'],
    ['Total sessions',
      '=IFERROR(ROWS(QUERY(Log!A:A,"SELECT A WHERE A IS NOT NULL GROUP BY A LABEL A \'\'"))-1,0)'],
    ['Push sessions',
      '=IFERROR(ROWS(QUERY(Log!A:B,"SELECT A WHERE B=\'Push\' GROUP BY A LABEL A \'\'"))-1,0)'],
    ['Pull sessions',
      '=IFERROR(ROWS(QUERY(Log!A:B,"SELECT A WHERE B=\'Pull\' GROUP BY A LABEL A \'\'"))-1,0)'],
    ['Legs sessions',
      '=IFERROR(ROWS(QUERY(Log!A:B,"SELECT A WHERE B=\'Legs\' GROUP BY A LABEL A \'\'"))-1,0)'],
  ];

  stats.forEach(([label, formula], i) => {
    sh.getRange(4 + i, 1).setValue(label).setFontColor(CLR.muted);
    sh.getRange(4 + i, 2).setFormula(formula).setFontWeight('bold').setFontSize(13);
  });

  // ── All-time PRs ─────────────────────────────────────
  sh.getRange('A10').setValue('ALL-TIME PRs')
    .setFontWeight('bold').setFontColor(CLR.muted);

  sh.getRange(11, 1, 1, 4)
    .setValues([['Exercise', 'Best Weight', 'Best Est. 1RM', 'Date']])
    .setFontWeight('bold').setBackground(CLR.light).setHorizontalAlignment('center');

  sh.getRange('A12').setFormula(
    '=IFERROR(' +
    'QUERY(Log!A:G,' +
    '"SELECT C, MAX(E), MAX(G), MAX(A) ' +
    'WHERE C IS NOT NULL AND E IS NOT NULL ' +
    'GROUP BY C ORDER BY MAX(G) DESC ' +
    'LABEL C \'Exercise\', MAX(E) \'Best Weight\', MAX(G) \'Best Est. 1RM\', MAX(A) \'Date\'"' +
    ',0),' +
    '{"No data yet"})'
  );
  sh.getRange('A12:A200').setNumberFormat('@');
  sh.getRange('D12:D200').setNumberFormat('MM/dd/yyyy');

  // ── Recent workouts (right side) ─────────────────────
  sh.getRange('F3').setValue('RECENT WORKOUTS')
    .setFontWeight('bold').setFontColor(CLR.muted);

  sh.getRange(4, 6, 1, 5)
    .setValues([['Date', 'Workout', 'Exercise', 'Best Weight', 'Best Reps']])
    .setFontWeight('bold').setBackground(CLR.light).setHorizontalAlignment('center');

  sh.getRange('F5').setFormula(
    '=IFERROR(' +
    'QUERY(Log!A:F,' +
    '"SELECT A, B, C, MAX(E), MAX(F) ' +
    'WHERE A IS NOT NULL AND E IS NOT NULL ' +
    'GROUP BY A, B, C ORDER BY A DESC LIMIT 60"' +
    ',0),' +
    '{"No data yet"})'
  );
  sh.getRange('F5:F200').setNumberFormat('MM/dd/yyyy');

  // Column widths
  [200, 120, 20, 120, 20].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  [105, 75, 190, 110, 90].forEach((w, i) => sh.setColumnWidth(i + 6, w));
}


// ════════════════════════════════════════════════════════
// LOAD TEMPLATES INTO LOG
// ════════════════════════════════════════════════════════

function loadPush() { _loadTemplate('Push'); }
function loadPull() { _loadTemplate('Pull'); }
function loadLegs() { _loadTemplate('Legs'); }

function _loadTemplate(type) {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const log = ss.getSheetByName('Log');
  const tpl = ss.getSheetByName('Templates');

  const typeIdx  = ['Push', 'Pull', 'Legs'].indexOf(type);
  const startCol = typeIdx * 3 + 1; // A=1, D=4, G=7

  // Read template (up to 20 exercises)
  const data  = tpl.getRange(4, startCol, 20, 3).getValues();
  const today = new Date();
  const rows  = [];

  data.forEach(([exercise, sets]) => {
    if (!exercise || !sets) return;
    for (let s = 1; s <= Number(sets); s++) {
      rows.push([today, type, exercise, s, '', '', '']); // A-F + Notes (G=1RM added below)
    }
  });

  if (!rows.length) {
    SpreadsheetApp.getUi().alert('No template found for ' + type + '. Check the Templates sheet.');
    return;
  }

  const firstRow = log.getLastRow() + 1;
  const color    = type === 'Push' ? CLR.push : type === 'Pull' ? CLR.pull : CLR.legs;

  // Write columns A-F and H (Notes), leaving G for the formula
  log.getRange(firstRow, 1, rows.length, 6).setValues(rows.map(r => r.slice(0, 6)));
  log.getRange(firstRow, 8, rows.length, 1).setValues(rows.map(() => [''])); // Notes column

  // Add 1RM formula per row (Epley: weight * (1 + reps/30))
  rows.forEach((_, i) => {
    const r = firstRow + i;
    log.getRange(r, 7).setFormula(`=IF(E${r}="","",ROUND(E${r}*(1+F${r}/30),1))`);
  });

  // Formatting
  rows.forEach((_, i) => {
    const r = firstRow + i;
    log.getRange(r, 1, 1, 8).setBackground(i % 2 === 0 ? CLR.white : CLR.row2);
    log.getRange(r, 2).setBackground(color).setFontWeight('bold').setHorizontalAlignment('center');
    log.getRange(r, 7).setFontColor(CLR.muted).setFontStyle('italic').setNumberFormat('0.0');
  });
  log.getRange(firstRow, 1, rows.length, 1).setNumberFormat('MM/dd/yyyy');

  // Navigate to the Weight column of the first new row
  ss.setActiveSheet(log);
  log.setActiveRange(log.getRange(firstRow, 5));

  SpreadsheetApp.getUi().alert(
    type + ' workout loaded (' + rows.length + ' sets).\n\nFill in Weight and Reps as you train.'
  );
}


// ════════════════════════════════════════════════════════
// ADD EXERCISE / MACHINE
// ════════════════════════════════════════════════════════

function addExercisePrompt() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const r1 = ui.prompt('Add Exercise (1/4)', 'Exercise / machine name:', ui.ButtonSet.OK_CANCEL);
  if (r1.getSelectedButton() !== ui.Button.OK) return;
  const name = r1.getResponseText().trim();
  if (!name) { ui.alert('Name cannot be empty.'); return; }

  const r2 = ui.prompt('Add Exercise (2/4)', 'Type — Push, Pull, or Legs:', ui.ButtonSet.OK_CANCEL);
  if (r2.getSelectedButton() !== ui.Button.OK) return;
  const type = r2.getResponseText().trim();
  if (!['Push', 'Pull', 'Legs'].includes(type)) { ui.alert('Must be Push, Pull, or Legs.'); return; }

  const r3 = ui.prompt('Add Exercise (3/4)', 'Muscle group (e.g. Chest, Quads, Back):', ui.ButtonSet.OK_CANCEL);
  if (r3.getSelectedButton() !== ui.Button.OK) return;
  const muscle = r3.getResponseText().trim();

  const r4 = ui.prompt('Add Exercise (4/4)', 'Equipment — Barbell, Dumbbell, Machine, Cable, or Bodyweight:', ui.ButtonSet.OK_CANCEL);
  if (r4.getSelectedButton() !== ui.Button.OK) return;
  const equip = r4.getResponseText().trim();

  const exSh   = ss.getSheetByName('Exercises');
  const newRow = exSh.getLastRow() + 1;

  exSh.getRange(newRow, 1, 1, 4).setValues([[name, type, muscle, equip]]);
  exSh.getRange(newRow, 1, 1, 5).setBackground(newRow % 2 === 0 ? CLR.white : CLR.row2);
  exSh.getRange(newRow, 2)
    .setBackground(type === 'Push' ? CLR.push : type === 'Pull' ? CLR.pull : CLR.legs)
    .setFontWeight('bold').setHorizontalAlignment('center');

  _refreshExerciseDropdowns(ss, exSh);

  ui.alert('"' + name + '" added! It will now appear in the Log and Progress dropdowns.');
}

function _refreshExerciseDropdowns(ss, exSh) {
  const lastRow = exSh.getLastRow();
  if (lastRow < 2) return;
  const names = exSh.getRange(2, 1, lastRow - 1, 1).getValues().flat().filter(n => n);
  const rule  = SpreadsheetApp.newDataValidation()
    .requireValueInList(names, true).setAllowInvalid(true).build();
  ss.getSheetByName('Log').getRange('C2:C2000').setDataValidation(rule);
  ss.getSheetByName('Progress').getRange('B1').setDataValidation(rule);
}


// ════════════════════════════════════════════════════════
// PROGRESS CHART
// ════════════════════════════════════════════════════════

function refreshProgress() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName('Progress');
  _buildProgressChart(sh);
  ss.setActiveSheet(sh);
}

function _buildProgressChart(sh) {
  sh.getCharts().forEach(c => sh.removeChart(c));

  const chart = sh.newChart()
    .setChartType(Charts.ChartType.LINE)
    .addRange(sh.getRange('A4:C500'))
    .setNumHeaders(1)
    .setPosition(6, 1, 0, 0)
    .setOption('title', 'Strength Progress')
    .setOption('hAxis.title', 'Date')
    .setOption('vAxis.title', 'Weight (lbs)')
    .setOption('width', 680)
    .setOption('height', 380)
    .setOption('legend', { position: 'bottom' })
    .setOption('series', {
      0: { color: '#2196F3', lineWidth: 3, pointSize: 6 },
      1: { color: '#FF7043', lineWidth: 2, lineDashStyle: [6, 3] },
    })
    .setOption('backgroundColor', '#FAFAFA')
    .build();

  sh.insertChart(chart);
}
