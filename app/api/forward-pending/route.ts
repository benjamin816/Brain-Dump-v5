import { NextResponse } from 'next/server';
import { getSheetsClient, ensureOutboxSheet, updateOutboxRow } from '@/lib/google-sheets';
import { forwardToCalendar } from '@/services/calendarService';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const cronKey = process.env.OUTBOX_CRON_KEY;
    const { searchParams } = new URL(req.url);
    
    // Read from header or query parameter
    const requestKey = req.headers.get('x-outbox-key') || searchParams.get('key');

    // 1. Security Check
    if (!cronKey || requestKey !== cronKey) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    const chronosKey = process.env.CHRONOS_SIRI_KEY;

    if (!spreadsheetId || !chronosKey) {
      return NextResponse.json({ ok: false, error: 'Server configuration missing' }, { status: 500 });
    }

    const sheets = await getSheetsClient();
    await ensureOutboxSheet(sheets, spreadsheetId);

    // 2. Read Outbox Rows
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Outbox!A:H',
    });

    const rows = res.data.values;
    if (!rows || rows.length <= 1) {
      return NextResponse.json({ ok: true, message: 'Outbox is empty', processed: 0, sent: 0, failed: 0 });
    }

    const results = {
      processed: 0,
      sent: 0,
      failed: 0
    };

    // Skip header row
    // We process up to 10 items to prevent timeouts
    const MAX_PROCESS = 10;
    
    for (let i = 1; i < rows.length && results.processed < MAX_PROCESS; i++) {
      const row = rows[i];
      // Column Indices: created_at(0), text(1), item_type(2), status(3), attempts(4), last_error(5), last_attempt_at(6), sent_at(7)
      const text = row[1];
      const status = row[3];
      const attempts = parseInt(row[4] || '0', 10);

      if ((status === 'pending' || status === 'failed') && attempts < 5) {
        results.processed++;
        const rowNumber = i + 1;
        const range = `Outbox!A${rowNumber}:H${rowNumber}`;

        console.log(`[Forward-Pending] Processing row ${rowNumber}: "${text.substring(0, 20)}..." (Attempt ${attempts + 1})`);

        try {
          const forwardRes = await forwardToCalendar(text, chronosKey);
          
          if (forwardRes.success) {
            results.sent++;
            await updateOutboxRow(sheets, spreadsheetId, range, { success: true });
          } else {
            results.failed++;
            await updateOutboxRow(sheets, spreadsheetId, range, { 
              success: false, 
              error: forwardRes.error || `HTTP ${forwardRes.status}` 
            });
          }
        } catch (err: any) {
          results.failed++;
          await updateOutboxRow(sheets, spreadsheetId, range, { 
            success: false, 
            error: err.message || 'Unknown forward error' 
          });
        }
      }
    }

    console.log(`[Forward-Pending] Done. Processed: ${results.processed}, Sent: ${results.sent}, Failed: ${results.failed}`);

    return NextResponse.json({
      ok: true,
      ...results
    });

  } catch (error: any) {
    console.error('Forward Pending API Error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

// Support GET for easier manual testing or simple cron triggers if needed,
// though POST is generally preferred for actions that modify state.
export async function GET(req: Request) {
  return POST(req);
}
