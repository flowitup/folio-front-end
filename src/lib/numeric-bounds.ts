/**
 * Upper bounds the API accepts for money and quantity fields
 * (back end: app/api/v1/numeric_bounds.py, and the billing line schema).
 * Each sits just under the column that stores the value, so a form can stop
 * an oversized number before the API rejects it.
 */

/** Worker daily rate, rate change, labor amount override — Numeric(10, 2). */
export const MAX_DAILY_AMOUNT = 99_999_999.99;
/** Project budget — Numeric(14, 2). */
export const MAX_BUDGET = 9_999_999_999.99;
/** Inventory counts — Postgres INTEGER. */
export const MAX_INT_QUANTITY = 2_147_483_647;
/** Chiffrage article quantity — Numeric(12, 3). */
export const MAX_ARTICLE_QUANTITY = 999_999_999.999;
/** Chiffrage quote unit price — Numeric(12, 4). */
export const MAX_QUOTE_UNIT_PRICE = 99_999_999.9999;
/** Bibliotheque purchase quantity and unit price — Numeric(18, 4). */
export const MAX_LIBRARY_AMOUNT = 99_999_999_999_999.9999;
/** Expense and billing document line quantity. */
export const MAX_LINE_QUANTITY = 9_999_999;
/** Expense and billing document line unit price (absolute value). */
export const MAX_LINE_UNIT_PRICE = 999_999_999;
/** VAT rate in percent. */
export const MAX_VAT_RATE = 100;
