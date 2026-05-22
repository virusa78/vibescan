import { HttpError } from 'wasp/server';
import { prisma } from 'wasp/server';
import * as crypto from 'crypto';
import * as z from 'zod';
import { ensureArgsSchemaOrThrowHttpError } from '../../validation.js';
import { requireWorkspaceScopedUser } from '../../services/workspaceAccess';
import { validateWebhookTargetUrl } from '../../../shared/webhookTarget';
import { isProductionEnvironment } from '../../config/env.js';
import { encryptWebhookSecret } from '../../utils/webhookEncryption.js';
import { canonicalEventRegistry, isCanonicalEventType } from '../../../shared/events.js';
const destinationTypeSchema = z.enum(['zoho_crm', 'generic_webhook', 'observability_sink']);
const eventCategorySchema = z.enum([
    'scanner_comparison',
    'customer',
    'billing',
    'quota',
    'scan',
    'report',
    'remediation',
    'vulnerability',
    'integration',
    'system',
]);
const createEventSubscriptionInputSchema = z.object({
    name: z.string().min(1).max(120),
    destination_type: destinationTypeSchema,
    event_types: z.array(z.string().min(1)).min(1),
    categories: z.array(eventCategorySchema).min(1),
    destination_config: z.record(z.string(), z.unknown()),
    enabled: z.boolean().optional(),
    signing_secret: z.string().min(8).optional(),
});
const CANONICAL_EVENT_CATEGORY_MAP = new Map(canonicalEventRegistry.map((entry) => [entry.type, entry.category]));
const CANONICAL_TO_LEGACY_WEBHOOK_EVENT_MAP = {
    'scan.completed': 'scan_complete',
    'scan.failed': 'scan_failed',
    'report.generated': 'report_ready',
};
async function validateDestinationConfig(destinationType, destinationConfig) {
    if (destinationType === 'zoho_crm') {
        const accountRef = destinationConfig.accountRef;
        if (typeof accountRef !== 'string' || accountRef.trim().length === 0) {
            throw new HttpError(400, 'Zoho destination requires accountRef');
        }
        const url = destinationConfig.url;
        if (typeof url !== 'string' || url.trim().length === 0) {
            throw new HttpError(400, 'Zoho destination requires url');
        }
        await validateWebhookTargetUrl(url, {
            allowLocalHttp: !isProductionEnvironment(),
            allowHttp: !isProductionEnvironment(),
        });
        return destinationConfig;
    }
    const url = destinationConfig.url;
    if (typeof url !== 'string' || url.trim().length === 0) {
        throw new HttpError(400, 'Destination requires url');
    }
    await validateWebhookTargetUrl(url, {
        allowLocalHttp: !isProductionEnvironment(),
        allowHttp: !isProductionEnvironment(),
    });
    return destinationConfig;
}
async function assertNoLegacyWebhookOwnershipConflict(args) {
    if (args.destinationType !== 'generic_webhook') {
        return;
    }
    const url = args.destinationConfig.url;
    if (typeof url !== 'string') {
        return;
    }
    const overlappingLegacyEvents = args.eventTypes
        .map((eventType) => CANONICAL_TO_LEGACY_WEBHOOK_EVENT_MAP[eventType] ?? null)
        .filter((value) => Boolean(value));
    if (overlappingLegacyEvents.length === 0) {
        return;
    }
    const conflictingLegacyWebhook = await prisma.webhook.findFirst({
        where: {
            url,
            enabled: true,
            events: {
                hasSome: overlappingLegacyEvents,
            },
            OR: [
                { workspaceId: args.workspaceId },
                { workspaceId: null, userId: args.userId },
            ],
        },
        select: {
            id: true,
            events: true,
        },
    });
    if (conflictingLegacyWebhook) {
        throw new HttpError(409, 'This destination is already owned by the legacy webhook subsystem for overlapping events. Migrate or disable the legacy webhook first.');
    }
}
function validateCanonicalEventSelections(eventTypes, categories) {
    for (const eventType of eventTypes) {
        if (!isCanonicalEventType(eventType)) {
            throw new HttpError(400, `Unsupported canonical event type: ${eventType}`);
        }
        const actualCategory = CANONICAL_EVENT_CATEGORY_MAP.get(eventType);
        if (!actualCategory) {
            throw new HttpError(400, `No category mapping found for event type: ${eventType}`);
        }
        if (!categories.includes(actualCategory)) {
            throw new HttpError(400, `Event type ${eventType} belongs to category ${actualCategory}, but that category is not included in the subscription`);
        }
    }
}
export async function createEventSubscription(rawArgs, context) {
    const user = await requireWorkspaceScopedUser(context.user);
    const args = ensureArgsSchemaOrThrowHttpError(createEventSubscriptionInputSchema, rawArgs);
    validateCanonicalEventSelections(args.event_types, args.categories);
    const destinationConfig = await validateDestinationConfig(args.destination_type, args.destination_config);
    await assertNoLegacyWebhookOwnershipConflict({
        userId: user.id,
        workspaceId: user.workspaceId,
        destinationType: args.destination_type,
        destinationConfig,
        eventTypes: args.event_types,
    });
    const signingSecret = args.signing_secret ?? crypto.randomBytes(32).toString('hex');
    const signingSecretEncrypted = args.destination_type === 'zoho_crm'
        ? null
        : encryptWebhookSecret(signingSecret);
    const subscription = await context.entities.EventSubscription.create({
        data: {
            name: args.name,
            destinationType: args.destination_type,
            workspaceId: user.workspaceId,
            userId: user.id,
            destinationConfig,
            eventTypes: args.event_types,
            categories: args.categories,
            filters: {},
            enabled: args.enabled ?? true,
            signingSecretEncrypted,
        },
    });
    return {
        id: subscription.id,
        name: subscription.name,
        destination_type: subscription.destinationType,
        event_types: subscription.eventTypes,
        categories: subscription.categories,
        enabled: subscription.enabled,
        signing_secret: signingSecretEncrypted ? signingSecret : null,
        secret_preview: signingSecretEncrypted
            ? `${signingSecret.substring(0, 8)}...${signingSecret.substring(signingSecret.length - 8)}`
            : null,
    };
}
//# sourceMappingURL=createSubscription.js.map