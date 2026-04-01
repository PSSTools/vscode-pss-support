import { IConfiguration } from '../../src/core/io/IConfiguration';

export class TestConfiguration implements IConfiguration {
  private values = new Map<string, unknown>();

  set<T>(key: string, value: T): void {
    this.values.set(key, value);
  }

  get<T>(key: string, defaultValue: T): T {
    if (this.values.has(key)) {
      return this.values.get(key) as T;
    }
    return defaultValue;
  }
}
