/**
 * Google APIs service helper for interacting with Sheets and Drive REST APIs.
 */

const SHEETS_API_BASE = 'https://sheets.googleapis.com/v4/spreadsheets';

// Helper to make authenticated requests
async function googleFetch(url, accessToken, options = {}) {
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });
  
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    const errorMessage = errorBody.error?.message || response.statusText;
    throw new Error(`Google API Error (${response.status}): ${errorMessage}`);
  }

  // Clear endpoints return different shapes or sometimes empty
  if (response.status === 204) return null;
  return response.json();
}

/**
 * Searches the user's Google Drive for existing spreadsheets created by this app.
 */
export async function listAppSpreadsheets(accessToken) {
  const q = encodeURIComponent("mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false and appProperties has { key='appIdentifier' and value='sheets-splitwise' }");
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,createdTime)&orderBy=modifiedTime desc`;
  const data = await googleFetch(url, accessToken);
  return data.files || [];
}

/**
 * Shares a Google Sheet with a friend via email using Google Drive API.
 */
export async function shareSpreadsheet(accessToken, fileId, friendEmail) {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}/permissions?sendNotificationEmail=true`;
  const body = {
    role: 'writer',
    type: 'user',
    emailAddress: friendEmail
  };
  return googleFetch(url, accessToken, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

/**
 * Creates a new Splitwise spreadsheet with the correct schemas and formatting.
 */
export async function createGroupSpreadsheet(accessToken, groupName, creatorName, creatorEmail, currency = 'INR') {
  const body = {
    properties: {
      title: `Splitwise - ${groupName}`,
    },
    sheets: [
      { properties: { title: 'Group_Config' } },
      { properties: { title: 'Members' } },
      { properties: { title: 'Expenses' } }
    ]
  };

  // 1. Create spreadsheet
  const sheetData = await createSpreadsheetRaw(accessToken, body);
  const spreadsheetId = sheetData.spreadsheetId;

  // 2. Initialize sheets with headers
  await initializeSheetHeaders(accessToken, spreadsheetId, groupName, creatorName, creatorEmail, currency);

  // 3. Tag spreadsheet with our appIdentifier metadata
  await setSpreadsheetAppProperties(accessToken, spreadsheetId);

  return spreadsheetId;
}

/**
 * Sets private appProperties on the sheet to tag it as created by our app.
 */
export async function setSpreadsheetAppProperties(accessToken, fileId) {
  const url = `https://www.googleapis.com/drive/v3/files/${fileId}`;
  const body = {
    appProperties: {
      appIdentifier: 'sheets-splitwise'
    }
  };
  return googleFetch(url, accessToken, {
    method: 'PATCH',
    body: JSON.stringify(body)
  });
}

// Raw create
async function createSpreadsheetRaw(accessToken, body) {
  return googleFetch(SHEETS_API_BASE, accessToken, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

/**
 * Populates header rows and default configurations into a new spreadsheet.
 */
async function initializeSheetHeaders(accessToken, spreadsheetId, groupName, creatorName, creatorEmail, currency) {
  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values:batchUpdate`;
  
  const body = {
    valueInputOption: 'USER_ENTERED',
    data: [
      {
        range: 'Group_Config!A1:B4',
        values: [
          ['Key', 'Value'],
          ['GroupName', groupName],
          ['Currency', currency], // Default currency
          ['CreatedAt', new Date().toISOString()]
        ]
      },
      {
        range: 'Members!A1:D2',
        values: [
          ['ID', 'Name', 'Email', 'JoinedAt'],
          [creatorEmail.toLowerCase(), creatorName, creatorEmail, new Date().toISOString()]
        ]
      },
      {
        range: 'Expenses!A1:I1',
        values: [
          ['ID', 'Description', 'Amount', 'PaidBy', 'SplitType', 'SplitDetails', 'Date', 'Category', 'CreatedBy']
        ]
      }
    ]
  };

  await googleFetch(url, accessToken, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

/**
 * Fetches all data (Config, Members, Expenses) from a spreadsheet in one batch call.
 */
export async function fetchSpreadsheetData(accessToken, spreadsheetId) {
  const ranges = ['Group_Config!A:B', 'Members!A:D', 'Expenses!A:I'];
  const rangesQuery = ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&');
  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values:batchGet?${rangesQuery}`;
  
  const data = await googleFetch(url, accessToken);
  const valueRanges = data.valueRanges || [];

  // Parse Config
  const configRows = valueRanges[0]?.values || [];
  const config = {};
  configRows.slice(1).forEach(row => {
    if (row[0]) config[row[0]] = row[1];
  });

  // Parse Members
  const memberRows = valueRanges[1]?.values || [];
  const membersHeaders = memberRows[0] || [];
  const members = memberRows.slice(1).map(row => {
    const m = {};
    membersHeaders.forEach((header, index) => {
      m[header] = row[index] || '';
    });
    return m;
  });

  // Parse Expenses
  const expenseRows = valueRanges[2]?.values || [];
  const expenseHeaders = expenseRows[0] || [];
  const expenses = expenseRows.slice(1).map(row => {
    const exp = {};
    expenseHeaders.forEach((header, index) => {
      exp[header] = row[index] || '';
    });
    return exp;
  });

  return {
    config,
    members,
    expenses
  };
}

/**
 * Appends a new expense to the Expenses sheet.
 */
export async function addExpense(accessToken, spreadsheetId, expense) {
  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/Expenses!A:I:append?valueInputOption=USER_ENTERED`;
  
  const values = [
    [
      expense.id,
      expense.description,
      expense.amount,
      expense.paidBy.toLowerCase(),
      expense.splitType,
      expense.splitDetails || '',
      expense.date || new Date().toISOString().split('T')[0],
      expense.category || 'General',
      expense.createdBy.toLowerCase()
    ]
  ];

  return googleFetch(url, accessToken, {
    method: 'POST',
    body: JSON.stringify({ values })
  });
}

/**
 * Appends a new member to the Members sheet.
 */
export async function addMember(accessToken, spreadsheetId, member) {
  // First check if user already exists
  const currentData = await fetchSpreadsheetData(accessToken, spreadsheetId);
  const exists = currentData.members.some(m => m.Email.toLowerCase() === member.email.toLowerCase());
  
  if (exists) {
    throw new Error('Member already exists in this group.');
  }

  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/Members!A:D:append?valueInputOption=USER_ENTERED`;
  
  const values = [
    [
      member.email.toLowerCase(),
      member.name,
      member.email,
      new Date().toISOString()
    ]
  ];

  return googleFetch(url, accessToken, {
    method: 'POST',
    body: JSON.stringify({ values })
  });
}

/**
 * Overwrites the entire list of expenses (used for editing or deleting).
 */
export async function writeAllExpenses(accessToken, spreadsheetId, expenses) {
  // 1. Clear existing expenses values (leaving header row intact)
  const clearUrl = `${SHEETS_API_BASE}/${spreadsheetId}/values/Expenses!A2:I:clear`;
  await googleFetch(clearUrl, accessToken, { method: 'POST' });

  if (expenses.length === 0) return;

  // 2. Write the new list of expenses
  const writeUrl = `${SHEETS_API_BASE}/${spreadsheetId}/values/Expenses!A2?valueInputOption=USER_ENTERED`;
  const values = expenses.map(exp => [
    exp.ID || exp.id,
    exp.Description || exp.description,
    exp.Amount || exp.amount,
    (exp.PaidBy || exp.paidBy).toLowerCase(),
    exp.SplitType || exp.splitType,
    exp.SplitDetails || exp.splitDetails || '',
    exp.Date || exp.date,
    exp.Category || exp.category,
    (exp.CreatedBy || exp.createdBy).toLowerCase()
  ]);

  return googleFetch(writeUrl, accessToken, {
    method: 'PUT',
    body: JSON.stringify({ values })
  });
}

/**
 * Overwrites the entire list of expenses (used for deleting an expense).
 */
export async function deleteExpense(accessToken, spreadsheetId, expenseId, remainingExpenses) {
  return writeAllExpenses(accessToken, spreadsheetId, remainingExpenses);
}

/**
 * Updates group configuration value.
 */
export async function updateGroupConfig(accessToken, spreadsheetId, key, value) {
  // Let's first read the current config to find the cell row matching key
  const configUrl = `${SHEETS_API_BASE}/${spreadsheetId}/values/Group_Config!A:B`;
  const currentConfig = await googleFetch(configUrl, accessToken);
  const rows = currentConfig.values || [];
  
  let rowIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === key) {
      rowIndex = i + 1; // 1-indexed
      break;
    }
  }

  let range = '';
  let values = [];

  if (rowIndex !== -1) {
    // Update existing row
    range = `Group_Config!B${rowIndex}`;
    values = [[value]];
  } else {
    // Append new row
    range = 'Group_Config!A:B';
    values = [[key, value]];
  }

  const url = `${SHEETS_API_BASE}/${spreadsheetId}/values/${range}?valueInputOption=USER_ENTERED`;
  const method = rowIndex !== -1 ? 'PUT' : 'POST';
  const appendSuffix = rowIndex !== -1 ? '' : ':append';

  return googleFetch(`${SHEETS_API_BASE}/${spreadsheetId}/values/${range}${appendSuffix}?valueInputOption=USER_ENTERED`, accessToken, {
    method: method === 'PUT' ? 'PUT' : 'POST',
    body: JSON.stringify({ values })
  });
}
