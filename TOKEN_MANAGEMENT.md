# Token Management Guide

## Overview

VibeScan implements a secure JWT-based token refresh mechanism with token rotation and blacklisting. This guide explains how tokens work, how to use them, and best practices for security.

## Token Types

### Access Token (Short-lived)
- **Expiry**: 15 minutes (900 seconds)
- **Purpose**: Used to authenticate API requests
- **Security**: Contains minimal claims, frequently rotated
- **Storage**: In memory (frontend), passed in Authorization header

### Refresh Token (Long-lived)
- **Expiry**: 30 days (2,592,000 seconds)
- **Purpose**: Used to obtain new access tokens without re-authenticating
- **Security**: Sensitive - should be stored securely
- **Storage**: Secure HTTP-only cookie (preferred) or secure localStorage

## Token Structure

All tokens are JWTs with the following structure:
```
header.payload.signature
```

### Header
```json
{
  "alg": "HS256",
  "typ": "JWT"
}
```

### Payload (Access Token)
```json
{
  "userId": "user-123",
  "jti": "jti_user-123_unique-uuid",
  "iat": 1713024000,
  "exp": 1713024900,
  "type": "access"
}
```

### Payload (Refresh Token)
```json
{
  "userId": "user-123",
  "jti": "jti_user-123_unique-uuid",
  "iat": 1713024000,
  "exp": 1745559600,
  "type": "refresh"
}
```

## Token Rotation

Token rotation enhances security by automatically invalidating old refresh tokens when new ones are issued.

### How It Works
1. User calls the refresh endpoint with their refresh token
2. Server validates the refresh token
3. Server checks if token has been blacklisted (previously used)
4. Server generates a new access + refresh token pair
5. Server blacklists the old refresh token
6. User stores new tokens

### Benefits
- **Replay Attack Prevention**: Old tokens cannot be reused
- **Compromise Mitigation**: If a token is stolen, it only works once
- **Audit Trail**: Each token has a unique JTI for tracking

## Token Blacklist

When a refresh token is used, it's immediately blacklisted to prevent replay attacks.

### Storage
- **Backend**: Redis with TTL matching token expiry
- **Key Format**: `token_blacklist:${jti}`
- **TTL**: Automatically expires when token would have expired anyway

### Checking Blacklist
```typescript
const isBlacklisted = await isTokenBlacklisted(jti);
```

## API Operations

### Refresh Token Operation

**Endpoint**: `POST /api/v1/refresh-token` (or via Wasp action)

**Request**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (Success)**:
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 900
}
```

**Response (Error)**:
```json
{
  "error": "Invalid or expired refresh token"
}
```

## Client-Side Usage

### React Hook: `useTokenRefresh`

```typescript
import { useTokenRefresh } from './hooks/useTokenRefresh';

export function MyComponent() {
  const { performRefresh, handleUnauthorized } = useTokenRefresh();

  // Manual token refresh
  const refreshTokens = async () => {
    const newAccessToken = await performRefresh();
    if (newAccessToken) {
      console.log('Tokens refreshed successfully');
    }
  };

  // Handle 401 responses
  const handleApiError = async (error) => {
    if (error.status === 401) {
      const success = await handleUnauthorized();
      if (success) {
        // Retry request with new token
      } else {
        // Redirect to login
      }
    }
  };

  return (
    <button onClick={refreshTokens}>
      Refresh Token
    </button>
  );
}
```

### Automatic Token Refresh

The `useTokenRefresh` hook automatically schedules token refresh 5 minutes before expiry:

```typescript
// In App.tsx
import { useTokenRefresh } from './hooks/useTokenRefresh';

export default function App() {
  useTokenRefresh(); // Schedules automatic refresh

  return (
    // ... app content
  );
}
```

## Server-Side Usage

### Token Service API

```typescript
import {
  generateTokenPair,
  verifyRefreshToken,
  verifyAccessToken,
  blacklistToken,
  isTokenBlacklisted,
} from '@src/server/services/tokenService';

// Generate tokens for user
const tokens = await generateTokenPair('user-123');

// Verify refresh token
const payload = await verifyRefreshToken(token);
if (payload) {
  console.log('Refresh token is valid for user:', payload.userId);
}

// Check if token is blacklisted
const isBlacklisted = await isTokenBlacklisted(payload.jti);

// Blacklist a token
await blacklistToken(payload.jti, payload.exp);
```

## Configuration

Token parameters are centralized in `src/server/config/tokens.ts`:

```typescript
export const TOKEN_CONFIG = {
  ACCESS_TOKEN_EXPIRY: 15 * 60,        // 15 minutes
  REFRESH_TOKEN_EXPIRY: 30 * 24 * 60 * 60, // 30 days
  REFRESH_TOKEN_ROTATION: true,        // Enable rotation
  ALGORITHM: 'HS256',                  // Signing algorithm
  TOKEN_TYPE_ACCESS: 'Bearer',
  TOKEN_TYPE_REFRESH: 'Refresh',
};
```

### Adjusting Token Expiry

To change token expiry times, modify `TOKEN_CONFIG` in `src/server/config/tokens.ts`:

```typescript
// Example: 30 minute access tokens, 60 day refresh tokens
export const TOKEN_CONFIG = {
  ACCESS_TOKEN_EXPIRY: 30 * 60,        // 30 minutes
  REFRESH_TOKEN_EXPIRY: 60 * 24 * 60 * 60, // 60 days
  // ... rest of config
};
```

## Security Best Practices

### 1. HTTPS Only
Always use HTTPS in production to prevent token interception:

```typescript
// Middleware should enforce HTTPS
if (!request.secure && process.env.NODE_ENV === 'production') {
  return response.redirect(301, `https://${request.host}${request.url}`);
}
```

### 2. Secure Token Storage
- **Access Tokens**: Store in memory or sessionStorage (shorter lived, safer)
- **Refresh Tokens**: Store in HTTP-only cookies or secure localStorage
- Never log tokens to console or error reporting

### 3. CORS Configuration
Restrict token endpoints to your domain:

```typescript
// In your API configuration
cors: {
  origin: ['https://yourapp.com'],
  credentials: true,
  maxAge: 3600,
}
```

### 4. Token Validation
Always validate token signature and expiry:

```typescript
// ✅ DO: Full validation
const payload = await verifyRefreshToken(token);
if (!payload) {
  throw new HttpError(401, 'Invalid token');
}

// ❌ DON'T: Skip signature verification
const payload = JSON.parse(base64Decode(token.split('.')[1]));
```

### 5. Environment Variables
Never commit JWT_SECRET to version control:

```bash
# .env.server (in .gitignore)
JWT_SECRET=your-strong-random-key-here
```

Generate strong secrets:
```bash
openssl rand -base64 32
```

### 6. Rate Limiting
Implement rate limiting on token refresh endpoint:

```typescript
// Limit to 10 refreshes per hour per user
const rateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  keyGenerator: (req) => req.user.id,
});
```

### 7. Token Blacklist Cleanup
Redis automatically cleans up blacklisted tokens when they expire (via TTL).

### 8. Logout
Implement logout by:
1. Blacklisting the current refresh token
2. Clearing tokens from client storage
3. Invalidating server-side sessions

```typescript
export async function logout(userId: string) {
  // Blacklist user's refresh tokens
  await blacklistToken(jti, expiryTimestamp);
  
  // Clear session
  await session.destroy();
}
```

## Monitoring & Debugging

### Log Token Events
```typescript
console.log('Token refreshed for user:', payload.userId);
console.log('Token JTI:', payload.jti);
console.log('Token expires at:', new Date(payload.exp * 1000));
```

### Monitor Refresh Rates
Track token refresh frequency to detect suspicious activity:

```typescript
// Alert if user refreshes token excessively
if (refreshCount > 100) {
  logger.warn(`Unusual refresh rate for user ${userId}`);
  // Potentially revoke session
}
```

### Check Token Validity
```bash
# Decode JWT at jwt.io or similar tool
# Verify signature matches your JWT_SECRET
# Check exp claim is in future
```

## Troubleshooting

### Issue: "JWT_SECRET environment variable is not set"
**Solution**: Add JWT_SECRET to `.env.server`:
```bash
JWT_SECRET=dev-jwt-secret-change-in-production
```

### Issue: "Token refresh returns 401 Unauthorized"
**Solution**: Check that:
1. Refresh token is valid and not expired
2. Refresh token hasn't been blacklisted
3. Token signature matches (JWT_SECRET is correct)

### Issue: "Refresh token expires too quickly"
**Solution**: Adjust TOKEN_CONFIG.REFRESH_TOKEN_EXPIRY in `tokens.ts`

### Issue: "Access tokens not auto-refreshing"
**Solution**: Ensure `useTokenRefresh` hook is initialized in App component

## Testing

Run token refresh tests:
```bash
npm test -- tests/tokenRefresh.test.ts
```

Key test scenarios:
- ✅ Token generation with correct format
- ✅ Token verification and validation
- ✅ Token rotation on refresh
- ✅ Blacklist prevents token reuse
- ✅ Expired tokens are rejected
- ✅ Tampered tokens are rejected

## Related Documentation

- [OPERATIONS.md](OPERATIONS.md) - API operations reference
- [TOKEN_VALIDATION.md](TOKEN_VALIDATION.md) - Token validation checklist
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8949)
- [OWASP Token Management](https://owasp.org/www-community/attacks/JWT)

---

**Last Updated**: April 2026  
**Token Version**: 1.0  
**Algorithm**: HS256  
**Status**: Production Ready
