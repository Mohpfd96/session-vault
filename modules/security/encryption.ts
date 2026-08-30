import { DomainError } from '../errors/domain-error.ts';

export const PBKDF2_ITERATIONS = 310_000;

export type EncryptedEnvelope = {
  readonly format: 'sessionvault-encrypted';
  readonly formatVersion: 1;
  readonly kdf: 'PBKDF2';
  readonly kdfHash: 'SHA-256';
  readonly iterations: typeof PBKDF2_ITERATIONS;
  readonly saltB64: string;
  readonly algo: 'AES-GCM';
  readonly ivB64: string;
  readonly ciphertextB64: string;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function getCrypto(): Crypto {
  const cryptoApi = globalThis.crypto;
  if (cryptoApi?.subtle === undefined) {
    throw new DomainError(
      'EncryptionFailed',
      'Web Crypto is not available in this environment.',
      true,
      'Run in a browser or Node 18+ with Web Crypto enabled.',
    );
  }
  return cryptoApi;
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(value, 'base64'));
  }
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const cryptoApi = getCrypto();
  const baseKey = await cryptoApi.subtle.importKey(
    'raw',
    textEncoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );

  return cryptoApi.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(salt),
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptBackup(
  plaintext: string,
  passphrase: string,
): Promise<EncryptedEnvelope> {
  if (passphrase.length === 0) {
    throw new DomainError(
      'EncryptionFailed',
      'Passphrase must not be empty.',
      true,
      'Choose a non-empty passphrase.',
    );
  }

  try {
    const cryptoApi = getCrypto();
    const salt = cryptoApi.getRandomValues(new Uint8Array(16));
    const iv = cryptoApi.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(passphrase, salt, PBKDF2_ITERATIONS);
    const ciphertext = await cryptoApi.subtle.encrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      key,
      textEncoder.encode(plaintext),
    );

    return {
      format: 'sessionvault-encrypted',
      formatVersion: 1,
      kdf: 'PBKDF2',
      kdfHash: 'SHA-256',
      iterations: PBKDF2_ITERATIONS,
      saltB64: bytesToBase64(salt),
      algo: 'AES-GCM',
      ivB64: bytesToBase64(iv),
      ciphertextB64: bytesToBase64(new Uint8Array(ciphertext)),
    };
  } catch (error) {
    if (error instanceof DomainError) {
      throw error;
    }
    throw new DomainError(
      'EncryptionFailed',
      'Could not encrypt backup.',
      true,
      'Retry with a valid passphrase.',
      { cause: error },
    );
  }
}

export async function decryptBackup(
  envelope: EncryptedEnvelope,
  passphrase: string,
): Promise<string> {
  if (passphrase.length === 0) {
    throw new DomainError(
      'DecryptionFailed',
      'Passphrase must not be empty.',
      true,
      'Enter the backup passphrase.',
    );
  }

  if (envelope.format !== 'sessionvault-encrypted' || envelope.formatVersion !== 1) {
    throw new DomainError(
      'DecryptionFailed',
      'Unsupported encrypted backup format.',
      true,
      'Import a Session Vault encrypted backup.',
    );
  }

  try {
    const cryptoApi = getCrypto();
    const salt = base64ToBytes(envelope.saltB64);
    const iv = base64ToBytes(envelope.ivB64);
    const ciphertext = base64ToBytes(envelope.ciphertextB64);
    const key = await deriveKey(passphrase, salt, envelope.iterations);
    const plaintext = await cryptoApi.subtle.decrypt(
      { name: 'AES-GCM', iv: toArrayBuffer(iv) },
      key,
      toArrayBuffer(ciphertext),
    );
    return textDecoder.decode(plaintext);
  } catch (error) {
    if (error instanceof DomainError) {
      throw error;
    }
    throw new DomainError(
      'DecryptionFailed',
      'Could not decrypt backup. Wrong passphrase or corrupted file.',
      true,
      'Verify the passphrase and try again.',
      { cause: error },
    );
  }
}

export function parseEncryptedEnvelope(value: unknown): EncryptedEnvelope {
  if (typeof value !== 'object' || value === null) {
    throw new DomainError(
      'ValidationFailed',
      'Encrypted backup must be a JSON object.',
      true,
      'Choose a valid .sessionvault file.',
    );
  }

  const record = value as Record<string, unknown>;
  const required = [
    'format',
    'formatVersion',
    'kdf',
    'kdfHash',
    'iterations',
    'saltB64',
    'algo',
    'ivB64',
    'ciphertextB64',
  ] as const;

  for (const key of required) {
    if (typeof record[key] !== 'string' && typeof record[key] !== 'number') {
      throw new DomainError(
        'ValidationFailed',
        `Encrypted backup field "${key}" is missing or invalid.`,
        true,
        'Choose a valid .sessionvault file.',
      );
    }
  }

  return record as EncryptedEnvelope;
}
