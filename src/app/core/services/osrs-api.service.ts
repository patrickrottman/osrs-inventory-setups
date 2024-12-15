import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, shareReplay, tap } from 'rxjs/operators';
import { OSRSItem, WikiItemMapping, WikiMappingResponse } from '../models/osrs-api.model';

@Injectable({
  providedIn: 'root'
})
export class OsrsApiService {
  private readonly WIKI_API = 'https://prices.runescape.wiki/api/v1/osrs';
  private readonly WIKI_CDN = 'https://oldschool.runescape.wiki/images';
  private readonly STORAGE_KEY = 'osrs_item_mapping';
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
  private itemCache = new Map<number, OSRSItem>();
  private mappingCache: WikiItemMapping | null = null;
  private failedImages = new Set<number>();
  private imageCache = new Map<number, string>();
  private loadingImages = new Set<number>();

  constructor(private http: HttpClient) {
    this.loadCacheFromStorage();
    this.fetchItemMapping().subscribe();
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'User-Agent': 'OSRS Inventory Setups - Development/Testing'
    });
  }

  private loadCacheFromStorage(): void {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        const { data, timestamp } = JSON.parse(stored) as { data: WikiItemMapping, timestamp: number };
        if (Date.now() - timestamp < this.CACHE_DURATION) {
          this.mappingCache = data;
          Object.values(data).forEach((item: OSRSItem) => {
            this.itemCache.set(item.id, item);
          });
        }
      } catch (e) {
        console.warn('Failed to load cached item data:', e);
      }
    }
  }

  private saveCache(data: WikiItemMapping): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
        data,
        timestamp: Date.now()
      }));
    } catch (e) {
      console.warn('Failed to cache item data:', e);
    }
  }

  private fetchItemMapping(): Observable<WikiItemMapping> {
    if (this.mappingCache) {
      return of(this.mappingCache);
    }

    return this.http.get<WikiMappingResponse>(`${this.WIKI_API}/mapping`, { headers: this.getHeaders() }).pipe(
      map(items => {
        const mapping: WikiItemMapping = {};
        items.forEach(item => {
          mapping[item.id] = item;
        });
        return mapping;
      }),
      tap(mapping => {
        this.mappingCache = mapping;
        this.saveCache(mapping);
      }),
      catchError(error => {
        console.error('Error fetching item mapping:', error);
        return of(this.mappingCache || {});
      }),
      shareReplay(1)
    );
  }

  getItem(id: number): Observable<OSRSItem | null> {
    if (this.itemCache.has(id)) {
      return of(this.itemCache.get(id)!);
    }

    return this.fetchItemMapping().pipe(
      map(mapping => {
        const item = mapping[id];
        if (item) {
          this.itemCache.set(id, item);
        }
        return item || null;
      })
    );
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

    const item = this.itemCache.get(id);
    if (!item) {
      // Only fetch item data if we haven't already started
      if (!this.loadingImages.has(id)) {
        this.loadingImages.add(id);
        this.getItem(id).subscribe(fetchedItem => {
          if (fetchedItem) {
            this.tryLoadImage(id, fetchedItem);
          } else {
            this.failedImages.add(id);
            this.loadingImages.delete(id);
          }
        });
      }
      return this.getPlaceholderImage();
    }

    // Only try loading the image if we haven't already started
    if (!this.loadingImages.has(id)) {
      this.loadingImages.add(id);
      this.tryLoadImage(id, item);
    }
    return this.getPlaceholderImage();
  }

  private tryLoadImage(id: number, item: OSRSItem): void {
    const baseName = item.wiki_name || item.name;
    const formattedName = this.formatItemName(baseName);
    const url = `${this.WIKI_CDN}/${formattedName}.png`;

    const img = new Image();
    img.onload = () => {
      this.imageCache.set(id, url);
      this.loadingImages.delete(id);
    };
    img.onerror = () => {
      this.failedImages.add(id);
      this.loadingImages.delete(id);
    };
    img.src = url;
  }

  private formatItemName(name: string): string {
    return name
      .replace(/ /g, '_')
      .replace(/'/g, '%27')
      .replace(/\((\d+)\)/, '($1)');
  }

  private getPlaceholderImage(): string {
    return `${this.WIKI_CDN}/Transparent.png`;
  }

  getCachedItem(id: number): OSRSItem | null {
    return this.itemCache.get(id) || null;
  }
}
