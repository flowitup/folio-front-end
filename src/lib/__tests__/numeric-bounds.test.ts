/**
 * Web copies of the API's input caps (back end app/api/v1/numeric_bounds.py).
 * Pinned so a change on either side is a deliberate, reviewed edit.
 */
import { describe, it, expect } from "vitest";
import * as bounds from "../numeric-bounds";

describe("numeric bounds", () => {
  it("match the API's caps", () => {
    expect(bounds).toMatchObject({
      MAX_DAILY_AMOUNT: 99999999.99,
      MAX_BUDGET: 9999999999.99,
      MAX_INT_QUANTITY: 2147483647,
      MAX_ARTICLE_QUANTITY: 999999999.999,
      MAX_QUOTE_UNIT_PRICE: 99999999.9999,
      MAX_LIBRARY_AMOUNT: 99999999999999.9999,
      MAX_LINE_QUANTITY: 9999999,
      MAX_LINE_UNIT_PRICE: 999999999,
    });
  });
});
