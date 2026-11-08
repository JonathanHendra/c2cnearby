import { describe, expect, it } from 'vitest';

import { createTokenVerifier } from '../../src/auth/index.js';
import { DevTokenVerifier } from '../../src/auth/dev-verifier.js';
import { ConfigError, loadConfig } from '../../src/config/env.js';

const baseEnv = {
  NODE_ENV: 'test',
  PORT: '4000',
  DB_NAME: 'c2c_nearby_test',
  DB_USER: 'c2c',
  DB_PASSWORD: 'x',
} satisfies NodeJS.ProcessEnv;

describe('auth configuration', () => {
  it('defaults to the dev driver outside production', () => {
    const config = loadConfig({ ...baseEnv });
    expect(config.auth.driver).toBe('dev');
    expect(config.face.driver).toBe('mock');
    expect(createTokenVerifier(config)).toBeInstanceOf(DevTokenVerifier);
  });

  it('refuses the dev driver in production', () => {
    expect(() =>
      loadConfig({ ...baseEnv, NODE_ENV: 'production', AUTH_DRIVER: 'dev' }),
    ).toThrow(ConfigError);
  });

  it('defaults production to firebase and demands service-account credentials', () => {
    expect(() => loadConfig({ ...baseEnv, NODE_ENV: 'production' })).toThrow(/FIREBASE_PROJECT_ID/);
  });

  it('accepts explicit firebase credentials and unescapes the private key', () => {
    const config = loadConfig({
      ...baseEnv,
      NODE_ENV: 'production',
      AUTH_DRIVER: 'firebase',
      FIREBASE_PROJECT_ID: 'c2cnearby',
      FIREBASE_CLIENT_EMAIL: 'service@c2cnearby.iam.gserviceaccount.com',
      FIREBASE_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----',
    });

    expect(config.auth.driver).toBe('firebase');
    expect(config.auth.firebase.privateKey).toContain('\nABC\n');
  });
});
