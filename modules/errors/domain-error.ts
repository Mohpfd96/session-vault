export type DomainErrorCode =
  | 'PermissionDenied'
  | 'SessionNotFound'
  | 'TabNotBound'
  | 'RuleCapacityExceeded'
  | 'DomainNotManaged'
  | 'MigrationFailed'
  | 'StorageCorrupted'
  | 'CompatibilityLimited'
  | 'IsolationUncertain'
  | 'ValidationFailed'
  | 'EncryptionFailed'
  | 'DecryptionFailed';

export class DomainError extends Error {
  public override readonly name = 'DomainError';

  public constructor(
    public readonly code: DomainErrorCode,
    message: string,
    public readonly isolationSafe: boolean,
    public readonly recommendedAction: string,
    options?: { cause?: unknown },
  ) {
    super(message, options);
  }

  public toUserMessage(): string {
    const safety = this.isolationSafe
      ? 'Isolation is still safe (fail-closed).'
      : 'Isolation could not be proven; cookies are stripped.';
    return `${this.message} ${safety} ${this.recommendedAction}`;
  }
}

export function permissionDenied(detail: string): DomainError {
  return new DomainError(
    'PermissionDenied',
    detail,
    true,
    'Grant host access for this site in the extension, then retry.',
  );
}

export function sessionNotFound(sessionId: string): DomainError {
  return new DomainError(
    'SessionNotFound',
    `Session ${sessionId} was not found.`,
    true,
    'Choose another session or create a new one.',
  );
}

export function tabNotBound(tabId: number): DomainError {
  return new DomainError(
    'TabNotBound',
    `Tab ${tabId} is not bound to a session.`,
    true,
    'Assign this tab to a session before continuing.',
  );
}

export function ruleCapacityExceeded(): DomainError {
  return new DomainError(
    'RuleCapacityExceeded',
    'Isolation paused because the browser rule limit was reached.',
    true,
    'Close unused isolated tabs or simplify path-specific cookies, then retry.',
  );
}

export function domainNotManaged(host: string): DomainError {
  return new DomainError(
    'DomainNotManaged',
    `${host} is not a managed domain.`,
    true,
    'Enable isolation for this site from the popup.',
  );
}

export function migrationFailed(detail: string): DomainError {
  return new DomainError(
    'MigrationFailed',
    detail,
    true,
    'Keep the extension open and retry. If it continues, export a backup and reinstall.',
  );
}

export function storageCorrupted(detail: string): DomainError {
  return new DomainError(
    'StorageCorrupted',
    detail,
    true,
    'Do not guess a session. Restore from a backup if available.',
  );
}

export function isolationUncertain(detail: string): DomainError {
  return new DomainError(
    'IsolationUncertain',
    detail,
    true,
    'This tab will not send session cookies until isolation is proven again.',
  );
}

export function validationFailed(detail: string): DomainError {
  return new DomainError(
    'ValidationFailed',
    detail,
    true,
    'Reject the import or message and try a valid payload.',
  );
}
