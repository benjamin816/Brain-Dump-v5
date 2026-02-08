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
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    const sheetEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const sheetKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
    const geminiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;

    const missingVars = [];
    if (!spreadsheetId) missingVars.push('GOOGLE_SHEETS_ID');
    if (!sheetEmail) missingVars.push('GOOGLE_SERVICE_ACCOUNT_EMAIL');
    if (!sheetKey) missingVars.push('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');
    if (!geminiKey) missingVars.push('GEMINI_API_KEY');

    if (missingVars.length > 0) {
      return NextResponse.json({ 
        ok: false, 
        error: `Missing environment configuration: ${missingVars.join(', ')}` 
      }, { status: 500 });
    }

    const contentType = (req.headers.get('content-type') || '').toLowerCase();
    let text = '';
    let createdAtClient = new Date().toISOString();
    let customCategories: string[] = [];
    let parsedFrom: 'json' | 'form' | 'text' = 'text';

    if (contentType.includes('application/json')) {
      parsedFrom = 'json';
      const body = await req.json();
      text = body.text || '';
      if (body.created_at) createdAtClient = body.created_at;
      if (Array.isArray(body.categories)) customCategories = body.categories;
    } else if (
      contentType.includes('application/x-www-form-urlencoded') || 
      contentType.includes('multipart/form-data')
    ) {
      parsedFrom = 'form';
      const formData = await req.formData();
      
      // Candidate keys for the note text from iPhone Shortcuts or other form-based tools
      const candidates = ['text', 'note', 'input', 'body'];
      for (const key of candidates) {
        const val = formData.get(key);
        if (val && typeof val === 'string') {
          text = val;
          break;
        }
      }

      // Check for other metadata if available in form fields
      const clientDate = formData.get('created_at');
      if (clientDate && typeof clientDate === 'string') createdAtClient = clientDate;
      
      const cats = formData.get('categories');
      if (cats && typeof cats === 'string') {
        try {
          customCategories = JSON.parse(cats);
        } catch (e) {
          customCategories = cats.split(',').map(c => c.trim());
        }
      }
    } else {
      parsedFrom = 'text';
      text = await req.text();
    }

    // Guard against empty content
    if (!text || !text.trim()) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Missing text', 
        parsedFrom 
      }, { status: 400 });
    }

    // Clean up text in case it's double-encoded or contains unexpected whitespace
    const cleanText = text.trim();

    // 1. AI Analysis with dynamic categories if provided
    const classification = await classifyNote(cleanText, customCategories);
    const id = crypto.randomUUID();
    const createdAtServer = new Date().toISOString();

    // 2. Calendar Routing
    let forwardedToCalendar = false;
    if (classification.is_event) {
      try {
        forwardedToCalendar = await forwardToCalendar(cleanText);
      } catch (calError) {
        console.warn('Calendar routing failed:', calError);
      }
    }

    // 3. Persistent Storage
    let sheetWriteOk = false;
    try {
      const sheets = await getSheetsClient();
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
            forwardedToCalendar ? 'FORWARDED' : 'LOCAL'
          ]],
        },
      });

      if (appendRes.status === 200) {
        sheetWriteOk = true;
      }
    } catch (sheetError: any) {
      console.error('Storage Error:', sheetError);
      return NextResponse.json({ ok: false, error: `Storage failure: ${sheetError.message}`, parsedFrom }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      id,
      classification,
      calendar_routed: forwardedToCalendar,
      sheet_write_ok: sheetWriteOk,
      parsedFrom
    });
  } catch (error: any) {
    console.error('Inbox API Handler Error:', error);
    return NextResponse.json({ ok: false, error: `Internal Server Error: ${error.message}` }, { status: 500 });
  }
}
