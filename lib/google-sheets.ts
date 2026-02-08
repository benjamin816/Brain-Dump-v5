
import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const DEFAULT_CATEGORIES = [
  'personal', 'work', 'creative', 'social', 'health', 
  'money', 'food', 'home', 'travel', 'learning', 
  'admin', 'wishlist', 'other'
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
      
      // Initialize Header and Defaults
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Config!A1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [['category'], ...DEFAULT_CATEGORIES.map(c => [c])]
        }
      });
    } else {
      // Check if it has content beyond header
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Config!A2:A',
      });
      if (!res.data.values || res.data.values.length === 0) {
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: 'Config!A2',
          valueInputOption: 'RAW',
          requestBody: {
            values: DEFAULT_CATEGORIES.map(c => [c])
          }
        });
      }
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
  
  // 1. Clear existing categories (A2:A)
  const sheetId = await getSheetId(sheets, spreadsheetId, 'Config');
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: 'Config!A2:A1000',
  });

  // 2. Write new ones
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: 'Config!A2',
    valueInputOption: 'RAW',
    requestBody: {
      values: categories.map(c => [c])
    }
  });
}
