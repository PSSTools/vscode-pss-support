import { IFileDiscovery } from '../../src/core/io/IFileDiscovery';

export class InMemoryFileDiscovery implements IFileDiscovery {
  private files: string[] = [];

  addFile(uri: string): void {
    this.files.push(uri);
  }

  async discoverFiles(_rootUri: string, _pattern: string): Promise<string[]> {
    return this.files;
  }
}
