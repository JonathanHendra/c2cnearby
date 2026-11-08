import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const srcRoot = fileURLToPath(new URL('../../src', import.meta.url));
const backendRoot = fileURLToPath(new URL('../..', import.meta.url));

function collectTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = join(directory, entry);
    if (statSync(fullPath).isDirectory()) {
      return collectTypeScriptFiles(fullPath);
    }
    return fullPath.endsWith('.ts') ? [fullPath] : [];
  });
}

const FORBIDDEN_PATTERNS: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
  { pattern: /\.sync\s*\(/, reason: 'sequelize.sync() dilarang' },
  { pattern: /\balter\s*:\s*true/, reason: 'sync({ alter: true }) dilarang' },
  { pattern: /\bforce\s*:\s*true/, reason: 'sync({ force: true }) dilarang' },
  { pattern: /from ['"]@prisma\//, reason: 'Prisma dilarang' },
  { pattern: /from ['"]typeorm['"]/, reason: 'TypeORM dilarang' },
  { pattern: /from ['"]pg['"]/, reason: 'PostgreSQL driver dilarang' },
];

describe('schema ownership', () => {
  it('contains no schema synchronization or alternative ORM usage in src/', () => {
    const files = collectTypeScriptFiles(srcRoot);
    expect(files.length).toBeGreaterThan(0);

    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
        if (pattern.test(content)) {
          violations.push(`${file.replace(srcRoot, 'src')}: ${reason}`);
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it('depends only on sequelize for persistence', () => {
    const pkg = JSON.parse(readFileSync(join(backendRoot, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const packages = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };

    expect(packages['sequelize']).toBeDefined();
    expect(packages['mysql2']).toBeDefined();
    expect(packages['@prisma/client']).toBeUndefined();
    expect(packages['typeorm']).toBeUndefined();
    expect(packages['pg']).toBeUndefined();
  });

  it('keeps association registration in a single module', () => {
    const files = collectTypeScriptFiles(srcRoot);
    const defining = files.filter((file) =>
      /\.(hasOne|hasMany|belongsTo)\s*\(/.test(readFileSync(file, 'utf8')),
    );
    expect(defining.map((file) => file.replace(srcRoot, 'src'))).toEqual([
      'src/database/associations.ts',
    ]);
  });
});
