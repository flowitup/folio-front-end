/**
 * Pure predicate for the /dashboard onboarding gate.
 *
 * Kept separate from `dashboard/layout.tsx` so the branching logic is
 * unit-testable without `next/headers` / a live session. A signed-in user
 * only needs to be pushed through onboarding when ALL of these hold:
 * - they are not platform ops (flowitup support has no company and never
 *   needs one — see `isPlatformOps` in `permissions.ts`);
 * - they have zero companies;
 * - they have no visible projects (cheap check — covers the edge case of a
 *   member removed from every company but still assigned to a project;
 *   without this a company-detach would incorrectly bounce them mid-work).
 */
export interface OnboardingGateInput {
  isPlatformOps: boolean;
  companiesCount: number;
  hasVisibleProjects: boolean;
}

export function shouldRedirectToOnboarding({
  isPlatformOps,
  companiesCount,
  hasVisibleProjects,
}: OnboardingGateInput): boolean {
  return !isPlatformOps && companiesCount === 0 && !hasVisibleProjects;
}
