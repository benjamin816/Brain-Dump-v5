import { NextResponse } from 'next/server';
import { getSheetsClient } from '@/lib/google-sheets';

export async function GET() {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    if (!spreadsheetId) {
      return NextResponse.json({ ok: false, error: 'GOOGLE_SHEETS_ID not configured' }, { status: 500 });
    }

    const sheets = await getSheetsClient();
    // Range A:H to cover status and id in G/H
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Sheet1!A:H',
    });

    const rows = res.data.values;
    if (!rows || rows.length <= 1) {
      return NextResponse.json({ ok: true, entries: [] });
    }

    /**
     * Expected Row Order:
     * 0: text
     * 1: created_at (client)
     * 2: received_at (server)
     * 3: item_type
     * 4: time_bucket
     * 5: categories
     * 6: id
     * 7: status
     */
    const entries = rows.slice(1)
      .filter((row: any) => row && row[0]) // Ensure at least text exists
      .map((row: any) => ({
        id: row[6] || `legacy-${Math.random().toString(36).substr(2, 9)}`, // Defensive: pick ID from G
        text: row[0] || '',
        created_at_client: row[1] || new Date().toISOString(),
        created_at_server: row[2] || new Date().toISOString(),
        item_type: row[3] || 'idea',
        time_bucket: row[4] || 'none',
        category: row[5] || 'Other',
      }));

    return NextResponse.json({ ok: true, entries });
  } catch (error: any) {
    console.error('Entries API Error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
