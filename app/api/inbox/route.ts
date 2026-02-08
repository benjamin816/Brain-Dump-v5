import { NextResponse } from 'next/server';
import { classifyNote } from '@/lib/gemini';
import { getSheetsClient, ensureHeaders, getCategoriesFromSheet, ensureOutboxSheet, enqueueOutbox, updateOutboxRow, updateRowStatus } from '@/lib/google-sheets';
import { forwardToCalendar } from '@/services/calendarService';
import { ForwardResponse } from '@/types';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  let parsedFrom: 'urlencoded' | 'json' | 'rawFallback' | 'unknown' = 'unknown';
  let forwarded = false;

  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    const apiKey = process.env.API_KEY;
    const chronosKey = process.env.CHRONOS_INBOX_KEY || '87654321'; // Defaulting to temporary key per request
    const chronosBaseUrl = process.env.CALENDAR_AGENT_BASE_URL;

    if (!spreadsheetId || !apiKey) {
      return NextResponse.json({ ok: false, error: 'Missing environment configuration' }, { status: 500 });
    }

    const contentType = (req.headers.get('content-type') || '').toLowerCase();
    const rawBody = await req.text();
    const rawTrim = rawBody.trim();

    let text = '';
    let createdAtClient = new Date().toISOString();

    if (contentType.includes('application/x-www-form-urlencoded') || rawTrim.includes('=')) {
      const params = new URLSearchParams(rawTrim);
      const foundText = params.get("text") || params.get("value") || params.get("note");
      if (foundText) {
        text = foundText;
        parsedFrom = 'urlencoded';
        if (params.get('created_at')) createdAtClient = params.get('created_at')!;
      }
    }

    if (!text && (contentType.includes('application/json') || rawTrim.startsWith('{'))) {
      try {
        const body = JSON.parse(rawTrim);
        const foundText = body.text || body.value || body.note;
        if (foundText) {
          text = foundText;
          parsedFrom = 'json';
          if (body.created_at) createdAtClient = body.created_at;
        }
      } catch (e) {}
    }

    if (!text && rawTrim) {
      text = rawTrim;
      parsedFrom = 'rawFallback';
    }

    if (!text || !text.trim()) {
      return NextResponse.json({ ok: false, error: 'Missing text' }, { status: 400 });
    }

    const cleanText = text.trim();
    const sheets = await getSheetsClient();
    await ensureOutboxSheet(sheets, spreadsheetId!);

    let liveCategories = [];
    try {
      liveCategories = await getCategoriesFromSheet(sheets, spreadsheetId!);
    } catch (e) {
      liveCategories = ['personal', 'work', 'other'];
    }

    const classification = await classifyNote(cleanText, liveCategories);
    const id = crypto.randomUUID(); // Stable identifier for idempotency
    const createdAtServer = new Date().toISOString();

    // 1. Persistence to Sheet1 (User Inbox)
    let sheet1Range = '';
    try {
      await ensureHeaders(sheets, spreadsheetId!);
      const appendRes = await sheets.spreadsheets.values.append({
        spreadsheetId: spreadsheetId!,
        range: 'Sheet1!A:H',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            cleanText,
            createdAtClient,
            createdAtServer,
            classification.item_type,
            classification.time_bucket,
            classification.category,
            id,
            'LOCAL'
          ]],
        },
      });
      sheet1Range = appendRes.data.updates?.updatedRange || '';
    } catch (sheetError) {
      console.error('Storage Error:', sheetError);
    }

    // 2. Outbox & Routing
    const isRoutable = classification.item_type === 'task' || classification.item_type === 'event';
    if (isRoutable) {
      const outboxRange = await enqueueOutbox(sheets, spreadsheetId!, { 
        text: cleanText, 
        item_type: classification.item_type,
        id 
      });
      
      // Attempt immediate forward
      try {
        console.log(`[Inbox] Forwarding routable thought to executor. ID: ${id}`);
        const res: ForwardResponse = await forwardToCalendar(cleanText, chronosKey, id, chronosBaseUrl);
        forwarded = res.success;

        if (outboxRange) {
          await updateOutboxRow(sheets, spreadsheetId!, outboxRange, res);
        }

        // Update Sheet1 status to FORWARDED if successful
        if (forwarded && sheet1Range) {
          await updateRowStatus(sheets, spreadsheetId!, sheet1Range, 'FORWARDED');
        }
      } catch (calError: any) {
        console.error('[Inbox] Forwarding failed:', calError.message);
      }
    }

    return NextResponse.json({
      ok: true,
      id,
      classification,
      calendar_routed: forwarded,
      forwarded,
      parsedFrom
    });

  } catch (error: any) {
    console.error('[Inbox] Critical Error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}