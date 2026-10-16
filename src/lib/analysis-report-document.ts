/**
 * Pieces of the analysis-report proxy (src/app/analysis-report/...) kept out
 * of the route file, which may only export route handlers.
 */

import { defaultLocale, locales, type Locale } from "@/i18n/config";

const ERROR_TEXT: Record<
  Locale,
  { title: string; forbidden: string; gone: string; signedOut: string; failed: string; signIn: string }
> = {
  fr: {
    title: "Rapport indisponible",
    forbidden: "Vous n'avez pas accès à ce rapport.",
    gone: "Ce rapport n'est plus disponible.",
    signedOut: "Votre session a expiré. Reconnectez-vous pour voir ce rapport.",
    failed: "Ce rapport n'a pas pu être chargé.",
    signIn: "Se connecter",
  },
  en: {
    title: "Report unavailable",
    forbidden: "You do not have access to this report.",
    gone: "This report is no longer available.",
    signedOut: "Your session has expired. Sign in again to see this report.",
    failed: "This report could not be loaded.",
    signIn: "Sign in",
  },
  vi: {
    title: "Báo cáo không khả dụng",
    forbidden: "Bạn không có quyền xem báo cáo này.",
    gone: "Báo cáo này không còn nữa.",
    signedOut: "Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại để xem báo cáo này.",
    failed: "Không thể tải báo cáo này.",
    signIn: "Đăng nhập",
  },
};

function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (locales as readonly string[]).includes(value);
}

/** The visitor's locale: NEXT_LOCALE cookie, then Accept-Language, then the default. */
export function requestLocale(request: Request): Locale {
  const cookie = request.headers.get("cookie") ?? "";
  const fromCookie = /(?:^|;\s*)NEXT_LOCALE=([^;]+)/.exec(cookie)?.[1];
  if (isLocale(fromCookie)) return fromCookie;
  for (const part of (request.headers.get("accept-language") ?? "").split(",")) {
    const tag = part.split(";")[0].trim().toLowerCase().split("-")[0];
    if (isLocale(tag)) return tag;
  }
  return defaultLocale;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Minimal, self-contained placeholder shown inside the frame on failure. */
export function errorDocument(status: number, locale: Locale, loginUrl?: string): string {
  const text = ERROR_TEXT[locale];
  const message =
    status === 403
      ? text.forbidden
      : status === 404
        ? text.gone
        : status === 401
          ? text.signedOut
          : text.failed;
  // target=_top is refused by the sandbox (no allow-top-navigation): the
  // sign-in page opens in a new tab, which allow-popups permits.
  const link = loginUrl
    ? `<a href="${escapeHtml(loginUrl)}" target="_blank" rel="noopener" style="color:#2563eb">${text.signIn}</a>`
    : "";
  return `<!DOCTYPE html><html lang="${locale}"><head><meta charset="utf-8"><title>${text.title}</title></head><body style="margin:0;display:flex;flex-direction:column;gap:8px;align-items:center;justify-content:center;height:100vh;padding:16px;box-sizing:border-box;text-align:center;font:14px system-ui,sans-serif;color:#6b7280;background:#fff"><p style="margin:0">${message}</p>${link}</body></html>`;
}

/**
 * Plain links open a new tab (`<base target="_blank">`); in-page anchors
 * (`href="#..."`) keep scrolling the report itself.
 */
const LINK_SHIM =
  '<base target="_blank">' +
  "<script>document.addEventListener('click',function(e){" +
  "var a=e.target&&e.target.closest&&e.target.closest('a[href]');" +
  "if(a&&a.getAttribute('href').charAt(0)==='#'&&!a.hasAttribute('target'))a.setAttribute('target','_self');" +
  "if(a&&a.target==='_blank'){var r=(a.getAttribute('rel')||'');if(r.indexOf('noopener')<0)a.setAttribute('rel',(r+' noopener').trim());}" +
  "},true);</script>";

/** Inserts the link shim right after `<head>` (or at the top of a headless document). */
export function withLinkShim(html: string): string {
  const head = /<head(\s[^>]*)?>/i.exec(html);
  if (head) {
    const at = head.index + head[0].length;
    return html.slice(0, at) + LINK_SHIM + html.slice(at);
  }
  return LINK_SHIM + html;
}
