export function reviewerMutationBlocked(role: string): boolean {
  return role === "reviewer";
}

export function panelConfigBlocksStaff(role: string, failed: boolean, config: unknown): boolean {
  return role !== "participant" && failed && config == null;
}
