/**
 * Enterprise Scanner Worker - Calls Codescoring/BlackDuck API
 * Handles premium vulnerability scanning for enterprise plans
 */

import { Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { normalizeCodescoringFindings } from '../operations/scans/normalizeFindings';
import { scanWithCodescoring } from '../lib/scanners/codescoringApiClient';
import type { ScanJob } from '../queues/jobContract';
import type { NormalizedComponent } from '../services/inputAdapterService';

const prisma = new PrismaClient();

export async function enterpriseScannerWorker(job: Job<ScanJob>) {
  const { scanId, userId, inputType, inputRef, s3Bucket } = job.data;

  try {
    console.log(`[Enterprise Scanner] Starting scan ${scanId} for user ${userId}`);

    // Update scan status to scanning
    await prisma.scan.update({
      where: { id: scanId },
      data: { status: 'scanning' },
    });

    // Fetch scan from database to get components
    const scan = await prisma.scan.findUnique({
      where: { id: scanId },
    });

    if (!scan) {
      throw new Error(`Scan ${scanId} not found`);
    }

    // Get components from scan record (stored as JSON, so parse/cast safely)
    const components = Array.isArray(scan.components) 
      ? (scan.components as unknown as NormalizedComponent[])
      : ([] as NormalizedComponent[]);

    if (components.length === 0) {
      console.log(`[Enterprise Scanner] No components to scan for ${scanId}`);
    }

    // Call Codescoring/BlackDuck API
    const startTime = Date.now();
    let codescoringFindings: any[] = [];

    if (components.length > 0) {
      codescoringFindings = await scanWithCodescoring(components, scanId);
    }

    const durationMs = Date.now() - startTime;

    console.log(`[Enterprise Scanner] Codescoring API call completed for scan ${scanId} in ${durationMs}ms`);

    // Convert to Codescoring format for normalization
    const codescoringOutput = {
      components: components.map(comp => ({
        name: comp.name,
        version: comp.version,
        vulnerabilities: codescoringFindings
          .filter(f => f.package === comp.name && f.version === comp.version)
          .map(f => ({
            cveId: f.cveId,
            severity: f.severity,
            cvssScore: f.cvssScore,
            description: f.description,
            fixedVersion: f.fixedVersion,
          })),
      })),
    };

    // Normalize findings
    const normalizedFindings = normalizeCodescoringFindings(codescoringOutput);

    // Store raw output in ScanResult
    const scanResult = await prisma.scanResult.upsert({
      where: {
        scanId_source: {
          scanId,
          source: 'enterprise',
        },
      },
      create: {
        scanId,
        source: 'enterprise',
        rawOutput: codescoringOutput as any,
        vulnerabilities: normalizedFindings as any,
        scannerVersion: 'codescoring-1.0',
        cveDbTimestamp: new Date(),
        durationMs,
      },
      update: {
        rawOutput: codescoringOutput as any,
        vulnerabilities: normalizedFindings as any,
        cveDbTimestamp: new Date(),
        durationMs,
      },
    });

    // Create Finding records
    for (const finding of normalizedFindings) {
      const fingerprint = `${finding.cveId}|${finding.package}|${finding.version}`;

      await prisma.finding.upsert({
        where: {
          scanId_fingerprint: {
            scanId,
            fingerprint,
          },
        },
        create: {
          scanId,
          userId,
          fingerprint,
          cveId: finding.cveId,
          packageName: finding.package,
          installedVersion: finding.version,
          severity: finding.severity.toUpperCase(),
          cvssScore: finding.cvssScore,
          fixedVersion: finding.fixedVersion,
          description: finding.description,
          source: 'enterprise',
          detectedData: finding as any,
        },
        update: {
          severity: finding.severity.toUpperCase(),
          cvssScore: finding.cvssScore,
          fixedVersion: finding.fixedVersion,
          description: finding.description,
        },
      });
    }

    console.log(`[Enterprise Scanner] Created ${normalizedFindings.length} findings for scan ${scanId}`);

    // Update scan with completion timestamp (unless already done by free worker)
    const currentScan = await prisma.scan.findUnique({
      where: { id: scanId },
      include: { scanResults: true },
    });

    if (currentScan && currentScan.status === 'scanning') {
      // Check if free worker has also completed
      const freeResult = currentScan.scanResults.some((r) => r.source === 'free');
      if (freeResult) {
        // Both completed, mark as done
        await prisma.scan.update({
          where: { id: scanId },
          data: {
            status: 'done',
            completedAt: new Date(),
          },
        });
      }
    }

    return {
      status: 'completed',
      findingsCount: normalizedFindings.length,
      scanResultId: scanResult.id,
    };
  } catch (error) {
    console.error(`[Enterprise Scanner] Error in scan ${scanId}:`, error);

    // Mark scan as error (allow partial-complete if free succeeded)
    const existingScan = await prisma.scan.findUnique({
      where: { id: scanId },
      include: { scanResults: true },
    });

    if (existingScan && existingScan.status === 'scanning') {
      const freeResult = existingScan.scanResults.some((r) => r.source === 'free');
      if (freeResult) {
        // Free completed, mark as partial
        await prisma.scan.update({
          where: { id: scanId },
          data: {
            status: 'done', // Partial completion
            completedAt: new Date(),
            errorMessage: `Enterprise scanner failed: ${error instanceof Error ? error.message : String(error)}`,
          },
        });
      } else {
        // Both failed
        await prisma.scan.update({
          where: { id: scanId },
          data: {
            status: 'error',
            errorMessage: `Enterprise scanner failed: ${error instanceof Error ? error.message : String(error)}`,
          },
        });
      }
    }

    throw error;
  }
}
