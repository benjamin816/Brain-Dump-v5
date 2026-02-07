
import { google } from 'googleapis';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

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
      range: 'Sheet1!A1:G1',
    });
    if (!res.data.values || res.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: 'Sheet1!A1:G1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [['id', 'text', 'created_at_client', 'created_at_server', 'item_type', 'time_bucket', 'category']],
        },
      });
    }
  } catch (e) {
    console.error('Error ensuring headers:', e);
  }
}

export async function getSheetId(sheets: any, spreadsheetId: string, title: string = 'Sheet1') {
  const res = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = res.data.sheets.find((s: any) => s.properties.title === title);
  return sheet?.properties.sheetId;
}
