import { NextResponse } from 'next/server';
import { classifyNote } from '@/lib/gemini';
import { getSheetsClient, ensureHeaders } from '@/lib/google-sheets';
import { forwardToCalendar } from '@/services/calendarService';

export const runtime = 'nodejs';

export async function GET() {
  return NextResponse.json({ ok: true, message: "inbox live" });
}

export async function POST(req: Request) {
  try {
    // 1. Env Validation - Fail gracefully at request time, not build time
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    const sheetEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const sheetKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
    const geminiKey = process.env.API_KEY;

    if (!spreadsheetId || !sheetEmail || !sheetKey || !geminiKey) {
      console.error('Missing configuration:', { 
        hasSpreadsheetId: !!spreadsheetId, 
        hasEmail: !!sheetEmail, 
        hasKey: !!sheetKey, 
        hasGeminiKey: !!geminiKey 
      });
      return NextResponse.json({ 
        ok: false, 
        error: 'System configuration missing (Environment Variables)' 
      }, { status: 500 });
    }

    const contentType = req.headers.get('content-type') || '';
    let text = '';
    let createdAtClient = new Date().toISOString();

    if (contentType.includes('application/json')) {
      const body = await req.json();
      text = body.text || '';
      if (body.created_at) createdAtClient = body.created_at;
    } else {
      // Direct text body from Siri Shortcuts
      text = await req.text();
    }

    if (!text.trim()) {
      return NextResponse.json({ ok: false, error: 'Empty content' }, { status: 400 });
    }

    // 2. Intelligent AI Classification
    const classification = await classifyNote(text);
    const id = crypto.randomUUID();
    const createdAtServer = new Date().toISOString();

    // 3. Automated Routing (Calendar Agent)
    let forwardedToCalendar = false;
    if (classification.is_event) {
      try {
        forwardedToCalendar = await forwardToCalendar(text);
      } catch (calError) {
        console.warn('Calendar routing failed, continuing:', calError);
      }
    }

    // 4. Persistent Storage (Google Sheets)
    try {
      const sheets = await getSheetsClient();
      await ensureHeaders(sheets, spreadsheetId);

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: 'Sheet1!A:H',
        valueInputOption: 'RAW',
        requestBody: {
          values: [[
            id,
            text,
            createdAtClient,
            createdAtServer,
            classification.item_type,
            classification.time_bucket,
            classification.category,
            forwardedToCalendar ? 'FORWARDED' : 'LOCAL'
          ]],
        },
      });
    } catch (sheetError: any) {
      console.error('Storage Error:', sheetError);
      // We still return 500 if the primary storage fails
      return NextResponse.json({ ok: false, error: 'Failed to persist note' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      id,
      classification,
      calendar_routed: forwardedToCalendar
    });
  } catch (error: any) {
    console.error('Inbox API Handler Error:', error);
    return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
