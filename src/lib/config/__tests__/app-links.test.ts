import { describe, it, expect } from "vitest";
import { appleAppSiteAssociation, assetLinks } from "../app-links";

describe("app links", () => {
  it("claims the invitation links for the iOS app once its id is configured", () => {
    expect(appleAppSiteAssociation({ IOS_APP_ID: "TEAM123.com.flowitup.folio" })).toEqual({
      applinks: {
        details: [{ appIDs: ["TEAM123.com.flowitup.folio"], components: [{ "/": "/*/accept-invite/*" }] }],
      },
    });
    expect(appleAppSiteAssociation({}).applinks.details).toEqual([]);
  });

  it("lists the Android signing fingerprints, or nothing", () => {
    const links = assetLinks({ ANDROID_SHA256_CERT_FINGERPRINTS: "AA:BB, CC:DD" });
    expect(links[0].target).toEqual({
      namespace: "android_app",
      package_name: "com.flowitup.folio",
      sha256_cert_fingerprints: ["AA:BB", "CC:DD"],
    });
    expect(assetLinks({})).toEqual([]);
  });
});
