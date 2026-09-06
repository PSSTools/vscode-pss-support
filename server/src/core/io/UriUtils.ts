/**
 * Minimal file-URI <-> path conversion.
 *
 * Deliberately not node's `url` module: `core/` stays free of node built-ins so
 * the same code runs over MemFileSystem with synthetic paths like '/ws/a.pss'.
 * Handles the two forms that actually occur here -- POSIX paths and Windows
 * drive paths -- and leaves anything else alone.
 */

/** Convert a filesystem path to a file:// URI. */
export function pathToUri(path: string): string {
  let p = path.replace(/\\/g, '/');
  if (!p.startsWith('/')) p = '/' + p;   // 'C:/x' -> '/C:/x'
  return 'file://' + p.split('/').map(encodeURIComponent).join('/');
}

/** Convert a file:// URI back to a filesystem path. Non-file URIs pass through. */
export function uriToPath(uri: string): string {
  if (!uri.startsWith('file://')) return uri;
  let p = decodeURIComponent(uri.slice('file://'.length));
  // Strip a leading slash from Windows drive paths: '/C:/x' -> 'C:/x'
  if (/^\/[a-zA-Z]:/.test(p)) p = p.slice(1);
  return p;
}

/** Join path segments with '/', collapsing duplicate separators and '.'/'..'. */
export function joinPath(...parts: string[]): string {
  return normalizePath(parts.filter(p => p.length > 0).join('/'));
}

/**
 * Collapse '.', '..', and duplicate separators. Node's `path` does this for the
 * real filesystem, but MemFileSystem keys are literal strings -- so paths must
 * be normalized before they are looked up, or '/a/b/../c' misses '/a/c'.
 */
export function normalizePath(path: string): string {
  const p = path.replace(/\\/g, '/');
  const absolute = p.startsWith('/');
  const out: string[] = [];

  for (const segment of p.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      // A leading '..' on a relative path has nothing to pop and must be kept.
      if (out.length > 0 && out[out.length - 1] !== '..') out.pop();
      else if (!absolute) out.push('..');
      continue;
    }
    out.push(segment);
  }

  return (absolute ? '/' : '') + out.join('/');
}
