import { IDocumentProvider } from '../../src/core/io/IDocumentProvider';

export class InMemoryDocumentProvider implements IDocumentProvider {
  private docs = new Map<string, { content: string; version: number }>();

  addDocument(uri: string, content: string, version: number = 1): void {
    this.docs.set(uri, { content, version });
  }

  updateDocument(uri: string, content: string): void {
    const doc = this.docs.get(uri);
    this.docs.set(uri, { content, version: doc ? doc.version + 1 : 1 });
  }

  removeDocument(uri: string): void {
    this.docs.delete(uri);
  }

  getContent(uri: string): string | undefined {
    return this.docs.get(uri)?.content;
  }

  getVersion(uri: string): number {
    return this.docs.get(uri)?.version ?? 0;
  }

  listUris(): string[] {
    return [...this.docs.keys()];
  }
}
