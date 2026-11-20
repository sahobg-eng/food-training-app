import { useEffect, useState } from 'preact/hooks';

/** Current route path from the URL hash, e.g. "#/train/123" -> "/train/123". */
function readPath(): string {
  const raw = window.location.hash.replace(/^#/, '');
  return raw.startsWith('/') ? raw : '/';
}

let current = readPath();
let previous: string | null = null;
if (typeof window !== 'undefined')
  window.addEventListener('hashchange', () => {
    previous = current;
    current = readPath();
  });

/** The route shown before the current one (null right after the app opened). */
export function previousPath(): string | null {
  return previous;
}

export function navigate(path: string): void {
  window.location.hash = path;
}

export function useRoute(): string {
  const [path, setPath] = useState(readPath);
  useEffect(() => {
    const onChange = () => setPath(readPath());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return path;
}

/**
 * Match a path against a pattern like "/workout/:id".
 * Returns the params on a match, or null.
 */
export function match(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split('/').filter(Boolean);
  const s = path.split('/').filter(Boolean);
  if (p.length !== s.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(':')) params[p[i].slice(1)] = decodeURIComponent(s[i]);
    else if (p[i] !== s[i]) return null;
  }
  return params;
}
