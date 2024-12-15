import { Injectable } from '@angular/core';
import { from, Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly DB_NAME = 'inventory-setups-cache';
  private readonly DB_VERSION = 1;
  private db: IDBDatabase | null = null;
  private dbInitialized = false;
  private dbError = false;

  constructor() {
    this.initDB().catch(() => {
      this.dbError = true;
      console.warn('IndexedDB initialization failed, falling back to memory-only storage');
    });
  }

  private async initDB(): Promise<void> {
    if (!this.isIndexedDBAvailable()) {
      this.dbError = true;
      return;
    }

    try {
      this.db = await new Promise((resolve, reject) => {
        const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

        request.onerror = () => {
          this.dbError = true;
          reject(new Error('Failed to open IndexedDB'));
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          
          if (!db.objectStoreNames.contains('items')) {
            db.createObjectStore('items');
          }
          if (!db.objectStoreNames.contains('stats')) {
            db.createObjectStore('stats');
          }
        };

        request.onsuccess = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          this.dbInitialized = true;
          resolve(db);
        };
      });
    } catch (error) {
      this.dbError = true;
      console.warn('Error initializing IndexedDB:', error);
    }
  }

  private isIndexedDBAvailable(): boolean {
    try {
      return !!window.indexedDB;
    } catch {
      return false;
    }
  }

  setItem(storeName: string, key: string, value: any): Observable<void> {
    // If IndexedDB is not available or errored, just return success
    if (this.dbError || !this.db) {
      return of(undefined);
    }

    return from(new Promise<void>((resolve) => {
      try {
        const transaction = this.db!.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(value, key);

        request.onerror = () => {
          console.warn(`Error saving to IndexedDB (${storeName}):`, request.error);
          resolve(); // Resolve anyway to prevent errors from bubbling up
        };

        request.onsuccess = () => resolve();

        transaction.onerror = () => {
          console.warn(`Transaction error while saving to IndexedDB (${storeName}):`, transaction.error);
          resolve(); // Resolve anyway to prevent errors from bubbling up
        };
      } catch (error) {
        console.warn(`Unexpected error while saving to IndexedDB (${storeName}):`, error);
        resolve(); // Resolve anyway to prevent errors from bubbling up
      }
    })).pipe(
      catchError(() => of(undefined))
    );
  }

  getItem<T>(storeName: string, key: string): Observable<T | null> {
    // If IndexedDB is not available or errored, return null
    if (this.dbError || !this.db) {
      return of(null);
    }

    return from(new Promise<T | null>((resolve) => {
      try {
        const transaction = this.db!.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);

        request.onerror = () => {
          console.warn(`Error reading from IndexedDB (${storeName}):`, request.error);
          resolve(null);
        };

        request.onsuccess = () => resolve(request.result);

        transaction.onerror = () => {
          console.warn(`Transaction error while reading from IndexedDB (${storeName}):`, transaction.error);
          resolve(null);
        };
      } catch (error) {
        console.warn(`Unexpected error while reading from IndexedDB (${storeName}):`, error);
        resolve(null);
      }
    })).pipe(
      catchError(() => of(null))
    );
  }

  removeItem(storeName: string, key: string): Observable<void> {
    // If IndexedDB is not available or errored, just return success
    if (this.dbError || !this.db) {
      return of(undefined);
    }

    return from(new Promise<void>((resolve) => {
      try {
        const transaction = this.db!.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);

        request.onerror = () => {
          console.warn(`Error removing from IndexedDB (${storeName}):`, request.error);
          resolve();
        };

        request.onsuccess = () => resolve();

        transaction.onerror = () => {
          console.warn(`Transaction error while removing from IndexedDB (${storeName}):`, transaction.error);
          resolve();
        };
      } catch (error) {
        console.warn(`Unexpected error while removing from IndexedDB (${storeName}):`, error);
        resolve();
      }
    })).pipe(
      catchError(() => of(undefined))
    );
  }
} 