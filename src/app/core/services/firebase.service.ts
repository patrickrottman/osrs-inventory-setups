import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { initializeApp } from 'firebase/app';
import { 
  Auth, 
  getAuth, 
  signInWithPopup,
  GoogleAuthProvider, 
  signOut as firebaseSignOut,
  User,
  onAuthStateChanged,
  browserPopupRedirectResolver
} from 'firebase/auth';
import { 
  Firestore, 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  CollectionReference,
  Query,
  DocumentData,
  runTransaction,
  serverTimestamp,
  increment,
  DocumentReference,
  setDoc,
  updateDoc,
  collectionGroup,
  writeBatch,
  QueryDocumentSnapshot,
  Timestamp,
  QueryConstraint
} from 'firebase/firestore';
import { Analytics, getAnalytics } from 'firebase/analytics';
import { environment } from '../../../environments/environment';
import { LoadoutData, Category } from '../../shared/models/inventory.model';
import { LoadoutStateService } from './loadout-state.service';
import { StorageService } from './storage.service';

export interface LoadoutQueryOptions {
  categories?: Category['type'][];
  searchTerm?: string;
  tags?: string[];
  sortBy?: 'date' | 'likes' | 'views';
  sortDirection?: 'asc' | 'desc';
  pageSize?: number;
  lastVisible?: QueryDocumentSnapshot<DocumentData>;
  createdAfter?: Date;
  showPersonalOnly?: boolean;
  isPublic?: boolean;
}

export interface LoadoutQueryResult {
  loadouts: LoadoutData[];
  lastVisible: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

interface CachedStats {
  data: {
    totalLoadouts: number;
    totalUsers: number;
    totalLikes: number;
    newToday: number;
  };
  timestamp: number;
}

@Injectable({
  providedIn: 'root'
})
export class FirebaseService {
  private app = initializeApp(environment.firebase);
  private analytics: Analytics = getAnalytics(this.app);
  private auth: Auth = getAuth(this.app);
  private db: Firestore = getFirestore(this.app);
  
  private currentUser = new BehaviorSubject<User | null>(null);
  currentUser$ = this.currentUser.asObservable();
  user$ = this.currentUser$;
  
  private stats = new BehaviorSubject<{
    totalLoadouts: number;
    totalUsers: number;
    totalLikes: number;
    newToday: number;
  }>({
    totalLoadouts: 0,
    totalUsers: 0,
    totalLikes: 0,
    newToday: 0
  });
  stats$ = this.stats.asObservable();
  
  isLoggedIn$ = this.currentUser$.pipe(
    map((user: User | null) => !!user)
  );

  private readonly STATS_CACHE_KEY = 'inventory_setups_stats';
  private readonly STATS_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  
  constructor(
    private loadoutStateService: LoadoutStateService,
    private storageService: StorageService
  ) {
    this.loadCachedStats();
    onAuthStateChanged(this.auth, (user: User | null) => {
      this.currentUser.next(user);
      this.refreshLoadouts();
      this.refreshStats();
    });

    // Refresh stats periodically if cached
    setInterval(() => {
      this.loadStatsFromCache().subscribe(cached => {
        if (cached) {
          this.refreshStats();
        }
      });
    }, this.STATS_CACHE_DURATION);
  }

  private loadCachedStats(): void {
    this.loadStatsFromCache().subscribe(cached => {
      if (cached) {
        this.stats.next(cached.data);
      }
    });
  }

  private loadStatsFromCache(): Observable<CachedStats | null> {
    return this.storageService.getItem<CachedStats>('stats', this.STATS_CACHE_KEY).pipe(
      map(cached => {
        if (cached && Date.now() - cached.timestamp < this.STATS_CACHE_DURATION) {
          return cached;
        }
        return null;
      }),
      catchError(error => {
        console.warn('Error loading stats from cache:', error);
        return of(null);
      })
    );
  }

  private saveStatsToCache(stats: CachedStats['data']): void {
    const cache: CachedStats = {
      data: stats,
      timestamp: Date.now()
    };
    this.storageService.setItem('stats', this.STATS_CACHE_KEY, cache).subscribe({
      next: () => console.debug('Stats cached successfully'),
      error: error => console.warn('Error saving stats to cache:', error)
    });
  }

  private async refreshStats(): Promise<void> {
    try {
      // Get loadouts count and total likes
      const loadoutsRef = collection(this.db, 'loadouts');
      const loadoutsSnap = await getDocs(loadoutsRef);
      const totalLoadouts = loadoutsSnap.size;
      const totalLikes = loadoutsSnap.docs.reduce((sum, doc) => sum + (doc.data()['likes'] || 0), 0);

      // Get total users count
      const usersRef = collection(this.db, 'users');
      const usersSnap = await getDocs(usersRef);
      const totalUsers = usersSnap.size;

      // Calculate new loadouts today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTimestamp = Timestamp.fromDate(today);
      
      const newTodayQuery = query(
        loadoutsRef,
        where('createdAt', '>=', todayTimestamp)
      );
      const newTodaySnap = await getDocs(newTodayQuery);
      const newToday = newTodaySnap.size;

      const stats = {
        totalLoadouts,
        totalUsers,
        totalLikes,
        newToday
      };

      // Only update the stats document if user is authenticated
      if (this.currentUser.value) {
        const statsRef = doc(this.db, 'stats/global');
        await setDoc(statsRef, {
          ...stats,
          lastUpdated: serverTimestamp()
        }, { merge: true });
      }

      // Update local stats and cache
      this.stats.next(stats);
      this.saveStatsToCache(stats);
    } catch (error) {
      console.error('Error refreshing stats:', error);
      
      // If error, try to use cached stats
      this.loadStatsFromCache().subscribe(cached => {
        if (cached) {
          this.stats.next(cached.data);
        }
      });
    }
  }

  // Make refreshLoadouts public so components can call it
  async refreshLoadouts(): Promise<void> {
    try {
      const result = await this.getLoadouts();
      this.loadoutStateService.updateLoadouts(result.loadouts);
    } catch (error) {
      console.error('Error refreshing loadouts:', error);
    }
  }

  getFirestore(): Firestore {
    return this.db;
  }

  doc(path: string): DocumentReference<DocumentData> {
    return doc(this.db, path);
  }

  collection(path: string): CollectionReference<DocumentData> {
    return collection(this.db, path);
  }

  collectionGroup(collectionId: string): Query<DocumentData> {
    return collectionGroup(this.db, collectionId);
  }

  async getCurrentUserId(): Promise<string | null> {
    return this.currentUser.value?.uid || null;
  }

  getCurrentUser(): Observable<User | null> {
    return this.currentUser$;
  }

  // Add a new method for getting current user synchronously
  getCurrentUserSync(): User | null {
    return this.currentUser.value;
  }

  async signIn(): Promise<void> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ 
      prompt: 'select_account',
      display: 'popup'
    });
    
    try {
      const result = await signInWithPopup(this.auth, provider, browserPopupRedirectResolver);
      const user = result.user;
      
      const userRef = doc(this.db, 'users', user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          displayName: user.displayName,
          photoURL: user.photoURL,
          lastActive: serverTimestamp(),
          loadoutCount: 0,
          totalLikes: 0,
          totalViews: 0,
          createdAt: serverTimestamp()
        });
      } else {
        await updateDoc(userRef, {
          lastActive: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  }

  async signOut(): Promise<void> {
    try {
      await firebaseSignOut(this.auth);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }

  async getLoadouts(options: LoadoutQueryOptions = {}): Promise<{
    loadouts: LoadoutData[];
    lastVisible: QueryDocumentSnapshot<DocumentData> | null;
    hasMore: boolean;
  }> {
    try {
      const db = this.getFirestore();
      const loadoutsRef = collection(db, 'loadouts');
      const constraints: QueryConstraint[] = [];

      // Handle personal loadouts filter
      if (options.showPersonalOnly) {
        const currentUser = this.getCurrentUserSync();
        if (currentUser?.uid) {
          constraints.push(where('userId', '==', currentUser.uid));
        }
      }

      // Handle categories filter
      if (options.categories && options.categories.length > 0) {
        constraints.push(where('category', 'in', options.categories));
      }

      // Handle tags filter
      if (options.tags && options.tags.length > 0) {
        constraints.push(where('tags', 'array-contains-any', options.tags));
      }

      // Handle public/private filter
      if (typeof options.isPublic === 'boolean') {
        constraints.push(where('isPublic', '==', options.isPublic));
      }

      // Handle created after filter
      if (options.createdAfter) {
        constraints.push(where('createdAt', '>=', options.createdAfter));
      }

      // Handle sorting
      if (options.sortBy) {
        constraints.push(orderBy(options.sortBy === 'date' ? 'createdAt' : options.sortBy, 
          options.sortDirection || 'desc'));
      }

      // Handle pagination
      if (options.pageSize) {
        constraints.push(limit(options.pageSize));
      }

      // Add startAfter if we have a lastVisible
      if (options.lastVisible) {
        constraints.push(startAfter(options.lastVisible));
      }

      const q = query(loadoutsRef, ...constraints);
      const querySnapshot = await getDocs(q);

      const loadouts = querySnapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      })) as LoadoutData[];

      // If search term is provided, filter results client-side
      if (options.searchTerm) {
        const searchLower = options.searchTerm.toLowerCase();
        return {
          loadouts: loadouts.filter(loadout =>
            loadout.setup.name.toLowerCase().includes(searchLower) ||
            loadout.setup.notes?.toLowerCase().includes(searchLower) ||
            loadout.tags?.some(tag => tag.toLowerCase().includes(searchLower))
          ),
          lastVisible: querySnapshot.docs[querySnapshot.docs.length - 1] || null,
          hasMore: querySnapshot.docs.length === options.pageSize
        };
      }

      return {
        loadouts,
        lastVisible: querySnapshot.docs[querySnapshot.docs.length - 1] || null,
        hasMore: querySnapshot.docs.length === options.pageSize
      };
    } catch (error) {
      console.error('Error getting loadouts:', error);
      return {
        loadouts: [],
        lastVisible: null,
        hasMore: false
      };
    }
  }

  async createLoadout(loadout: LoadoutData): Promise<string> {
    try {
      const db = this.getFirestore();
      const user = this.currentUser.value;
      if (!user) throw new Error('Must be logged in to create loadout');

      // Create loadout in a transaction to update all related stats
      let loadoutId: string;
      await runTransaction(db, async (transaction) => {
        // Create the loadout document
        const loadoutRef = doc(collection(db, 'loadouts'));
        loadoutId = loadoutRef.id;
        
        transaction.set(loadoutRef, {
          ...loadout,
          id: loadoutId,
          userId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          likes: 0,
          views: 0
        });

        // Update user stats
        const userRef = doc(this.db, 'users', user.uid);
        transaction.update(userRef, {
          loadoutCount: increment(1),
          lastUpdated: serverTimestamp()
        });

        // Update global stats
        const statsRef = doc(this.db, 'stats/global');
        const statsDoc = await transaction.get(statsRef);
        
        if (statsDoc.exists()) {
          transaction.update(statsRef, {
            totalLoadouts: increment(1),
            lastUpdated: serverTimestamp()
          });
        } else {
          transaction.set(statsRef, {
            totalLoadouts: 1,
            totalLikes: 0,
            totalUsers: 1,
            lastUpdated: serverTimestamp()
          });
        }
      });

      // After transaction completes successfully, refresh the UI
      await Promise.all([
        this.refreshLoadouts(),
        this.refreshStats()
      ]);

      return loadoutId!;
    } catch (error) {
      console.error('Error creating loadout:', error);
      throw error;
    }
  }

  async deleteLoadout(id: string): Promise<void> {
    try {
      const user = this.currentUser.value;
      if (!user) throw new Error('Must be logged in to delete loadout');

      const db = this.getFirestore();

      // First verify ownership
      const loadoutRef = doc(this.db, 'loadouts', id);
      const loadoutSnap = await getDoc(loadoutRef);
      
      if (!loadoutSnap.exists()) {
        throw new Error('Loadout not found');
      }

      const loadoutData = loadoutSnap.data();
      if (loadoutData['userId'] !== user.uid) {
        throw new Error('You do not have permission to delete this loadout');
      }

      // Create a batch for all operations
      const batch = writeBatch(db);

      // Delete the loadout document
      batch.delete(loadoutRef);

      // Update user stats
      const userRef = doc(this.db, 'users', user.uid);
      batch.update(userRef, {
        loadoutCount: increment(-1),
        lastUpdated: serverTimestamp()
      });

      // Delete the user's own like if it exists
      const userLikeRef = doc(this.db, `users/${user.uid}/likes/${id}`);
      const userLikeSnap = await getDoc(userLikeRef);
      if (userLikeSnap.exists()) {
        batch.delete(userLikeRef);
      }

      // Commit all changes in one batch
      await batch.commit();

      // Wait for Firestore to propagate the changes
      await new Promise(resolve => setTimeout(resolve, 500));

      // Remove from local state first
      const currentLoadouts = this.loadoutStateService.getCurrentLoadouts();
      const updatedLoadouts = currentLoadouts.filter((loadout: LoadoutData) => loadout.id !== id);
      this.loadoutStateService.updateLoadouts(updatedLoadouts);

      // Then refresh from server
      await this.refreshLoadouts();

    } catch (error) {
      console.error('Error deleting loadout:', error);
      throw error;
    }
  }

  async hasUserLiked(loadoutId: string): Promise<boolean> {
    try {
      if (!loadoutId) return false;

      const user = this.currentUser.value;
      if (!user) return false;

      const likeRef = doc(this.db, `users/${user.uid}/likes/${loadoutId}`);
      const likeDoc = await getDoc(likeRef);
      return likeDoc.exists();
    } catch (error) {
      console.error('Error checking like status:', error);
      return false;
    }
  }

  // Helper method to check if user owns a loadout
  isLoadoutOwner(loadout: LoadoutData): boolean {
    const user = this.currentUser.value;
    return user ? loadout.userId === user.uid : false;
  }
}
