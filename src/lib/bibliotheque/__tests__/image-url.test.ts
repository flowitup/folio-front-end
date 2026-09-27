/**
 * image-url.test.ts — the https pre-check and the BE error-code mapping used
 * by the library "image from a supplier link" field.
 */

import { describe, it, expect } from "vitest";
import { imageUrlErrorKey, isHttpsUrl } from "../image-url";

describe("isHttpsUrl", () => {
  it.each([
    "https://media.adeo.com/marketplace/photo.jpg",
    "  https://www.leroymerlin.fr/img.png  ",
  ])("accepts %s", (value) => {
    expect(isHttpsUrl(value)).toBe(true);
  });

  it.each([
    "",
    "media.adeo.com/photo.jpg",
    "http://media.adeo.com/photo.jpg",
    "ftp://media.adeo.com/photo.jpg",
    "not a url",
  ])("rejects %j", (value) => {
    expect(isHttpsUrl(value)).toBe(false);
  });
});

describe("imageUrlErrorKey", () => {
  it.each([
    ["ValidationError", "invalid"],
    ["SsrfBlocked", "blocked"],
    ["UnsupportedMediaType", "notImage"],
    ["FileTooLarge", "tooLarge"],
    ["Forbidden", "forbidden"],
  ])("maps %s to %s", (code, key) => {
    expect(imageUrlErrorKey(code)).toBe(key);
  });

  it("treats an unknown or missing code as a failed download", () => {
    expect(imageUrlErrorKey("InternalError")).toBe("failed");
    expect(imageUrlErrorKey(undefined)).toBe("failed");
  });
});
