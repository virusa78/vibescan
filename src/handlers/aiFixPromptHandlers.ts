import type { FastifyReply, FastifyRequest } from 'fastify';
import { aiFixPromptService } from '../services/aiFixPromptService.js';

function extractUserId(request: any): string | null {
    return request.apiKey?.user_id || request.user?.userId || null;
}

export async function generateAiFixPromptHandler(request: FastifyRequest, reply: FastifyReply) {
    try {
        const userId = extractUserId(request);
        if (!userId) {
            return reply.code(401).send({ error: 'unauthorized', message: 'Authentication required' });
        }

        const { scanId } = request.params as { scanId: string };
        const { cveId, packageName, installedVersion, modelName } = request.body as {
            cveId?: string;
            packageName: string;
            installedVersion: string;
            modelName?: string;
        };

        const result = await aiFixPromptService.generatePrompt({
            scanId,
            userId,
            cveId,
            packageName,
            installedVersion,
            modelName,
        });

        return reply.code(200).send({ success: true, data: result });
    } catch (error: any) {
        if (error.code === 'not_found') {
            return reply.code(404).send({ error: 'not_found', message: error.message });
        }
        if (error.code === 'validation_error') {
            return reply.code(400).send({ error: 'validation_error', message: error.message });
        }
        return reply.code(500).send({ error: 'internal_error', message: error.message || 'Failed to generate AI fix prompt' });
    }
}

export async function listAiFixPromptsHandler(request: FastifyRequest, reply: FastifyReply) {
    try {
        const userId = extractUserId(request);
        if (!userId) {
            return reply.code(401).send({ error: 'unauthorized', message: 'Authentication required' });
        }
        const { scanId } = request.params as { scanId: string };
        const prompts = await aiFixPromptService.listScanPrompts(scanId, userId);
        return reply.code(200).send({ success: true, data: { items: prompts } });
    } catch (error: any) {
        if (error.code === 'not_found') {
            return reply.code(404).send({ error: 'not_found', message: error.message });
        }
        return reply.code(500).send({ error: 'internal_error', message: error.message || 'Failed to list AI fix prompts' });
    }
}

export default {
    generateAiFixPromptHandler,
    listAiFixPromptsHandler,
};
