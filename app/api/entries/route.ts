import { NextResponse } from 'next/server';
import { getSheetsClient } from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    if (!spreadsheetId) {
      console.error('GOOGLE_SHEETS_ID is not set in environment variables');
      return NextResponse.json({ ok: false, error: 'Storage backend not configured' }, { status: 500 });
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
      .filter((row: any) => row && row.length > 0 && row[0])
      .map((row: any) => {
        // Ensure we handle rows that might be shorter than expected
        const safeGet = (index: number, fallback: string = '') => (row[index] !== undefined ? row[index] : fallback);
        
        return {
          id: safeGet(6, `legacy-${Math.random().toString(36).substr(2, 9)}`),
          text: safeGet(0, ''),
          created_at_client: safeGet(1, new Date().toISOString()),
          created_at_server: safeGet(2, new Date().toISOString()),
          item_type: safeGet(3, 'idea'),
          time_bucket: safeGet(4, 'none'),
          category: safeGet(5, 'Other'),
          status: safeGet(7, 'LOCAL')
        };
      });

    // Robust sorting: handle potential invalid dates
    const sortedEntries = entries.sort((a, b) => {
      const dateA = new Date(a.created_at_server).getTime() || 0;
      const dateB = new Date(b.created_at_server).getTime() || 0;
      return dateB - dateA;
    });

    return NextResponse.json({ ok: true, entries: sortedEntries });
  } catch (error: any) {
    console.error('Entries API Critical Error:', error);
    return NextResponse.json({ ok: false, error: error.message || 'Failed to fetch from Google Sheets' }, { status: 500 });
  }
}
