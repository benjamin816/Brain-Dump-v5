import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const DEFAULT_CATEGORIES = [
  'personal', 'work', 'creative', 'social', 'health', 
  'money', 'food', 'home', 'travel', 'learning', 
  'admin', 'wishlist', 'other'
];

const OUTBOX_HEADERS = [
  'created_at', 'text', 'item_type', 'status', 'attempts', 'last_error', 'last_attempt_at', 'sent_at'
];

export async function getSheetsClient() {
  const privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const auth = new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    undefined,
    privateKey,
    SCOPES
  );
  return google.sheets({ version: 'v4', auth });
}

export async function ensureHeaders(sheets: any, spreadsheetId: string) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Sheet1!A1:H1',
    });
    if (!res.data.values || res.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Sheet1!A1:H1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [['text', 'created_at', 'received_at', 'item_type', 'time_bucket', 'categories', 'id', 'status']],
        },
      });
    }
  } catch (e) {
    console.error('Error ensuring headers:', e);
  }
}

/**
 * Updates the status (Column H) of a specific row range.
 * Useful for updating a row immediately after appending it.
 */
export async function updateRowStatus(sheets: any, spreadsheetId: string, range: string, status: string) {
  // Range is typically "Sheet1!A10:H10". We want to update only Column H of that row.
  const rowMatch = range.match(/\d+$/);
  if (!rowMatch) return;
  const rowNumber = rowMatch[0];
  const targetRange = `Sheet1!H${rowNumber}`;

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: targetRange,
    valueInputOption: 'RAW',
    requestBody: {
      values: [[status]],
    },
  });
}

export async function ensureOutboxSheet(sheets: any, spreadsheetId: string) {
  try {
    const metadata = await sheets.spreadsheets.get({ spreadsheetId });
    const outboxExists = metadata.data.sheets?.some((s: any) => s.properties.title === 'Outbox');

    if (!outboxExists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: 'Outbox' } } }]
        }
      });
      
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Outbox!A1:H1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [OUTBOX_HEADERS]
        }
      });
    }
  } catch (error) {
    console.error('Error ensuring Outbox sheet:', error);
  }
}

export async function enqueueOutbox(sheets: any, spreadsheetId: string, data: { text: string, item_type: string }) {
  const now = new Date().toISOString();
  const res = await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: 'Outbox!A:H',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        now,
        data.text,
        data.item_type,
        'pending',
        0,
        '',
        '',
        ''
      ]],
    },
  });
  return res.data.updates?.updatedRange;
}

export async function updateOutboxRow(sheets: any, spreadsheetId: string, range: string, result: { success: boolean, status?: number, error?: string }) {
  const now = new Date().toISOString();
  const currentRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: range,
  });
  
  const row = currentRes.data.values?.[0] || [];
  const currentAttempts = parseInt(row[4] || '0', 10);

  const updatedRow = [
    row[0], row[1], row[2],
    result.success ? 'sent' : 'failed',
    currentAttempts + 1,
    result.error || '',
    now,
    result.success ? now : ''
  ];

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: range,
    valueInputOption: 'RAW',
    requestBody: {
      values: [updatedRow],
    },
  });
}

export async function getSheetId(sheets: any, spreadsheetId: string, title: string) {
  const res = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = res.data.sheets.find((s: any) => s.properties.title === title);
  return sheet?.properties.sheetId;
}

export async function ensureConfigSheet(sheets: any, spreadsheetId: string) {
  try {
    const metadata = await sheets.spreadsheets.get({ spreadsheetId });
    const configExists = metadata.data.sheets.some((s: any) => s.properties.title === 'Config');
    if (!configExists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [{ addSheet: { properties: { title: 'Config' } } }]
        }
      });
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Config!A1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [['category'], ...DEFAULT_CATEGORIES.map(c => [c])]
        }
      });
    }
  } catch (error) {
    console.error('Error ensuring Config sheet:', error);
  }
}

export async function getCategoriesFromSheet(sheets: any, spreadsheetId: string): Promise<string[]> {
  await ensureConfigSheet(sheets, spreadsheetId);
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: 'Config!A2:A',
  });
  const rows = res.data.values;
  if (!rows || rows.length === 0) return DEFAULT_CATEGORIES;
  return rows.map((row: any) => row[0]).filter(Boolean);
}

export async function updateCategoriesInSheet(sheets: any, spreadsheetId: string, categories: string[]) {
  await ensureConfigSheet(sheets, spreadsheetId);
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: 'Config!A2:A1000',
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Config!A2',
    valueInputOption: 'RAW',
    requestBody: {
      values: categories.map(c => [c])
    }
  });
}