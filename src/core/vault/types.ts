/**
 * Options for configuring the local credential vault.
 */
export interface VaultOptions {
  customHome?: string;
}

/**
 * Masked view of a stored credential entry.
 */
export interface VaultKeySummary {
  key: string;
  maskedValue: string;
}

/**
 * Payload schema for registering or updating a secret.
 */
export interface SetSecretPayload {
  key: string;
  value: string;
}
