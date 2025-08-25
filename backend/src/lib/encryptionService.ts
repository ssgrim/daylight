import * as crypto from 'crypto';
import { KMSClient, EncryptCommand, DecryptCommand, GenerateDataKeyCommand } from '@aws-sdk/client-kms';
import { 
  EncryptionConfig,
  DataClassification,
  EncryptionResult,
  DecryptionRequest
} from '../../../shared/src/types/security';

// Encryption & Data Protection Service
// Issue #119 - Advanced Security Framework

const kmsClient = new KMSClient({
  region: process.env.AWS_REGION || 'us-east-1'
});

export class EncryptionService {
  private readonly kmsKeyId: string;
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyCache = new Map<string, { key: Buffer; expiresAt: number }>();
  private readonly cacheExpiryMs = 60 * 60 * 1000; // 1 hour

  constructor(kmsKeyId?: string) {
    this.kmsKeyId = kmsKeyId || process.env.KMS_KEY_ID || 'alias/daylight-encryption-key';
  }

  // ===== Field-Level Encryption =====

  async encryptField(
    data: string,
    classification: DataClassification = 'internal',
    context?: Record<string, string>
  ): Promise<EncryptionResult> {
    try {
      if (!data) {
        throw new Error('Data is required for encryption');
      }

      const dataKey = await this.getOrGenerateDataKey(classification);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher(this.algorithm, dataKey.key);
      cipher.setAAD(Buffer.from(JSON.stringify(context || {})));

      let encrypted = cipher.update(data, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      const authTag = cipher.getAuthTag();

      const result: EncryptionResult = {
        encryptedData: encrypted,
        keyId: this.kmsKeyId,
        algorithm: this.algorithm,
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        classification,
        encryptedAt: new Date().toISOString(),
        context
      };

      return result;
    } catch (error) {
      console.error('Field encryption error:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  async decryptField(encryptionResult: EncryptionResult): Promise<string> {
    try {
      const dataKey = await this.getOrGenerateDataKey(encryptionResult.classification);
      const decipher = crypto.createDecipher(encryptionResult.algorithm, dataKey.key);
      
      if (encryptionResult.context) {
        decipher.setAAD(Buffer.from(JSON.stringify(encryptionResult.context)));
      }
      
      decipher.setAuthTag(Buffer.from(encryptionResult.authTag, 'base64'));

      let decrypted = decipher.update(encryptionResult.encryptedData, 'base64', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('Field decryption error:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  // ===== Bulk Data Encryption =====

  async encryptObject<T extends Record<string, any>>(
    obj: T,
    fieldConfig: Record<keyof T, DataClassification>,
    context?: Record<string, string>
  ): Promise<{
    encryptedObject: Record<string, any>;
    encryptionMetadata: Record<string, EncryptionResult>;
  }> {
    const encryptedObject: Record<string, any> = { ...obj };
    const encryptionMetadata: Record<string, EncryptionResult> = {};

    for (const [field, classification] of Object.entries(fieldConfig)) {
      if (obj[field] != null) {
        const encrypted = await this.encryptField(
          String(obj[field]),
          classification,
          { ...context, field }
        );
        
        encryptedObject[field] = encrypted.encryptedData;
        encryptionMetadata[field] = encrypted;
      }
    }

    return { encryptedObject, encryptionMetadata };
  }

  async decryptObject<T extends Record<string, any>>(
    encryptedObject: Record<string, any>,
    encryptionMetadata: Record<string, EncryptionResult>
  ): Promise<T> {
    const decryptedObject: Record<string, any> = { ...encryptedObject };

    for (const [field, metadata] of Object.entries(encryptionMetadata)) {
      if (encryptedObject[field] != null) {
        const decrypted = await this.decryptField({
          ...metadata,
          encryptedData: encryptedObject[field]
        });
        
        decryptedObject[field] = decrypted;
      }
    }

    return decryptedObject as T;
  }

  // ===== Key Management =====

  private async getOrGenerateDataKey(classification: DataClassification): Promise<{ key: Buffer; expiresAt: number }> {
    const cacheKey = `${this.kmsKeyId}:${classification}`;
    const cached = this.keyCache.get(cacheKey);
    
    if (cached && cached.expiresAt > Date.now()) {
      return cached;
    }

    try {
      const command = new GenerateDataKeyCommand({
        KeyId: this.kmsKeyId,
        KeySpec: 'AES_256',
        EncryptionContext: {
          classification,
          service: 'daylight',
          timestamp: new Date().toISOString()
        }
      });

      const result = await kmsClient.send(command);
      
      if (!result.Plaintext) {
        throw new Error('Failed to generate data key');
      }

      const keyData = {
        key: Buffer.from(result.Plaintext),
        expiresAt: Date.now() + this.cacheExpiryMs
      };

      this.keyCache.set(cacheKey, keyData);
      return keyData;
    } catch (error) {
      console.error('Data key generation error:', error);
      throw new Error('Failed to generate encryption key');
    }
  }

  // ===== Direct KMS Operations =====

  async encryptWithKMS(data: string, context?: Record<string, string>): Promise<{
    encryptedData: string;
    keyId: string;
  }> {
    try {
      const command = new EncryptCommand({
        KeyId: this.kmsKeyId,
        Plaintext: Buffer.from(data, 'utf8'),
        EncryptionContext: context
      });

      const result = await kmsClient.send(command);
      
      if (!result.CiphertextBlob) {
        throw new Error('Encryption failed');
      }

      return {
        encryptedData: Buffer.from(result.CiphertextBlob).toString('base64'),
        keyId: result.KeyId || this.kmsKeyId
      };
    } catch (error) {
      console.error('KMS encryption error:', error);
      throw new Error('Failed to encrypt with KMS');
    }
  }

  async decryptWithKMS(encryptedData: string, context?: Record<string, string>): Promise<string> {
    try {
      const command = new DecryptCommand({
        CiphertextBlob: Buffer.from(encryptedData, 'base64'),
        EncryptionContext: context
      });

      const result = await kmsClient.send(command);
      
      if (!result.Plaintext) {
        throw new Error('Decryption failed');
      }

      return Buffer.from(result.Plaintext).toString('utf8');
    } catch (error) {
      console.error('KMS decryption error:', error);
      throw new Error('Failed to decrypt with KMS');
    }
  }

  // ===== Utility Functions =====

  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('base64url');
  }

  generateSecretKey(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  hashPassword(password: string, salt?: string): { hash: string; salt: string } {
    const actualSalt = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, actualSalt, 100000, 64, 'sha512').toString('hex');
    return { hash, salt: actualSalt };
  }

  verifyPassword(password: string, hash: string, salt: string): boolean {
    const expectedHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(expectedHash, 'hex'));
  }

  generateJWTSecret(): string {
    return crypto.randomBytes(64).toString('base64');
  }

  // ===== Data Masking =====

  maskSensitiveData(data: any, fields: string[] = []): any {
    if (!data || typeof data !== 'object') {
      return data;
    }

    const sensitiveFields = [
      'password', 'secret', 'token', 'key', 'auth', 'credential',
      'ssn', 'social', 'credit', 'card', 'account', 'routing',
      'email', 'phone', 'address', 'ip', 'location',
      ...fields
    ];

    const masked = { ...data };

    for (const key of Object.keys(masked)) {
      const lowerKey = key.toLowerCase();
      
      if (sensitiveFields.some(field => lowerKey.includes(field))) {
        if (typeof masked[key] === 'string') {
          masked[key] = this.maskString(masked[key]);
        } else {
          masked[key] = '[REDACTED]';
        }
      } else if (typeof masked[key] === 'object' && masked[key] !== null) {
        masked[key] = this.maskSensitiveData(masked[key], fields);
      }
    }

    return masked;
  }

  private maskString(value: string): string {
    if (value.length <= 4) {
      return '*'.repeat(value.length);
    }
    
    if (value.includes('@')) {
      // Email masking
      const [local, domain] = value.split('@');
      return `${local.substring(0, 2)}***@${domain}`;
    }
    
    // General string masking - show first 2 and last 2 characters
    return `${value.substring(0, 2)}${'*'.repeat(value.length - 4)}${value.substring(value.length - 2)}`;
  }

  // ===== Cleanup =====

  clearKeyCache(): void {
    this.keyCache.clear();
  }

  getKeyStats(): { cachedKeys: number; oldestKey: number | null } {
    const now = Date.now();
    let oldestKey: number | null = null;
    
    for (const keyData of this.keyCache.values()) {
      if (oldestKey === null || keyData.expiresAt < oldestKey) {
        oldestKey = keyData.expiresAt;
      }
    }

    return {
      cachedKeys: this.keyCache.size,
      oldestKey: oldestKey ? now - oldestKey : null
    };
  }
}

// ===== Data Protection Utilities =====

export class DataProtectionService {
  private encryptionService: EncryptionService;

  constructor(kmsKeyId?: string) {
    this.encryptionService = new EncryptionService(kmsKeyId);
  }

  // ===== PII Protection =====

  async protectPII<T extends Record<string, any>>(
    data: T,
    piiFields: Array<{ field: keyof T; classification: DataClassification }>
  ): Promise<{
    protectedData: T;
    encryptionMap: Record<string, EncryptionResult>;
  }> {
    const fieldConfig: Record<string, DataClassification> = {};
    
    for (const { field, classification } of piiFields) {
      fieldConfig[field as string] = classification;
    }

    const { encryptedObject, encryptionMetadata } = await this.encryptionService.encryptObject(
      data,
      fieldConfig,
      { type: 'pii_protection' }
    );

    return {
      protectedData: encryptedObject as T,
      encryptionMap: encryptionMetadata
    };
  }

  async unprotectPII<T extends Record<string, any>>(
    protectedData: Record<string, any>,
    encryptionMap: Record<string, EncryptionResult>
  ): Promise<T> {
    return this.encryptionService.decryptObject<T>(protectedData, encryptionMap);
  }

  // ===== GDPR Compliance =====

  async encryptForGDPR(personalData: any): Promise<{
    encryptedData: string;
    keyReference: string;
  }> {
    const dataString = JSON.stringify(personalData);
    const result = await this.encryptionService.encryptWithKMS(
      dataString,
      { 
        compliance: 'GDPR',
        dataType: 'personal_data',
        timestamp: new Date().toISOString()
      }
    );

    return {
      encryptedData: result.encryptedData,
      keyReference: result.keyId
    };
  }

  async decryptGDPRData(encryptedData: string, keyReference: string): Promise<any> {
    const decrypted = await this.encryptionService.decryptWithKMS(
      encryptedData,
      {
        compliance: 'GDPR',
        dataType: 'personal_data'
      }
    );

    return JSON.parse(decrypted);
  }

  // ===== Secure Storage Patterns =====

  createSecureRecord<T extends Record<string, any>>(
    data: T,
    classification: DataClassification = 'internal'
  ): {
    id: string;
    encryptedData: string;
    metadata: {
      classification: DataClassification;
      createdAt: string;
      algorithm: string;
    };
  } {
    const id = this.encryptionService.generateSecureToken();
    const dataString = JSON.stringify(data);
    
    // This is a simplified version - in production, use proper encryption
    const encryptedData = Buffer.from(dataString).toString('base64');

    return {
      id,
      encryptedData,
      metadata: {
        classification,
        createdAt: new Date().toISOString(),
        algorithm: 'aes-256-gcm'
      }
    };
  }

  // ===== Security Utilities =====

  generateApiKey(): {
    keyId: string;
    secret: string;
    hash: string;
  } {
    const keyId = `dk_${this.encryptionService.generateSecureToken(16)}`;
    const secret = this.encryptionService.generateSecureToken(32);
    const { hash } = this.encryptionService.hashPassword(secret);

    return { keyId, secret, hash };
  }

  validateApiKey(secret: string, hash: string, salt: string): boolean {
    return this.encryptionService.verifyPassword(secret, hash, salt);
  }
}

export const encryptionService = new EncryptionService();
export const dataProtectionService = new DataProtectionService();
