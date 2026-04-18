/**
 * ═══════════════════════════════════════════════════════
 *  Workout Tracker for Google Sheets
 * ═══════════════════════════════════════════════════════
 *
 *  SETUP (one-time):
 *  1. Create a new Google Sheet
 *  2. Extensions → Apps Script
 *  3. Paste this entire file into Code.gs and save
 *  4. Run → setup  (grant permissions when prompted)
 *  5. Return to your sheet — it's ready!
 *
 *  ADDING A NEW WORKOUT GROUP:
 *  1. Add an entry to WORKOUT_TYPES below (name + colour + strength flag)
 *  2. Add exercises for it to EXERCISE_DATA
 *  3. Add a template entry to TEMPLATES
 *  4. Re-run setup() — everything else updates automatically
 *
 *  DAILY USE:
 *  "Workout" menu → Load <Type> Workout
 *  Fill in Weight (lbs) and Reps as you train.
 *  Est. 1RM auto-calculates (Epley formula).
 */

// ── Fixed colours (non-type-specific) ────────────────
const CLR = {
  hdr:    '#263238',
  white:  '#FFFFFF',
  row2:   '#F5F5F5',
  muted:  '#78909C',
  yellow: '#FFF9C4',
  light:  '#ECEFF1',
};

// ══════════════════════════════════════════════════════
//  WORKOUT TYPE REGISTRY
//  ─────────────────────────────────────────────────────
//  To add a new group:
//    1. Add an object here  { name, color, strength }
//    2. Add exercises to EXERCISE_DATA with the matching name as Type
//    3. Add a key to TEMPLATES with the same name
//    4. Re-run setup()
//
//  strength: true  → included on the PR board (weight-based)
//            false → excluded from PR board (abs, cardio, etc.)
// ══════════════════════════════════════════════════════
const WORKOUT_TYPES = [
  { name: 'Push',   color: '#FF8A80', strength: true  },
  { name: 'Pull',   color: '#80CBC4', strength: true  },
  { name: 'Legs',   color: '#81D4FA', strength: true  },
  { name: 'Abs',    color: '#CE93D8', strength: false },
  { name: 'Cardio', color: '#FFB74D', strength: false },
];

// Dynamically register a global load<Name>() function for each type.
// Apps Script menu items call these by string name at runtime (V8).
WORKOUT_TYPES.forEach(t => {
  globalThis['load' + t.name] = () => _loadTemplate(t.name);
});


// ── Pre-loaded exercise library ───────────────────────
// [Name, Type, Muscle Group, Equipment]
const EXERCISE_DATA = [
  ['Bench Press',              'Push',   'Chest',          'Barbell'   ],
  ['Incline Bench Press',      'Push',   'Chest',          'Barbell'   ],
  ['Overhead Press',           'Push',   'Shoulders',      'Barbell'   ],
  ['Dumbbell Shoulder Press',  'Push',   'Shoulders',      'Dumbbell'  ],
  ['Lateral Raises',           'Push',   'Shoulders',      'Dumbbell'  ],
  ['Cable Fly',                'Push',   'Chest',          'Cable'     ],
  ['Chest Press Machine',      'Push',   'Chest',          'Machine'   ],
  ['Tricep Pushdown',          'Push',   'Triceps',        'Cable'     ],
  ['Skull Crushers',           'Push',   'Triceps',        'Barbell'   ],
  ['Overhead Tricep Extension','Push',   'Triceps',        'Cable'     ],
  ['Dips',                     'Push',   'Chest/Triceps',  'Bodyweight'],
  ['Deadlift',                 'Pull',   'Back',           'Barbell'   ],
  ['Barbell Row',              'Pull',   'Back',           'Barbell'   ],
  ['Pull-ups',                 'Pull',   'Back',           'Bodyweight'],
  ['Lat Pulldown',             'Pull',   'Back',           'Machine'   ],
  ['Seated Cable Row',         'Pull',   'Back',           'Cable'     ],
  ['Face Pull',                'Pull',   'Rear Delts',     'Cable'     ],
  ['Barbell Curl',             'Pull',   'Biceps',         'Barbell'   ],
  ['Dumbbell Curl',            'Pull',   'Biceps',         'Dumbbell'  ],
  ['Hammer Curl',              'Pull',   'Biceps',         'Dumbbell'  ],
  ['Shrugs',                   'Pull',   'Traps',          'Barbell'   ],
  ['T-Bar Row',                'Pull',   'Back',           'Machine'   ],
  ['Barbell Squat',            'Legs',   'Quads',          'Barbell'   ],
  ['Romanian Deadlift',        'Legs',   'Hamstrings',     'Barbell'   ],
  ['Leg Press',                'Legs',   'Quads',          'Machine'   ],
  ['Leg Curl',                 'Legs',   'Hamstrings',     'Machine'   ],
  ['Leg Extension',            'Legs',   'Quads',          'Machine'   ],
  ['Calf Raise',               'Legs',   'Calves',         'Machine'   ],
  ['Bulgarian Split Squat',    'Legs',   'Quads',          'Dumbbell'  ],
  ['Hack Squat',               'Legs',   'Quads',          'Machine'   ],
  ['Hip Thrust',               'Legs',   'Glutes',         'Barbell'   ],
  ['Plank',                    'Abs',    'Core',           'Bodyweight'],
  ['Leg Raises',               'Abs',    'Core',           'Bodyweight'],
  ['Hanging Knee Raise',       'Abs',    'Core',           'Bodyweight'],
  ['Cable Crunch',             'Abs',    'Core',           'Cable'     ],
  ['Ab Wheel Rollout',         'Abs',    'Core',           'Bodyweight'],
  ['Russian Twist',            'Abs',    'Core',           'Dumbbell'  ],
  ['Decline Sit-up',           'Abs',    'Core',           'Bodyweight'],
  ['Crunch',                   'Abs',    'Core',           'Bodyweight'],
  ['Treadmill',                'Cardio', 'Cardio',         'Machine'   ],
  ['Stationary Bike',          'Cardio', 'Cardio',         'Machine'   ],
  ['Elliptical',               'Cardio', 'Cardio',         'Machine'   ],
  ['Rowing Machine',           'Cardio', 'Cardio',         'Machine'   ],
  ['Stair Climber',            'Cardio', 'Cardio',         'Machine'   ],
  ['Jump Rope',                'Cardio', 'Cardio',         'Bodyweight'],
  ['Swimming',                 'Cardio', 'Cardio',         'Bodyweight'],
];

// ── Default workout templates ─────────────────────────
// [Exercise Name, Sets, Target Rep Range / Duration]
const TEMPLATES = {
  Push: [
    ['Bench Press',             4, '4-6'    ],
    ['Overhead Press',          4, '6-8'    ],
    ['Incline Bench Press',     3, '8-10'   ],
    ['Lateral Raises',          3, '12-15'  ],
    ['Tricep Pushdown',         3, '10-12'  ],
  ],
  Pull: [
    ['Deadlift',                3, '3-5'    ],
    ['Barbell Row',             4, '6-8'    ],
    ['Lat Pulldown',            3, '8-10'   ],
    ['Face Pull',               3, '15-20'  ],
    ['Barbell Curl',            3, '8-10'   ],
  ],
  Legs: [
    ['Barbell Squat',           4, '4-6'    ],
    ['Romanian Deadlift',       3, '8-10'   ],
    ['Leg Press',               3, '10-12'  ],
    ['Leg Curl',                3, '10-12'  ],
    ['Calf Raise',              4, '15-20'  ],
  ],
  Abs: [
    ['Plank',                   3, '30-60s' ],
    ['Leg Raises',              3, '15-20'  ],
    ['Cable Crunch',            3, '12-15'  ],
    ['Ab Wheel Rollout',        3, '8-10'   ],
    ['Russian Twist',           3, '20-30'  ],
  ],
  Cardio: [
    ['Treadmill',               1, '20-45 min'],
  ],
};


// ════════════════════════════════════════════════════════
// ENTRY POINTS
// ════════════════════════════════════════════════════════

function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

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
    'Tip: To add a new workout group, edit WORKOUT_TYPES at the top of Code.gs and re-run setup().'
  );
}

function onOpen() {
  const ui   = SpreadsheetApp.getUi();
  const menu = ui.createMenu('Workout');

  WORKOUT_TYPES.forEach(t => menu.addItem('Load ' + t.name + ' Workout', 'load' + t.name));

  menu.addSeparator()
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
      .setBackground(_typeColor(row[1]))
      .setFontWeight('bold').setHorizontalAlignment('center');
  });

  sh.getRange('B2:B1000').setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(_typeNames(), true)
      .setAllowInvalid(false).build()
  );

  [220, 75, 140, 110, 200].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  sh.setFrozenRows(1);
}


// ════════════════════════════════════════════════════════
// BUILD: TEMPLATES SHEET
// ════════════════════════════════════════════════════════

function _buildTemplatesSheet(ss) {
  const sh       = ss.insertSheet('Templates');
  const lastCol  = WORKOUT_TYPES.length * 3;

  sh.getRange('A1:' + _colLetter(lastCol) + '1').merge()
    .setValue('Edit your default workout templates here. Changes take effect the next time you load a workout.')
    .setFontStyle('italic').setFontColor(CLR.muted).setBackground(CLR.light);
  sh.setRowHeight(1, 30);

  WORKOUT_TYPES.forEach((type, ti) => {
    const sc    = ti * 3 + 1;
    const color = _typeColor(type.name);

    sh.getRange(2, sc, 1, 3).merge()
      .setValue(type.name).setBackground(color)
      .setFontWeight('bold').setFontSize(13).setHorizontalAlignment('center');

    sh.getRange(3, sc, 1, 3)
      .setValues([['Exercise', 'Sets', 'Target Reps']])
      .setFontWeight('bold').setBackground(CLR.light).setHorizontalAlignment('center');

    const rows = TEMPLATES[type.name] || [];
    rows.forEach((row, ri) => {
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

  sh.getRange('B2:B2000').setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(_typeNames(), true)
      .setAllowInvalid(false).build()
  );

  sh.getRange('C2:C2000').setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(EXERCISE_DATA.map(r => r[0]), true)
      .setAllowInvalid(true).build()
  );

  sh.getRange('A2:A2000').setNumberFormat('MM/dd/yyyy');
  sh.getRange('E2:E2000').setNumberFormat('0.0');
  sh.getRange('G2:G2000').setFontColor(CLR.muted).setFontStyle('italic').setNumberFormat('0.0');

  const cfRules = WORKOUT_TYPES.map(t =>
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo(t.name)
      .setBackground(t.color)
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

  sh.getRange(4, 1, 1, 3)
    .setValues([['Date', 'Best Weight (lbs)', 'Best Est. 1RM']])
    .setBackground(CLR.light).setFontWeight('bold').setHorizontalAlignment('center');

  sh.getRange('A5').setFormula(
    '=IFERROR(' +
    'QUERY(Log!A:G,' +
    '"SELECT A, MAX(E), MAX(G) ' +
    'WHERE C=\'"&B1&"\' AND E IS NOT NULL ' +
    'GROUP BY A ORDER BY A"' +
    ',0),' +
    '{"No data yet \u2014 log some sets first!"})'
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

  sh.getRange('A1:G1').merge()
    .setValue('WORKOUT TRACKER  \u00b7  ' + WORKOUT_TYPES.map(t => t.name).join(' / '))
    .setFontSize(18).setFontWeight('bold').setFontColor(CLR.hdr)
    .setHorizontalAlignment('center').setBackground(CLR.light)
    .setVerticalAlignment('middle');
  sh.setRowHeight(1, 55);

  // ── Stats ────────────────────────────────────────────
  sh.getRange('A3').setValue('STATS').setFontWeight('bold').setFontColor(CLR.muted);

  const stats = [
    ['Last workout',
      '=IFERROR(TEXT(MAX(Log!A:A),"MMM DD, YYYY"),"No workouts yet")'],
    ['Total sessions',
      '=IFERROR(ROWS(QUERY(Log!A:A,"SELECT A WHERE A IS NOT NULL GROUP BY A LABEL A \'\'"))-1,0)'],
    ...WORKOUT_TYPES.map(t => [
      t.name + ' sessions',
      `=IFERROR(ROWS(QUERY(Log!A:B,"SELECT A WHERE B='${t.name}' GROUP BY A LABEL A ''"))-1,0)`,
    ]),
  ];

  const statsStartRow = 4;
  stats.forEach(([label, formula], i) => {
    sh.getRange(statsStartRow + i, 1).setValue(label).setFontColor(CLR.muted);
    sh.getRange(statsStartRow + i, 2).setFormula(formula).setFontWeight('bold').setFontSize(13);
  });

  // ── All-time PRs (strength types only) ───────────────
  const prLabelRow = statsStartRow + stats.length + 1;
  sh.getRange(prLabelRow, 1).setValue('ALL-TIME PRs  (strength exercises)')
    .setFontWeight('bold').setFontColor(CLR.muted);

  sh.getRange(prLabelRow + 1, 1, 1, 4)
    .setValues([['Exercise', 'Best Weight', 'Best Est. 1RM', 'Date']])
    .setFontWeight('bold').setBackground(CLR.light).setHorizontalAlignment('center');

  // Build WHERE filter to exclude non-strength types
  const nonStrength = WORKOUT_TYPES.filter(t => !t.strength);
  const excludeClause = nonStrength.length
    ? ' AND ' + nonStrength.map(t => `B<>'${t.name}'`).join(' AND ')
    : '';

  const prDataRow = prLabelRow + 2;
  sh.getRange(prDataRow, 1).setFormula(
    '=IFERROR(' +
    'QUERY(Log!A:G,' +
    '"SELECT C, MAX(E), MAX(G), MAX(A) ' +
    `WHERE C IS NOT NULL AND E IS NOT NULL${excludeClause} ` +
    'GROUP BY C ORDER BY MAX(G) DESC ' +
    'LABEL C \'Exercise\', MAX(E) \'Best Weight\', MAX(G) \'Best Est. 1RM\', MAX(A) \'Date\'"' +
    ',0),' +
    '{"No data yet"})'
  );
  sh.getRange(`A${prDataRow}:A200`).setNumberFormat('@');
  sh.getRange(`D${prDataRow}:D200`).setNumberFormat('MM/dd/yyyy');

  // ── Recent workouts ───────────────────────────────────
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

  [200, 120, 20, 120, 20].forEach((w, i) => sh.setColumnWidth(i + 1, w));
  [105, 75, 190, 110, 90].forEach((w, i) => sh.setColumnWidth(i + 6, w));
}


// ════════════════════════════════════════════════════════
// LOAD TEMPLATE INTO LOG
// ════════════════════════════════════════════════════════

function _loadTemplate(type) {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const log = ss.getSheetByName('Log');
  const tpl = ss.getSheetByName('Templates');

  const typeIdx  = WORKOUT_TYPES.findIndex(t => t.name === type);
  const startCol = typeIdx * 3 + 1;

  const data  = tpl.getRange(4, startCol, 20, 3).getValues();
  const today = new Date();
  const rows  = [];

  data.forEach(([exercise, sets]) => {
    if (!exercise || !sets) return;
    for (let s = 1; s <= Number(sets); s++) {
      rows.push([today, type, exercise, s, '', '', '']);
    }
  });

  if (!rows.length) {
    SpreadsheetApp.getUi().alert('No template found for ' + type + '. Check the Templates sheet.');
    return;
  }

  const firstRow = log.getLastRow() + 1;
  const color    = _typeColor(type);

  log.getRange(firstRow, 1, rows.length, 6).setValues(rows.map(r => r.slice(0, 6)));
  log.getRange(firstRow, 8, rows.length, 1).setValues(rows.map(() => ['']));

  rows.forEach((_, i) => {
    const r = firstRow + i;
    log.getRange(r, 7).setFormula(`=IF(E${r}="","",ROUND(E${r}*(1+F${r}/30),1))`);
  });

  rows.forEach((_, i) => {
    const r = firstRow + i;
    log.getRange(r, 1, 1, 8).setBackground(i % 2 === 0 ? CLR.white : CLR.row2);
    log.getRange(r, 2).setBackground(color).setFontWeight('bold').setHorizontalAlignment('center');
    log.getRange(r, 7).setFontColor(CLR.muted).setFontStyle('italic').setNumberFormat('0.0');
  });
  log.getRange(firstRow, 1, rows.length, 1).setNumberFormat('MM/dd/yyyy');

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
  const ui    = SpreadsheetApp.getUi();
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const names = _typeNames();

  const r1 = ui.prompt('Add Exercise (1/4)', 'Exercise / machine name:', ui.ButtonSet.OK_CANCEL);
  if (r1.getSelectedButton() !== ui.Button.OK) return;
  const name = r1.getResponseText().trim();
  if (!name) { ui.alert('Name cannot be empty.'); return; }

  const r2 = ui.prompt('Add Exercise (2/4)', 'Type — ' + names.join(', ') + ':', ui.ButtonSet.OK_CANCEL);
  if (r2.getSelectedButton() !== ui.Button.OK) return;
  const type = r2.getResponseText().trim();
  if (!names.includes(type)) { ui.alert('Must be one of: ' + names.join(', ')); return; }

  const r3 = ui.prompt('Add Exercise (3/4)', 'Muscle group (e.g. Chest, Quads, Core):', ui.ButtonSet.OK_CANCEL);
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
    .setBackground(_typeColor(type))
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


// ════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════

function _typeColor(typeName) {
  const t = WORKOUT_TYPES.find(t => t.name === typeName);
  return t ? t.color : CLR.muted;
}

function _typeNames() {
  return WORKOUT_TYPES.map(t => t.name);
}

// Converts a 1-based column number to a spreadsheet letter (e.g. 15 → "O").
function _colLetter(n) {
  let s = '';
  while (n > 0) {
    s = String.fromCharCode(65 + (n - 1) % 26) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
