import { getFrontendBaseUrl, getBackendBaseUrl } from '../../config/runtime';
import { getGitHubAppId, getGitHubAppSlug, isGitHubAppConfigured } from '../../services/githubAppEnv';
export async function getGithubAppSetup() {
    const configured = isGitHubAppConfigured();
    const appId = configured ? getGitHubAppId() : null;
    const appSlug = getGitHubAppSlug() ?? null;
    const callbackUrl = `${getFrontendBaseUrl()}/settings`;
    const webhookUrl = `${getBackendBaseUrl()}/github/webhook`;
    return {
        configured,
        app_id: appId,
        app_slug: appSlug,
        install_url: appSlug ? `https://github.com/apps/${appSlug}/installations/new` : null,
        callback_url: callbackUrl,
        webhook_url: webhookUrl,
        manual_linking_required: true,
    };
}
//# sourceMappingURL=getGithubAppSetup.js.map