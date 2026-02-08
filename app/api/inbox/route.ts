import { NextResponse } from 'next/server';
import { classifyNote } from '@/lib/gemini';
import { getSheetsClient, ensureHeaders, getCategoriesFromSheet, ensureOutboxSheet, enqueueOutbox, updateOutboxRow, updateRowStatus } from '@/lib/google-sheets';
import { forwardToCalendar, ForwardResponse } from '@/services/calendarService';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({ ok: true, message: "inbox live" });
}

export async function POST(req: Request) {
  let parsedFrom: 'urlencoded' | 'json' | 'rawFallback' | 'unknown' = 'unknown';
  let forwardStatus: number | undefined;
  let forwardError: string | undefined;
  let forwarded = false;

  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    const sheetEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const sheetKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
    const apiKey = process.env.API_KEY;
    const chronosKey = process.env.CHRONOS_SIRI_KEY;

    if (!spreadsheetId || !sheetEmail || !sheetKey || !apiKey) {
      return NextResponse.json({ ok: false, error: 'Missing environment configuration' }, { status: 500 });
    }

    const contentType = (req.headers.get('content-type') || '').toLowerCase();
    const rawBody = await req.text();
    const rawTrim = rawBody.trim();

    let text = '';
    let createdAtClient = new Date().toISOString();

    if (contentType.includes('application/x-www-form-urlencoded') || rawTrim.includes('=')) {
      const params = new URLSearchParams(rawTrim);
      const foundText = params.get("text") || params.get("value") || params.get("Value") || params.get("note");
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
    const id = crypto.randomUUID();
    const createdAtServer = new Date().toISOString();

    // 4. Persistence to Sheet1
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

    // 5. Outbox & Routing
    const isRoutable = classification.item_type === 'task' || classification.item_type === 'event';
    if (isRoutable) {
      const outboxRange = await enqueueOutbox(sheets, spreadsheetId!, { text: cleanText, item_type: classification.item_type });
      
      if (chronosKey) {
        try {
          const res: ForwardResponse = await forwardToCalendar(cleanText, chronosKey);
          forwarded = res.success;
          forwardStatus = res.status;
          forwardError = res.error;

          if (outboxRange) {
            await updateOutboxRow(sheets, spreadsheetId!, outboxRange, { 
              success: forwarded, 
              status: forwardStatus, 
              error: forwarded ? undefined : (forwardError || `HTTP ${forwardStatus}`)
            });
          }

          // Update Sheet1 status to FORWARDED
          if (forwarded && sheet1Range) {
            await updateRowStatus(sheets, spreadsheetId!, sheet1Range, 'FORWARDED');
          }
        } catch (calError: any) {
          forwardError = calError.message;
        }
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
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}