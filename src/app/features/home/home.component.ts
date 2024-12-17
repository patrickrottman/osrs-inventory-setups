import { Component, OnInit, OnDestroy, HostListener, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
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
import { Observable, Subscription } from 'rxjs';
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
import { BankTagLayoutGridComponent } from '../inventory/components/bank-tag-layout-grid/bank-tag-layout-grid.component';
import { BankTagLayout } from '../../shared/models/bank-tag-layout.model';

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
    EquipmentSlotsComponent,
    BankTagLayoutGridComponent
  ],
  providers: [DatePipe]
})
export class HomeComponent implements OnInit, OnDestroy, AfterViewInit {
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
  showMobileSearch = false;
  @ViewChild('searchInput') searchInput!: ElementRef;

  private subscriptions = new Subscription();
  private observer: IntersectionObserver | null = null;
  isFooterVisible = false;

  readonly categories: { value: Category['type']; label: string }[] = [
    { value: 'Boss', label: 'Boss' },
    { value: 'Skill', label: 'Skill' },
    { value: 'Custom', label: 'Custom' }
  ];

  readonly sortOptions: { key: 'likes' | 'date'; label: string; icon: string }[] = [
    { key: 'likes', label: 'Likes', icon: 'favorite' },
    { key: 'date', label: 'Date', icon: 'schedule' }
  ];

  selectedType = new FormControl<'inventory' | 'banktag' | 'banktaglayout' | ''>('');

  readonly loadoutTypes: { value: 'inventory' | 'banktag' | 'banktaglayout'; label: string }[] = [
    { value: 'inventory', label: 'Inventory Setups' },
    { value: 'banktaglayout', label: 'Bank Tag Layouts' }
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

    // Subscribe to type changes
    this.subscriptions.add(
      this.selectedType.valueChanges.subscribe(() => {
        this.updateFilters();
      })
    );
  }

  ngOnInit() {
    // Set up search with debounce
    this.subscriptions.add(
      this.searchControl.valueChanges.pipe(
        debounceTime(300),
        distinctUntilChanged()
      ).subscribe(value => {
        this.loadoutService.updateFilters({ search: value || '' });
      })
    );

    // Combined category and tag filter
    this.subscriptions.add(
      this.selectedCategories.valueChanges.subscribe(() => {
        this.updateFilters();
      })
    );

    this.subscriptions.add(
      this.selectedTags.valueChanges.subscribe(() => {
        this.updateFilters();
      })
    );

    // Sort controls
    this.subscriptions.add(
      this.sortControl.valueChanges.subscribe(value => {
        if (value) {
          this.loadoutService.updateFilters({ sortBy: value });
        }
      })
    );

    this.subscriptions.add(
      this.sortDirectionControl.valueChanges.subscribe(value => {
        if (value) {
          this.loadoutService.updateFilters({ sortDirection: value });
        }
      })
    );

    // Check if instructions should be hidden
    this.showInstructions = localStorage.getItem('hideInstructions') !== 'true';
  }

  ngAfterViewInit() {
    // Set up intersection observer for footer visibility
    const footer = document.querySelector('app-footer');
    if (footer && window.IntersectionObserver) {
      this.observer = new IntersectionObserver(
        (entries) => {
          const isIntersecting = entries[0].isIntersecting;
          // Add a small buffer before triggering the change
          if (isIntersecting !== this.isFooterVisible) {
            this.isFooterVisible = isIntersecting;
            // Force change detection since we're in an async callback
            requestAnimationFrame(() => {
              document.body.classList.toggle('footer-visible', this.isFooterVisible);
            });
          }
        },
        {
          threshold: 0,
          rootMargin: '100px' // Start transition before footer is fully visible
        }
      );
      this.observer.observe(footer);
    }
  }

  ngOnDestroy() {
    // Clean up the observer
    if (this.observer) {
      this.observer.disconnect();
    }
    this.subscriptions.unsubscribe();
    this.loadoutService.resetFilters();
  }

  private updateFilters() {
    this.loadoutService.updateFilters({
      categories: this.selectedCategories.value ?? [],
      tags: this.selectedTags.value ?? [],
      type: this.selectedType.value || undefined
    });
  }

  hasActiveFilters(): boolean {
    return (
      !!this.searchControl.value ||
      (this.selectedCategories.value?.length ?? 0) > 0 ||
      (this.selectedTags.value?.length ?? 0) > 0 ||
      !!this.selectedType.value ||
      this.sortControl.value !== 'likes' ||
      this.sortDirectionControl.value !== 'desc'
    );
  }

  clearFilters() {
    this.searchControl.setValue('');
    this.selectedCategories.setValue([]);
    this.selectedTags.setValue([]);
    this.selectedType.setValue('');
    this.sortControl.setValue('likes');
    this.sortDirectionControl.setValue('desc');
    this.loadoutService.resetFilters();
    
    if (this.showMobileSearch) {
      this.closeMobileSearch();
    }
  }

  openMobileSearch() {
    this.showMobileSearch = true;
    setTimeout(() => {
      this.searchInput?.nativeElement?.focus();
    }, 300);
  }

  closeMobileSearch() {
    this.showMobileSearch = false;
  }

  @HostListener('window:scroll', ['$event'])
  onScroll() {
    // Check if we're near the bottom of the page for infinite scroll
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

  hideInstructions(): void {
    this.showInstructions = false;
    localStorage.setItem('hideInstructions', 'true');
  }

  handleFilterKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
    }
  }

  isLayoutType(loadout: LoadoutData): boolean {
    return loadout.type === 'banktag' || loadout.type === 'banktaglayout';
  }

  getBankTagLayout(loadout: LoadoutData): BankTagLayout {
    // Get all items sorted by position
    const items = Object.entries(loadout.setup.afi || {})
      .map(([pos, item]) => ({
        id: item.id,
        position: parseInt(pos),
        q: item.q || 1
      }))
      .sort((a, b) => a.position - b.position);

    // Calculate how many rows we currently have
    const maxPosition = Math.max(...items.map(item => item.position));
    const totalRows = Math.floor(maxPosition / 8) + 1;

    // If we have more than 7 rows, only take items from first 7 rows
    const maxAllowedPosition = 7 * 8 - 1; // 7 rows * 8 columns - 1 (0-based)
    const limitedItems = totalRows > 7 
      ? items.filter(item => item.position <= maxAllowedPosition)
      : items;

    return {
      name: loadout.setup.name,
      items: limitedItems,
      bankTag: limitedItems.map(item => item.id),
      width: 8,
      originalFormat: loadout.originalFormat || ''
    };
  }
} 