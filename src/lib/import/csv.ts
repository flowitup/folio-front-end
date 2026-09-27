/**
 * Minimal CSV reader for import files (RFC 4180 quoting).
 *
 * Spreadsheet exports vary by locale: French Excel writes `;`-separated files,
 * others use `,` or tabs. The delimiter is detected from the header line, a
 * UTF-8 byte-order mark is dropped, quoted fields may contain the delimiter,
 * line breaks and doubled quotes (`""`). Rows made only of empty cells are
 * skipped so trailing blank lines in a sheet export do not become records.
 */

const CANDIDATE_DELIMITERS = [";", ",", "\t"] as const;

/** Count each candidate delimiter outside quotes on the first line; the most frequent wins. */
export function detectCsvDelimiter(text: string): string {
  const counts = new Map<string, number>(CANDIDATE_DELIMITERS.map((d) => [d, 0]));
  let inQuotes = false;
  for (const ch of text) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && (ch === "\n" || ch === "\r")) break;
    else if (!inQuotes && counts.has(ch)) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  }
  let best = ",";
  let bestCount = 0;
  for (const [delimiter, count] of counts) {
    if (count > bestCount) {
      best = delimiter;
      bestCount = count;
    }
  }
  return best;
}

/** One parsed row plus the 1-based line number it started on (for error messages). */
export interface CsvRow {
  line: number;
  cells: string[];
}

export function parseCsv(input: string, delimiter?: string): CsvRow[] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const sep = delimiter ?? detectCsvDelimiter(text);
  const rows: CsvRow[] = [];

  let cells: string[] = [];
  let field = "";
  let inQuotes = false;
  let line = 1;
  let rowStartLine = 1;

  const endRow = () => {
    cells.push(field);
    if (cells.some((c) => c.trim() !== "")) rows.push({ line: rowStartLine, cells });
    cells = [];
    field = "";
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === "\n") line++;
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field === "") {
      inQuotes = true;
    } else if (ch === sep) {
      cells.push(field);
      field = "";
    } else if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      endRow();
      line++;
      rowStartLine = line;
    } else {
      field += ch;
    }
  }
  if (field !== "" || cells.length > 0) endRow();
  return rows;
}

/** Quote a value for a CSV cell when it contains the delimiter, a quote or a line break. */
export function toCsvCell(value: string, delimiter: string): string {
  if (value.includes(delimiter) || /["\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
