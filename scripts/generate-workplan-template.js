/**
 * Generates the FAO Work Plan Excel template.
 * Run with: node scripts/generate-workplan-template.js
 * Output: public/work_plan_template.xlsx
 */

const XLSX = require('xlsx');
const path = require('path');

const wb = XLSX.utils.book_new();

// ─── Instructions sheet ────────────────────────────────────────────────────

const instructions = [
  ['FAO Ukraine – Work Plan Template'],
  [''],
  ['HOW TO USE THIS TEMPLATE'],
  ['1. Fill in the "Work Plan" sheet. Each row is one task.'],
  ['2. Column A (Task #) is used to link dependencies between tasks.'],
  ['   To set a dependency, enter the Task # of the blocking task in column J.'],
  ['   For multiple dependencies separate them with commas, e.g.  1,3'],
  ['3. Dates must be in YYYY-MM-DD format (e.g. 2026-05-15).'],
  ['4. Status must be one of: not-started | in-progress | completed | delayed'],
  ['5. Priority must be one of: low | medium | high | critical'],
  ['6. Progress is a number from 0 to 100 (percentage complete).'],
  ['7. When you are done, save the file and import it into the app via Work Plans → Import.'],
  [''],
  ['FIELD DESCRIPTIONS'],
  ['Task #',      'Sequential number used only for dependency references. Do not change the order after setting dependencies.'],
  ['Title',       'Short name of the task (required).'],
  ['Description', 'Optional longer description of the task.'],
  ['Assignee',    'Name of the person responsible for this task.'],
  ['Start Date',  'When the task starts (YYYY-MM-DD).'],
  ['End Date',    'When the task is due (YYYY-MM-DD).'],
  ['Status',      'Current status: not-started | in-progress | completed | delayed'],
  ['Priority',    'Task priority: low | medium | high | critical'],
  ['Progress %',  'Percentage complete (0–100).'],
  ['Dependencies','Comma-separated Task # values of tasks that must finish before this one. Leave blank if none.'],
];

const instructionSheet = XLSX.utils.aoa_to_sheet(instructions);
instructionSheet['!cols'] = [{ wch: 18 }, { wch: 80 }];
instructionSheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }]; // Merge title row
XLSX.utils.book_append_sheet(wb, instructionSheet, 'Instructions');

// ─── Work Plan sheet ───────────────────────────────────────────────────────

const headers = [
  'Task #',
  'Title *',
  'Description',
  'Assignee',
  'Start Date (YYYY-MM-DD)',
  'End Date (YYYY-MM-DD)',
  'Status',
  'Priority',
  'Progress % (0-100)',
  'Dependencies (Task # list)',
];

// Example rows
const examples = [
  [1, 'Inception workshop',        'Organise and deliver the project kick-off workshop', 'Smith, John',  '2026-05-01', '2026-05-05', 'completed',   'high',     100, ''],
  [2, 'Baseline assessment',       'Conduct field survey for baseline data collection',  'Doe, Jane',   '2026-05-06', '2026-05-20', 'in-progress', 'high',      60, '1'],
  [3, 'Procurement of inputs',     'Purchase seeds, tools and equipment',                'Smith, John',  '2026-05-10', '2026-05-25', 'not-started', 'medium',     0, '1'],
  [4, 'Training of farmers',       'Deliver technical training to 200 beneficiaries',    'Doe, Jane',   '2026-05-26', '2026-06-10', 'not-started', 'high',       0, '2,3'],
  [5, 'Mid-term review',           'Internal review of progress against work plan',      'Smith, John',  '2026-06-15', '2026-06-20', 'not-started', 'medium',     0, '4'],
  [6, 'Report to donor',           'Prepare and submit progress report',                 'Doe, Jane',   '2026-06-25', '2026-06-30', 'not-started', 'critical',   0, '5'],
  // 10 empty rows for the PM to fill in
  [7,  '', '', '', '', '', 'not-started', 'medium', 0, ''],
  [8,  '', '', '', '', '', 'not-started', 'medium', 0, ''],
  [9,  '', '', '', '', '', 'not-started', 'medium', 0, ''],
  [10, '', '', '', '', '', 'not-started', 'medium', 0, ''],
  [11, '', '', '', '', '', 'not-started', 'medium', 0, ''],
  [12, '', '', '', '', '', 'not-started', 'medium', 0, ''],
  [13, '', '', '', '', '', 'not-started', 'medium', 0, ''],
  [14, '', '', '', '', '', 'not-started', 'medium', 0, ''],
  [15, '', '', '', '', '', 'not-started', 'medium', 0, ''],
  [16, '', '', '', '', '', 'not-started', 'medium', 0, ''],
  [17, '', '', '', '', '', 'not-started', 'medium', 0, ''],
  [18, '', '', '', '', '', 'not-started', 'medium', 0, ''],
  [19, '', '', '', '', '', 'not-started', 'medium', 0, ''],
  [20, '', '', '', '', '', 'not-started', 'medium', 0, ''],
];

const wpData = [headers, ...examples];
const wpSheet = XLSX.utils.aoa_to_sheet(wpData);

// Column widths
wpSheet['!cols'] = [
  { wch: 8  },  // Task #
  { wch: 30 },  // Title
  { wch: 40 },  // Description
  { wch: 22 },  // Assignee
  { wch: 22 },  // Start Date
  { wch: 22 },  // End Date
  { wch: 16 },  // Status
  { wch: 12 },  // Priority
  { wch: 18 },  // Progress
  { wch: 26 },  // Dependencies
];

// Freeze top row (headers)
wpSheet['!freeze'] = { xSplit: 0, ySplit: 1 };

XLSX.utils.book_append_sheet(wb, wpSheet, 'Work Plan');

// ─── Write file ────────────────────────────────────────────────────────────

const outPath = path.join(__dirname, '..', 'public', 'work_plan_template.xlsx');
XLSX.writeFile(wb, outPath);
console.log('Template written to:', outPath);
