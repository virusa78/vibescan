/**
 * Migration 011: Create SbomDocument table
 *
 * SBOM document storage for audit:
 * - Raw CycloneDX document reference
 * - Spec version tracking
 * - Validation status and errors
 * - Tool information (Syft, cdxgen, Trivy, etc.)
 */

export const up = `
-- Create SbomDocument table
CREATE TABLE sbom_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scan_id UUID NOT NULL REFERENCES scans(id) ON DELETE CASCADE,
    spec_version VARCHAR(10) NOT NULL,
    serial_number VARCHAR(255) NOT NULL,
    component_count INTEGER NOT NULL,
    tool_name VARCHAR(100) NOT NULL,
    tool_version VARCHAR(50) NOT NULL,
    raw_document_s3_key TEXT NOT NULL,
    validated_at TIMESTAMPTZ,
    validation_errors TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_sbom_documents_scan_id ON sbom_documents(scan_id);
CREATE INDEX idx_sbom_documents_spec_version ON sbom_documents(spec_version);
CREATE INDEX idx_sbom_documents_validated_at ON sbom_documents(validated_at);
`;

export const down = `
DROP TABLE sbom_documents;
`;

export default {
    up,
    down,
    name: '011_create_sbom_documents_table',
    description: 'Create SbomDocument table for SBOM audit storage'
};
