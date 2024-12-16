import { Component, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatRadioModule } from '@angular/material/radio';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatListModule } from '@angular/material/list';
import { FormControl } from '@angular/forms';
import { Observable } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { Router } from '@angular/router';

import { FirebaseService } from '../../core/services/firebase.service';
import { LoadoutService, PaginationState } from '../../core/services/loadout.service';
import { LoadoutData, Category } from '../../shared/models/inventory.model';
import { LoadoutModalComponent } from '../loadout/components/loadout-modal/loadout-modal.component';
import { LoadoutUploaderDialogComponent } from '../loadout/components/loadout-uploader/loadout-uploader-dialog.component';
import { FirebaseDatePipe } from '../../shared/pipes/firebase-date.pipe';
import { OsrsApiService } from '../../core/services/osrs-api.service';
import { EquipmentSlotsComponent } from '../equipment/components/equipment-slots/equipment-slots.component';

@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatChipsModule,
    MatMenuModule,
    MatTooltipModule,
    MatDialogModule,
    MatRadioModule,
    MatDividerModule,
    MatProgressSpinnerModule,
    MatListModule,
    FirebaseDatePipe,
    EquipmentSlotsComponent
  ],
  providers: [DatePipe]
})
export class HomeComponent implements OnInit, OnDestroy {
  loadouts$: Observable<LoadoutData[]>;
  availableTags$: Observable<string[]>;
  isLoggedIn$: Observable<boolean>;
  paginationState$: Observable<PaginationState>;
  
  searchControl = new FormControl('');
  selectedCategories = new FormControl<Category['type'][]>([]);
  selectedTags = new FormControl<string[]>([]);
  sortControl = new FormControl<'date' | 'likes'>('likes');
  sortDirectionControl = new FormControl<'asc' | 'desc'>('desc');
  showInstructions = true;

  readonly categories: { value: Category['type']; label: string }[] = [
    { value: 'Boss', label: 'Boss' },
    { value: 'Skill', label: 'Skill' },
    { value: 'Custom', label: 'Custom' }
  ];

  readonly sortOptions: { key: 'likes' | 'date'; label: string; icon: string }[] = [
    { key: 'likes', label: 'Likes', icon: 'favorite' },
    { key: 'date', label: 'Date', icon: 'schedule' }
  ];

  constructor(
    private loadoutService: LoadoutService,
    private dialog: MatDialog,
    private osrsApi: OsrsApiService,
    private firebaseService: FirebaseService,
    private router: Router
  ) {
    this.loadouts$ = this.loadoutService.getLoadouts();
    this.availableTags$ = this.loadoutService.getAllTags();
    this.isLoggedIn$ = this.firebaseService.isLoggedIn$;
    this.paginationState$ = this.loadoutService.getPaginationState();
  }

  ngOnInit() {
    // Set up search with debounce
    this.searchControl.valueChanges.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(value => {
      this.loadoutService.updateFilters({ search: value || '' });
    });

    // Combined category and tag filter
    this.selectedCategories.valueChanges.subscribe(() => {
      this.updateFilters();
    });

    this.selectedTags.valueChanges.subscribe(() => {
      this.updateFilters();
    });

    // Sort controls
    this.sortControl.valueChanges.subscribe(value => {
      if (value) {
        this.loadoutService.updateFilters({ sortBy: value });
      }
    });

    this.sortDirectionControl.valueChanges.subscribe(value => {
      if (value) {
        this.loadoutService.updateFilters({ sortDirection: value });
      }
    });

    // Check if instructions should be hidden
    this.showInstructions = localStorage.getItem('hideInstructions') !== 'true';
  }

  private updateFilters() {
    this.loadoutService.updateFilters({
      categories: this.selectedCategories.value ?? [],
      tags: this.selectedTags.value ?? []
    });
  }

  hasActiveFilters(): boolean {
    return (
      !!this.searchControl.value ||
      (this.selectedCategories.value?.length ?? 0) > 0 ||
      (this.selectedTags.value?.length ?? 0) > 0 ||
      this.sortControl.value !== 'likes' ||
      this.sortDirectionControl.value !== 'desc'
    );
  }

  clearFilters() {
    this.searchControl.setValue('');
    this.selectedCategories.setValue([]);
    this.selectedTags.setValue([]);
    this.sortControl.setValue('likes');
    this.sortDirectionControl.setValue('desc');
    this.loadoutService.resetFilters();
  }

  ngOnDestroy() {
    // Reset filters when leaving the page
    this.loadoutService.resetFilters();
  }

  @HostListener('window:scroll', ['$event'])
  onScroll() {
    // Check if we're near the bottom of the page
    const windowHeight = window.innerHeight;
    const documentHeight = document.documentElement.scrollHeight;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollBottom = scrollTop + windowHeight;

    if (documentHeight - scrollBottom < 200) { // Load more when within 200px of bottom
      this.loadMore();
    }
  }

  async loadMore() {
    await this.loadoutService.loadNextPage();
  }

  openCreateDialog(): void {
    this.dialog.open(LoadoutUploaderDialogComponent, {
      width: '90vw',
      maxWidth: '1400px',
      disableClose: false
    });
  }

  openLoadout(loadout: LoadoutData) {
    this.dialog.open(LoadoutModalComponent, {
      data: loadout,
      panelClass: 'loadout-modal',
      maxWidth: '90vw',
      width: '80%'
    });
  }

  getItemImageUrl(id: number): string {
    return this.osrsApi.getItemImageUrl(id);
  }

  toggleSortDirection() {
    const current = this.sortDirectionControl.value;
    this.sortDirectionControl.setValue(current === 'asc' ? 'desc' : 'asc');
  }

  getSortIcon(): string {
    const direction = this.sortDirectionControl.value;
    return direction === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  handleFilterKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      // Handle filter selection
    }
    if (event.key === 'Escape') {
      // Close menu
      event.preventDefault();
    }
  }

  hideInstructions(): void {
    this.showInstructions = false;
    localStorage.setItem('hideInstructions', 'true');
  }
} 