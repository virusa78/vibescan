export declare const schemas: {
    SubmitScanRequest: {
        type: string;
        required: string[];
        properties: {
            inputType: {
                type: string;
                enum: string[];
                description: string;
                example: string;
            };
            inputRef: {
                type: string;
                description: string;
                example: string;
            };
        };
    };
    ScanResponse: {
        type: string;
        properties: {
            id: {
                type: string;
                format: string;
                description: string;
            };
            status: {
                type: string;
                enum: string[];
                description: string;
            };
            created_at: {
                type: string;
                format: string;
                description: string;
            };
            quota_remaining: {
                type: string;
                description: string;
            };
        };
    };
    ListScansRequest: {
        type: string;
        properties: {
            limit: {
                type: string;
                minimum: number;
                maximum: number;
                default: number;
                description: string;
            };
            offset: {
                type: string;
                minimum: number;
                default: number;
                description: string;
            };
            status: {
                type: string;
                enum: string[];
                description: string;
            };
            created_from: {
                type: string;
                format: string;
                description: string;
            };
            created_to: {
                type: string;
                format: string;
                description: string;
            };
        };
    };
    ScanSummary: {
        type: string;
        properties: {
            id: {
                type: string;
                format: string;
                description: string;
            };
            status: {
                type: string;
                enum: string[];
            };
            inputType: {
                type: string;
                enum: string[];
            };
            inputRef: {
                type: string;
                description: string;
            };
            planAtSubmission: {
                type: string;
                enum: string[];
            };
            planned_sources: {
                type: string;
                items: {
                    type: string;
                    enum: string[];
                };
            };
            created_at: {
                type: string;
                format: string;
            };
            completed_at: {
                type: string;
                format: string;
                nullable: boolean;
            };
        };
    };
    ListScansResponse: {
        type: string;
        properties: {
            scans: {
                type: string;
                items: {
                    $ref: string;
                };
            };
            total: {
                type: string;
                description: string;
            };
            has_more: {
                type: string;
                description: string;
            };
        };
    };
    ScanDetail: {
        type: string;
        properties: {
            id: {
                type: string;
                format: string;
            };
            status: {
                type: string;
                enum: string[];
            };
            inputType: {
                type: string;
                example: string;
            };
            inputRef: {
                type: string;
                description: string;
            };
            planAtSubmission: {
                type: string;
                enum: string[];
            };
            created_at: {
                type: string;
                format: string;
            };
            completed_at: {
                type: string;
                format: string;
                nullable: boolean;
            };
            error_message: {
                type: string;
                nullable: boolean;
                description: string;
            };
        };
    };
    ResultsSummary: {
        type: string;
        properties: {
            free_count: {
                type: string;
                description: string;
            };
            enterprise_count: {
                type: string;
                description: string;
            };
            total_count: {
                type: string;
                description: string;
            };
            counts_by_source: {
                type: string;
                additionalProperties: {
                    type: string;
                };
                description: string;
                example: {
                    grype: number;
                    codescoring_johnny: number;
                    snyk: number;
                };
            };
        };
    };
    DeltaSummary: {
        type: string;
        properties: {
            delta_count: {
                type: string;
                description: string;
            };
            delta_by_severity: {
                type: string;
                additionalProperties: {
                    type: string;
                };
                description: string;
                example: {
                    critical: number;
                    high: number;
                    medium: number;
                };
            };
            is_locked: {
                type: string;
                description: string;
            };
        };
    };
    ScanDetailResponse: {
        type: string;
        properties: {
            scan: {
                $ref: string;
            };
            results_summary: {
                $ref: string;
            };
            delta_summary: {
                $ref: string;
            };
            status: {
                type: string;
                enum: string[];
            };
        };
    };
    ActionResponse: {
        type: string;
        properties: {
            success: {
                type: string;
                description: string;
            };
            message: {
                type: string;
                description: string;
            };
            quota_refunded: {
                type: string;
                nullable: boolean;
                description: string;
            };
        };
    };
    ScanStatsRequest: {
        type: string;
        properties: {
            time_range: {
                type: string;
                enum: string[];
                default: string;
                description: string;
            };
        };
    };
    StatusBreakdown: {
        type: string;
        properties: {
            pending: {
                type: string;
            };
            scanning: {
                type: string;
            };
            done: {
                type: string;
            };
            error: {
                type: string;
            };
            cancelled: {
                type: string;
            };
        };
    };
    SeverityBreakdown: {
        type: string;
        properties: {
            critical: {
                type: string;
            };
            high: {
                type: string;
            };
            medium: {
                type: string;
            };
            low: {
                type: string;
            };
            info: {
                type: string;
            };
        };
    };
    ScanRate: {
        type: string;
        properties: {
            per_day: {
                type: string;
                format: string;
                description: string;
            };
            per_week: {
                type: string;
                format: string;
                description: string;
            };
        };
    };
    ScanStatsResponse: {
        type: string;
        properties: {
            total_scans: {
                type: string;
                description: string;
            };
            by_status: {
                $ref: string;
            };
            by_severity: {
                $ref: string;
            };
            scan_rate: {
                $ref: string;
            };
            by_source: {
                type: string;
                additionalProperties: {
                    type: string;
                };
                description: string;
            };
            time_range: {
                type: string;
                enum: string[];
                description: string;
            };
        };
    };
    ScannerHealthSnapshot: {
        type: string;
        properties: {
            kind: {
                type: string;
                enum: string[];
            };
            configured: {
                type: string;
            };
            healthy: {
                type: string;
                nullable: boolean;
            };
            checkedAt: {
                type: string;
                format: string;
                nullable: boolean;
            };
            healthyAt: {
                type: string;
                format: string;
                nullable: boolean;
            };
            host: {
                type: string;
                nullable: boolean;
            };
            probeDirectory: {
                type: string;
                nullable: boolean;
            };
            probeCommand: {
                type: string;
                nullable: boolean;
            };
            error: {
                type: string;
                nullable: boolean;
            };
        };
    };
    ScannerAccessResponse: {
        type: string;
        properties: {
            snyk_api_key_attached: {
                type: string;
            };
            snyk_api_key_preview: {
                type: string;
                nullable: boolean;
            };
            snyk_enabled: {
                type: string;
            };
            snyk_ready: {
                type: string;
            };
            snyk_ready_reason: {
                type: string;
                nullable: boolean;
            };
            snyk_credential_source: {
                type: string;
                enum: string[];
                nullable: boolean;
            };
            scanner_health: {
                type: string;
                properties: {
                    johnny: {
                        $ref: string;
                    };
                    snyk: {
                        $ref: string;
                    };
                };
            };
        };
    };
    UpdateScannerAccessRequest: {
        type: string;
        properties: {
            snyk_api_key: {
                type: string;
                nullable: boolean;
                description: string;
            };
        };
    };
    ErrorResponse: {
        type: string;
        properties: {
            error: {
                type: string;
                description: string;
            };
            message: {
                type: string;
                description: string;
            };
            details: {
                type: string;
                description: string;
            };
        };
    };
    ValidationErrorResponse: {
        type: string;
        properties: {
            error: {
                type: string;
                enum: string[];
            };
            message: {
                type: string;
            };
            validation_errors: {
                type: string;
                items: {
                    type: string;
                    properties: {
                        field: {
                            type: string;
                        };
                        message: {
                            type: string;
                        };
                    };
                };
            };
        };
    };
    QuotaExceededResponse: {
        type: string;
        properties: {
            error: {
                type: string;
                enum: string[];
            };
            message: {
                type: string;
            };
            quota_limit: {
                type: string;
            };
            quota_used: {
                type: string;
            };
        };
    };
    ScanSubmission: {
        type: string;
        required: string[];
        properties: {
            source: {
                type: string;
                enum: string[];
                description: string;
            };
            name: {
                type: string;
                description: string;
            };
            description: {
                type: string;
                description: string;
            };
        };
    };
    Scan: {
        type: string;
        properties: {
            id: {
                type: string;
                format: string;
                description: string;
            };
            userId: {
                type: string;
                format: string;
                description: string;
            };
            status: {
                type: string;
                enum: string[];
            };
            name: {
                type: string;
            };
            createdAt: {
                type: string;
                format: string;
            };
            completedAt: {
                type: string;
                format: string;
            };
        };
    };
    Vulnerability: {
        type: string;
        properties: {
            id: {
                type: string;
                format: string;
                description: string;
            };
            cveId: {
                type: string;
                description: string;
            };
            packageName: {
                type: string;
                description: string;
            };
            installedVersion: {
                type: string;
                description: string;
            };
            severity: {
                type: string;
                enum: string[];
            };
            cvssScore: {
                type: string;
                format: string;
                description: string;
            };
            fixedVersion: {
                type: string;
                nullable: boolean;
                description: string;
            };
            description: {
                type: string;
                description: string;
            };
            source: {
                type: string;
                enum: string[];
                description: string;
            };
            filePath: {
                type: string;
                nullable: boolean;
                description: string;
            };
            status: {
                type: string;
                description: string;
            };
            annotation: {
                oneOf: ({
                    $ref: string;
                    type?: undefined;
                } | {
                    type: string;
                    $ref?: undefined;
                })[];
            };
        };
    };
    FindingAnnotation: {
        type: string;
        properties: {
            state: {
                type: string;
                enum: string[];
            };
            reason: {
                type: string;
                nullable: boolean;
            };
            expires_at: {
                type: string;
                format: string;
                nullable: boolean;
            };
        };
    };
    ReportResponse: {
        type: string;
        properties: {
            scanId: {
                type: string;
                format: string;
            };
            status: {
                type: string;
                enum: string[];
            };
            lockedView: {
                type: string;
                description: string;
            };
            severity_breakdown: {
                $ref: string;
            };
            total_free: {
                type: string;
                description: string;
            };
            total_enterprise: {
                type: string;
                description: string;
            };
            totals_by_source: {
                type: string;
                additionalProperties: {
                    type: string;
                };
                description: string;
                example: {
                    grype: number;
                    codescoring_johnny: number;
                    snyk: number;
                };
            };
            delta_count: {
                type: string;
                description: string;
            };
            vulnerabilities: {
                type: string;
                items: {
                    $ref: string;
                };
                description: string;
            };
        };
    };
    ReportSummaryResponse: {
        type: string;
        properties: {
            scanId: {
                type: string;
                format: string;
            };
            totalFindings: {
                type: string;
            };
            totalsBySource: {
                type: string;
                additionalProperties: {
                    type: string;
                };
            };
            severity: {
                type: string;
                properties: {
                    critical: {
                        type: string;
                    };
                    high: {
                        type: string;
                    };
                };
            };
        };
    };
    PDFResponse: {
        type: string;
        properties: {
            scanId: {
                type: string;
                format: string;
            };
            jobId: {
                type: string;
                description: string;
            };
            status: {
                type: string;
                description: string;
            };
            estimatedTime: {
                type: string;
                description: string;
            };
        };
    };
    CIDecisionResponse: {
        type: string;
        properties: {
            scanId: {
                type: string;
                format: string;
            };
            decision: {
                type: string;
                enum: string[];
                description: string;
            };
            reason: {
                type: string;
                description: string;
            };
            criticalIssues: {
                type: string;
                description: string;
            };
            criticalIssuesBySource: {
                type: string;
                additionalProperties: {
                    type: string;
                };
            };
        };
    };
    LatestRemediationPayload: {
        type: string;
        properties: {
            id: {
                type: string;
                format: string;
            };
            requestKey: {
                type: string;
            };
            promptType: {
                type: string;
                enum: string[];
            };
            provider: {
                type: string;
                enum: string[];
            };
            modelName: {
                type: string;
                nullable: boolean;
            };
            createdAt: {
                type: string;
                format: string;
            };
            responsePayload: {
                type: string;
                description: string;
            };
        };
    };
    LatestRemediationResponse: {
        type: string;
        properties: {
            scanId: {
                type: string;
                format: string;
            };
            findingId: {
                type: string;
                format: string;
            };
            has_remediation: {
                type: string;
            };
            remediation: {
                oneOf: ({
                    $ref: string;
                    type?: undefined;
                } | {
                    type: string;
                    $ref?: undefined;
                })[];
            };
        };
    };
    CreateWebhookRequest: {
        type: string;
        required: string[];
        properties: {
            url: {
                type: string;
                format: string;
                description: string;
                example: string;
            };
            events: {
                type: string;
                items: {
                    type: string;
                    enum: string[];
                };
                description: string;
                example: string[];
            };
        };
    };
    WebhookResponse: {
        type: string;
        properties: {
            id: {
                type: string;
                format: string;
                description: string;
            };
            url: {
                type: string;
                format: string;
                description: string;
            };
            created_at: {
                type: string;
                format: string;
                description: string;
            };
            events: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            secret_preview: {
                type: string;
                description: string;
                example: string;
            };
        };
    };
    Webhook: {
        type: string;
        properties: {
            id: {
                type: string;
                format: string;
            };
            url: {
                type: string;
                format: string;
            };
            created_at: {
                type: string;
                format: string;
            };
            events: {
                type: string;
                items: {
                    type: string;
                };
            };
            enabled: {
                type: string;
            };
        };
    };
    WebhookListResponse: {
        type: string;
        properties: {
            webhooks: {
                type: string;
                items: {
                    $ref: string;
                };
            };
        };
    };
    WebhookDeliveryStats: {
        type: string;
        properties: {
            total_attempts: {
                type: string;
                description: string;
            };
            successful: {
                type: string;
                description: string;
            };
            failed: {
                type: string;
                description: string;
            };
            pending: {
                type: string;
                description: string;
            };
        };
    };
    WebhookDelivery: {
        type: string;
        properties: {
            id: {
                type: string;
                format: string;
            };
            scan_id: {
                type: string;
                format: string;
            };
            status: {
                type: string;
                enum: string[];
            };
            http_status: {
                type: string;
                nullable: boolean;
            };
            event: {
                type: string;
            };
            attempt: {
                type: string;
            };
            duration: {
                type: string;
                nullable: boolean;
            };
            created_at: {
                type: string;
                format: string;
            };
            delivered_at: {
                type: string;
                format: string;
                nullable: boolean;
            };
            payload: {
                type: string;
                nullable: boolean;
                additionalProperties: boolean;
            };
            response: {
                type: string;
                nullable: boolean;
            };
        };
    };
    WebhookDetailResponse: {
        type: string;
        properties: {
            webhook: {
                $ref: string;
            };
            delivery_stats: {
                $ref: string;
            };
            last_5_deliveries: {
                type: string;
                items: {
                    $ref: string;
                };
            };
        };
    };
    WebhookDeliveriesResponse: {
        type: string;
        properties: {
            deliveries: {
                type: string;
                items: {
                    $ref: string;
                };
            };
            next_cursor: {
                type: string;
                format: string;
                nullable: boolean;
            };
        };
    };
    UpdateWebhookRequest: {
        type: string;
        properties: {
            url: {
                type: string;
                format: string;
                description: string;
            };
            events: {
                type: string;
                items: {
                    type: string;
                    enum: string[];
                };
                description: string;
            };
            enabled: {
                type: string;
                description: string;
            };
            rotateSecret: {
                type: string;
                description: string;
            };
        };
    };
    UpdateWebhookResponse: {
        type: string;
        properties: {
            id: {
                type: string;
                format: string;
            };
            url: {
                type: string;
                format: string;
            };
            events: {
                type: string;
                items: {
                    type: string;
                };
            };
            enabled: {
                type: string;
            };
            updated_at: {
                type: string;
                format: string;
            };
        };
    };
    PaymentPlanId: {
        type: string;
        enum: string[];
        description: string;
    };
    CheckoutSessionResponse: {
        type: string;
        properties: {
            sessionUrl: {
                type: string;
                nullable: boolean;
                description: string;
            };
            sessionId: {
                type: string;
                description: string;
            };
        };
    };
    CustomerPortalUrlResponse: {
        type: string;
        nullable: boolean;
        description: string;
    };
    MetricsResponse: {
        type: string;
        properties: {
            total_scans: {
                type: string;
                description: string;
            };
            scans_this_month: {
                type: string;
                description: string;
            };
            total_vulnerabilities: {
                type: string;
                description: string;
            };
            avg_severity: {
                type: string;
                enum: string[];
                nullable: boolean;
                description: string;
            };
            quota_used: {
                type: string;
                description: string;
            };
            quota_limit: {
                type: string;
                description: string;
            };
            plan_tier: {
                type: string;
                enum: string[];
                description: string;
            };
            vulnerabilities_by_source: {
                type: string;
                additionalProperties: {
                    type: string;
                };
                description: string;
            };
            time_range: {
                type: string;
                enum: string[];
                description: string;
            };
        };
    };
    RecentScan: {
        type: string;
        properties: {
            id: {
                type: string;
                format: string;
                description: string;
            };
            status: {
                type: string;
                enum: string[];
            };
            inputType: {
                type: string;
                enum: string[];
            };
            inputRef: {
                type: string;
                description: string;
            };
            planAtSubmission: {
                type: string;
                enum: string[];
            };
            planned_sources: {
                type: string;
                items: {
                    type: string;
                    enum: string[];
                };
            };
            created_at: {
                type: string;
                format: string;
                description: string;
            };
            completed_at: {
                type: string;
                format: string;
                nullable: boolean;
                description: string;
            };
            vulnerability_count: {
                type: string;
                description: string;
            };
            counts_by_source: {
                type: string;
                additionalProperties: {
                    type: string;
                };
            };
        };
    };
    RecentScansResponse: {
        type: string;
        properties: {
            scans: {
                type: string;
                items: {
                    $ref: string;
                };
                description: string;
            };
            status_counts: {
                type: string;
                additionalProperties: {
                    type: string;
                };
            };
            total_count: {
                type: string;
            };
            filtered_count: {
                type: string;
            };
        };
    };
    SavedView: {
        type: string;
        properties: {
            id: {
                type: string;
                format: string;
            };
            name: {
                type: string;
            };
            sortField: {
                type: string;
                enum: string[];
            };
            sortDirection: {
                type: string;
                enum: string[];
            };
            statuses: {
                type: string;
                items: {
                    type: string;
                    enum: string[];
                };
            };
            query: {
                type: string;
            };
            createdAt: {
                type: string;
                format: string;
            };
            updatedAt: {
                type: string;
                format: string;
            };
        };
    };
    SavedViewsResponse: {
        type: string;
        properties: {
            views: {
                type: string;
                items: {
                    $ref: string;
                };
            };
        };
    };
    CreateSavedViewRequest: {
        type: string;
        required: string[];
        properties: {
            name: {
                type: string;
            };
            config: {
                type: string;
                required: string[];
                properties: {
                    sortField: {
                        type: string;
                        enum: string[];
                    };
                    sortDirection: {
                        type: string;
                        enum: string[];
                    };
                    statuses: {
                        type: string;
                        items: {
                            type: string;
                            enum: string[];
                        };
                    };
                    query: {
                        type: string;
                    };
                };
            };
        };
    };
    SeverityBreakdownResponse: {
        type: string;
        properties: {
            critical: {
                type: string;
                description: string;
            };
            high: {
                type: string;
                description: string;
            };
            medium: {
                type: string;
                description: string;
            };
            low: {
                type: string;
                description: string;
            };
            info: {
                type: string;
                description: string;
            };
            total: {
                type: string;
                description: string;
            };
            time_range: {
                type: string;
                enum: string[];
                description: string;
            };
        };
    };
    QuotaStatusResponse: {
        type: string;
        properties: {
            used: {
                type: string;
                description: string;
            };
            limit: {
                type: string;
                description: string;
            };
            percentage: {
                type: string;
                description: string;
            };
            monthly_reset_date: {
                type: string;
                format: string;
                description: string;
            };
            usage_trend: {
                type: string;
                enum: string[];
                description: string;
            };
        };
    };
    TrendBucket: {
        type: string;
        properties: {
            bucket_start: {
                type: string;
                format: string;
                description: string;
            };
            scans: {
                type: string;
                description: string;
            };
            findings: {
                type: string;
                description: string;
            };
            delta: {
                type: string;
                description: string;
            };
            findings_by_source: {
                type: string;
                additionalProperties: {
                    type: string;
                };
            };
        };
    };
    TrendSeriesResponse: {
        type: string;
        properties: {
            time_range: {
                type: string;
                enum: string[];
            };
            granularity: {
                type: string;
                enum: string[];
            };
            buckets: {
                type: string;
                items: {
                    $ref: string;
                };
            };
            totals: {
                type: string;
                properties: {
                    scans: {
                        type: string;
                    };
                    findings: {
                        type: string;
                    };
                    delta: {
                        type: string;
                    };
                    findings_by_source: {
                        type: string;
                        additionalProperties: {
                            type: string;
                        };
                    };
                };
            };
        };
    };
    ProfileResponse: {
        type: string;
        properties: {
            id: {
                type: string;
                format: string;
                description: string;
            };
            name: {
                type: string;
                nullable: boolean;
                description: string;
            };
            email: {
                type: string;
                format: string;
                description: string;
            };
            region: {
                type: string;
                enum: string[];
                description: string;
            };
            plan_tier: {
                type: string;
                enum: string[];
                description: string;
            };
            subscription_status: {
                type: string;
                nullable: boolean;
                description: string;
            };
            monthly_quota_used: {
                type: string;
                description: string;
            };
            monthly_quota_limit: {
                type: string;
                description: string;
            };
            org_id: {
                type: string;
                format: string;
                nullable: boolean;
                description: string;
            };
            org_name: {
                type: string;
                nullable: boolean;
                description: string;
            };
            org_slug: {
                type: string;
                nullable: boolean;
                description: string;
            };
            org_role: {
                type: string;
                enum: (string | null)[];
                nullable: boolean;
                description: string;
            };
            active_workspace_id: {
                type: string;
                format: string;
                nullable: boolean;
                description: string;
            };
            active_workspace_name: {
                type: string;
                nullable: boolean;
                description: string;
            };
            active_workspace_slug: {
                type: string;
                nullable: boolean;
                description: string;
            };
            active_workspace_role: {
                type: string;
                enum: (string | null)[];
                nullable: boolean;
                description: string;
            };
            workspace_count: {
                type: string;
                minimum: number;
                description: string;
            };
        };
    };
    UpdateProfileSettingsRequest: {
        type: string;
        properties: {
            name: {
                type: string;
                minLength: number;
                maxLength: number;
                description: string;
            };
            region: {
                type: string;
                enum: string[];
                description: string;
            };
            notifications_enabled: {
                type: string;
                description: string;
            };
        };
    };
    NotificationSettingsResponse: {
        type: string;
        properties: {
            project_key: {
                type: string;
                description: string;
                example: string;
            };
            email_on_scan_complete: {
                type: string;
                description: string;
            };
            email_on_vulnerability: {
                type: string;
                description: string;
            };
            weekly_digest: {
                type: string;
                description: string;
            };
            sms_enabled: {
                type: string;
                description: string;
            };
        };
    };
    UpdateNotificationSettingsRequest: {
        type: string;
        properties: {
            project_key: {
                type: string;
                description: string;
                example: string;
            };
            email_on_scan_complete: {
                type: string;
                description: string;
            };
            email_on_vulnerability: {
                type: string;
                description: string;
            };
            weekly_digest: {
                type: string;
                description: string;
            };
        };
    };
    WorkspaceSummary: {
        type: string;
        properties: {
            id: {
                type: string;
                format: string;
            };
            name: {
                type: string;
            };
            slug: {
                type: string;
            };
            is_personal: {
                type: string;
            };
            role: {
                type: string;
                enum: string[];
            };
            organization: {
                type: string;
                properties: {
                    id: {
                        type: string;
                        format: string;
                    };
                    name: {
                        type: string;
                    };
                    slug: {
                        type: string;
                    };
                    is_personal: {
                        type: string;
                    };
                };
            };
            team: {
                type: string;
                nullable: boolean;
                properties: {
                    id: {
                        type: string;
                        format: string;
                    };
                    name: {
                        type: string;
                    };
                    slug: {
                        type: string;
                    };
                    is_default: {
                        type: string;
                    };
                };
            };
        };
    };
    ListWorkspacesResponse: {
        type: string;
        properties: {
            workspaces: {
                type: string;
                items: {
                    $ref: string;
                };
            };
        };
    };
    WorkspaceContextResponse: {
        type: string;
        properties: {
            active_workspace: {
                $ref: string;
            };
            workspaces: {
                type: string;
                items: {
                    $ref: string;
                };
            };
            personal_organization_id: {
                type: string;
                format: string;
            };
            personal_workspace_id: {
                type: string;
                format: string;
            };
        };
    };
    SwitchWorkspaceRequest: {
        type: string;
        required: string[];
        properties: {
            workspace_id: {
                type: string;
                format: string;
            };
        };
    };
    OnboardingStateResponse: {
        type: string;
        properties: {
            should_show_onboarding: {
                type: string;
            };
            is_complete: {
                type: string;
            };
            has_workspace: {
                type: string;
            };
            has_scans: {
                type: string;
            };
            has_github_installation: {
                type: string;
            };
            workspace_name: {
                type: string;
                nullable: boolean;
            };
            workspace_slug: {
                type: string;
                nullable: boolean;
            };
            recommended_path: {
                type: string;
                enum: string[];
            };
            primary_cta_route: {
                type: string;
            };
            secondary_cta_route: {
                type: string;
                nullable: boolean;
            };
        };
    };
    CompleteOnboardingResponse: {
        type: string;
        properties: {
            success: {
                type: string;
            };
            completed_at: {
                type: string;
                format: string;
            };
        };
    };
    GithubInstallationSummary: {
        type: string;
        properties: {
            id: {
                type: string;
                format: string;
            };
            github_installation_id: {
                type: string;
            };
            workspace_id: {
                type: string;
                format: string;
                nullable: boolean;
            };
            org_id: {
                type: string;
                format: string;
                nullable: boolean;
            };
            account_login: {
                type: string;
                nullable: boolean;
            };
            repository_selection: {
                type: string;
            };
            repos_scope: {
                type: string;
                items: {
                    type: string;
                };
            };
            trigger_on_push: {
                type: string;
            };
            trigger_on_pr: {
                type: string;
            };
            target_branches: {
                type: string;
                items: {
                    type: string;
                };
            };
            fail_pr_on_severity: {
                type: string;
                enum: string[];
            };
            available_repos: {
                type: string;
                items: {
                    type: string;
                };
            };
        };
    };
    ListGithubInstallationsResponse: {
        type: string;
        properties: {
            installations: {
                type: string;
                items: {
                    $ref: string;
                };
            };
        };
    };
    LinkGithubInstallationRequest: {
        type: string;
        required: string[];
        properties: {
            installationId: {
                type: string;
            };
        };
    };
    UpdateGithubInstallationSettingsRequest: {
        type: string;
        required: string[];
        properties: {
            repos_scope: {
                type: string;
                items: {
                    type: string;
                };
            };
            trigger_on_push: {
                type: string;
            };
            trigger_on_pr: {
                type: string;
            };
            target_branches: {
                type: string;
                items: {
                    type: string;
                };
            };
            fail_pr_on_severity: {
                type: string;
                enum: string[];
            };
        };
    };
};
//# sourceMappingURL=schemas.d.ts.map