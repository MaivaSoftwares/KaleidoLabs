declare module 'speakeasy' {
  interface GeneratedSecret {
    base32: string;
    ascii: string;
    hex: string;
    qr: string;
    otpauth_url: string;
    name?: string;
  }

  interface GenerateSecretOptions {
    length?: number;
    name?: string;
  }

  interface TotpOptions {
    secret: string;
    encoding?: 'base32' | 'hex' | 'ascii';
    token?: string;
    counter?: number;
    window?: number;
    digits?: 6 | 8;
    algorithm?: 'sha1' | 'sha256' | 'sha512';
  }

  export function generateSecret(options?: GenerateSecretOptions): GeneratedSecret;
  export const totp: {
    (options: TotpOptions): string;
    verify(options: TotpOptions): boolean;
  };
}
