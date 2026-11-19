export function escapeCsvValue(value: string | number | null | undefined): string {
  const normalized = value == null ? "" : String(value);

  if (/[",\n\r]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  return normalized;
}

export function rowsToCsv(headers: string[], rows: Array<Array<string | number | null>>): string {
  const lines = [
    headers.map(escapeCsvValue).join(","),
    ...rows.map((row) => row.map(escapeCsvValue).join(",")),
  ];

  return `\uFEFF${lines.join("\r\n")}`;
}

export function csvToBuffer(csv: string): Buffer {
  return Buffer.from(csv, "utf-8");
}
