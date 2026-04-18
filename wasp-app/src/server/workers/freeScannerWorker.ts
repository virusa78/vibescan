/**
 * Free Scanner Worker - Runs Grype vulnerability scanner
 * Handles source_zip and sbom_upload input types
 */

import { Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { normalizeGrypeFindings } from '../operations/scans/normalizeFindings';
import type { ScanJob } from '../queues/jobContract';

const prisma = new PrismaClient();

export async function freeScannerWorker(job: Job<ScanJob>) {
  const { scanId, userId, inputType, inputRef, s3Bucket } = job.data;

  try {
    console.log(`[Free Scanner] Starting scan ${scanId} for user ${userId}`);

    // Update scan status to scanning
    await prisma.scan.update({
      where: { id: scanId },
      data: { status: 'scanning' },
    });

    // Execute Grype scan
    // TODO: Implement actual Grype execution
    // For now, return mock data
    const mockGrypeOutput = {
      matches: [
        {
          vulnerability: {
            id: 'CVE-2024-1234',
            severity: 'high',
            cvssScore: { baseScore: 7.5 },
            description: 'Test vulnerability',
            fix: { versions: ['1.0.1'] },
          },
          artifact: {
            name: 'lodash',
            version: '1.0.0',
          },
          matchDetails: [{ found: 'test' }],
        },
      ],
    };

    console.log(`[Free Scanner] Grype execution completed for scan ${scanId}`);

    // Normalize findings
    const normalizedFindings = normalizeGrypeFindings(mockGrypeOutput);

    // Store raw output in ScanResult
    const scanResult = await prisma.scanResult.upsert({
      where: {
        scanId_source: {
          scanId,
          source: 'free',
        },
      },
      create: {
        scanId,
        source: 'free',
        rawOutput: mockGrypeOutput as any,
        vulnerabilities: normalizedFindings as any,
        scannerVersion: 'grype-0.70.0', // TODO: Get actual version
        cveDbTimestamp: new Date(),
        durationMs: 0, // TODO: Calculate actual duration
      },
      update: {
        rawOutput: mockGrypeOutput as any,
        vulnerabilities: normalizedFindings as any,
        cveDbTimestamp: new Date(),
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
          source: 'free',
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

    console.log(`[Free Scanner] Created ${normalizedFindings.length} findings for scan ${scanId}`);

    // Update scan with completion timestamp (unless already done by enterprise worker)
    const currentScan = await prisma.scan.findUnique({
      where: { id: scanId },
      include: { scanResults: true },
    });

    if (currentScan && currentScan.status === 'scanning') {
      // Check if enterprise worker has also completed
      const enterpriseResult = currentScan.scanResults.some((r) => r.source === 'enterprise');
      if (enterpriseResult) {
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
    console.error(`[Free Scanner] Error in scan ${scanId}:`, error);

    // Mark scan as error (allow partial-complete if enterprise succeeded)
    const existingScan = await prisma.scan.findUnique({
      where: { id: scanId },
      include: { scanResults: true },
    });

    if (existingScan && existingScan.status === 'scanning') {
      const enterpriseResult = existingScan.scanResults.some((r) => r.source === 'enterprise');
      if (enterpriseResult) {
        // Enterprise completed, mark as partial
        await prisma.scan.update({
          where: { id: scanId },
          data: {
            status: 'done', // Partial completion
            completedAt: new Date(),
            errorMessage: `Free scanner failed: ${error instanceof Error ? error.message : String(error)}`,
          },
        });
      } else {
        // Both failed
        await prisma.scan.update({
          where: { id: scanId },
          data: {
            status: 'error',
            errorMessage: `Free scanner failed: ${error instanceof Error ? error.message : String(error)}`,
          },
        });
      }
    }

    throw error;
  }
}
