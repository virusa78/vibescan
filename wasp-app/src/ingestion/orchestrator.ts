/**
 * PR-07: Ingestion Pipeline Orchestrator
 * 
 * Coordinates the full ingestion flow:
 * Adapters → Parser → Validator → Unifier → Normalized Findings
 * 
 * This is the main entry point for processing scanner output.
 */

import type { UnifiedScanPayload } from "./cyclonedx-contracts";
import type { AdapterMetadata } from "./adapters";
import { AdapterRegistry } from "./adapters";
import { parseCycloneDXDocument, type ParserResult } from "./parser";
import { validateCycloneDXDocument } from "./validator";
import { unifyCycloneDXDocument } from "./unifier";

export interface IngestionContext {
  scanId: string;
  userId: string;
  scannerName: string;
  scannerVersion?: string;
  timestamp: string;
}

export interface IngestionResult {
  success: boolean;
  payload?: UnifiedScanPayload;
  error?: {
    stage: "adapter" | "parser" | "validator" | "unifier";
    message: string;
    details?: Record<string, any>;
  };
}

/**
 * Main ingestion pipeline orchestrator
 * 
 * Flow:
 * 1. Adapter: Convert scanner-specific format to CycloneDX
 * 2. Parser: Safe JSON parsing & normalization
 * 3. Validator: Schema validation & runtime invariants (future)
 * 4. Unifier: Transform to UnifiedScanPayload (future)
 * 
 * Returns normalized findings ready for database storage.
 */
export async function ingestScanOutput(
  rawOutput: string | Record<string, any>,
  scannerName: string,
  context: IngestionContext
): Promise<IngestionResult> {
  try {
    // ========================================================================
    // STAGE 1: ADAPTER - Convert scanner output to CycloneDX
    // ========================================================================
    const adapterRegistry = new AdapterRegistry();
    const adapterMetadata: AdapterMetadata = {
      scannerVersion: context.scannerVersion,
      timestamp: context.timestamp,
    };

    const adapterResult = adapterRegistry.adapt(scannerName, rawOutput, adapterMetadata);
    if (adapterResult.success === false) {
      return {
        success: false,
        error: {
          stage: "adapter",
          message: `Failed to adapt scanner output: ${adapterResult.error}`,
          details: { scannerName },
        },
      };
    }

    const rawCycloneDX = adapterResult.document;

    // ========================================================================
    // STAGE 2: PARSER - Safe JSON parsing & normalization
    // ========================================================================
    const parserResult = parseCycloneDXDocument(rawCycloneDX, {
      name: scannerName,
      version: context.scannerVersion,
      timestamp: context.timestamp,
    });
    if (parserResult.success === false) {
      return {
        success: false,
        error: {
          stage: "parser",
          message: `Failed to parse CycloneDX document: ${parserResult.error.message}`,
          details: {
            code: parserResult.error.code,
            context: parserResult.error.context,
          },
        },
      };
    }

    const parsedDocument = parserResult.data;

    // ========================================================================
    // STAGE 3: VALIDATOR - Schema validation & invariants
    // ========================================================================
    const validatorResult = validateCycloneDXDocument(parsedDocument, {
      name: scannerName,
      timestamp: context.timestamp,
    });

    if (validatorResult.success === false) {
      return {
        success: false,
        error: {
          stage: "validator",
          message: `Failed to validate CycloneDX document: ${validatorResult.error.message}`,
          details: {
            code: validatorResult.error.code,
            context: validatorResult.error.context,
          },
        },
      };
    }

    const validatedDocument = validatorResult.data;

    // ========================================================================
    // STAGE 4: UNIFIER - Transform to platform DTO
    // ========================================================================
    const unifierResult = unifyCycloneDXDocument(validatedDocument, {
      scanId: context.scanId,
      userId: context.userId,
      scannerId: scannerName,
      timestamp: context.timestamp,
    });

    if (unifierResult.success === false) {
      return {
        success: false,
        error: {
          stage: "unifier",
          message: `Failed to unify CycloneDX document: ${unifierResult.error.message}`,
          details: {
            code: unifierResult.error.code,
            context: unifierResult.error.context,
          },
        },
      };
    }

    const payload = unifierResult.data;
    // ========================================================================
    return {
      success: true,
      payload,
    };
  } catch (err) {
    return {
      success: false,
      error: {
        stage: "adapter",
        message: `Unexpected error during ingestion: ${err instanceof Error ? err.message : String(err)}`,
        details: { error: String(err) },
      },
    };
  }
}

/**
 * Convenience function to ingest from raw JSON string
 */
export async function ingestFromJSON(
  jsonString: string,
  scannerName: string,
  context: IngestionContext
): Promise<IngestionResult> {
  try {
    const rawOutput = JSON.parse(jsonString);
    return ingestScanOutput(rawOutput, scannerName, context);
  } catch (err) {
    return {
      success: false,
      error: {
        stage: "adapter",
        message: `Failed to parse input JSON: ${err instanceof Error ? err.message : String(err)}`,
      },
    };
  }
}

/**
 * Get status of ingestion pipeline
 */
export function getPipelineStatus(): {
  stages: string[];
  version: string;
  supportedScanners: string[];
} {
  const registry = new AdapterRegistry();
  return {
    stages: ["adapter", "parser", "validator", "unifier"],
    version: "1.0.0",
    supportedScanners: registry.listScanners(),
  };
}
