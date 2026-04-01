import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { IConfiguration } from '../io/IConfiguration';

export interface PSSConfig {
  include?: string[];
  exclude?: string[];
  standardVersion?: string;
  defines?: Record<string, string>;
  format?: {
    indentSize?: number;
    insertFinalNewline?: boolean;
  };
  lint?: {
    enabled?: boolean;
    rules?: Record<string, boolean>;
  };
}

/**
 * Load .pssconfig.json from a workspace root directory.
 */
export function loadPSSConfig(workspaceRoot: string): PSSConfig {
  const configPath = join(workspaceRoot, '.pssconfig.json');
  if (!existsSync(configPath)) return {};

  try {
    const content = readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as PSSConfig;
  } catch {
    return {};
  }
}

/**
 * Adapter: wrap a PSSConfig into an IConfiguration.
 */
export class PSSConfigAdapter implements IConfiguration {
  private config: PSSConfig;

  constructor(config: PSSConfig) {
    this.config = config;
  }

  get<T>(key: string, defaultValue: T): T {
    const parts = key.split('.');
    let current: any = this.config;
    if (parts[0] === 'pss') parts.shift();
    for (const part of parts) {
      if (current === undefined || current === null) return defaultValue;
      current = current[part];
    }
    return current !== undefined ? (current as T) : defaultValue;
  }
}
