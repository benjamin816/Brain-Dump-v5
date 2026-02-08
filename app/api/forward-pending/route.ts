import { NextResponse } from 'next/server';
import { getSheetsClient, ensureOutboxSheet, updateOutboxRow } from '@/lib/google-sheets';
import { forwardToCalendar } from '@/services/calendarService';
import { ForwardResponse } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const cronKey = process.env.OUTBOX_CRON_KEY;
    const { searchParams } = new URL(req.url);
    const requestKey = req.headers.get('x-outbox-key') || searchParams.get('key');

    if (!cronKey || requestKey !== cronKey) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    const chronosKey = process.env.CHRONOS_INBOX_KEY || '87654321';
    const chronosBaseUrl = process.env.CALENDAR_AGENT_BASE_URL;

    if (!spreadsheetId) {
      return NextResponse.json({ ok: false, error: 'Server configuration missing' }, { status: 500 });
    }

    const sheets = await getSheetsClient();
    await ensureOutboxSheet(sheets, spreadsheetId);

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Outbox!A:O',
    });

    const rows = res.data.values;
    if (!rows || rows.length <= 1) {
      return NextResponse.json({ ok: true, message: 'Outbox is empty', processed: 0, sent: 0, failed: 0 });
    }

    const results = { processed: 0, sent: 0, failed: 0 };
    const MAX_PROCESS = 10;
    
    for (let i = 1; i < rows.length && results.processed < MAX_PROCESS; i++) {
      const row = rows[i];
      // Indices: created_at(0), text(1), item_type(2), status(3), attempts(4), last_error(5), last_attempt_at(6), sent_at(7), id(8)
      const text = row[1];
      const status = row[3];
      const attempts = parseInt(row[4] || '0', 10);
      const outboxId = row[8] || `legacy-${i}`;

      if ((status === 'pending' || status === 'failed') && attempts < 5) {
        results.processed++;
        const rowNumber = i + 1;
        const range = `Outbox!A${rowNumber}:O${rowNumber}`;

        console.log(`[Forward-Pending] Retrying row ${rowNumber}. ID: ${outboxId}. Attempt ${attempts + 1}`);

        try {
          const forwardRes: ForwardResponse = await forwardToCalendar(text, chronosKey, outboxId, chronosBaseUrl);
          
          if (forwardRes.success) {
            results.sent++;
            console.log(`[Forward-Pending] Success! Remote ID: ${forwardRes.data?.id}`);
          } else {
            results.failed++;
            console.warn(`[Forward-Pending] Failed: ${forwardRes.error}`);
          }
          
          await updateOutboxRow(sheets, spreadsheetId, range, forwardRes);
        } catch (err: any) {
          results.failed++;
          await updateOutboxRow(sheets, spreadsheetId, range, { 
            success: false, 
            error: err.message || 'Unknown forward error' 
          });
        }
      }
    }

    return NextResponse.json({ ok: true, ...results });
  } catch (error: any) {
    console.error('[Forward-Pending] API Critical Error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return POST(req);
}