/**
 * Read an import file picked in the browser as text.
 *
 * Files are decoded as UTF-8 first; a file that is not valid UTF-8 is re-read
 * as Windows-1252, the encoding older Excel versions use for "CSV" exports in
 * French, so accented names do not come through as replacement characters.
 */

/** Upper bound for an import file; far above any realistic export, low enough to parse in-page. */
export const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;

export async function readImportFileText(file: Blob): Promise<string> {
  const buffer = await file.arrayBuffer();
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}
