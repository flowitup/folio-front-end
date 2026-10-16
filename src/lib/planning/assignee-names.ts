/**
 * The board's id → name lookup for task assignees, with a placeholder for an
 * assignee who is not on the loaded project team (removed since, or an account
 * that reads the project without being listed). Without it a card assigned to
 * such a person shows no name at all and reads as free, while the drawer says
 * "someone outside the team".
 */
export function assigneeNamesWithFallback(
  names: ReadonlyMap<string, string>,
  fallback: string,
): ReadonlyMap<string, string> {
  class WithFallback extends Map<string, string> {
    override get(id: string): string {
      return super.get(id) ?? fallback;
    }
  }
  return new WithFallback(names);
}
