import config from '../../config/index.js';
import {
    ProviderRequestPayload,
    RemoteScannerProvider,
    RemoteScannerProviderId,
} from '../../types/remoteScanner.js';

export class GrypeLikeRemoteProvider implements RemoteScannerProvider {
    id: RemoteScannerProviderId = 'grype_like';

    async execute(payload: ProviderRequestPayload): Promise<any> {
        if (!config.REMOTE_SCANNER_API_URL) {
            throw { code: 'remote_scanner_not_configured', message: 'REMOTE_SCANNER_API_URL is required' };
        }

        const controller = new AbortController();
        const timeoutMs = 10000;
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        let response: Response;
        try {
            response = await fetch(`${config.REMOTE_SCANNER_API_URL}/scan`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(config.REMOTE_SCANNER_API_KEY ? { Authorization: `Bearer ${config.REMOTE_SCANNER_API_KEY}` } : {}),
                },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });
        } catch (error: any) {
            if (error?.name === 'AbortError') {
                throw {
                    code: 'remote_scanner_timeout',
                    message: `Remote scanner request timed out after ${timeoutMs}ms`,
                };
            }
            throw error;
        } finally {
            clearTimeout(timeout);
        }

        if (!response.ok) {
            throw {
                code: 'remote_scanner_error',
                message: `Remote scanner request failed with status ${response.status}`,
                status: response.status,
            };
        }

        return response.json();
    }
}

export const grypeLikeRemoteProvider = new GrypeLikeRemoteProvider();

export default grypeLikeRemoteProvider;
