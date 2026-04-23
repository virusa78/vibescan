/**
 * @swagger
 * /api/v1/api-keys:
 *   post:
 *     summary: Generate a new API key
 *     description: |
 *       Generate a new API key for the authenticated user.
 *       The raw key is shown only once during generation.
 *       Store it securely before leaving this page.
 *     operationId: generateAPIKey
 *     tags:
 *       - API Keys
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GenerateAPIKeyRequest'
 *     responses:
 *       201:
 *         description: API key generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/APIKeyResponse'
 *       400:
 *         description: Invalid input
 *       401:
 *         description: User not authenticated
 *
 *   get:
 *     summary: List all API keys
 *     description: |
 *       List all API keys for the authenticated user.
 *       Keys are masked to show only the last 4 characters.
 *     operationId: listAPIKeys
 *     tags:
 *       - API Keys
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     responses:
 *       200:
 *         description: API keys retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/APIKeyListResponse'
 *       401:
 *         description: User not authenticated
 *
 * /api/v1/api-keys/{keyId}:
 *   get:
 *     summary: Get API key details
 *     description: |
 *       Get detailed information about a specific API key,
 *       including usage statistics and expiration date.
 *     operationId: getAPIKeyDetails
 *     tags:
 *       - API Keys
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - name: keyId
 *         in: path
 *         required: true
 *         description: The unique identifier of the API key
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: API key details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/APIKeyDetailsResponse'
 *       401:
 *         description: User not authenticated
 *       403:
 *         description: Access denied
 *       404:
 *         description: API key not found
 *
 *   delete:
 *     summary: Revoke an API key
 *     description: |
 *       Revoke (disable) an API key.
 *       Once revoked, the key cannot be used for authentication.
 *     operationId: revokeAPIKey
 *     tags:
 *       - API Keys
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - name: keyId
 *         in: path
 *         required: true
 *         description: The unique identifier of the API key
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: API key revoked successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ActionResponse'
 *       401:
 *         description: User not authenticated
 *       403:
 *         description: Access denied
 *       404:
 *         description: API key not found
 *
 * components:
 *   schemas:
 *     GenerateAPIKeyRequest:
 *       type: object
 *       required:
 *         - name
 *       properties:
 *         name:
 *           type: string
 *           minLength: 1
 *           maxLength: 255
 *           description: Human-readable name for the API key
 *           example: "GitHub Actions CI/CD"
 *         expiresIn:
 *           type: string
 *           enum: ["30", "90", "365", "never"]
 *           default: "90"
 *           description: Key expiration period in days
 *           example: "90"
 *
 *     APIKeyResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier for the API key
 *         name:
 *           type: string
 *           description: Human-readable name of the API key
 *         key:
 *           type: string
 *           description: Raw API key (shown only on generation)
 *           example: "vsk_example_key"
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the key was created
 *         expires_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Timestamp when the key expires (null if never)
 *
 *     APIKeyInfo:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier for the API key
 *         name:
 *           type: string
 *           description: Human-readable name of the API key
 *         masked_key:
 *           type: string
 *           description: Masked key showing only last 4 characters
 *           example: "****K0L7"
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the key was created
 *         last_used_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Timestamp of last usage
 *         status:
 *           type: string
 *           enum: ["active", "revoked", "expired"]
 *           description: Current status of the API key
 *
 *     APIKeyListResponse:
 *       type: object
 *       properties:
 *         keys:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/APIKeyInfo'
 *           description: List of API keys for the user
 *
 *     APIKeyDetailsResponse:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier for the API key
 *         name:
 *           type: string
 *           description: Human-readable name of the API key
 *         created_at:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the key was created
 *         expires_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Timestamp when the key expires
 *         last_used_at:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           description: Timestamp of last usage
 *         request_count:
 *           type: integer
 *           description: Total number of requests made with this key
 *         usage_by_day:
 *           type: array
 *           description: Daily usage counts for the most recent activity window
 *           items:
 *             type: object
 *             properties:
 *               date:
 *                 type: string
 *                 format: date
 *               count:
 *                 type: integer
 *         status:
 *           type: string
 *           enum: ["active", "revoked", "expired"]
 *           description: Current status of the API key
 *
 *     ActionResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           description: Whether the operation was successful
 *         message:
 *           type: string
 *           description: Human-readable message about the operation
 */
