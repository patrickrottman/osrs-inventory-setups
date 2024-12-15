import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { FormControl } from '@angular/forms';
import { debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { Observable, Subject } from 'rxjs';
import { firstValueFrom } from 'rxjs';

import { FirebaseService } from '../../../../core/services/firebase.service';
import { LoadoutData, Category } from '../../../../shared/models/inventory.model';
import { LoadoutModalComponent } from '../loadout-modal/loadout-modal.component';
import { LoadoutUploaderDialogComponent } from '../loadout-uploader/loadout-uploader-dialog.component';
import { FirebaseDatePipe } from '../../../../shared/pipes/firebase-date.pipe';
import { DeleteConfirmationComponent } from '../../../../shared/components/delete-confirmation/delete-confirmation.component';
import { InventoryGridComponent } from '../../../inventory/components/inventory-grid/inventory-grid.component';
import { LoadoutService } from '../../../../core/services/loadout.service';

@Component({
  selector: 'app-loadout-list',
  templateUrl: './loadout-list.component.html',
  styleUrls: ['./loadout-list.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    MatSnackBarModule,
    FormsModule,
    ReactiveFormsModule,
    FirebaseDatePipe,
    InventoryGridComponent
  ]
})
export class LoadoutListComponent implements OnInit, OnDestroy {
  loadouts$: Observable<LoadoutData[]>;
  searchControl: FormControl<string | null>;
  categoryControl: FormControl<Category['type'] | ''>;
  isLoggedIn$: Observable<boolean>;
  private destroy$ = new Subject<void>();
  
  readonly categories: { type: Category['type']; name: string; }[] = [
    { type: 'Boss', name: 'Boss' },
    { type: 'Skill', name: 'Skill' },
    { type: 'Custom', name: 'Custom' }
  ];

  constructor(
    private firebaseService: FirebaseService,
    private loadoutService: LoadoutService,
    private dialog: MatDialog,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private snackBar: MatSnackBar
  ) {
    this.loadouts$ = this.firebaseService.loadouts$;
    this.isLoggedIn$ = this.firebaseService.isLoggedIn$;
    this.searchControl = new FormControl('');
    this.categoryControl = new FormControl<Category['type'] | ''>('');
  }

  ngOnInit(): void {
    // Initial load
    this.firebaseService.refreshLoadouts();

    // Set up search with debounce
    this.searchControl.valueChanges.pipe(
      takeUntil(this.destroy$),
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(() => {
      this.firebaseService.refreshLoadouts();
    });

    // Category filter
    this.categoryControl.valueChanges.pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.firebaseService.refreshLoadouts();
    });

    // Subscribe to auth state changes
    this.firebaseService.isLoggedIn$.pipe(
      takeUntil(this.destroy$)
    ).subscribe(isLoggedIn => {
      console.log('LoadoutList auth state changed:', isLoggedIn);
      this.firebaseService.refreshLoadouts();
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  openLoadoutModal(loadout: LoadoutData): void {
    const dialogRef = this.dialog.open(LoadoutModalComponent, {
      width: '800px',
      data: loadout,
      panelClass: 'modern-dialog'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === 'deleted') {
        this.firebaseService.refreshLoadouts();
      }
    });
  }

  isOwner(loadout: LoadoutData): boolean {
    return this.firebaseService.isLoadoutOwner(loadout);
  }

  openCreateDialog(): void {
    const dialogRef = this.dialog.open(LoadoutUploaderDialogComponent, {
      width: '90vw',
      maxWidth: '1400px',
      disableClose: false
    });

    dialogRef.afterClosed().pipe(
      takeUntil(this.destroy$)
    ).subscribe(result => {
      if (result) {
        this.firebaseService.refreshLoadouts();
      }
    });
  }

  openLoadout(loadout: LoadoutData): void {
    const dialogRef = this.dialog.open(LoadoutModalComponent, {
      width: '800px',
      data: loadout,
      panelClass: 'modern-dialog'
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result === 'deleted') {
        this.firebaseService.refreshLoadouts();
      }
    });
  }

  async deleteLoadout(event: Event, loadout: LoadoutData): Promise<void> {
    event.stopPropagation(); // Prevent opening the modal when clicking delete

    const dialogRef = this.dialog.open(DeleteConfirmationComponent, {
      data: { name: loadout.setup.name },
      width: '400px'
    });

    try {
      const confirmed = await firstValueFrom(dialogRef.afterClosed());
      if (confirmed) {
        await this.firebaseService.deleteLoadout(loadout.id);
        // Wait for a short delay to ensure Firestore has propagated the changes
        await new Promise(resolve => setTimeout(resolve, 500));
        await this.firebaseService.refreshLoadouts();
      }
    } catch (error) {
      console.error('Error deleting loadout:', error);
      // TODO: Show error message to user
    }
  }

  async toggleLike(event: Event, loadout: LoadoutData): Promise<void> {
    event.stopPropagation(); // Prevent opening the modal when clicking like

    try {
      await this.loadoutService.toggleLike(loadout.id);
      const hasLiked = await this.loadoutService.hasUserLiked(loadout.id);
      loadout.likes = (loadout.likes || 0) + (hasLiked ? 1 : -1);
      
      this.snackBar.open(
        hasLiked ? 'Added to your likes' : 'Removed from your likes',
        'Close',
        { duration: 3000 }
      );
    } catch (error) {
      console.error('Error toggling like:', error);
      this.snackBar.open(
        'You must be logged in to like loadouts',
        'Close',
        { duration: 3000 }
      );
    }
  }

  async hasUserLiked(loadoutId: string): Promise<boolean> {
    return this.loadoutService.hasUserLiked(loadoutId);
  }
} 