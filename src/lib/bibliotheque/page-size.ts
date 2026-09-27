/**
 * Products per page of GET /bibliotheque/products. The API pages by 20 and
 * does not read a page size parameter, so the page count must be computed with
 * this same number: a larger one leaves the last pages unreachable.
 */
export const LIBRARY_PAGE_SIZE = 20;
