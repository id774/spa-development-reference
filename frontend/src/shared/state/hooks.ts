// frontend/src/shared/state/hooks.ts: data loading hooks
//
// Description:
// Small hooks for loading data: useResource for a value loaded on mount and
// when its key changes, and usePagedList for a cursor-paginated list loaded
// page by page on demand. Until a load finishes for the current key, the state
// is loading.
//
// Author: id774 (More info: https://id774.net)
// Source Code: https://github.com/id774/spa-development-reference
// License: The GPL version 3, or LGPL version 3 (Dual License).
// Contact: idnanashi@gmail.com
//
// Requirements:
// - Node.js 24 or later
// - TypeScript 5.9.3
// - React 19
// - See frontend/package.json for workspace dependencies
//
// Version History:
// v1.0 2026-10-03
//      Initial release.

import { useCallback, useEffect, useRef, useState } from 'react';

export type Resource<T> =
  { state: 'loading' } | { state: 'error'; error: unknown } | { state: 'ready'; data: T };

/** Keeps the latest callback available to effects without re-running them. */
function useLatest<T>(value: T) {
  const ref = useRef(value);
  useEffect(() => {
    ref.current = value;
  });
  return ref;
}

/**
 * Loads a value on mount and whenever `key` changes or `reload` is called.
 * Until the load for the current key finishes, the resource is `loading`.
 */
export function useResource<T>(load: () => Promise<T>, key: string) {
  const loadRef = useLatest(load);
  const [version, setVersion] = useState(0);
  const token = `${key}#${version}`;
  const [stored, setStored] = useState<{ token: string; value: Resource<T> } | null>(null);

  useEffect(() => {
    let active = true;
    loadRef
      .current()
      .then((data) => active && setStored({ token, value: { state: 'ready', data } }))
      .catch((error: unknown) => active && setStored({ token, value: { state: 'error', error } }));
    return () => {
      active = false;
    };
  }, [token, loadRef]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const set = useCallback(
    (data: T) => setStored({ token, value: { state: 'ready', data } }),
    [token],
  );
  const resource: Resource<T> =
    stored !== null && stored.token === token ? stored.value : { state: 'loading' };
  return { resource, reload, set };
}

export interface PageSource<T> {
  items: T[];
  nextCursor?: string | undefined;
}

interface PagedState<T> {
  token: string;
  items: T[];
  nextCursor: string | undefined;
  error: unknown;
  failed: boolean;
}

/** A cursor-paginated list: the first page on mount, further pages on demand. */
export function usePagedList<T>(
  loadPage: (cursor: string | undefined) => Promise<PageSource<T>>,
  key: string,
) {
  const loadRef = useLatest(loadPage);
  const [version, setVersion] = useState(0);
  const token = `${key}#${version}`;
  const [stored, setStored] = useState<PagedState<T> | null>(null);

  useEffect(() => {
    let active = true;
    loadRef
      .current(undefined)
      .then((page) => {
        if (active) {
          setStored({
            token,
            items: page.items,
            nextCursor: page.nextCursor,
            error: null,
            failed: false,
          });
        }
      })
      .catch((error: unknown) => {
        if (active) setStored({ token, items: [], nextCursor: undefined, error, failed: true });
      });
    return () => {
      active = false;
    };
  }, [token, loadRef]);

  const current = stored !== null && stored.token === token ? stored : null;
  const nextCursor = current?.nextCursor;

  const loadMore = useCallback(async () => {
    if (nextCursor === undefined) return;
    try {
      const page = await loadRef.current(nextCursor);
      setStored((previous) =>
        previous === null || previous.token !== token
          ? previous
          : { ...previous, items: [...previous.items, ...page.items], nextCursor: page.nextCursor },
      );
    } catch (error) {
      setStored((previous) =>
        previous === null || previous.token !== token
          ? previous
          : { ...previous, error, failed: true },
      );
    }
  }, [loadRef, nextCursor, token]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const state: 'loading' | 'ready' | 'error' =
    current === null ? 'loading' : current.failed ? 'error' : 'ready';
  return {
    items: current?.items ?? [],
    hasMore: nextCursor !== undefined,
    state,
    error: current?.error ?? null,
    loadMore,
    reload,
  };
}
