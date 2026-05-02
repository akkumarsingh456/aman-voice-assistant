import { useCallback, useEffect, useState } from "react";

const DB_NAME = "aman-alarm";
const STORE = "song";
const KEY = "current";

type StoredSong = {
  name: string;
  type: string;
  blob: Blob;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function readSong(): Promise<StoredSong | null> {
  if (typeof indexedDB === "undefined") return null;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve((req.result as StoredSong) ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function writeSong(song: StoredSong | null): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    if (song) store.put(song, KEY);
    else store.delete(KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Persists user-picked alarm song (audio file from device) in IndexedDB.
 * Returns helpers to set, clear, and get a fresh playable URL.
 */
export function useAlarmSound() {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    void readSong().then((s) => setName(s?.name ?? null));
  }, []);

  const setSong = useCallback(async (file: File) => {
    await writeSong({ name: file.name, type: file.type, blob: file });
    setName(file.name);
  }, []);

  const clearSong = useCallback(async () => {
    await writeSong(null);
    setName(null);
  }, []);

  const getObjectUrl = useCallback(async (): Promise<string | null> => {
    const s = await readSong();
    if (!s) return null;
    return URL.createObjectURL(s.blob);
  }, []);

  return { name, setSong, clearSong, getObjectUrl };
}
