
import { NextResponse } from 'next/server';
import { getSheetsClient } from '@/lib/google-sheets';

export async function GET() {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    if (!spreadsheetId) {
      return NextResponse.json({ ok: false, error: 'GOOGLE_SHEETS_ID not configured' }, { status: 500 });
    }

    const sheets = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Sheet1!A:G',
    });

    const rows = res.data.values;
    if (!rows || rows.length <= 1) {
      return NextResponse.json({ ok: true, entries: [] });
    }

    // Filter out rows that don't have at least an ID and text to prevent client crashes
    const entries = rows.slice(1)
      .filter((row: any) => row && row[0] && row[1])
      .map((row: any) => ({
        id: row[0],
        text: row[1],
        created_at_client: row[2] || new Date().toISOString(),
        created_at_server: row[3] || new Date().toISOString(),
        item_type: row[4] || 'idea',
        time_bucket: row[5] || 'none',
        category: row[6] || 'Other',
      }));

    return NextResponse.json({ ok: true, entries });
  } catch (error: any) {
    console.error('Entries API Error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
