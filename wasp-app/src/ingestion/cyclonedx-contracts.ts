import Ajv from "ajv";

export type CycloneDXSpecVersion = "1.4" | "1.5" | "1.6";
export type IngestionStage = "parsing" | "validation" | "unification" | "ingestion";
export type IngestionStatus = "ingested" | "rejected";
export type IngestionErrorType = "parse_error" | "validation_error" | "unify_error";
export type SeverityLevel = "critical" | "high" | "medium" | "low" | "info";

export interface RawCycloneDXDocument {
  [key: string]: unknown;
}

export interface CycloneDXIssue {
  path: string;
  code: string;
  message: string;
  severity: "error" | "warning";
}

export interface IngestionContext {
  scanId?: string;
  scannerId?: string;
  stage?: IngestionStage;
  source?: string;
  toolVersion?: string;
  ingestedAt?: Date;
  [key: string]: unknown;
}

export interface IngestionError {
  type: IngestionErrorType;
  code: string;
  message: string;
  details?: Record<string, unknown>;
  context?: IngestionContext;
  timestamp: Date;
}

export interface CycloneDxTool {
  vendor?: string;
  name?: string;
  version?: string;
}

export interface CycloneDxLicense {
  id?: string;
  name?: string;
}

export interface CycloneDxComponent {
  bomRef?: string;
  "bom-ref"?: string;
  type?: string;
  name?: string;
  version?: string;
  purl?: string;
  cpe?: string;
  licenses?: Array<{ license?: CycloneDxLicense }>;
  properties?: Array<{ name: string; value: string }>;
  [key: string]: unknown;
}

export interface CycloneDxRating {
  source?: { name?: string; url?: string };
  severity?: string;
  score?: number;
  vector?: string;
  method?: string;
}

export interface CycloneDxCwe {
  id?: string;
  name?: string;
}

export interface CycloneDxFix {
  version?: string;
  state?: string;
  [key: string]: unknown;
}

export interface CycloneDxReference {
  url?: string;
  category?: string;
  [key: string]: unknown;
}

export interface CycloneDxVulnerability {
  ref?: string;
  id?: string;
  source?: { name?: string; url?: string };
  ratings?: CycloneDxRating[];
  cwes?: CycloneDxCwe[];
  fixes?: CycloneDxFix[];
  references?: CycloneDxReference[];
  affects?: Array<{ ref?: string; [key: string]: unknown }>;
  description?: string;
  [key: string]: unknown;
}

export interface ParsedCycloneDxDocument {
  bomFormat: "CycloneDX";
  specVersion: CycloneDXSpecVersion;
  serialNumber?: string;
  version: number;
  metadata?: {
    timestamp?: string;
    tools?: CycloneDxTool[] | { components?: CycloneDxTool[] };
    component?: Record<string, unknown>;
    [key: string]: unknown;
  };
  components: CycloneDxComponent[];
  vulnerabilities: CycloneDxVulnerability[];
  dependencies?: Array<{ ref?: string; dependsOn?: string[]; [key: string]: unknown }>;
  _rawFields?: Record<string, unknown>;
}

export interface ValidationIssue extends CycloneDXIssue {}

export interface ValidationMetadata {
  schemaVersion: CycloneDXSpecVersion | "unknown";
  isValid: boolean;
  issues: ValidationIssue[];
  validatedAt: Date;
}

export interface ValidatedCycloneDxDocument extends ParsedCycloneDxDocument {
  _validation: ValidationMetadata;
}

export interface UnifiedIdentifierSet {
  id?: string;
  ghsa?: string;
  osv?: string;
  aliases?: string[];
}

export interface UnifiedSeverity {
  level: SeverityLevel;
  cvssScore?: number;
  cvssVector?: string;
  cvssVersion?: string;
}

export interface UnifiedReference {
  url: string;
  category?: string;
}

export interface UnifiedComponent {
  bomRef: string;
  type: string;
  name: string;
  version: string;
  purl?: string;
  cpe?: string;
  licenses: CycloneDxLicense[];
  foundBy?: string;
  locations: string[];
  vulnerabilities: UnifiedVulnerability[];
  _rawFields?: Record<string, unknown>;
}

export interface UnifiedVulnerability {
  identifiers: UnifiedIdentifierSet;
  severity: UnifiedSeverity;
  cwes: CycloneDxCwe[];
  fixedVersions: string[];
  references: UnifiedReference[];
  description?: string;
  _sourceDocument?: string;
  _sourceId?: string;
  _rawFields?: Record<string, unknown>;
}

export interface UnifiedScanStats {
  componentCount: number;
  vulnerabilityCount: number;
  severityCounts: Partial<Record<SeverityLevel, number>>;
}

export interface UnifiedScanPayload {
  scanId: string;
  scannerId: string;
  scanTime: Date;
  components: UnifiedComponent[];
  vulnerabilities: UnifiedVulnerability[];
  stats: UnifiedScanStats;
  _originalDocument: ValidatedCycloneDxDocument;
  _unknownFields: Map<string, unknown>;
}

export interface IngestionSuccessResult {
  scanId: string;
  status: "ingested";
  payload: UnifiedScanPayload;
  processingTimeMs: number;
}

export interface IngestionFailureResult {
  scanId: string;
  status: "rejected";
  error: IngestionError;
  stage: IngestionStage;
  processingTimeMs: number;
}

export type IngestionResult = IngestionSuccessResult | IngestionFailureResult;

const SUPPORTED_SPEC_VERSIONS: CycloneDXSpecVersion[] = ["1.4", "1.5", "1.6"];

const CYCLOONEDX_SCHEMA = {
  type: "object",
  required: ["bomFormat", "specVersion", "version"],
  additionalProperties: true,
  properties: {
    bomFormat: { const: "CycloneDX" },
    specVersion: { enum: SUPPORTED_SPEC_VERSIONS },
    serialNumber: { type: "string" },
    version: { type: "integer", minimum: 1 },
    metadata: { type: "object" },
    components: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: true,
        properties: {
          "bom-ref": { type: "string" },
          bomRef: { type: "string" },
          type: { type: "string" },
          name: { type: "string" },
          version: { type: "string" },
          purl: { type: "string" },
          cpe: { type: "string" },
        },
        required: ["name"],
      },
    },
    vulnerabilities: {
      type: "array",
      items: { type: "object", additionalProperties: true },
    },
    dependencies: {
      type: "array",
      items: { type: "object", additionalProperties: true },
    },
  },
} as const;

const AjvCtor = Ajv as unknown as new (options: {
  allErrors: boolean;
  allowUnionTypes: boolean;
  strict: boolean;
}) => {
  compile: (schema: unknown) => {
    (data: unknown): boolean;
    errors?: Array<{ instancePath?: string; schemaPath?: string; message?: string }>;
  };
  errors?: Array<{ instancePath?: string; schemaPath?: string; message?: string }>;
};

const ajv = new AjvCtor({ allErrors: true, allowUnionTypes: true, strict: false });
const validateSchema = ajv.compile(CYCLOONEDX_SCHEMA as any);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cloneUnknownFields(document: Record<string, unknown>): Record<string, unknown> {
  const known = new Set([
    "bomFormat",
    "specVersion",
    "serialNumber",
    "version",
    "metadata",
    "components",
    "vulnerabilities",
    "dependencies",
    "$schema",
  ]);

  const unknown: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(document)) {
    if (!known.has(key)) {
      unknown[key] = value;
    }
  }
  return unknown;
}

function createIngestionError(
  type: IngestionErrorType,
  code: string,
  message: string,
  context?: IngestionContext,
  details?: Record<string, unknown>,
): IngestionError {
  return {
    type,
    code,
    message,
    details,
    context,
    timestamp: new Date(),
  };
}

function parseRawCycloneDXDocument(
  document: string | RawCycloneDXDocument | ParsedCycloneDxDocument,
  context?: IngestionContext,
): RawCycloneDXDocument {
  const parsed: unknown =
    typeof document === "string"
      ? (() => {
          try {
            return JSON.parse(document);
          } catch (error) {
            throw createIngestionError(
              "parse_error",
              "parse_json_failed",
              "Invalid JSON in CycloneDX document",
              { ...context, stage: context?.stage || "parsing" },
              { detail: error instanceof Error ? error.message : String(error) },
            );
          }
        })()
      : document;

  if (!isObject(parsed)) {
    throw createIngestionError(
      "parse_error",
      "invalid_document_root",
      "CycloneDX document must be a JSON object",
      { ...context, stage: context?.stage || "parsing" },
      { expected: "object", actual: typeof parsed },
    );
  }

  return parsed;
}

function normalizeLicense(license: unknown): CycloneDxLicense | undefined {
  if (!isObject(license)) {
    return undefined;
  }

  const id = typeof license.id === "string" ? license.id : undefined;
  const name = typeof license.name === "string" ? license.name : undefined;

  if (!id && !name) {
    return undefined;
  }

  return { id, name };
}

function normalizeComponent(component: unknown): CycloneDxComponent | null {
  if (!isObject(component)) {
    return null;
  }

  const name = typeof component.name === "string" ? component.name.trim() : "";
  if (!name) {
    return null;
  }

  const version = typeof component.version === "string" ? component.version.trim() : undefined;
  const bomRef = typeof component.bomRef === "string"
    ? component.bomRef
    : typeof component["bom-ref"] === "string"
      ? component["bom-ref"]
      : undefined;

  const licenses: Array<{ license?: CycloneDxLicense }> = [];
  if (Array.isArray(component.licenses)) {
    for (const entry of component.licenses) {
      if (!isObject(entry)) {
        continue;
      }

      const license = normalizeLicense(entry.license);
      if (license) {
        licenses.push({ license });
      }
    }
  }

  const properties = Array.isArray(component.properties)
    ? component.properties
        .filter((property): property is { name: string; value: string } =>
          isObject(property) && typeof property.name === "string" && typeof property.value === "string",
        )
    : [];

  return {
    ...component,
    bomRef,
    name,
    version,
    type: typeof component.type === "string" ? component.type : "library",
    purl: typeof component.purl === "string" ? component.purl : undefined,
    cpe: typeof component.cpe === "string" ? component.cpe : undefined,
    licenses,
    properties,
  };
}

function normalizeRatingLevel(rating?: CycloneDxRating): SeverityLevel | undefined {
  const severity = rating?.severity?.toLowerCase();
  if (
    severity === "critical" ||
    severity === "high" ||
    severity === "medium" ||
    severity === "low" ||
    severity === "info"
  ) {
    return severity;
  }

  const score = rating?.score;
  if (typeof score !== "number") {
    return undefined;
  }

  if (score >= 9) return "critical";
  if (score >= 7) return "high";
  if (score >= 4) return "medium";
  if (score > 0) return "low";
  return "info";
}

function normalizeVulnerability(vulnerability: unknown): CycloneDxVulnerability | null {
  if (!isObject(vulnerability)) {
    return null;
  }

  const id = typeof vulnerability.id === "string" ? vulnerability.id : undefined;
  const ref = typeof vulnerability.ref === "string" ? vulnerability.ref : undefined;
  const description = typeof vulnerability.description === "string" ? vulnerability.description : undefined;

  return {
    ...vulnerability,
    id,
    ref,
    description,
    ratings: Array.isArray(vulnerability.ratings)
      ? vulnerability.ratings.filter((rating): rating is CycloneDxRating => isObject(rating))
      : [],
    cwes: Array.isArray(vulnerability.cwes)
      ? vulnerability.cwes.filter((cwe): cwe is CycloneDxCwe => isObject(cwe))
      : [],
    fixes: Array.isArray(vulnerability.fixes)
      ? vulnerability.fixes.filter((fix): fix is CycloneDxFix => isObject(fix))
      : [],
    references: Array.isArray(vulnerability.references)
      ? vulnerability.references.filter((reference): reference is CycloneDxReference => isObject(reference))
      : [],
    affects: Array.isArray(vulnerability.affects)
      ? vulnerability.affects.filter((affect): affect is { ref?: string; [key: string]: unknown } => isObject(affect))
      : [],
  };
}

function mapTopLevelVulnerabilities(document: ParsedCycloneDxDocument): UnifiedVulnerability[] {
  return document.vulnerabilities
    .map((vulnerability) => {
      const ratings = vulnerability.ratings || [];
      const highestRating = ratings.reduce<CycloneDxRating | undefined>((best, rating) => {
        if (!best) return rating;

        const bestScore = typeof best.score === "number" ? best.score : -1;
        const currentScore = typeof rating.score === "number" ? rating.score : -1;
        if (currentScore > bestScore) return rating;
        return best;
      }, undefined);

      const severity = normalizeRatingLevel(highestRating) || "info";
      const identifiers: UnifiedIdentifierSet = {
        id: vulnerability.id || vulnerability.ref,
        aliases: [],
      };

      if (vulnerability.id?.startsWith("GHSA-")) {
        identifiers.ghsa = vulnerability.id;
      }
      if (vulnerability.id?.startsWith("CVE-")) {
        identifiers.osv = vulnerability.id;
      }

      return {
        identifiers,
        severity: {
          level: severity,
          cvssScore: highestRating?.score,
          cvssVector: highestRating?.vector,
          cvssVersion: highestRating?.source?.name,
        },
        cwes: vulnerability.cwes || [],
        fixedVersions: (vulnerability.fixes || [])
          .map((fix) => fix.version)
          .filter((version): version is string => typeof version === "string" && version.trim().length > 0),
        references: (vulnerability.references || [])
          .map((reference) => reference.url)
          .filter((url): url is string => typeof url === "string" && url.trim().length > 0)
          .map((url, index) => {
            const reference = vulnerability.references?.[index];
            return { url, category: reference?.category };
          }),
        description: vulnerability.description,
        _sourceDocument: "cyclonedx",
        _sourceId: vulnerability.id || vulnerability.ref,
        _rawFields: vulnerability,
      } satisfies UnifiedVulnerability;
    })
    .filter((vulnerability) => !!vulnerability);
}

function mapComponentsToVulnerabilities(
  components: CycloneDxComponent[],
  vulnerabilities: UnifiedVulnerability[],
): UnifiedComponent[] {
  const refsToVulns = new Map<string, UnifiedVulnerability[]>();

  for (const vulnerability of vulnerabilities) {
    const sourceDoc = vulnerability._rawFields as CycloneDxVulnerability | undefined;
    const affects = sourceDoc?.affects || [];

    for (const affect of affects) {
      const ref = affect?.ref;
      if (!ref) continue;

      const existing = refsToVulns.get(ref) || [];
      existing.push(vulnerability);
      refsToVulns.set(ref, existing);
    }
  }

  return components.map((component) => {
    const bomRef = component.bomRef || component["bom-ref"] || component.purl || `${component.name}@${component.version}`;
    const directVulnerabilities = refsToVulns.get(bomRef) || [];
    const locations = (component.properties || [])
      .filter((property) => property.name.startsWith("syft:location:") && property.value)
      .map((property) => property.value);

    const foundBy = component.properties?.find((property) => property.name === "syft:package:foundBy")?.value;

    return {
      bomRef,
      type: component.type || "library",
      name: component.name || "unknown",
      version: component.version || "unknown",
      purl: component.purl,
      cpe: component.cpe,
      licenses: (component.licenses || [])
        .map((entry) => {
          if (isObject(entry) && "license" in entry) {
            return normalizeLicense(entry.license);
          }
          return normalizeLicense(entry);
        })
        .filter((license): license is CycloneDxLicense => !!license),
      foundBy,
      locations,
      vulnerabilities: directVulnerabilities,
      _rawFields: component,
    };
  });
}

export function parseCycloneDXDocument(
  rawDocument: string | RawCycloneDXDocument | ParsedCycloneDxDocument,
  context?: IngestionContext,
): ParsedCycloneDxDocument {
  const parsed = parseRawCycloneDXDocument(rawDocument, context);

  const components = Array.isArray(parsed.components)
    ? parsed.components.map(normalizeComponent).filter((component): component is CycloneDxComponent => !!component)
    : [];
  const vulnerabilities = Array.isArray(parsed.vulnerabilities)
    ? parsed.vulnerabilities.map(normalizeVulnerability).filter((vulnerability): vulnerability is CycloneDxVulnerability => !!vulnerability)
    : [];

  return {
    ...parsed,
    bomFormat: "CycloneDX",
    specVersion: typeof parsed.specVersion === "string" ? (parsed.specVersion as CycloneDXSpecVersion) : "1.6",
    version: typeof parsed.version === "number" ? parsed.version : Number(parsed.version) || 1,
    serialNumber: typeof parsed.serialNumber === "string" ? parsed.serialNumber : undefined,
    metadata: isObject(parsed.metadata) ? (parsed.metadata as ParsedCycloneDxDocument["metadata"]) : undefined,
    components,
    vulnerabilities,
    dependencies: Array.isArray(parsed.dependencies)
      ? parsed.dependencies.filter((dependency): dependency is { ref?: string; dependsOn?: string[]; [key: string]: unknown } => isObject(dependency))
      : [],
    _rawFields: cloneUnknownFields(parsed),
  };
}

export function validateCycloneDX(
  document: string | RawCycloneDXDocument | ParsedCycloneDxDocument,
): { valid: boolean; errors: string[]; spec_version: CycloneDXSpecVersion | "unknown" } {
  let parsed: RawCycloneDXDocument;

  try {
    parsed = parseRawCycloneDXDocument(document);
  } catch (error) {
    const ingestionError = error as IngestionError;
    return {
      valid: false,
      errors: [ingestionError.message],
      spec_version: "unknown",
    };
  }

  const valid = validateSchema(parsed);
  const errors = valid
    ? []
    : (validateSchema.errors || []).map((issue) => {
        const path = issue.instancePath || issue.schemaPath;
        return `${path}: ${issue.message || "validation failed"}`;
      });

  return {
    valid,
    errors,
    spec_version: valid && typeof parsed.specVersion === "string"
      ? (parsed.specVersion as CycloneDXSpecVersion)
      : "unknown",
  };
}

export function unifyCycloneDXDocument(
  document: ValidatedCycloneDxDocument,
  context?: IngestionContext,
): UnifiedScanPayload {
  const vulnerabilities = mapTopLevelVulnerabilities(document);
  const components = mapComponentsToVulnerabilities(document.components, vulnerabilities);
  const severityCounts = vulnerabilities.reduce<Partial<Record<SeverityLevel, number>>>((counts, vulnerability) => {
    const level = vulnerability.severity.level;
    counts[level] = (counts[level] || 0) + 1;
    return counts;
  }, {});

  const unknownFields = new Map<string, unknown>();
  if (document._rawFields) {
    for (const [key, value] of Object.entries(document._rawFields)) {
      unknownFields.set(key, value);
    }
  }

  return {
    scanId: context?.scanId || "unknown-scan",
    scannerId: context?.scannerId || "cyclonedx",
    scanTime: context?.ingestedAt || new Date(),
    components,
    vulnerabilities,
    stats: {
      componentCount: components.length,
      vulnerabilityCount: vulnerabilities.length,
      severityCounts,
    },
    _originalDocument: document,
    _unknownFields: unknownFields,
  };
}

export function fromCycloneDX(
  document: string | RawCycloneDXDocument,
  context?: IngestionContext,
): IngestionResult {
  const startedAt = Date.now();
  const scanId = context?.scanId || "unknown-scan";

  try {
    const validation = validateCycloneDX(document);

    if (!validation.valid) {
      return {
        scanId,
        status: "rejected",
        stage: "validation",
        processingTimeMs: Date.now() - startedAt,
        error: createIngestionError(
          "validation_error",
          "cyclonedx_validation_failed",
          "CycloneDX validation failed",
          { ...context, stage: context?.stage || "validation" },
          { errors: validation.errors, specVersion: validation.spec_version },
        ),
      };
    }

    const parsed = parseCycloneDXDocument(document, context);

    const validated: ValidatedCycloneDxDocument = {
      ...parsed,
      _validation: {
        schemaVersion: validation.spec_version,
        isValid: true,
        issues: [],
        validatedAt: new Date(),
      },
    };
    const payload = unifyCycloneDXDocument(validated, {
      ...context,
      stage: context?.stage || "ingestion",
      ingestedAt: context?.ingestedAt || new Date(),
    });

    return {
      scanId,
      status: "ingested",
      payload,
      processingTimeMs: Date.now() - startedAt,
    };
  } catch (error) {
    const ingestionError =
      error && typeof error === "object" && "type" in error
        ? (error as IngestionError)
        : createIngestionError(
            "unify_error",
            "cyclonedx_ingestion_failed",
            error instanceof Error ? error.message : String(error),
            { ...context, stage: context?.stage || "unification" },
          );

    return {
      scanId,
      status: "rejected",
      stage: context?.stage || "unification",
      processingTimeMs: Date.now() - startedAt,
      error: ingestionError,
    };
  }
}
