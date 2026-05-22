import Ajv from "ajv";
const SUPPORTED_SPEC_VERSIONS = ["1.4", "1.5", "1.6"];
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
};
const AjvCtor = Ajv;
const ajv = new AjvCtor({ allErrors: true, allowUnionTypes: true, strict: false });
const validateSchema = ajv.compile(CYCLOONEDX_SCHEMA);
const KNOWN_METADATA_FIELDS = new Set(["timestamp", "tools", "component"]);
const KNOWN_COMPONENT_FIELDS = new Set([
    "bomRef",
    "bom-ref",
    "type",
    "name",
    "version",
    "purl",
    "cpe",
    "supplier",
    "licenses",
    "properties",
]);
const KNOWN_VULNERABILITY_FIELDS = new Set([
    "ref",
    "id",
    "source",
    "ratings",
    "cwes",
    "fixes",
    "references",
    "affects",
    "description",
]);
function isObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
function cloneUnknownFields(document) {
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
    const unknown = {};
    for (const [key, value] of Object.entries(document)) {
        if (!known.has(key)) {
            unknown[key] = value;
        }
    }
    return unknown;
}
function createIngestionError(type, code, message, context, details) {
    return {
        type,
        code,
        message,
        details,
        context,
        timestamp: new Date(),
    };
}
function appendUnknownFields(target, source, basePath, knownFields) {
    for (const [key, value] of Object.entries(source)) {
        if (!knownFields.has(key)) {
            target.set(`${basePath}.${key}`, value);
        }
    }
}
function parseRawCycloneDXDocument(document, context) {
    const parsed = typeof document === "string"
        ? (() => {
            try {
                return JSON.parse(document);
            }
            catch (error) {
                throw createIngestionError("parse_error", "parse_json_failed", "Invalid JSON in CycloneDX document", { ...context, stage: context?.stage || "parsing" }, { detail: error instanceof Error ? error.message : String(error) });
            }
        })()
        : document;
    if (!isObject(parsed)) {
        throw createIngestionError("parse_error", "invalid_document_root", "CycloneDX document must be a JSON object", { ...context, stage: context?.stage || "parsing" }, { expected: "object", actual: typeof parsed });
    }
    return parsed;
}
function normalizeLicense(license) {
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
function normalizeComponent(component) {
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
    const licenses = [];
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
            .filter((property) => isObject(property) && typeof property.name === "string" && typeof property.value === "string")
        : [];
    return {
        ...component,
        bomRef,
        name,
        version,
        type: typeof component.type === "string" ? component.type : "library",
        purl: typeof component.purl === "string" ? component.purl : undefined,
        cpe: typeof component.cpe === "string" ? component.cpe : undefined,
        supplier: typeof component.supplier === "string" ? component.supplier : undefined,
        licenses,
        properties,
    };
}
function normalizeRatingLevel(rating) {
    const severity = rating?.severity?.toLowerCase();
    if (severity === "critical" ||
        severity === "high" ||
        severity === "medium" ||
        severity === "low" ||
        severity === "info") {
        return severity;
    }
    const score = rating?.score;
    if (typeof score !== "number") {
        return undefined;
    }
    if (score >= 9)
        return "critical";
    if (score >= 7)
        return "high";
    if (score >= 4)
        return "medium";
    if (score > 0)
        return "low";
    return "info";
}
function normalizeVulnerability(vulnerability) {
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
            ? vulnerability.ratings.filter((rating) => isObject(rating))
            : [],
        cwes: Array.isArray(vulnerability.cwes)
            ? vulnerability.cwes.filter((cwe) => isObject(cwe))
            : [],
        fixes: Array.isArray(vulnerability.fixes)
            ? vulnerability.fixes.filter((fix) => isObject(fix))
            : [],
        references: Array.isArray(vulnerability.references)
            ? vulnerability.references.filter((reference) => isObject(reference))
            : [],
        affects: Array.isArray(vulnerability.affects)
            ? vulnerability.affects.filter((affect) => isObject(affect))
            : [],
    };
}
function mapTopLevelVulnerabilities(document) {
    return document.vulnerabilities
        .map((vulnerability) => {
        const ratings = vulnerability.ratings || [];
        const highestRating = ratings.reduce((best, rating) => {
            if (!best)
                return rating;
            const bestScore = typeof best.score === "number" ? best.score : -1;
            const currentScore = typeof rating.score === "number" ? rating.score : -1;
            if (currentScore > bestScore)
                return rating;
            return best;
        }, undefined);
        const severity = normalizeRatingLevel(highestRating) || "info";
        const identifiers = {
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
                .filter((version) => typeof version === "string" && version.trim().length > 0),
            references: (vulnerability.references || [])
                .map((reference) => reference.url)
                .filter((url) => typeof url === "string" && url.trim().length > 0)
                .map((url, index) => {
                const reference = vulnerability.references?.[index];
                return { url, category: reference?.category };
            }),
            description: vulnerability.description,
            _sourceDocument: "cyclonedx",
            _sourceId: vulnerability.id || vulnerability.ref,
            _rawFields: vulnerability,
        };
    })
        .filter((vulnerability) => !!vulnerability);
}
function mapComponentsToVulnerabilities(components, vulnerabilities) {
    const refsToVulns = new Map();
    for (const vulnerability of vulnerabilities) {
        const sourceDoc = vulnerability._rawFields;
        const affects = sourceDoc?.affects || [];
        for (const affect of affects) {
            const ref = affect?.ref;
            if (!ref)
                continue;
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
                .filter((license) => !!license),
            foundBy,
            locations,
            vulnerabilities: directVulnerabilities,
            _rawFields: component,
        };
    });
}
export function parseCycloneDXDocument(rawDocument, context) {
    const parsed = parseRawCycloneDXDocument(rawDocument, context);
    const components = Array.isArray(parsed.components)
        ? parsed.components.map(normalizeComponent).filter((component) => !!component)
        : [];
    const vulnerabilities = Array.isArray(parsed.vulnerabilities)
        ? parsed.vulnerabilities.map(normalizeVulnerability).filter((vulnerability) => !!vulnerability)
        : [];
    return {
        ...parsed,
        bomFormat: "CycloneDX",
        specVersion: typeof parsed.specVersion === "string" ? parsed.specVersion : "1.6",
        version: typeof parsed.version === "number" ? parsed.version : Number(parsed.version) || 1,
        serialNumber: typeof parsed.serialNumber === "string" ? parsed.serialNumber : undefined,
        metadata: isObject(parsed.metadata) ? parsed.metadata : undefined,
        components,
        vulnerabilities,
        dependencies: Array.isArray(parsed.dependencies)
            ? parsed.dependencies.filter((dependency) => isObject(dependency))
            : [],
        _rawFields: cloneUnknownFields(parsed),
    };
}
export function validateCycloneDX(document) {
    let parsed;
    try {
        parsed = parseRawCycloneDXDocument(document);
    }
    catch (error) {
        const ingestionError = error;
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
            ? parsed.specVersion
            : "unknown",
    };
}
export function unifyCycloneDXDocument(document, context) {
    const vulnerabilities = mapTopLevelVulnerabilities(document);
    const components = mapComponentsToVulnerabilities(document.components, vulnerabilities);
    const severityCounts = vulnerabilities.reduce((counts, vulnerability) => {
        const level = vulnerability.severity.level;
        counts[level] = (counts[level] || 0) + 1;
        return counts;
    }, {});
    const unknownFields = new Map();
    if (document._rawFields) {
        for (const [key, value] of Object.entries(document._rawFields)) {
            unknownFields.set(`$.${key}`, value);
        }
    }
    if (document.metadata && isObject(document.metadata)) {
        appendUnknownFields(unknownFields, document.metadata, "$.metadata", KNOWN_METADATA_FIELDS);
    }
    document.components.forEach((component, index) => {
        appendUnknownFields(unknownFields, component, `$.components[${index}]`, KNOWN_COMPONENT_FIELDS);
    });
    document.vulnerabilities.forEach((vulnerability, index) => {
        appendUnknownFields(unknownFields, vulnerability, `$.vulnerabilities[${index}]`, KNOWN_VULNERABILITY_FIELDS);
    });
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
export function fromCycloneDX(document, context) {
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
                error: createIngestionError("validation_error", "cyclonedx_validation_failed", "CycloneDX validation failed", { ...context, stage: context?.stage || "validation" }, { errors: validation.errors, specVersion: validation.spec_version }),
            };
        }
        const parsed = parseCycloneDXDocument(document, context);
        const validated = {
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
    }
    catch (error) {
        const ingestionError = error && typeof error === "object" && "type" in error
            ? error
            : createIngestionError("unify_error", "cyclonedx_ingestion_failed", error instanceof Error ? error.message : String(error), { ...context, stage: context?.stage || "unification" });
        return {
            scanId,
            status: "rejected",
            stage: context?.stage || "unification",
            processingTimeMs: Date.now() - startedAt,
            error: ingestionError,
        };
    }
}
//# sourceMappingURL=cyclonedx-contracts.js.map