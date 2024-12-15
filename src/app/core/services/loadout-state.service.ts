import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { LoadoutData } from '../../shared/models/inventory.model';

@Injectable({
  providedIn: 'root'
})
export class LoadoutStateService {
  private loadouts = new BehaviorSubject<LoadoutData[]>([]);
  loadouts$ = this.loadouts.asObservable();

  updateLoadouts(loadouts: LoadoutData[]) {
    this.loadouts.next(loadouts);
  }

  getLoadouts(): Observable<LoadoutData[]> {
    return this.loadouts$;
  }

  getCurrentLoadouts(): LoadoutData[] {
    return this.loadouts.value;
  }
} 