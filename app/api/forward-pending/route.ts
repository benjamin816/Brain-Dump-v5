import { NextResponse } from 'next/server';
import { getSheetsClient, ensureOutboxSheet, updateOutboxRow, updateRowStatus } from '@/lib/google-sheets';
import { forwardToCalendar } from '@/services/calendarService';
import { ForwardResponse } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const cronKey = process.env.OUTBOX_CRON_KEY;
    const { searchParams } = new URL(req.url);
    const requestKey = req.headers.get('x-outbox-key') || searchParams.get('key');

    if (cronKey && requestKey !== cronKey) {
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
      range: 'Outbox!A:P',
    });

    const rows = res.data.values;
    if (!rows || rows.length <= 1) {
      return NextResponse.json({ ok: true, message: 'Outbox is empty', processed: 0, sent: 0, failed: 0 });
    }

    const results = { processed: 0, sent: 0, failed: 0 };
    const MAX_PROCESS = 25; 
    
    for (let i = 1; i < rows.length && results.processed < MAX_PROCESS; i++) {
      const row = rows[i];
      // Mapping: 1: text, 3: status, 4: attempts, 8: id, 9: remote_id, 15: forward_trace_id
      const text = row[1];
      const status = row[3];
      const attempts = parseInt(row[4] || '0', 10);
      const outboxId = row[8] || `gen-${i}`;
      const remoteId = row[9];
      const traceId = row[15] || crypto.randomUUID();

      const needsForwarding = (status !== 'sent' || !remoteId) && attempts < 5;

      if (needsForwarding) {
        results.processed++;
        const rowNumber = i + 1;
        const range = `Outbox!A${rowNumber}:P${rowNumber}`;

        console.log(`[Forward-Pending][${traceId}] Processing retry. ID: ${outboxId}. Attempt ${attempts + 1}`);

        try {
          const forwardRes: ForwardResponse = await forwardToCalendar(text, chronosKey, outboxId, traceId, chronosBaseUrl);
          
          if (forwardRes.success && forwardRes.data?.id) {
            results.sent++;
            console.log(`[Forward-Pending][${traceId}] Success! Remote ID: ${forwardRes.data?.id}`);
          } else {
            results.failed++;
            console.warn(`[Forward-Pending][${traceId}] Failed: ${forwardRes.error}`);
          }
          
          await updateOutboxRow(sheets, spreadsheetId, range, { ...forwardRes, traceId });
        } catch (err: any) {
          results.failed++;
          console.error(`[Forward-Pending][${traceId}] Fatal retry error`, err);
          await updateOutboxRow(sheets, spreadsheetId, range, { 
            success: false, 
            error: err.message || 'Unknown internal error',
            traceId
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