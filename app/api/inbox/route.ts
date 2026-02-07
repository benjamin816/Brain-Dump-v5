import { NextResponse } from 'next/server';
import { classifyNote } from '@/lib/gemini';
import { getSheetsClient, ensureHeaders } from '@/lib/google-sheets';
import { forwardToCalendar } from '@/services/calendarService';

export async function GET() {
  return NextResponse.json({ ok: true, status: "Webhook endpoint active" });
}

export async function POST(req: Request) {
  try {
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

    // 1. Intelligent AI Classification
    const classification = await classifyNote(text);
    const id = crypto.randomUUID();
    const createdAtServer = new Date().toISOString();

    // 2. Automated Routing (Calendar Agent)
    let forwardedToCalendar = false;
    if (classification.is_event) {
      forwardedToCalendar = await forwardToCalendar(text);
    }

    // 3. Persistent Storage (Google Sheets)
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
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

    return NextResponse.json({
      ok: true,
      id,
      classification,
      calendar_routed: forwardedToCalendar
    });
  } catch (error: any) {
    console.error('Inbox API Error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
