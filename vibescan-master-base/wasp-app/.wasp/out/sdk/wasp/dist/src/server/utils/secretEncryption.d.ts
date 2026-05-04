/**
 * Encrypt a secret using AES-256-GCM.
 * Buffer layout: IV (16 bytes) + Auth Tag (16 bytes) + Ciphertext.
 */
export declare function encryptSecret(secret: string): Buffer;
/**
 * Decrypt a secret previously encrypted with `encryptSecret`.
 */
export declare function decryptSecret(encryptedBuffer: Buffer): string;
//# sourceMappingURL=secretEncryption.d.ts.map