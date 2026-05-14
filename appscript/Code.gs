/**
 * FieldSpend - Google Apps Script Delete Service
 *
 * DEPLOY STEPS:
 * 1. Open script.google.com → New project → paste this code
 * 2. Set script properties (Project Settings → Script Properties):
 *      SPREADSHEET_ID  →  your spreadsheet ID
 *      SECRET_TOKEN    →  any random string (e.g. "fieldspend-secret-123")
 * 3. Deploy → New deployment → Web app
 *      Execute as:     Me
 *      Who has access: Anyone
 * 4. Copy the web app URL into your .env:
 *      APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_ID/exec
 *      APPS_SCRIPT_SECRET=fieldspend-secret-123
 */

var PROPS = PropertiesService.getScriptProperties();
var SPREADSHEET_ID = PROPS.getProperty('SPREADSHEET_ID');
var SECRET_TOKEN   = PROPS.getProperty('SECRET_TOKEN');

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);

    if (SECRET_TOKEN && payload.token !== SECRET_TOKEN) {
      return json({ error: 'Unauthorized' });
    }

    var ssId = payload.spreadsheetId || SPREADSHEET_ID;
    var ss   = SpreadsheetApp.openById(ssId);

    switch (payload.action) {
      case 'deleteExpense':      return deleteExpense(ss, payload.id);
      case 'bulkDeleteExpenses': return bulkDeleteExpenses(ss, payload.ids);
      case 'deleteProject':      return deleteRowById(ss, 'Projects', payload.id, 'Project');
      default:                   return json({ error: 'Unknown action: ' + payload.action });
    }
  } catch (err) {
    return json({ error: err.toString() });
  }
}

function doGet(e) {
  return json({ status: 'FieldSpend Apps Script service is running' });
}

// ---------------------------------------------------------------------------
// Delete single expense row by ID
// ---------------------------------------------------------------------------
function deleteExpense(ss, id) {
  var sheet = ss.getSheetByName('Expenses');
  if (!sheet) return json({ error: 'Expenses sheet not found' });

  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {          // i=0 is the header row
    if (String(values[i][0]).trim() === String(id).trim()) {
      sheet.deleteRow(i + 1);                         // sheet rows are 1-indexed
      return json({ success: true });
    }
  }
  return json({ error: 'Expense not found: ' + id });
}

// ---------------------------------------------------------------------------
// Delete multiple expense rows by ID array
// ---------------------------------------------------------------------------
function bulkDeleteExpenses(ss, ids) {
  if (!ids || !ids.length) return json({ error: 'No IDs provided' });

  var sheet = ss.getSheetByName('Expenses');
  if (!sheet) return json({ error: 'Expenses sheet not found' });

  var values      = sheet.getDataRange().getValues();
  var idSet       = ids.map(function(x) { return String(x).trim(); });
  var rowsToDelete = [];

  for (var i = 1; i < values.length; i++) {
    if (idSet.indexOf(String(values[i][0]).trim()) !== -1) {
      rowsToDelete.push(i + 1);                       // 1-indexed
    }
  }

  if (rowsToDelete.length === 0) return json({ error: 'No matching expenses found' });

  // Delete bottom-up so row numbers stay valid
  rowsToDelete.sort(function(a, b) { return b - a; });
  rowsToDelete.forEach(function(row) { sheet.deleteRow(row); });

  return json({ success: true, count: rowsToDelete.length });
}

// ---------------------------------------------------------------------------
// Generic single-row delete by ID (column A)
// ---------------------------------------------------------------------------
function deleteRowById(ss, sheetName, id, label) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return json({ error: sheetName + ' sheet not found' });

  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]).trim() === String(id).trim()) {
      sheet.deleteRow(i + 1);
      return json({ success: true });
    }
  }
  return json({ error: (label || sheetName) + ' not found: ' + id });
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
