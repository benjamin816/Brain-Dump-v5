
import { NextResponse } from 'next/server';
import { classifyNote } from '@/lib/gemini';
import { getSheetsClient, ensureHeaders } from '@/lib/google-sheets';

export async function GET() {
  return NextResponse.json({ ok: true, message: "inbox live" });
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get('content-type') || '';
    let text = '';
    let createdAtClient = '';

    if (contentType.includes('application/json')) {
      const body = await req.json();
      text = body.text || '';
      createdAtClient = body.created_at || '';
    } else {
      text = await req.text();
    }

    if (!text.trim()) {
      return NextResponse.json({ ok: false, error: 'Empty text' }, { status: 400 });
    }

    const classification = await classifyNote(text);
    const id = crypto.randomUUID();
    const createdAtServer = new Date().toISOString();

    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID!;
    
    await ensureHeaders(sheets, spreadsheetId);

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Sheet1!A:G',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          id,
          text,
          createdAtClient,
          createdAtServer,
          classification.item_type,
          classification.time_bucket,
          classification.category
        ]],
      },
    });

    return NextResponse.json({
      ok: true,
      id,
      stored: {
        text,
        created_at_client: createdAtClient,
        created_at_server: createdAtServer,
        ...classification
      }
    });
  } catch (error: any) {
    console.error('Inbox API Error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
