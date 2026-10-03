/**
 * Videos are far too big for localStorage, so the files live in IndexedDB and the
 * design only stores a "media:<id>" reference. At runtime each id maps to an object URL.
 */
import { uid } from "./factory";

const DB = "postcraft-media";
const STORE = "files";
const urls = new Map<string, string>();

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function putMedia(blob: Blob): Promise<string> {
  const id = uid() + uid();
  urls.set(id, URL.createObjectURL(blob));
  try {
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(blob, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    /* private mode: still works for this session */
  }
  return "media:" + id;
}

/** Load stored files for these references (call before showing a saved design). */
export async function restoreMedia(refs: string[]): Promise<void> {
  const ids = refs.filter((r) => r.startsWith("media:")).map((r) => r.slice(6)).filter((id) => !urls.has(id));
  if (!ids.length) return;
  try {
    const db = await open();
    await Promise.all(
      ids.map(
        (id) =>
          new Promise<void>((resolve) => {
            const req = db.transaction(STORE).objectStore(STORE).get(id);
            req.onsuccess = () => {
              if (req.result) urls.set(id, URL.createObjectURL(req.result as Blob));
              resolve();
            };
            req.onerror = () => resolve();
          }),
      ),
    );
  } catch {
    /* ignore */
  }
}

/** Turn an element src into something a <video>/<img> can load. */
export function resolveSrc(src?: string): string | undefined {
  if (!src) return undefined;
  if (src.startsWith("media:")) return urls.get(src.slice(6));
  return src;
}
