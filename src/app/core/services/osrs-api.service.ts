import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, shareReplay, tap } from 'rxjs/operators';
import { StorageService } from './storage.service';

@Injectable({
  providedIn: 'root'
})
export class OsrsApiService {
  private readonly WIKI_API = 'https://prices.runescape.wiki/api/v1/osrs';
  private readonly RUNELITE_STATIC = 'https://raw.githubusercontent.com/runelite/static.runelite.net/master/cache/item';
  private readonly STORAGE_KEY_NAMES = 'osrs_item_names';
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private itemNamesCache: Record<string, string> | null = null;
  private failedImages = new Set<number>();
  private imageCache = new Map<number, string>();
  private loadingImages = new Set<number>();

  constructor(
    private http: HttpClient,
    private storageService: StorageService
  ) {
    this.loadNamesFromStorage();
    this.fetchItemNames().subscribe();
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'User-Agent': 'OSRS Inventory Setups - Development/Testing'
    });
  }

  private loadNamesFromStorage(): void {
    this.storageService.getItem<{ data: Record<string, string>, timestamp: number }>('items', this.STORAGE_KEY_NAMES).subscribe(stored => {
      if (stored && Date.now() - stored.timestamp < this.CACHE_DURATION) {
        this.itemNamesCache = stored.data;
      }
    });
  }

  private saveNamesToStorage(data: Record<string, string>): void {
    this.storageService.setItem('items', this.STORAGE_KEY_NAMES, {
      data,
      timestamp: Date.now()
    }).subscribe();
  }

  private fetchItemNames(): Observable<Record<string, string>> {
    if (this.itemNamesCache) {
      return of(this.itemNamesCache);
    }

    return this.http.get<Record<string, string>>(`${this.RUNELITE_STATIC}/names.json`).pipe(
      tap(names => {
        this.itemNamesCache = names;
        this.saveNamesToStorage(names);
      }),
      catchError(error => {
        console.error('Error fetching item names:', error);
        return of(this.itemNamesCache || {});
      }),
      shareReplay(1)
    );
  }

  getItemName(id: number): string {
    if (!this.itemNamesCache) {
      return `Item ${id}`;
    }
    return this.itemNamesCache[id] || `Item ${id}`;
  }

  getItemImageUrl(id: number): string {
    // Return cached image URL if available
    if (this.imageCache.has(id)) {
      return this.imageCache.get(id)!;
    }

    // Return placeholder if we've already tried and failed to load this image
    if (this.failedImages.has(id)) {
      return this.getPlaceholderImage();
    }

    // If we're already trying to load this image, return placeholder
    if (this.loadingImages.has(id)) {
      return this.getPlaceholderImage();
    }

    // Try loading the image
    if (!this.loadingImages.has(id)) {
      this.loadingImages.add(id);
      this.tryLoadImage(id);
    }
    return this.getPlaceholderImage();
  }

  private tryLoadImage(id: number): void {
    const runeliteUrl = `${this.RUNELITE_STATIC}/icon/${id}.png`;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.imageCache.set(id, runeliteUrl);
      this.loadingImages.delete(id);
    };
    img.onerror = () => {
      this.failedImages.add(id);
      this.loadingImages.delete(id);
    };
    img.src = runeliteUrl;
  }

  private getPlaceholderImage(): string {
    return 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
  }
}
