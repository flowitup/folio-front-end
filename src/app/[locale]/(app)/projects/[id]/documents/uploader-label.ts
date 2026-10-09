import { formatFrenchPhone } from "@/lib/auth/phone-number";
import type { DocumentUploader } from "@/lib/api/project-documents";

/**
 * How an uploader is named in the documents UI. The API names them by name,
 * else real e-mail, else phone (never a phone-only account's synthetic address
 * nor an erased account's placeholder); the phone is shown formatted. "" for an
 * erased account: callers show "former member" instead.
 */
export function uploaderLabel(uploader: DocumentUploader): string {
  if (uploader.is_deleted) return "";
  const name = uploader.display_name.trim();
  const phone = uploader.phone?.trim();
  return phone && name === phone ? formatFrenchPhone(phone) : name;
}
