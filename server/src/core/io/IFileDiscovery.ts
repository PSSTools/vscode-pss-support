export interface IFileDiscovery {
  discoverFiles(rootUri: string, pattern: string): Promise<string[]>;
}
