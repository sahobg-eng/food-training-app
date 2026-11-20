import { useEffect, useState } from 'preact/hooks';
import type { ExerciseDetails } from '../../db/exercises';
import { formatMuscles, loadCatalog, searchCatalog, type CatalogEntry } from '../../domain/catalog';

/** The built-in exercise library, loaded on first use. Null while loading. */
export function useCatalog(): CatalogEntry[] | null {
  const [catalog, setCatalog] = useState<CatalogEntry[] | null>(null);
  useEffect(() => {
    let live = true;
    void loadCatalog().then((c) => live && setCatalog(c));
    return () => {
      live = false;
    };
  }, []);
  return catalog;
}

export const detailsFrom = (e: CatalogEntry): ExerciseDetails => ({
  primaryMuscles: e.p,
  secondaryMuscles: e.s,
  equipment: e.e,
  catalogId: e.id,
});

/** "From the exercise library" matches for what's being typed, each with its muscles. */
export function CatalogSuggestions(props: {
  query: string;
  /** Names already in the user's list, so they aren't suggested twice. */
  existingNames: string[];
  onPick: (entry: CatalogEntry) => void;
  title?: string;
  limit?: number;
}) {
  const catalog = useCatalog();
  if (!catalog) return null;
  const hits = searchCatalog(catalog, props.query, props.limit ?? 6, props.existingNames);
  if (hits.length === 0) return null;
  return (
    <div class="catalog">
      <p class="catalog-title">{props.title ?? 'From the exercise library'}</p>
      <ul class="list">
        {hits.map((e) => (
          <li key={e.id}>
            <button type="button" class="list-item catalog-item" onClick={() => props.onPick(e)}>
              <span class="grow">
                <span class="catalog-name">+ {e.n}</span>
                <span class="muted small">{formatMuscles(e.p, e.s)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Small muscle line under an exercise name. Renders nothing when there are none. */
export function MuscleLine({ primary, secondary }: { primary?: string[]; secondary?: string[] }) {
  const text = formatMuscles(primary as never, secondary as never);
  return text ? <span class="muscles small">{text}</span> : null;
}
