import { NextResponse } from 'next/server';
import { getSheetsClient, getSheetId } from '@/lib/google-sheets';

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const updates = await req.json();
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

    if (!spreadsheetId) {
      return NextResponse.json({ ok: false, error: 'Spreadsheet ID is not configured' }, { status: 500 });
    }

    // Look for ID in Column G
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Sheet1!G:G',
    });
    
    const rows = res.data.values;
    if (!rows || rows.length === 0) {
      return NextResponse.json({ ok: false, error: 'No data found in sheet' }, { status: 404 });
    }

    const rowIndex = rows.findIndex((row: any) => row && row[0] === id);

    if (rowIndex === -1) {
      return NextResponse.json({ ok: false, error: 'Entry not found' }, { status: 404 });
    }

    const rowNum = rowIndex + 1;
    // Fetch full row up to status (A to H)
    const currentRes = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `Sheet1!A${rowNum}:H${rowNum}`,
    });

    const currentValues = currentRes.data.values;
    if (!currentValues || currentValues.length === 0 || !currentValues[0]) {
      return NextResponse.json({ ok: false, error: 'Row data not found' }, { status: 404 });
    }

    const currentRow = currentValues[0];

    // Reconstruction order: text(0), created_at(1), received_at(2), item_type(3), time_bucket(4), categories(5), id(6), status(7)
    const newRow = [
      updates.text !== undefined ? updates.text : currentRow[0],
      updates.created_at_client !== undefined ? updates.created_at_client : currentRow[1],
      currentRow[2], // received_at (server) immutable
      updates.item_type !== undefined ? updates.item_type : currentRow[3],
      updates.time_bucket !== undefined ? updates.time_bucket : currentRow[4],
      updates.category !== undefined ? updates.category : currentRow[5],
      currentRow[6], // id immutable
      currentRow[7]  // status immutable
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `Sheet1!A${rowNum}:H${rowNum}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [newRow],
      },
    });

    return NextResponse.json({ ok: true, id, updated: true });
  } catch (error: any) {
    console.error('PATCH Entry Error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const { id } = params;
    const sheets = await getSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

    if (!spreadsheetId) {
      return NextResponse.json({ ok: false, error: 'Spreadsheet ID is not configured' }, { status: 500 });
    }

    // Look for ID in Column G
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Sheet1!G:G',
    });
    
    const rows = res.data.values;
    if (!rows || rows.length === 0) {
      return NextResponse.json({ ok: false, error: 'Entry not found' }, { status: 404 });
    }

    const rowIndex = rows.findIndex((row: any) => row && row[0] === id);

    if (rowIndex === -1) {
      return NextResponse.json({ ok: false, error: 'Entry not found' }, { status: 404 });
    }

    const sheetId = await getSheetId(sheets, spreadsheetId);
    if (sheetId === undefined || sheetId === null) {
      return NextResponse.json({ ok: false, error: 'Could not resolve sheet ID' }, { status: 500 });
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: rowIndex,
                endIndex: rowIndex + 1,
              },
            },
          },
        ],
      },
    });

    return NextResponse.json({ ok: true, id, deleted: true });
  } catch (error: any) {
    console.error('DELETE Entry Error:', error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
