import * as XLSX from "xlsx";

export function rowsToExcelBuffer(
  sheetName: string,
  headers: string[],
  rows: Array<Array<string | number | null>>,
): Buffer {
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));

  return Buffer.from(
    XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as ArrayBuffer,
  );
}
