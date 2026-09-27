/**
 * Images up to 10 MB (the API's cap, and what the upload dialogs advertise)
 * go through server actions. Next's default 1 MB server-action body limit and
 * the 10 MB proxy buffer both refused them, so both limits are pinned above
 * 10 MB plus multipart overhead.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const CONFIG = readFileSync(resolve(__dirname, "..", "..", "next.config.ts"), "utf-8");
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

function limitBytes(key: string): number {
  const m = CONFIG.match(new RegExp(`${key}:\\s*"(\\d+)mb"`));
  expect(m, `${key} must be set in next.config.ts`).not.toBeNull();
  return Number(m![1]) * 1024 * 1024;
}

describe("next.config upload body limits", () => {
  it.each(["bodySizeLimit", "proxyClientMaxBodySize"])("%s leaves room for a 10 MB file", (key) => {
    expect(limitBytes(key)).toBeGreaterThan(MAX_UPLOAD_BYTES);
  });
});
