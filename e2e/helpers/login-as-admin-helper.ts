/**
 * Back-compat shim. The admin login logic now lives in `auth-helper.ts`
 * (generalized to `loginAs`). Existing specs import `loginAsAdmin` from here;
 * keep this re-export so those imports stay valid.
 */
export { loginAsAdmin } from "./auth-helper";
