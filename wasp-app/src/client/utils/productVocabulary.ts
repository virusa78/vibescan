export type BillingPlanTier = 'free_trial' | 'starter' | 'pro' | 'enterprise';
export type BillingLifecycleState =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'unpaid'
  | 'none';

export const developerSecurityTitle = 'Developer security control plane';
export const developerSecuritySubtitle =
  'One shell for scans, findings, billing, and internal operations.';

export const scanLifecycleLabels = {
  pending: 'Queued',
  scanning: 'Running',
  done: 'Done',
  error: 'Failed',
  cancelled: 'Cancelled',
} as const;

export const scannerResultLabels = {
  completed: 'Done',
  failed: 'Failed',
  missing: 'Not run',
  planned: 'Queued',
} as const;

export const scannerAvailabilityLabels = {
  available: 'Available',
  cooling_down: 'Cooling down',
  unavailable: 'Unavailable',
} as const;

export const scannerHealthLabels = {
  healthy: 'Healthy',
  unhealthy: 'Unhealthy',
  unknown: 'Unknown',
} as const;

export const billingPlanLabels: Record<BillingPlanTier, string> = {
  free_trial: 'Free trial',
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

export const billingPlanSummaries: Record<BillingPlanTier, string> = {
  free_trial: 'Validate the workflow with a small scan allotment and core reporting.',
  starter: 'Keep a steady scan cadence with the primary control-plane features.',
  pro: 'Expand coverage with richer reporting, history, and workflow depth.',
  enterprise: 'Coordinate larger teams, higher limits, and the full control plane.',
};

export const billingStateLabels: Record<BillingLifecycleState, string> = {
  active: 'Active',
  trialing: 'Trialing',
  past_due: 'Past due',
  canceled: 'Canceled',
  incomplete: 'Needs attention',
  unpaid: 'Unpaid',
  none: 'Not linked',
};

export const scanInputTypeLabels = {
  github: 'GitHub repository',
  sbom: 'SBOM file',
  source_zip: 'Source archive',
} as const;

export const adminRoleLabels = {
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
} as const;

export const actionVerbLabels = {
  submitScan: 'Submit scan',
  manageBilling: 'Manage billing',
  browsePlans: 'Browse plans',
  openAdminConsole: 'Open admin console',
  reviewFindings: 'Review findings',
  triageFinding: 'Triage finding',
} as const;

export function getBillingPlanLabel(plan: BillingPlanTier | null | undefined): string {
  return plan ? billingPlanLabels[plan] : billingPlanLabels.free_trial;
}

export function getBillingPlanSummary(plan: BillingPlanTier | null | undefined): string {
  return plan ? billingPlanSummaries[plan] : billingPlanSummaries.free_trial;
}

export function getBillingStateLabel(state: BillingLifecycleState | string | null | undefined): string {
  if (!state) {
    return billingStateLabels.none;
  }

  const normalized = state.toLowerCase() as BillingLifecycleState;
  return billingStateLabels[normalized] ?? state;
}

export function getAdminRoleLabel(role: keyof typeof adminRoleLabels | null | undefined): string {
  return role ? adminRoleLabels[role] : adminRoleLabels.viewer;
}
