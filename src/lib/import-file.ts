import ExcelJS from 'exceljs';

const cellText = (v: any): string => {
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v instanceof Date) return v.toISOString();
    if ('result' in v) return cellText((v as any).result);           // formula
    if ('richText' in v) return (v as any).richText.map((r: any) => r.text).join('');
    if ('text' in v) return String((v as any).text);                  // hyperlink
    return '';
  }
  return String(v).trim();
};

/** Same RFC-4180 reader the browser used to have; kept on the server so .csv and .xlsx share one path. */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const rows: string[][] = []; let row: string[] = [], cur = '', inQ = false;
  const delim = (src.split('\n', 1)[0].match(/;/g) || []).length > (src.split('\n', 1)[0].match(/,/g) || []).length ? ';' : ',';
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQ) { if (ch === '"') { if (src[i + 1] === '"') { cur += '"'; i++; } else inQ = false; } else cur += ch; }
    else if (ch === '"') inQ = true;
    else if (ch === delim) { row.push(cur.trim()); cur = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && src[i + 1] === '\n') i++; row.push(cur.trim()); cur = ''; if (row.some(Boolean)) rows.push(row); row = []; }
    else cur += ch;
  }
  row.push(cur.trim()); if (row.some(Boolean)) rows.push(row);
  return rows;
}

/** First worksheet of an .xlsx -> rows of text. Prices typed as numbers keep their value, not their cell format. */
export async function parseXlsx(buf: Buffer | ArrayBuffer): Promise<string[][]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as any);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const rows: string[][] = [];
  const width = ws.columnCount;
  ws.eachRow({ includeEmpty: false }, row => {
    const out: string[] = [];
    for (let c = 1; c <= width; c++) out.push(cellText(row.getCell(c).value));
    rows.push(out);
  });
  return rows;
}

export async function parseUpload(name: string, buf: Buffer): Promise<string[][]> {
  if (/\.xlsx$/i.test(name)) return parseXlsx(buf);
  if (/\.(csv|txt)$/i.test(name)) return parseCsv(buf.toString('utf8'));
  throw new Error('Upload an Excel (.xlsx) or CSV file.');
}

export async function buildTemplateXlsx(rows: string[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Products');
  rows.forEach(r => ws.addRow(r));
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  ws.columns.forEach(c => { c.width = 18; });
  const help = wb.addWorksheet('How to fill');
  [
    ['Column', 'What to write'],
    ['sku', 'Required. Unique code. A SKU that already exists UPDATES that product; a new SKU creates one.'],
    ['name, price, stock, category', 'Required for NEW products. Stock is in base units (use 0 if none).'],
    ['category / subcategory', 'Names are fine. Missing categories are created for you. You can also write "Parent > Child" in category.'],
    ['uom', 'Unit of measure, e.g. pcs, kg, m. Missing units are created for you.'],
    ['units', 'Extra ways to sell: Name|base units inside|price; next one after a semicolon. Example: Box of 12|12|90.000; Carton|48|330'],
    ['image', 'Full image links, several separated with ;'],
    ['Updating', 'For an existing SKU only fill the columns you want to change; blank cells are left as they are.'],
    ['true/false columns', 'Use true or false (or yes / no).'],
  ].forEach(r => help.addRow(r));
  help.getRow(1).font = { bold: true }; help.getColumn(1).width = 30; help.getColumn(2).width = 110;
  return Buffer.from(await wb.xlsx.writeBuffer());
}
