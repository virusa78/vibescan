import express from 'express'

import auth from 'wasp/core/auth'

import updateIsUserAdminById from './updateIsUserAdminById.js'
import updateUserSettings from './updateUserSettings.js'
import refreshToken from './refreshToken.js'
import generateApiKey from './generateApiKey.js'
import revokeApiKey from './revokeApiKey.js'
import submitScan from './submitScan.js'
import generateCveRemediation from './generateCveRemediation.js'
import createScanSavedView from './createScanSavedView.js'
import updateScanSavedView from './updateScanSavedView.js'
import deleteScanSavedView from './deleteScanSavedView.js'
import bulkCancelScans from './bulkCancelScans.js'
import bulkRerunScans from './bulkRerunScans.js'
import exportScans from './exportScans.js'
import generateReportPDF from './generateReportPDF.js'
import upsertFindingAnnotation from './upsertFindingAnnotation.js'
import createWebhook from './createWebhook.js'
import updateWebhook from './updateWebhook.js'
import deleteWebhook from './deleteWebhook.js'
import testWebhookDelivery from './testWebhookDelivery.js'
import retryWebhookDelivery from './retryWebhookDelivery.js'
import generateCheckoutSession from './generateCheckoutSession.js'
import switchWorkspace from './switchWorkspace.js'
import completeOnboarding from './completeOnboarding.js'
import linkGithubInstallation from './linkGithubInstallation.js'
import updateGithubInstallationSettings from './updateGithubInstallationSettings.js'
import updateProfileSettings from './updateProfileSettings.js'
import updateNotificationSettings from './updateNotificationSettings.js'
import updateScannerAccessSettings from './updateScannerAccessSettings.js'
import getPaginatedUsers from './getPaginatedUsers.js'
import listApiKeys from './listApiKeys.js'
import getAPIKeyDetails from './getAPIKeyDetails.js'
import getScans from './getScans.js'
import getScanById from './getScanById.js'
import getDashboardMetrics from './getDashboardMetrics.js'
import getRecentScans from './getRecentScans.js'
import getSeverityBreakdown from './getSeverityBreakdown.js'
import getTrendSeries from './getTrendSeries.js'
import getQuotaStatus from './getQuotaStatus.js'
import listScanSavedViews from './listScanSavedViews.js'
import getReport from './getReport.js'
import getReportSummary from './getReportSummary.js'
import getCIDecision from './getCIDecision.js'
import listFindingAnnotations from './listFindingAnnotations.js'
import listWebhooks from './listWebhooks.js'
import getWebhook from './getWebhook.js'
import listWebhookDeliveries from './listWebhookDeliveries.js'
import getCustomerPortalUrl from './getCustomerPortalUrl.js'
import getWorkspaceContext from './getWorkspaceContext.js'
import listWorkspaces from './listWorkspaces.js'
import getProfileSettings from './getProfileSettings.js'
import getOnboardingState from './getOnboardingState.js'
import listGithubInstallations from './listGithubInstallations.js'
import getGithubAppSetup from './getGithubAppSetup.js'
import getNotificationSettings from './getNotificationSettings.js'
import getScannerAccessSettings from './getScannerAccessSettings.js'

const router = express.Router()

router.post('/update-is-user-admin-by-id', auth, updateIsUserAdminById)
router.post('/update-user-settings', auth, updateUserSettings)
router.post('/refresh-token', refreshToken)
router.post('/generate-api-key', auth, generateApiKey)
router.post('/revoke-api-key', auth, revokeApiKey)
router.post('/submit-scan', auth, submitScan)
router.post('/generate-cve-remediation', auth, generateCveRemediation)
router.post('/create-scan-saved-view', auth, createScanSavedView)
router.post('/update-scan-saved-view', auth, updateScanSavedView)
router.post('/delete-scan-saved-view', auth, deleteScanSavedView)
router.post('/bulk-cancel-scans', auth, bulkCancelScans)
router.post('/bulk-rerun-scans', auth, bulkRerunScans)
router.post('/export-scans', auth, exportScans)
router.post('/generate-report-pdf', auth, generateReportPDF)
router.post('/upsert-finding-annotation', auth, upsertFindingAnnotation)
router.post('/create-webhook', auth, createWebhook)
router.post('/update-webhook', auth, updateWebhook)
router.post('/delete-webhook', auth, deleteWebhook)
router.post('/test-webhook-delivery', auth, testWebhookDelivery)
router.post('/retry-webhook-delivery', auth, retryWebhookDelivery)
router.post('/generate-checkout-session', auth, generateCheckoutSession)
router.post('/switch-workspace', auth, switchWorkspace)
router.post('/complete-onboarding', auth, completeOnboarding)
router.post('/link-github-installation', auth, linkGithubInstallation)
router.post('/update-github-installation-settings', auth, updateGithubInstallationSettings)
router.post('/update-profile-settings', auth, updateProfileSettings)
router.post('/update-notification-settings', auth, updateNotificationSettings)
router.post('/update-scanner-access-settings', auth, updateScannerAccessSettings)
router.post('/get-paginated-users', auth, getPaginatedUsers)
router.post('/list-api-keys', auth, listApiKeys)
router.post('/get-apikey-details', auth, getAPIKeyDetails)
router.post('/get-scans', auth, getScans)
router.post('/get-scan-by-id', auth, getScanById)
router.post('/get-dashboard-metrics', auth, getDashboardMetrics)
router.post('/get-recent-scans', auth, getRecentScans)
router.post('/get-severity-breakdown', auth, getSeverityBreakdown)
router.post('/get-trend-series', auth, getTrendSeries)
router.post('/get-quota-status', auth, getQuotaStatus)
router.post('/list-scan-saved-views', auth, listScanSavedViews)
router.post('/get-report', auth, getReport)
router.post('/get-report-summary', auth, getReportSummary)
router.post('/get-cidecision', auth, getCIDecision)
router.post('/list-finding-annotations', auth, listFindingAnnotations)
router.post('/list-webhooks', auth, listWebhooks)
router.post('/get-webhook', auth, getWebhook)
router.post('/list-webhook-deliveries', auth, listWebhookDeliveries)
router.post('/get-customer-portal-url', auth, getCustomerPortalUrl)
router.post('/get-workspace-context', auth, getWorkspaceContext)
router.post('/list-workspaces', auth, listWorkspaces)
router.post('/get-profile-settings', auth, getProfileSettings)
router.post('/get-onboarding-state', auth, getOnboardingState)
router.post('/list-github-installations', auth, listGithubInstallations)
router.post('/get-github-app-setup', auth, getGithubAppSetup)
router.post('/get-notification-settings', auth, getNotificationSettings)
router.post('/get-scanner-access-settings', auth, getScannerAccessSettings)

export default router
