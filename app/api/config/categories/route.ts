
import { NextResponse } from 'next/server';
import { getSheetsClient, getCategoriesFromSheet, updateCategoriesInSheet } from '@/lib/google-sheets';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    if (!spreadsheetId) throw new Error('GOOGLE_SHEETS_ID not configured');

    const sheets = await getSheetsClient();
    const categories = await getCategoriesFromSheet(sheets, spreadsheetId);
    
    return NextResponse.json({ ok: true, categories });
  } catch (error: any) {
    console.error('GET Categories API Error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const { categories } = await req.json();
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
    if (!spreadsheetId) throw new Error('GOOGLE_SHEETS_ID not configured');
    if (!Array.isArray(categories)) throw new Error('Invalid categories format');

    const sheets = await getSheetsClient();
    await updateCategoriesInSheet(sheets, spreadsheetId, categories);

    return NextResponse.json({ ok: true, categories });
  } catch (error: any) {
    console.error('PUT Categories API Error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
