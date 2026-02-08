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
      range: 'Sheet1!A:H',
    });

    const rows = res.data.values;
    if (!rows || rows.length <= 1) {
      return NextResponse.json({ ok: true, entries: [] });
    }

    /**
     * Header order: text(0), created_at(1), received_at(2), item_type(3), time_bucket(4), categories(5), id(6), status(7)
     */
    const entries = rows.slice(1)
      .filter((row: any) => row && row[0])
      .map((row: any) => ({
        id: row[6] || `legacy-${Math.random().toString(36).substr(2, 9)}`,
        text: row[0] || '',
        created_at_client: row[1] || new Date().toISOString(),
        created_at_server: row[2] || new Date().toISOString(),
        item_type: row[3] || 'idea',
        time_bucket: row[4] || 'none',
        category: row[5] || 'Other',
        status: row[7] || 'LOCAL'
      }));

    return NextResponse.json({ ok: true, entries });
  } catch (error: any) {
    console.error('Entries API Error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
