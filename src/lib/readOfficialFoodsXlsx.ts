import * as XLSX from 'xlsx';
import { parseOfficialFoodsRows, type OfficialFoodsParseResult } from './parseOfficialFoodsWorkbook';

export async function parseOfficialFoodsWorkbook(file: File): Promise<OfficialFoodsParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const sheetName =
    workbook.SheetNames.find((name) => name.trim().toLowerCase() === 'alimentos')
    ?? workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error('El Excel no tiene hojas.');
  }
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: true,
  }) as unknown[][];
  return parseOfficialFoodsRows(rows);
}
