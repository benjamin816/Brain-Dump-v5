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

    // Simple security layer
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
      range: 'Outbox!A:O',
    });

    const rows = res.data.values;
    if (!rows || rows.length <= 1) {
      return NextResponse.json({ ok: true, message: 'Outbox is empty', processed: 0, sent: 0, failed: 0 });
    }

    const results = { processed: 0, sent: 0, failed: 0 };
    const MAX_PROCESS = 25; // Process up to 25 items per run
    
    for (let i = 1; i < rows.length && results.processed < MAX_PROCESS; i++) {
      const row = rows[i];
      // Mapping based on lib/google-sheets.ts:
      // 1: text, 3: status, 4: attempts, 8: id, 9: remote_id
      const text = row[1];
      const status = row[3];
      const attempts = parseInt(row[4] || '0', 10);
      const outboxId = row[8] || `gen-${i}`;
      const remoteId = row[9];

      // Retry condition: Not 'sent' OR missing 'remote_id' (if attempts remain)
      const needsForwarding = (status !== 'sent' || !remoteId) && attempts < 5;

      if (needsForwarding) {
        results.processed++;
        const rowNumber = i + 1;
        const range = `Outbox!A${rowNumber}:O${rowNumber}`;

        console.log(`[Forward-Pending] Processing row ${rowNumber}. ID: ${outboxId}. Attempt ${attempts + 1}`);

        try {
          const forwardRes: ForwardResponse = await forwardToCalendar(text, chronosKey, outboxId, chronosBaseUrl);
          
          if (forwardRes.success && forwardRes.data?.id) {
            results.sent++;
            console.log(`[Forward-Pending] Success! ID: ${outboxId} -> Remote ID: ${forwardRes.data?.id}`);
            
            // Sync status back to main Sheet1 if we can find it
            // This requires scanning Sheet1 or having a faster index, but we'll stick to updating Outbox first.
            // For BrainDump v5, we mostly care about the Outbox being the source of truth for routing.
          } else {
            results.failed++;
            console.warn(`[Forward-Pending] Failed for ID: ${outboxId}: ${forwardRes.error}`);
          }
          
          await updateOutboxRow(sheets, spreadsheetId, range, forwardRes);
        } catch (err: any) {
          results.failed++;
          console.error(`[Forward-Pending] Fatal error for ID: ${outboxId}`, err);
          await updateOutboxRow(sheets, spreadsheetId, range, { 
            success: false, 
            error: err.message || 'Unknown internal error' 
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
  // Allow GET for easy manual triggering or simple cron services
  return POST(req);
}