import { describe, expect, it } from '@jest/globals';
import {
  actionVerbLabels,
  getAdminRoleLabel,
  getBillingPlanLabel,
  getBillingPlanSummary,
  getBillingStateLabel,
  scanInputTypeLabels,
} from '../../wasp-app/src/client/utils/productVocabulary';

describe('productVocabulary', () => {
  it('keeps billing plan labels in product language', () => {
    expect(getBillingPlanLabel('free_trial')).toBe('Free trial');
    expect(getBillingPlanLabel('starter')).toBe('Starter');
    expect(getBillingPlanLabel('pro')).toBe('Pro');
    expect(getBillingPlanLabel('enterprise')).toBe('Enterprise');
    expect(getBillingPlanLabel(null)).toBe('Free trial');
    expect(getBillingPlanSummary('enterprise')).toContain('Coordinate larger teams');
    expect(getBillingPlanSummary(undefined)).toBe(
      'Validate the workflow with a small scan allotment and core reporting.',
    );
  });

  it('keeps billing lifecycle labels readable', () => {
    expect(getBillingStateLabel('active')).toBe('Active');
    expect(getBillingStateLabel('past_due')).toBe('Past due');
    expect(getBillingStateLabel('canceled')).toBe('Canceled');
    expect(getBillingStateLabel(null)).toBe('Not linked');
    expect(getBillingStateLabel('custom_state')).toBe('custom_state');
  });

  it('labels admin roles and core action verbs', () => {
    expect(getAdminRoleLabel('admin')).toBe('Admin');
    expect(getAdminRoleLabel('viewer')).toBe('Viewer');
    expect(getAdminRoleLabel(null)).toBe('Viewer');
    expect(getAdminRoleLabel(undefined)).toBe('Viewer');
    expect(actionVerbLabels.manageBilling).toBe('Manage billing');
    expect(actionVerbLabels.openAdminConsole).toBe('Open admin console');
  });

  it('labels scan input types with product language', () => {
    expect(scanInputTypeLabels.github).toBe('GitHub repository');
    expect(scanInputTypeLabels.sbom).toBe('SBOM file');
    expect(scanInputTypeLabels.source_zip).toBe('Source archive');
  });
});
