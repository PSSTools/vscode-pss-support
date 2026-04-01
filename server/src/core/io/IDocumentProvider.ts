export interface IDocumentProvider {
  getContent(uri: string): string | undefined;
  getVersion(uri: string): number;
  listUris(): string[];
}
