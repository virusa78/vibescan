import { githubIntegrationService } from '../services/githubIntegrationService.js';

export async function githubWebhookHandler(request: any, reply: any): Promise<void> {
    const signature = request.headers['x-hub-signature-256'] as string | undefined;
    const eventType = String(request.headers['x-github-event'] || '');
    const deliveryId = request.headers['x-github-delivery'] as string | undefined;
    const rawBody = request.rawBody
        ? Buffer.from(request.rawBody)
        : Buffer.from(JSON.stringify(request.body || {}));

    const signatureCheck = githubIntegrationService.verifyWebhookSignature(rawBody, signature);
    if (!signatureCheck.valid) {
        reply.code(401).send({
            success: false,
            error: signatureCheck.reason || 'invalid_signature',
        });
        return;
    }

    let payload: any = request.body;
    if (!payload && rawBody.length > 0) {
        try {
            payload = JSON.parse(rawBody.toString('utf8'));
        } catch {
            reply.code(400).send({
                success: false,
                error: 'invalid_payload',
                message: 'Invalid JSON payload',
            });
            return;
        }
    }

    const result = await githubIntegrationService.handleWebhookEvent(eventType, payload || {}, deliveryId);
    reply.code(202).send({
        success: true,
        data: result,
    });
}
