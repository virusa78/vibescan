import type { FastifyReply, FastifyRequest } from 'fastify';
import { securityScoreService } from '../services/securityScoreService.js';

function extractUserId(request: any): string | null {
    return request.apiKey?.user_id || request.user?.userId || null;
}

export async function getSecurityScoreSnapshotHandler(request: FastifyRequest, reply: FastifyReply) {
    try {
        const userId = extractUserId(request);
        if (!userId) {
            return reply.code(401).send({ error: 'unauthorized', message: 'Authentication required' });
        }
        const { scanId } = request.params as { scanId: string };
        const snapshot = await securityScoreService.getSnapshot(scanId, userId);
        return reply.code(200).send({ success: true, data: snapshot });
    } catch (error: any) {
        if (error.code === 'not_found') {
            return reply.code(404).send({ error: 'not_found', message: error.message });
        }
        return reply.code(500).send({ error: 'internal_error', message: error.message || 'Failed to load security score snapshot' });
    }
}

export async function getSecurityScoreTrendHandler(request: FastifyRequest, reply: FastifyReply) {
    try {
        const userId = extractUserId(request);
        if (!userId) {
            return reply.code(401).send({ error: 'unauthorized', message: 'Authentication required' });
        }
        const { limit } = request.query as { limit?: string };
        const trend = await securityScoreService.getTrend(userId, limit ? Number(limit) : 20);
        return reply.code(200).send({ success: true, data: { items: trend } });
    } catch (error: any) {
        return reply.code(500).send({ error: 'internal_error', message: error.message || 'Failed to load security score trend' });
    }
}

export async function getSlaSummaryHandler(request: FastifyRequest, reply: FastifyReply) {
    try {
        const userId = extractUserId(request);
        if (!userId) {
            return reply.code(401).send({ error: 'unauthorized', message: 'Authentication required' });
        }
        const { scanId } = request.params as { scanId: string };
        const summary = await securityScoreService.getSlaSummary(scanId, userId);
        return reply.code(200).send({ success: true, data: summary });
    } catch (error: any) {
        if (error.code === 'not_found') {
            return reply.code(404).send({ error: 'not_found', message: error.message });
        }
        return reply.code(500).send({ error: 'internal_error', message: error.message || 'Failed to load SLA summary' });
    }
}

export async function listRiskAcceptancesHandler(request: FastifyRequest, reply: FastifyReply) {
    try {
        const userId = extractUserId(request);
        if (!userId) {
            return reply.code(401).send({ error: 'unauthorized', message: 'Authentication required' });
        }
        const { scanId } = request.params as { scanId: string };
        const items = await securityScoreService.listRiskAcceptances(scanId, userId);
        return reply.code(200).send({ success: true, data: { items } });
    } catch (error: any) {
        if (error.code === 'not_found') {
            return reply.code(404).send({ error: 'not_found', message: error.message });
        }
        return reply.code(500).send({ error: 'internal_error', message: error.message || 'Failed to list risk acceptances' });
    }
}

export async function acceptRiskHandler(request: FastifyRequest, reply: FastifyReply) {
    try {
        const userId = extractUserId(request);
        if (!userId) {
            return reply.code(401).send({ error: 'unauthorized', message: 'Authentication required' });
        }
        const { scanId } = request.params as { scanId: string };
        const { vulnerabilityId, reason, expiresAt } = request.body as {
            vulnerabilityId: string;
            reason?: string;
            expiresAt?: string;
        };

        if (!vulnerabilityId) {
            return reply.code(400).send({ error: 'validation_error', message: 'vulnerabilityId is required' });
        }

        const item = await securityScoreService.acceptRisk(scanId, userId, vulnerabilityId, reason, expiresAt);
        return reply.code(200).send({ success: true, data: item });
    } catch (error: any) {
        if (error.code === 'not_found') {
            return reply.code(404).send({ error: 'not_found', message: error.message });
        }
        return reply.code(500).send({ error: 'internal_error', message: error.message || 'Failed to accept risk' });
    }
}

export async function revokeRiskHandler(request: FastifyRequest, reply: FastifyReply) {
    try {
        const userId = extractUserId(request);
        if (!userId) {
            return reply.code(401).send({ error: 'unauthorized', message: 'Authentication required' });
        }
        const { scanId, vulnerabilityId } = request.params as { scanId: string; vulnerabilityId: string };
        await securityScoreService.revokeRisk(scanId, userId, vulnerabilityId);
        return reply.code(204).send();
    } catch (error: any) {
        if (error.code === 'not_found') {
            return reply.code(404).send({ error: 'not_found', message: error.message });
        }
        return reply.code(500).send({ error: 'internal_error', message: error.message || 'Failed to revoke risk acceptance' });
    }
}

export default {
    getSecurityScoreSnapshotHandler,
    getSecurityScoreTrendHandler,
    getSlaSummaryHandler,
    listRiskAcceptancesHandler,
    acceptRiskHandler,
    revokeRiskHandler,
};
