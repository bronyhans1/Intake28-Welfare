export function truncateText(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trimEnd()}…`;
}

export function shouldTruncateText(value: string, maxLength: number): boolean {
  return value.length > maxLength;
}
