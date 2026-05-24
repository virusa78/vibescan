import { getFrontendBaseUrl, getBackendBaseUrl } from '../../config/runtime';
import {
  getGitHubAppId,
  getGitHubAppSlug,
  getMissingGitHubAppEnvVars,
  isGitHubAppConfigured,
} from '../../services/githubAppEnv';

export type GithubAppSetupResponse = {
  configured: boolean;
  app_id: string | null;
  app_slug: string | null;
  install_url: string | null;
  callback_url: string | null;
  webhook_url: string | null;
  manual_linking_required: boolean;
  missing_fields: string[];
  setup_message: string;
};

export async function getGithubAppSetup(): Promise<GithubAppSetupResponse> {
  const configured = isGitHubAppConfigured();
  const appId = configured ? getGitHubAppId() : null;
  const appSlug = getGitHubAppSlug() ?? null;
  const callbackUrl = `${getFrontendBaseUrl()}/settings`;
  const webhookUrl = `${getBackendBaseUrl()}/github/webhook`;
  const missingFields = getMissingGitHubAppEnvVars();
  const setupMessage = configured
    ? (appSlug
      ? 'GitHub App is configured and ready to install.'
      : 'GitHub App is configured, but the install link cannot be generated until GITHUB_APP_SLUG is set.')
    : `GitHub App is missing required environment variables: ${missingFields.join(', ')}.`;

  return {
    configured,
    app_id: appId,
    app_slug: appSlug,
    install_url: appSlug ? `https://github.com/apps/${appSlug}/installations/new` : null,
    callback_url: callbackUrl,
    webhook_url: webhookUrl,
    manual_linking_required: true,
    missing_fields: missingFields,
    setup_message: setupMessage,
  };
}
