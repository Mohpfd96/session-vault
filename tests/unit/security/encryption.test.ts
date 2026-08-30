import { describe, expect, it } from 'vitest';
import { DomainError } from '../../../modules/errors/domain-error.ts';
import {
  decryptBackup,
  encryptBackup,
  PBKDF2_ITERATIONS,
} from '../../../modules/security/encryption.ts';

describe('encryption envelope', () => {
  it('roundtrips plaintext with AES-GCM + PBKDF2', async () => {
    const plaintext = JSON.stringify({ format: 'sessionvault-backup', schemaVersion: 1 });
    const envelope = await encryptBackup(plaintext, 'correct-passphrase');

    expect(envelope.format).toBe('sessionvault-encrypted');
    expect(envelope.iterations).toBe(PBKDF2_ITERATIONS);
    expect(envelope.kdf).toBe('PBKDF2');
    expect(envelope.algo).toBe('AES-GCM');

    const decrypted = await decryptBackup(envelope, 'correct-passphrase');
    expect(decrypted).toBe(plaintext);
  });

  it('throws on wrong passphrase', async () => {
    const envelope = await encryptBackup('secret payload', 'correct-passphrase');
    await expect(decryptBackup(envelope, 'wrong-passphrase')).rejects.toBeInstanceOf(
      DomainError,
    );
  });

  it('fails decrypt when ciphertext is tampered', async () => {
    const envelope = await encryptBackup('secret payload', 'correct-passphrase');
    const tampered = {
      ...envelope,
      ciphertextB64: `${envelope.ciphertextB64.slice(0, -2)}aa`,
    };
    await expect(decryptBackup(tampered, 'correct-passphrase')).rejects.toMatchObject({
      code: 'DecryptionFailed',
    });
  });
});
