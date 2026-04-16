import { describe, expect, it, jest } from '@jest/globals';
import { SettingsService } from '../../src/services/settingsService';

describe('SettingsService SQL builders', () => {
    it('updates timezone/language in users table', async () => {
        const service = new SettingsService() as any;
        const query: any = jest.fn();
        query.mockImplementation(async () => ({ rows: [] }));
        service.pool = { query };
        service.logAuditEvent = jest.fn(async () => undefined);
        service.getUserProfile = jest.fn(async () => ({
            id: 'u1',
            email: 'u@example.com',
            region: 'OTHER',
            timezone: 'UTC',
            language: 'en',
            created_at: new Date().toISOString(),
        }));

        await service.updateUserProfile('u1', { timezone: 'UTC', language: 'en' });

        const updateCall = query.mock.calls.find(([sql]: any[]) =>
            String(sql).includes('UPDATE users SET'),
        );
        expect(updateCall).toBeDefined();
        expect(String(updateCall[0])).toContain('timezone = $1');
        expect(String(updateCall[0])).toContain('language = $2');
    });

    it('builds valid regional settings upsert', async () => {
        const service = new SettingsService() as any;
        const query: any = jest.fn();
        query.mockImplementation(async () => ({ rows: [] }));
        service.pool = { query };
        service.logAuditEvent = jest.fn(async () => undefined);
        service.getRegionalSettings = jest.fn(async () => ({
            user_id: 'u1',
            timezone: 'UTC',
            language: 'en',
            currency: 'USD',
            date_format: 'auto',
            number_format: '1,000.00',
        }));

        await service.updateRegionalSettings('u1', {
            timezone: 'UTC',
            language: 'en',
            currency: 'USD',
            date_format: 'auto',
        });

        const upsertCall = query.mock.calls.find(([sql]: any[]) =>
            String(sql).includes('INSERT INTO user_settings'),
        );
        expect(upsertCall).toBeDefined();
        expect(String(upsertCall[0])).toContain('INSERT INTO user_settings (user_id, currency, date_format)');
        expect(String(upsertCall[0])).toContain('currency = EXCLUDED.currency');
        expect(String(upsertCall[0])).toContain('date_format = EXCLUDED.date_format');

        const userUpdateCall = query.mock.calls.find(([sql]: any[]) =>
            String(sql).includes('UPDATE users SET'),
        );
        expect(userUpdateCall).toBeDefined();
        expect(String(userUpdateCall[0])).toContain('timezone = $1');
        expect(String(userUpdateCall[0])).toContain('language = $2');
    });

    it('uses lateral join for latest webhook delivery', async () => {
        const service = new SettingsService() as any;
        const query: any = jest.fn();
        query.mockResolvedValue({
            rows: [{
                id: 'w1',
                user_id: 'u1',
                url: 'https://example.com/hook',
                enabled: true,
                created_at: new Date().toISOString(),
                last_delivery_status: 'success',
            }],
        });
        service.pool = { query };

        const result = await service.listWebhooks('u1');
        expect(result[0].last_delivery_status).toBe('success');

        const sql = String(query.mock.calls[0][0]);
        expect(sql).toContain('LEFT JOIN LATERAL');
        expect(sql).toContain('ORDER BY created_at DESC');
        expect(sql).toContain('LIMIT 1');
    });

    it('preserves unspecified notification fields on partial update', async () => {
        const service = new SettingsService() as any;
        const query: any = jest.fn();
        query
            .mockResolvedValueOnce({
                rows: [{
                    user_id: 'u1',
                    email_enabled: true,
                    webhook_enabled: true,
                    slack_enabled: false,
                    preferred_delivery_time: '10:00',
                }],
            })
            .mockResolvedValueOnce({
                rows: [{
                    user_id: 'u1',
                    email_enabled: true,
                    webhook_enabled: false,
                    slack_enabled: false,
                    preferred_delivery_time: '10:00',
                }],
            });
        service.pool = { query };
        service.logAuditEvent = jest.fn(async () => undefined);

        const updated = await service.updateNotificationPreferences('u1', { webhook_enabled: false });
        expect(updated.webhook_enabled).toBe(false);
        expect(updated.email_enabled).toBe(true);
        expect(updated.preferred_delivery_time).toBe('10:00');

        const upsertCall = query.mock.calls.find(([sql]: any[]) =>
            String(sql).includes('INSERT INTO notification_preferences'),
        );
        expect(upsertCall).toBeDefined();
        expect(upsertCall[1]).toEqual(['u1', true, false, false, '10:00']);
    });
});
