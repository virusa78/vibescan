#!/usr/bin/env node
/**
 * Loads simulated scanner outputs into VibeScan DB as a completed scan.
 *
 * Usage:
 * npx tsx scripts/load-simulated-scan.ts \
 *   --user-email arjun.mehta@finstack.io \
 *   --grype /tmp/grype-sim.json \
 *   --blackduck /tmp/blackduck-sim.json \
 *   --input-ref "simulated:/tmp/demo-sbom.json"
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { readFile } from 'node:fs/promises';
import { Client } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { computeDelta } from '../src/services/diffEngine.js';

type Args = {
    userEmail: string;
    grypePath: string;
    blackduckPath: string;
    inputRef: string;
};

function parseArgs(argv: string[]): Args {
    const argMap = new Map<string, string>();
    for (let i = 0; i < argv.length; i += 2) {
        argMap.set(argv[i], argv[i + 1]);
    }

    const userEmail = argMap.get('--user-email');
    const grypePath = argMap.get('--grype');
    const blackduckPath = argMap.get('--blackduck');
    const inputRef = argMap.get('--input-ref') || 'simulated:sbom';

    if (!userEmail || !grypePath || !blackduckPath) {
        console.error(
            'Usage: npx tsx scripts/load-simulated-scan.ts --user-email <email> --grype <path> --blackduck <path> [--input-ref <ref>]'
        );
        process.exit(1);
    }

    return { userEmail, grypePath, blackduckPath, inputRef };
}

function normalizeGrypeVulns(doc: any): any[] {
    const items = Array.isArray(doc.vulnerabilities) ? doc.vulnerabilities : [];
    return items.map((v: any) => ({
        cve_id: v.id || null,
        severity: v.severity || 'LOW',
        package_name: v.package || 'unknown',
        fixed_version: v.fixVersion || null,
        cvss_score: null,
        is_exploitable: false
    }));
}

function normalizeBlackDuckVulns(doc: any): any[] {
    const items = Array.isArray(doc.findings) ? doc.findings : [];
    return items.map((v: any) => ({
        cve_id: v.id || null,
        severity: v.severity || 'LOW',
        package_name: v.package || 'unknown',
        fixed_version: v.fixVersion || null,
        cvss_score: null,
        exploit_maturity: v.exploitMaturity || null,
        is_exploitable: ['functional', 'proof-of-concept'].includes(String(v.exploitMaturity || '').toLowerCase())
    }));
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const grypeDoc = JSON.parse(await readFile(args.grypePath, 'utf-8'));
    const blackduckDoc = JSON.parse(await readFile(args.blackduckPath, 'utf-8'));

    const freeVulns = normalizeGrypeVulns(grypeDoc);
    const enterpriseVulns = normalizeBlackDuckVulns(blackduckDoc);
    const delta = computeDelta(freeVulns, enterpriseVulns);

    const client = new Client({
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME || 'vibescan',
        user: process.env.DB_USER || 'vibescan',
        password: process.env.DB_PASSWORD || 'vibescan'
    });

    await client.connect();

    try {
        await client.query('BEGIN');

        const userRes = await client.query(
            'SELECT id, plan FROM users WHERE email = $1 LIMIT 1',
            [args.userEmail]
        );
        if (userRes.rows.length === 0) {
            throw new Error(`User not found: ${args.userEmail}`);
        }

        const user = userRes.rows[0];
        const scanId = uuidv4();

        await client.query(
            `INSERT INTO scans (id, user_id, input_type, input_ref, sbom_raw, components, status, plan_at_submission, completed_at)
             VALUES ($1, $2, 'sbom_upload', $3, NULL, '[]'::jsonb, 'done', $4, NOW())`,
            [scanId, user.id, args.inputRef, user.plan]
        );

        await client.query(
            `INSERT INTO scan_results (scan_id, source, raw_output, vulnerabilities, scanner_version, cve_db_timestamp, duration_ms)
             VALUES ($1, 'free', $2::jsonb, $3::jsonb, 'grype-sim', NOW(), 4000)`,
            [scanId, JSON.stringify(grypeDoc), JSON.stringify(freeVulns)]
        );

        await client.query(
            `INSERT INTO scan_results (scan_id, source, raw_output, vulnerabilities, scanner_version, cve_db_timestamp, duration_ms)
             VALUES ($1, 'enterprise', $2::jsonb, $3::jsonb, 'blackduck-sim', NOW(), 5000)`,
            [scanId, JSON.stringify(blackduckDoc), JSON.stringify(enterpriseVulns)]
        );

        await client.query(
            `INSERT INTO scan_deltas (scan_id, total_free_count, total_enterprise_count, delta_count, delta_by_severity, delta_vulnerabilities, is_locked)
             VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, FALSE)`,
            [
                scanId,
                delta.totalFreeCount,
                delta.totalEnterpriseCount,
                delta.deltaCount,
                JSON.stringify(delta.deltaBySeverity),
                JSON.stringify(delta.deltaVulnerabilities)
            ]
        );

        await client.query('COMMIT');
        console.log(`Loaded simulated scan into DB. scan_id=${scanId}`);
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        await client.end();
    }
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
});
