import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, combineLatest } from 'rxjs';
import { map } from 'rxjs/operators';
import { LoadoutData, Category } from '../../shared/models/inventory.model';
import { FirebaseService, LoadoutQueryOptions } from './firebase.service';
import { RecaptchaService } from './recaptcha.service';
import { LoadoutStateService } from './loadout-state.service';
import { 
  serverTimestamp, 
  Timestamp, 
  increment, 
  runTransaction,
  getDoc,
  getDocs,
  query,
  where,
  DocumentReference,
  DocumentData,
  setDoc,
  doc,
  collection,
  writeBatch,
  QueryDocumentSnapshot
} from 'firebase/firestore';

export interface LoadoutFilters {
  search: string;
  categories: Category['type'][];
  tags: string[];
  sortBy: 'date' | 'likes' | 'views';
  sortDirection: 'asc' | 'desc';
  showPersonalOnly: boolean;
  isPublic?: boolean;
}

export interface PaginationState {
  pageSize: number;
  lastVisible: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
  loading: boolean;
}

const DEFAULT_FILTERS: LoadoutFilters = {
  search: '',
  categories: [],
  tags: [],
  sortBy: 'date',
  sortDirection: 'desc',
  showPersonalOnly: false,
  isPublic: true
};

const DEFAULT_PAGINATION: PaginationState = {
  pageSize: 10,
  lastVisible: null,
  hasMore: true,
  loading: false
};

@Injectable({
  providedIn: 'root'
})
export class LoadoutService {
  private filters = new BehaviorSubject<LoadoutFilters>(DEFAULT_FILTERS);
  private pagination = new BehaviorSubject<PaginationState>(DEFAULT_PAGINATION);

  constructor(
    private firebaseService: FirebaseService,
    private recaptchaService: RecaptchaService,
    private loadoutStateService: LoadoutStateService
  ) {
    // Subscribe to filter changes to reset pagination and reload data
    this.filters.subscribe(() => {
      this.resetPagination();
      this.loadInitialData();
    });
  }

  private async loadInitialData() {
    try {
      this.setPaginationLoading(true);
      const result = await this.firebaseService.getLoadouts(this.createQueryOptions());
      
      this.loadoutStateService.updateLoadouts(result.loadouts);
      this.updatePaginationState(result.lastVisible, result.hasMore);
    } catch (error) {
      console.error('Error loading loadouts:', error);
      this.loadoutStateService.updateLoadouts([]);
    } finally {
      this.setPaginationLoading(false);
    }
  }

  private createQueryOptions(): LoadoutQueryOptions {
    const filters = this.filters.value;
    const { pageSize, lastVisible } = this.pagination.value;

    return {
      categories: filters.categories.length > 0 ? filters.categories : undefined,
      sortBy: filters.sortBy,
      sortDirection: filters.sortDirection,
      pageSize,
      lastVisible: lastVisible || undefined,
      searchTerm: filters.search || undefined,
      tags: filters.tags.length > 0 ? filters.tags : undefined,
      showPersonalOnly: filters.showPersonalOnly,
      isPublic: filters.isPublic
    };
  }

  async loadNextPage(): Promise<void> {
    const { hasMore, loading, lastVisible } = this.pagination.value;
    if (!hasMore || loading || !lastVisible) return;

    try {
      this.setPaginationLoading(true);
      const result = await this.firebaseService.getLoadouts({
        ...this.createQueryOptions(),
        lastVisible
      });

      // Append new loadouts to existing ones
      this.loadoutStateService.updateLoadouts([...this.loadoutStateService.getCurrentLoadouts(), ...result.loadouts]);
      this.updatePaginationState(result.lastVisible, result.hasMore);
    } catch (error) {
      console.error('Error loading next page:', error);
    } finally {
      this.setPaginationLoading(false);
    }
  }

  private updatePaginationState(
    lastVisible: QueryDocumentSnapshot<DocumentData> | null,
    hasMore: boolean
  ) {
    this.pagination.next({
      ...this.pagination.value,
      lastVisible,
      hasMore
    });
  }

  private setPaginationLoading(loading: boolean) {
    this.pagination.next({
      ...this.pagination.value,
      loading
    });
  }

  private resetPagination() {
    this.pagination.next(DEFAULT_PAGINATION);
  }

  // Observable getters
  getLoadouts(): Observable<LoadoutData[]> {
    return this.loadoutStateService.getLoadouts();
  }

  getPaginationState(): Observable<PaginationState> {
    return this.pagination.asObservable();
  }

  getFilteredLoadouts(): Observable<LoadoutData[]> {
    return combineLatest([
      this.loadoutStateService.getLoadouts(),
      this.filters,
      this.firebaseService.getCurrentUser()
    ]).pipe(
      map(([loadouts, filters, currentUser]) => {
        let filtered = [...loadouts];

        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          filtered = filtered.filter(loadout => 
            loadout.setup.name.toLowerCase().includes(searchLower) ||
            loadout.setup.notes?.toLowerCase().includes(searchLower) ||
            loadout.tags?.some(tag => tag.toLowerCase().includes(searchLower))
          );
        }

        if (filters.categories.length > 0) {
          filtered = filtered.filter(loadout => 
            filters.categories.includes(loadout.category)
          );
        }

        if (filters.tags.length > 0) {
          filtered = filtered.filter(loadout =>
            filters.tags.every(tag => loadout.tags?.includes(tag))
          );
        }

        if (filters.showPersonalOnly && currentUser) {
          filtered = filtered.filter(loadout => 
            loadout.userId === currentUser.uid
          );
        }

        if (typeof filters.isPublic === 'boolean') {
          filtered = filtered.filter(loadout => 
            loadout.isPublic === filters.isPublic
          );
        }

        filtered.sort((a, b) => {
          let comparison = 0;
          switch (filters.sortBy) {
            case 'date': {
              comparison = this.getTimestamp(b.createdAt) - this.getTimestamp(a.createdAt);
              break;
            }
            case 'likes': {
              comparison = (b.likes || 0) - (a.likes || 0);
              break;
            }
            case 'views': {
              comparison = (b.views || 0) - (a.views || 0);
              break;
            }
          }
          return filters.sortDirection === 'desc' ? comparison : -comparison;
        });

        return filtered;
      })
    );
  }

  private getTimestamp(date: Date | Timestamp): number {
    if (date instanceof Date) {
      return date.getTime();
    }
    if (date instanceof Timestamp) {
      return date.toMillis();
    }
    return Date.now();
  }

  async createLoadout(loadout: LoadoutData): Promise<string> {
    try {
      // Get reCAPTCHA token
      const token = await this.recaptchaService.executeRecaptcha('create_loadout');
      
      // TODO: Send token to backend for verification
      const userId = await this.firebaseService.getCurrentUserId();
      if (!userId) {
        throw new Error('Must be logged in to create a loadout');
      }

      const db = this.firebaseService.getFirestore();

      // Create a new document reference with auto-generated ID
      const loadoutRef = doc(collection(db, 'loadouts'));
      const loadoutId = loadoutRef.id;

      // Create the loadout with userId and timestamps
      const loadoutWithTimestamps = {
        ...loadout,
        id: loadoutId,
        userId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        isPublic: loadout.isPublic ?? true,
        version: loadout.version ?? 1,
        likes: 0,
        views: 0
      };

      // First, add the new loadout to the current list with client-side timestamps
      const newLoadout = {
        ...loadoutWithTimestamps,
        createdAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date())
      } as LoadoutData;

      // Update the loadouts list with the new loadout based on current sort
      const currentLoadouts = this.loadoutStateService.getCurrentLoadouts();
      const filters = this.filters.value;
      const updatedLoadouts = filters.sortBy === 'date' && filters.sortDirection === 'desc'
        ? [newLoadout, ...currentLoadouts]
        : [...currentLoadouts, newLoadout];
      this.loadoutStateService.updateLoadouts(updatedLoadouts);

      // Now perform the transaction
      await runTransaction(db, async (transaction) => {
        // Create the document
        transaction.set(loadoutRef, loadoutWithTimestamps);

        // Update user stats
        const userRef = this.firebaseService.doc(`users/${userId}`);
        transaction.update(userRef, {
          loadoutCount: increment(1),
          lastLoadoutCreated: serverTimestamp()
        });

        // Update global stats
        const statsRef = this.firebaseService.doc('stats/global');
        transaction.set(statsRef, {
          totalLoadouts: increment(1),
          lastUpdated: serverTimestamp()
        }, { merge: true });
      });

      // Wait a short moment for Firestore to process the transaction
      await new Promise(resolve => setTimeout(resolve, 500));

      // Refresh the data in the background while keeping current loadouts
      const result = await this.firebaseService.getLoadouts(this.createQueryOptions());
      
      // Only update if we got results back
      if (result.loadouts.length > 0) {
        this.loadoutStateService.updateLoadouts(result.loadouts);
        this.updatePaginationState(result.lastVisible, result.hasMore);
      }

      return loadoutId;
    } catch (error) {
      console.error('Error creating loadout:', error);
      throw error;
    }
  }

  async deleteLoadout(id: string): Promise<void> {
    try {
      const db = this.firebaseService.getFirestore();
      const userId = await this.firebaseService.getCurrentUserId();
      if (!userId) throw new Error('Must be logged in to delete loadout');

      // Get all necessary document references
      const loadoutRef = this.firebaseService.doc(`loadouts/${id}`);
      const userRef = this.firebaseService.doc(`users/${userId}`);
      const statsRef = this.firebaseService.doc('stats/global');

      // Perform all reads before the transaction
      const loadoutSnap = await getDoc(loadoutRef);
      if (!loadoutSnap.exists()) {
        throw new Error('Loadout not found');
      }

      const loadoutData = loadoutSnap.data() as LoadoutData;
      if (loadoutData.userId !== userId) {
        throw new Error('You do not have permission to delete this loadout');
      }

      // Get likes for this loadout
      const likesRef = this.firebaseService.collectionGroup('likes');
      const likesQuery = query(likesRef, where('loadoutId', '==', id));
      const likesSnap = await getDocs(likesQuery);
      
      // Delete likes in batches if there are any
      if (!likesSnap.empty) {
        const batch = writeBatch(db);
        likesSnap.docs.forEach((doc) => {
          batch.delete(doc.ref);
        });
        await batch.commit();
      }

      // Now perform the transaction with no reads
      await runTransaction(db, async (transaction) => {
        // Delete the loadout document
        transaction.delete(loadoutRef);

        // Update user stats
        transaction.update(userRef, {
          loadoutCount: increment(-1),
          lastUpdated: serverTimestamp()
        });

        // Update global stats
        transaction.update(statsRef, {
          totalLoadouts: increment(-1),
          lastUpdated: serverTimestamp()
        });
      });

      // Wait for Firestore to propagate the changes
      await new Promise(resolve => setTimeout(resolve, 500));

      // Use firebaseService to refresh loadouts
      await this.firebaseService.refreshLoadouts();
    } catch (error) {
      console.error('Error deleting loadout:', error);
      throw error;
    }
  }

  async toggleLike(loadoutId: string): Promise<void> {
    if (!loadoutId) {
      throw new Error('Loadout ID is required');
    }

    try {
      const db = this.firebaseService.getFirestore();
      const userId = await this.firebaseService.getCurrentUserId();
      if (!userId) throw new Error('Must be logged in to like loadouts');

      // Get all necessary document references
      const loadoutRef = this.firebaseService.doc(`loadouts/${loadoutId}`) as DocumentReference<LoadoutData>;
      const likeRef = this.firebaseService.doc(`users/${userId}/likes/${loadoutId}`);

      // Perform all reads before the transaction
      const hasLiked = await this.hasUserLiked(loadoutId);
      const loadoutSnap = await getDoc(loadoutRef);
      if (!loadoutSnap.exists()) {
        throw new Error('Loadout not found');
      }
      const loadoutData = loadoutSnap.data() as LoadoutData;
      const ownerRef = this.firebaseService.doc(`users/${loadoutData.userId}`);

      // Now perform the transaction with no reads
      await runTransaction(db, async (transaction) => {
        if (hasLiked) {
          // Remove like
          transaction.delete(likeRef);
          transaction.update(loadoutRef, {
            likes: increment(-1)
          });

          // Update owner's stats
          transaction.update(ownerRef, {
            totalLikes: increment(-1),
            lastUpdated: serverTimestamp()
          });
        } else {
          // Add like
          transaction.set(likeRef, {
            loadoutId,
            createdAt: serverTimestamp()
          });
          transaction.update(loadoutRef, {
            likes: increment(1)
          });

          // Update owner's stats
          transaction.update(ownerRef, {
            totalLikes: increment(1),
            lastUpdated: serverTimestamp()
          });
        }
      });

      // Refresh the loadouts list
      this.loadInitialData();
    } catch (error) {
      console.error('Error toggling like:', error);
      throw error;
    }
  }

  async hasUserLiked(loadoutId: string): Promise<boolean> {
    if (!loadoutId) return false;
    return this.firebaseService.hasUserLiked(loadoutId);
  }

  async getLoadoutStats(): Promise<{ total: number; today: number }> {
    try {
      // Get global stats
      const statsRef = this.firebaseService.doc('stats/global');
      const statsSnap = await getDoc(statsRef);
      
      // If stats don't exist, create them
      if (!statsSnap.exists()) {
        // Count all loadouts
        const result = await this.firebaseService.getLoadouts();
        const total = result.loadouts.length;

        // Initialize stats document
        await setDoc(statsRef, {
          totalLoadouts: total,
          lastUpdated: serverTimestamp()
        });

        return {
          total,
          today: 0 // Will be calculated below
        };
      }

      const stats = statsSnap.data();

      // Get today's loadouts
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayResult = await this.firebaseService.getLoadouts({
        createdAfter: today
      });

      return {
        total: stats['totalLoadouts'] || 0,
        today: todayResult.loadouts.length
      };
    } catch (error) {
      console.error('Error getting loadout stats:', error);
      return { total: 0, today: 0 };
    }
  }

  async getUserStats(userId: string): Promise<{
    loadoutCount: number;
    totalLikes: number;
    totalViews: number;
  }> {
    try {
      const userRef = this.firebaseService.doc(`users/${userId}`);
      const userSnap = await getDoc(userRef);
      
      // If user stats don't exist, calculate them
      if (!userSnap.exists()) {
        // Get all user's loadouts
        const result = await this.firebaseService.getLoadouts({ 
          showPersonalOnly: true,
          isPublic: undefined // Include both public and private loadouts
        });
        const loadoutCount = result.loadouts.length;
        const totalLikes = result.loadouts.reduce((sum: number, loadout) => sum + (loadout.likes || 0), 0);
        const totalViews = result.loadouts.reduce((sum: number, loadout) => sum + (loadout.views || 0), 0);

        // Initialize user stats
        await setDoc(userRef, {
          loadoutCount,
          totalLikes,
          totalViews,
          lastUpdated: serverTimestamp()
        }, { merge: true });

        return {
          loadoutCount,
          totalLikes,
          totalViews
        };
      }

      const userData = userSnap.data();
      return {
        loadoutCount: userData['loadoutCount'] || 0,
        totalLikes: userData['totalLikes'] || 0,
        totalViews: userData['totalViews'] || 0
      };
    } catch (error) {
      console.error('Error getting user stats:', error);
      return { loadoutCount: 0, totalLikes: 0, totalViews: 0 };
    }
  }

  updateFilters(newFilters: Partial<LoadoutFilters>) {
    this.filters.next({
      ...this.filters.value,
      ...newFilters
    });
  }

  getAllTags(): Observable<string[]> {
    return this.loadoutStateService.getLoadouts().pipe(
      map(loadouts => {
        const tagSet = new Set<string>();
        loadouts.forEach(loadout => {
          loadout.tags?.forEach(tag => tagSet.add(tag));
        });
        return Array.from(tagSet).sort();
      })
    );
  }

  resetFilters() {
    this.filters.next(DEFAULT_FILTERS);
  }
} 