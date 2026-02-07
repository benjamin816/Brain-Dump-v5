
import { NextResponse } from 'next/server';
import { getSheetsClient } from '@/lib/google-sheets';

export async function GET() {
  try {
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Sheet1!A:G',
    });

    const rows = res.data.values;
    if (!rows || rows.length <= 1) {
      return NextResponse.json({ ok: true, entries: [] });
    }

    const entries = rows.slice(1).map((row: any) => ({
      id: row[0],
      text: row[1],
      created_at_client: row[2],
      created_at_server: row[3],
      item_type: row[4],
      time_bucket: row[5],
      category: row[6],
    }));

    return NextResponse.json({ ok: true, entries });
  } catch (error: any) {
    console.error('Entries API Error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
