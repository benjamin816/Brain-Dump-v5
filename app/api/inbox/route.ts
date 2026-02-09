import { NextResponse } from 'next/server';
import { classifyNote } from '@/lib/gemini';
import { getSheetsClient, ensureHeaders, getCategoriesFromSheet, ensureOutboxSheet, enqueueOutbox, updateOutboxRow, updateRowStatus } from '@/lib/google-sheets';
import { forwardToCalendar } from '@/services/calendarService';
import { ForwardResponse } from '@/types';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  let parsedFrom: 'urlencoded' | 'json' | 'rawFallback' | 'unknown' = 'unknown';
  let forwarded = false;
  const traceId = crypto.randomUUID();

  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    const apiKey = process.env.API_KEY;
    const chronosKey = process.env.CHRONOS_INBOX_KEY || '87654321'; 
    const chronosBaseUrl = process.env.CALENDAR_AGENT_BASE_URL;

    console.log(`[Inbox][${traceId}] Received new signal. Parsing body...`);

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
    console.log(`[Inbox][${traceId}] Text extracted: "${cleanText.substring(0, 30)}..."`);
    const sheets = await getSheetsClient();
    
    let liveCategories = [];
    try {
      liveCategories = await getCategoriesFromSheet(sheets, spreadsheetId!);
    } catch (e) {
      liveCategories = ['personal', 'work', 'other'];
    }

    console.log(`[Inbox][${traceId}] Triggering Gemini classification...`);
    const classification = await classifyNote(cleanText, liveCategories);
    console.log(`[Inbox][${traceId}] Classification: ${classification.item_type} / ${classification.category}`);
    
    const outboxId = crypto.randomUUID(); 
    const createdAtServer = new Date().toISOString();

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
            outboxId,
            'LOCAL'
          ]],
        },
      });
      sheet1Range = appendRes.data.updates?.updatedRange || '';
    } catch (sheetError) {
      console.error(`[Inbox][${traceId}] Sheet1 Storage Error:`, sheetError);
    }

    const isRoutable = classification.item_type === 'task' || classification.item_type === 'event';
    if (isRoutable) {
      console.log(`[Inbox][${traceId}] Routing thought to Outbox. Type: ${classification.item_type}`);
      await ensureOutboxSheet(sheets, spreadsheetId!);
      const outboxRange = await enqueueOutbox(sheets, spreadsheetId!, { 
        text: cleanText, 
        item_type: classification.item_type,
        id: outboxId,
        trace_id: traceId
      });
      
      try {
        console.log(`[Inbox][${traceId}] Forwarding to Calendar Agent. ID: ${outboxId}`);
        const res: ForwardResponse = await forwardToCalendar(cleanText, chronosKey, outboxId, traceId, chronosBaseUrl);
        
        forwarded = res.success && !!res.data?.id;

        if (outboxRange) {
          await updateOutboxRow(sheets, spreadsheetId, outboxRange, { ...res, traceId });
        }

        if (forwarded && sheet1Range) {
          console.log(`[Inbox][${traceId}] Forwarding Success. Remote ID: ${res.data?.id}`);
          await updateRowStatus(sheets, spreadsheetId!, sheet1Range, 'FORWARDED');
        } else {
          console.warn(`[Inbox][${traceId}] Forwarding failed or returned no ID: ${res.error}`);
        }
      } catch (calError: any) {
        console.error(`[Inbox][${traceId}] Fatal error in immediate forwarding:`, calError);
      }
    } else {
      console.log(`[Inbox][${traceId}] Note is informational. Stored locally only.`);
    }

    return NextResponse.json({
      ok: true,
      id: outboxId,
      forward_trace_id: traceId,
      classification,
      calendar_routed: forwarded,
      forwarded,
      parsedFrom
    });

  } catch (error: any) {
    console.error(`[Inbox][${traceId}] Critical Failure:`, error);
    return NextResponse.json({ ok: false, error: error.message, forward_trace_id: traceId }, { status: 500 });
  }
}