
import { Product } from '../types';

const DB_NAME = 'PimpitCache';
const STORE_NAME = 'products';
const DB_VERSION = 1;
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

interface CacheEntry {
  id: string;
  data: Product[];
  timestamp: number;
}

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
        reject(new Error("IndexedDB is not supported"));
        return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

export const saveProductsToCache = async (products: Product[]): Promise<void> => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    const entry: CacheEntry = {
      id: 'allProducts',
      data: products,
      timestamp: Date.now(),
    };

    store.put(entry);
    
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.error('Error saving to cache:', e);
  }
};

export const getProductsFromCache = async (): Promise<Product[] | null> => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get('allProducts');

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const entry: CacheEntry = request.result;
        if (!entry) {
          resolve(null);
          return;
        }

        const now = Date.now();
        if (now - entry.timestamp > CACHE_DURATION_MS) {
          // Cache expired
          console.log('Cache expired');
          resolve(null);
        } else {
          console.log('Loaded from cache');
          resolve(entry.data);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error('Error reading from cache:', e);
    return null;
  }
};

export const clearCache = async (): Promise<void> => {
    try {
        const db = await openDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.clear();
        return new Promise((resolve) => {
            tx.oncomplete = () => resolve();
        });
    } catch(e) {
        console.error('Error clearing cache:', e);
    }
}
