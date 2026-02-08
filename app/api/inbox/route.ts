import { NextResponse } from 'next/server';
import { classifyNote } from '@/lib/gemini';
import { getSheetsClient, ensureHeaders, getCategoriesFromSheet } from '@/lib/google-sheets';
import { forwardToCalendar } from '@/services/calendarService';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({ ok: true, message: "inbox live" });
}

export async function POST(req: Request) {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    const sheetEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const sheetKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
    const geminiKey = process.env.API_KEY;

    // Basic config validation
    if (!spreadsheetId || !sheetEmail || !sheetKey || !geminiKey) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Missing environment configuration (Sheets or Gemini keys)' 
      }, { status: 500 });
    }

    const contentType = (req.headers.get('content-type') || '').toLowerCase();
    const rawBody = await req.text();
    const rawTrim = rawBody.trim();

    let text = '';
    let createdAtClient = new Date().toISOString();
    let parsedFrom: 'urlencoded' | 'json' | 'rawFallback' | 'unknown' = 'unknown';

    // 1. Parsing Logic
    if (contentType.includes('application/x-www-form-urlencoded') || rawTrim.includes('=')) {
      const params = new URLSearchParams(rawTrim);
      const foundText = params.get("text") || params.get("value") || params.get("Value") || 
                        params.get("note") || params.get("input") || params.get("body");
      
      if (foundText) {
        text = foundText;
        parsedFrom = 'urlencoded';
        const clientDate = params.get('created_at');
        if (clientDate) createdAtClient = clientDate;
      }
    }

    if (!text && (contentType.includes('application/json') || rawTrim.startsWith('{'))) {
      try {
        const body = JSON.parse(rawTrim);
        const foundText = body.text || body.value || body.note || body.input || body.body;
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

    // 2. Load live categories from Config sheet
    let liveCategories: string[] = [];
    try {
      liveCategories = await getCategoriesFromSheet(sheets, spreadsheetId);
    } catch (catErr) {
      console.warn('Failed to fetch categories from Config sheet, falling back to defaults.');
      liveCategories = ['personal', 'work', 'other'];
    }

    // 3. AI Analysis using refined classifier
    const classification = await classifyNote(cleanText, liveCategories);
    const id = crypto.randomUUID();
    const createdAtServer = new Date().toISOString();

    // 4. Calendar Routing
    let forwardedToCalendar = false;
    // item_type 'event' or is_event flag trigger forwarding
    if (classification.item_type === 'event' || classification.is_event) {
      try {
        forwardedToCalendar = await forwardToCalendar(cleanText);
      } catch (calError) {
        console.warn('Calendar routing failed:', calError);
      }
    }

    // 5. Persistent Storage (Google Sheets)
    let sheetWriteOk = false;
    try {
      await ensureHeaders(sheets, spreadsheetId);
      const appendRes = await sheets.spreadsheets.values.append({
        spreadsheetId: spreadsheetId,
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
            forwardedToCalendar ? 'FORWARDED' : 'LOCAL'
          ]],
        },
      });

      if (appendRes.status === 200) {
        sheetWriteOk = true;
      }
    } catch (sheetError: any) {
      console.error('Storage Error:', sheetError);
      return NextResponse.json({ ok: false, error: `Storage failure: ${sheetError.message}` }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      id,
      classification: {
        item_type: classification.item_type,
        category: classification.category,
        time_bucket: classification.time_bucket,
        is_event: classification.is_event,
        summary: classification.summary
      },
      // Debug Info
      classificationSource: classification.classificationSource,
      rawModelTextPreview: classification.rawModelTextPreview,
      calendar_routed: forwardedToCalendar,
      sheet_write_ok: sheetWriteOk,
      parsedFrom
    });

  } catch (error: any) {
    console.error('Inbox API Handler Critical Error:', error);
    return NextResponse.json({ ok: false, error: `Internal Server Error: ${error.message}` }, { status: 500 });
  }
}
