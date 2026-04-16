import type { FastifyReply, FastifyRequest } from 'fastify';
import { cveRemediationService } from '../services/cveRemediationService.js';

function extractUserId(request: any): string | null {
    if (request.user?.userId) return request.user.userId;
    if (request.apiKey?.user_id) return request.apiKey.user_id;
    return null;
}

export async function upsertRemediationItemHandler(request: FastifyRequest, reply: FastifyReply) {
    try {
        const userId = extractUserId(request);
        if (!userId) {
            return reply.code(401).send({ error: 'unauthorized', message: 'Authentication required' });
        }

        const { scanId } = request.params as { scanId: string };
        const { cveId, status, notes } = request.body as { cveId: string; status: any; notes?: string };

        const item = await cveRemediationService.upsertItem(scanId, userId, cveId, status, notes);
        return reply.code(200).send({ success: true, data: item });
    } catch (error: any) {
        if (error.code === 'not_found') {
            return reply.code(404).send({ error: 'not_found', message: error.message });
        }
        if (error.code === 'validation_error') {
            return reply.code(400).send({ error: 'validation_error', message: error.message });
        }
        return reply.code(500).send({ error: 'internal_error', message: error.message || 'Failed to update remediation item' });
    }
}

export async function listRemediationItemsHandler(request: FastifyRequest, reply: FastifyReply) {
    try {
        const userId = extractUserId(request);
        if (!userId) {
            return reply.code(401).send({ error: 'unauthorized', message: 'Authentication required' });
        }

        const { scanId } = request.params as { scanId: string };
        const items = await cveRemediationService.listItems(scanId, userId);
        return reply.code(200).send({ success: true, data: { items } });
    } catch (error: any) {
        if (error.code === 'not_found') {
            return reply.code(404).send({ error: 'not_found', message: error.message });
        }
        return reply.code(500).send({ error: 'internal_error', message: error.message || 'Failed to list remediation items' });
    }
}

export async function getRemediationProgressHandler(request: FastifyRequest, reply: FastifyReply) {
    try {
        const userId = extractUserId(request);
        if (!userId) {
            return reply.code(401).send({ error: 'unauthorized', message: 'Authentication required' });
        }

        const { scanId } = request.params as { scanId: string };
        const progress = await cveRemediationService.getProgress(scanId, userId);
        return reply.code(200).send({ success: true, data: progress });
    } catch (error: any) {
        if (error.code === 'not_found') {
            return reply.code(404).send({ error: 'not_found', message: error.message });
        }
        return reply.code(500).send({ error: 'internal_error', message: error.message || 'Failed to load remediation progress' });
    }
}

export default {
    upsertRemediationItemHandler,
    listRemediationItemsHandler,
    getRemediationProgressHandler,
};
