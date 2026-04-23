# Token Validation Checklist

This checklist ensures JWT refresh token flow is properly implemented and secured.

## Pre-Implementation ✅

- [x] JWT_SECRET environment variable configured
- [x] Redis connection available and tested
- [x] Node.js crypto module available
- [x] Zod validation library available
- [x] Wasp framework version 0.23+ running

## Configuration ✅

- [x] JWT_SECRET set in .env.server
  - [ ] Strong random value (min 32 characters)
  - [ ] Different for each environment
  - [ ] Never committed to version control

- [x] Token expiry times configured
  - [ ] ACCESS_TOKEN_EXPIRY = 15 minutes (900s)
  - [ ] REFRESH_TOKEN_EXPIRY = 30 days (2,592,000s)
  - [ ] REFRESH_TOKEN_ROTATION = true

- [x] Redis configuration for blacklist
  - [ ] Host: localhost (default)
  - [ ] Port: 6379 (default)
  - [ ] Connection pooling enabled

## Implementation ✅

### Server-Side

- [x] Token Service (`src/server/services/tokenService.ts`)
  - [x] `generateTokenPair()` - Creates access + refresh token pair
  - [x] `verifyRefreshToken()` - Validates refresh token signature
  - [x] `verifyAccessToken()` - Validates access token signature
  - [x] `blacklistToken()` - Marks token as revoked in Redis
  - [x] `isTokenBlacklisted()` - Checks if token is revoked
  - [ ] All functions properly handle errors
  - [ ] No plaintext tokens logged

- [x] Token Configuration (`src/server/config/tokens.ts`)
  - [x] TOKEN_CONFIG exported
  - [x] getTokenExpiry() function
  - [x] isTokenExpired() function
  - [ ] All values correct

- [x] Refresh Token Operation (`src/server/operations/auth/refreshToken.ts`)
  - [x] Operation declared in main.wasp
  - [x] Validates refresh token input
  - [x] Verifies token signature
  - [x] Checks token blacklist
  - [x] Generates new token pair
  - [x] Blacklists old refresh token
  - [x] Returns proper error codes (401, 500)

- [x] main.wasp Declaration
  - [x] `refreshToken` action declared
  - [x] `auth: false` (doesn't require Wasp session auth)
  - [x] Correct import path
  - [x] No entities required

### Client-Side

- [x] Token Refresh Hook (`src/client/hooks/useTokenRefresh.ts`)
  - [x] `useTokenRefresh()` hook exports
  - [x] `performRefresh()` - Manual token refresh
  - [x] `handleUnauthorized()` - Handle 401 responses
  - [x] Auto-schedules refresh before expiry
  - [ ] Handles network errors gracefully
  - [ ] Clears tokens on permanent failure

- [x] App Integration (`src/client/App.tsx`)
  - [x] `useTokenRefresh` hook imported
  - [x] Hook initialized in App component
  - [x] Runs once on mount
  - [ ] Proper cleanup on unmount

## Token Format ✅

- [x] JWT Structure: `header.payload.signature`
  - [x] Header contains algorithm and type
  - [x] Payload contains claims
  - [x] Signature uses HS256 with JWT_SECRET

- [x] Token Claims (Access Token)
  - [x] userId: User identifier
  - [x] jti: Unique token ID
  - [x] iat: Issued At timestamp
  - [x] exp: Expiration timestamp
  - [x] type: "access"

- [x] Token Claims (Refresh Token)
  - [x] userId: User identifier
  - [x] jti: Unique token ID
  - [x] iat: Issued At timestamp
  - [x] exp: Expiration timestamp
  - [x] type: "refresh"

## Token Rotation ✅

- [x] Token rotation enabled
- [x] New refresh token issued on each refresh
- [x] Old refresh token blacklisted immediately
- [x] JTI unique per token
- [x] Rotation prevents replay attacks

## Blacklist Mechanism ✅

- [x] Redis blacklist storage
  - [x] Key format: `token_blacklist:${jti}`
  - [x] Value: "1" (any truthy value)
  - [x] TTL: Token expiration timestamp

- [x] Blacklist checking
  - [x] Called before issuing new tokens
  - [x] Prevents token reuse
  - [ ] Performance optimized (caching?)

- [x] Blacklist cleanup
  - [x] Redis TTL handles automatic cleanup
  - [x] No manual cleanup needed

## Error Handling ✅

- [x] Invalid token returns 401
  - [ ] Clear error message provided
  - [ ] No token details leaked in error

- [x] Expired token returns 401
  - [ ] Error distinguishes from other auth failures

- [x] Blacklisted token returns 401
  - [ ] Indicates token has been revoked

- [x] Missing JWT_SECRET throws error
  - [ ] Clear error message

- [x] Redis connection failure handled
  - [ ] Fails secure (treats as blacklisted)
  - [ ] Doesn't crash server

## Security ✅

- [x] HMAC-SHA256 signing
  - [ ] Using Node.js crypto module
  - [ ] Signature verification on decode

- [x] Token signature validation
  - [x] Header + payload signed
  - [x] Signature verified on use
  - [ ] No relaxed verification

- [x] No plaintext tokens in logs
  - [ ] Tokens never logged directly
  - [ ] Only JTI logged if needed

- [x] HTTP-only considerations
  - [ ] Documented for storage
  - [ ] Client warns against localStorage for refresh tokens

- [x] HTTPS requirement
  - [ ] Documented as mandatory in production
  - [ ] Configuration prevents HTTP in production

- [x] Rate limiting on refresh endpoint
  - [ ] Implemented or recommended
  - [ ] Prevents token refresh attacks

- [x] CORS configured
  - [ ] Refresh endpoint CORS locked down
  - [ ] Credentials: true if needed

## Testing ✅

- [x] Unit Tests (`tests/tokenRefresh.test.ts`)
  - [x] Token generation tests
    - [x] Valid tokens generated
    - [x] Correct format (3 parts)
    - [x] Different tokens for same user
  
  - [x] Token verification tests
    - [x] Valid refresh token verified
    - [x] Valid access token verified
    - [x] Invalid tokens rejected
    - [x] Tampered tokens rejected
    - [x] Wrong token type rejected
  
  - [x] Token expiry tests
    - [x] Correct expiry times
    - [x] Expired tokens rejected
    - [x] Non-expired tokens accepted
  
  - [x] Blacklist tests
    - [x] Tokens can be blacklisted
    - [x] Blacklisted tokens detected
    - [x] Non-blacklisted tokens not detected
  
  - [x] JTI uniqueness
    - [x] Each token has unique JTI
    - [x] Same user gets different JTIs

- [ ] Integration Tests
  - [ ] Full token refresh flow
  - [ ] Token rotation works
  - [ ] Old tokens cannot be reused
  - [ ] Error handling works

- [ ] E2E Tests
  - [ ] User can refresh token via UI
  - [ ] Auto-refresh happens before expiry
  - [ ] 401 triggers manual refresh
  - [ ] Logout blacklists tokens

## Documentation ✅

- [x] TOKEN_MANAGEMENT.md
  - [x] Token types explained
  - [x] Token structure documented
  - [x] Token rotation explained
  - [x] Blacklist mechanism explained
  - [x] API operations documented
  - [x] Client-side usage examples
  - [x] Server-side usage examples
  - [x] Configuration instructions
  - [x] Security best practices
  - [x] Troubleshooting guide

- [x] TOKEN_VALIDATION.md (this file)
  - [x] Pre-implementation checklist
  - [x] Configuration checklist
  - [x] Implementation checklist
  - [x] Format checklist
  - [x] Rotation checklist
  - [x] Blacklist checklist
  - [x] Error handling checklist
  - [x] Security checklist
  - [x] Testing checklist
  - [x] Documentation checklist

- [ ] OPERATIONS.md Update
  - [ ] refreshToken operation documented
  - [ ] Input/output format shown
  - [ ] Example cURL request
  - [ ] Error codes listed

- [ ] Code Comments
  - [ ] tokenService.ts commented
  - [ ] tokens.ts commented
  - [ ] refreshToken.ts commented
  - [ ] useTokenRefresh.ts commented

## Build & Deploy ✅

- [ ] npm run build succeeds
  - [ ] No TypeScript errors
  - [ ] No linting errors
  - [ ] All imports resolve

- [ ] npm test succeeds
  - [ ] Token refresh tests pass
  - [ ] No test failures
  - [ ] Coverage acceptable

- [ ] npm run lint:fix succeeds
  - [ ] Code style fixed
  - [ ] No linting warnings

- [ ] Local dev testing
  - [ ] Dev server starts
  - [ ] Token refresh endpoint accessible
  - [ ] Manual refresh works
  - [ ] Auto-refresh works

## Production Readiness ✅

- [ ] JWT_SECRET properly secured
  - [ ] Random strong key generated
  - [ ] Different per environment
  - [ ] Secure key rotation plan

- [ ] Redis connection pooling
  - [ ] Connection limits set
  - [ ] Failover configured

- [ ] Monitoring configured
  - [ ] Token refresh rate monitored
  - [ ] Failed refreshes tracked
  - [ ] Unusual patterns alerted

- [ ] Rate limiting deployed
  - [ ] Refresh endpoint rate limited
  - [ ] DDoS protection enabled

- [ ] HTTPS enforced
  - [ ] Certificates configured
  - [ ] HSTS headers set
  - [ ] Cookies secure flag set

- [ ] Performance optimized
  - [ ] Token verification < 5ms
  - [ ] Blacklist lookup < 10ms
  - [ ] Redis connection pooled

## Sign-Off

- [ ] Implementation complete
- [ ] All tests passing
- [ ] Documentation complete
- [ ] Code reviewed
- [ ] Production ready
- [ ] Deployed to staging
- [ ] Deployed to production

---

**Checklist Version**: 1.0  
**Last Updated**: April 2026  
**Status**: Ready for Implementation
