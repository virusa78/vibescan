/**
 * Free Scanner Worker - Runs Grype vulnerability scanner
 * Handles source_zip and sbom_upload input types
 */

import { Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { normalizeGrypeFindings } from '../operations/scans/normalizeFindings';
import { scanWithGrype, isGrypInstalled } from '../lib/scanners/grypeScannerUtil';
import type { ScanJob } from '../queues/jobContract';
import type { NormalizedComponent } from '../services/inputAdapterService';

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

    // Check if Grype is installed
    if (!isGrypInstalled()) {
      throw new Error('Grype CLI not found - please install Grype');
    }

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
      console.log(`[Free Scanner] No components to scan for ${scanId}`);
    }

    // Execute Grype scan
    const startTime = Date.now();
    let grypFindings: any[] = [];
    
    if (components.length > 0) {
      grypFindings = await scanWithGrype(components, scanId);
    }

    const durationMs = Date.now() - startTime;

    console.log(`[Free Scanner] Grype execution completed for scan ${scanId} in ${durationMs}ms`);

    // Convert to Grype output format for normalization
    const grypOutput = {
      matches: grypFindings.map(f => ({
        vulnerability: {
          id: f.cveId,
          severity: f.severity,
          cvssScore: { baseScore: f.cvssScore },
          description: f.description,
          fix: f.fixedVersion ? { versions: [f.fixedVersion] } : { versions: [] },
        },
        artifact: {
          name: f.package,
          version: f.version,
        },
        matchDetails: [{ found: 'grype' }],
      })),
    };

    // Normalize findings
    const normalizedFindings = normalizeGrypeFindings(grypOutput);

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
        rawOutput: grypOutput as any,
        vulnerabilities: normalizedFindings as any,
        scannerVersion: 'grype-0.111.0', // Get actual version from Grype
        cveDbTimestamp: new Date(),
        durationMs,
      },
      update: {
        rawOutput: grypOutput as any,
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
