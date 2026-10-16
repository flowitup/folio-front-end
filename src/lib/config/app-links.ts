/**
 * Universal links (iOS) and App Links (Android) for the mobile app, so an
 * invitation link opens the app's accept-invite screen when it is installed.
 *
 * The identifiers are deployment settings, read at request time:
 * - IOS_APP_ID: "<Apple team id>.<bundle id>", e.g. "ABCDE12345.com.flowitup.folio"
 * - ANDROID_PACKAGE: the app's package (default com.flowitup.folio)
 * - ANDROID_SHA256_CERT_FINGERPRINTS: comma-separated signing-cert fingerprints
 * Without them the files are served empty and no link is claimed.
 */

/** The web paths the app opens itself: invitation links in every locale. */
export const APP_LINK_PATHS = ["/*/accept-invite/*"];

export function appleAppSiteAssociation(env: Record<string, string | undefined> = process.env) {
  const appId = env.IOS_APP_ID?.trim();
  return {
    applinks: {
      details: appId ? [{ appIDs: [appId], components: APP_LINK_PATHS.map((path) => ({ "/": path })) }] : [],
    },
  };
}

export function assetLinks(env: Record<string, string | undefined> = process.env) {
  const fingerprints = (env.ANDROID_SHA256_CERT_FINGERPRINTS ?? "")
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);
  if (fingerprints.length === 0) return [];
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: env.ANDROID_PACKAGE?.trim() || "com.flowitup.folio",
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
}
