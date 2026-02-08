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
    // Fix: Always use process.env.API_KEY exclusively for Gemini API interactions
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
    let customCategories: string[] = [];
    let parsedFrom: 'urlencoded' | 'json' | 'rawFallback' | 'unknown' = 'unknown';
    let receivedKeys: string[] = [];

    // 1. Parsing Priority Logic
    if (contentType.includes('application/x-www-form-urlencoded') || rawTrim.includes('=')) {
      const params = new URLSearchParams(rawTrim);
      const foundText = params.get("text") || params.get("value") || params.get("Value") || 
                        params.get("note") || params.get("input") || params.get("body");
      
      if (foundText) {
        text = foundText;
        parsedFrom = 'urlencoded';
        receivedKeys = Array.from(params.keys());
        const clientDate = params.get('created_at');
        if (clientDate) createdAtClient = clientDate;
        const cats = params.get('categories');
        if (cats) {
          try {
            customCategories = JSON.parse(cats);
          } catch (e) {
            customCategories = cats.split(',').map(c => c.trim()).filter(Boolean);
          }
        }
      } else {
        receivedKeys = Array.from(params.keys());
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
          if (Array.isArray(body.categories)) customCategories = body.categories;
          receivedKeys = Object.keys(body);
        }
      } catch (e) {}
    }

    if (!text && rawTrim) {
      text = rawTrim;
      parsedFrom = 'rawFallback';
    }

    if (!text || !text.trim()) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Missing text', 
        parsedFrom,
        receivedKeys: receivedKeys.length > 0 ? receivedKeys : undefined,
        rawBodyPreview: rawTrim.substring(0, 120)
      }, { status: 400 });
    }

    const cleanText = text.trim();
    const sheets = await getSheetsClient();

    // 2. Load centralized categories if not provided (server-side truth)
    if (customCategories.length === 0) {
      try {
        customCategories = await getCategoriesFromSheet(sheets, spreadsheetId);
      } catch (catErr) {
        console.warn('Failed to fetch categories from sheet, using fallback list');
      }
    }

    // 3. AI Analysis
    const classification = await classifyNote(cleanText, customCategories);
    const id = crypto.randomUUID();
    const createdAtServer = new Date().toISOString();

    // 4. Calendar Routing
    let forwardedToCalendar = false;
    if (classification.is_event) {
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
      return NextResponse.json({ 
        ok: false, 
        error: `Storage failure: ${sheetError.message}`, 
        parsedFrom 
      }, { status: 500 });
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
    console.error('Inbox API Handler Critical Error:', error);
    return NextResponse.json({ ok: false, error: `Internal Server Error: ${error.message}` }, { status: 500 });
  }
}