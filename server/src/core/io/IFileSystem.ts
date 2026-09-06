/**
 * Filesystem seam. `core/` reaches the disk only through this interface so that
 * the whole analysis pipeline can be driven from memory in tests.
 *
 * Paths are plain filesystem paths, not URIs. Directory separators are
 * normalized to '/' internally, so tests can use POSIX paths on any platform.
 */
export interface IFileSystem {
  /** Read a file's text, or undefined if it does not exist / is unreadable. */
  readFile(path: string): string | undefined;
  /** List entry names (not paths) directly under a directory; [] if not a directory. */
  readDir(path: string): string[];
  /** True if the path exists (file or directory). */
  exists(path: string): boolean;
  /** True if the path exists and is a directory. */
  isDirectory(path: string): boolean;
}
