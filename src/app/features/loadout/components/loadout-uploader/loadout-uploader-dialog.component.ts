import { Component, OnInit, OnDestroy, Renderer2 } from '@angular/core';
import { CommonModule, KeyValue } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSelectModule } from '@angular/material/select';
import { MatDividerModule } from '@angular/material/divider';
import { MatChipsModule } from '@angular/material/chips';
import { InventoryGridComponent } from '../../../inventory/components/inventory-grid/inventory-grid.component';
import { EquipmentSlotsComponent } from '../../../equipment/components/equipment-slots/equipment-slots.component';
import { RunePouchComponent } from '../../../inventory/components/rune-pouch/rune-pouch.component';
import { BankTagLayoutGridComponent } from '../../../inventory/components/bank-tag-layout-grid/bank-tag-layout-grid.component';
import { OsrsApiService } from '../../../../core/services/osrs-api.service';
import { LoadoutService } from '../../../../core/services/loadout.service';
import { FirebaseService } from '../../../../core/services/firebase.service';
import { LoadoutData, Setup, Category, Item } from '../../../../shared/models/inventory.model';
import { BankTagLayoutService } from '../../../../shared/services/bank-tag-layout.service';
import { BankTagLayout, BankTagLayoutItem } from '../../../../shared/models/bank-tag-layout.model';
import { firstValueFrom, Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { serverTimestamp, collection, doc, Timestamp } from 'firebase/firestore';

interface LoadoutPreview {
  setup: Setup;
  layout?: (string | number)[];
  category?: Category['type'];
  tags?: string[];
  type?: 'inventory' | 'banktag' | 'banktaglayout';
  originalFormat?: string;  // Store the original format for export
}

@Component({
  selector: 'app-loadout-uploader-dialog',
  templateUrl: './loadout-uploader-dialog.component.html',
  styleUrls: ['./loadout-uploader-dialog.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatSelectModule,
    MatDividerModule,
    MatChipsModule,
    InventoryGridComponent,
    EquipmentSlotsComponent,
    RunePouchComponent,
    BankTagLayoutGridComponent
  ]
})
export class LoadoutUploaderDialogComponent implements OnInit, OnDestroy {
  private jsonInputSubject = new Subject<string>();
  private subscriptions: Subscription[] = [];

  jsonForm: FormGroup;
  loadoutPreview: LoadoutPreview | null = null;
  isExpanded = false;
  imageError = false;

  readonly categories: { value: Category['type']; label: string }[] = [
    { value: 'Boss', label: 'Boss' },
    { value: 'Skill', label: 'Skill' },
    { value: 'Custom', label: 'Custom' }
  ];

  readonly availableTags: string[] = [
    'Bossing',
    'Slayer',
    'Raids',
    'Wilderness',
    'Skilling',
    'Money-maker',
    'Beginner',
    'Advanced',
    'Leagues'
  ];

  constructor(
    private fb: FormBuilder,
    private dialogRef: MatDialogRef<LoadoutUploaderDialogComponent>,
    private snackBar: MatSnackBar,
    private osrsApi: OsrsApiService,
    private loadoutService: LoadoutService,
    private firebaseService: FirebaseService,
    private bankTagLayoutService: BankTagLayoutService,
    private renderer: Renderer2
  ) {
    this.jsonForm = this.fb.group({
      json: ['', Validators.required],
      category: ['Boss', Validators.required],
      tags: [[]]
    });

    // Set up debounced JSON input handling
    this.subscriptions.push(
      this.jsonInputSubject.pipe(
        debounceTime(300),
        distinctUntilChanged()
      ).subscribe(value => {
        if (value) {
          this.parseJson(value);
        } else {
          this.loadoutPreview = null;
        }
      })
    );

    // Listen to form changes
    this.subscriptions.push(
      this.jsonForm.get('json')?.valueChanges.subscribe(value => {
        this.jsonInputSubject.next(value);
      }) || new Subscription()
    );

    this.subscriptions.push(
      this.jsonForm.get('category')?.valueChanges.subscribe(category => {
        if (this.loadoutPreview) {
          this.loadoutPreview = {
            ...this.loadoutPreview,
            category
          };
        }
      }) || new Subscription()
    );

    this.subscriptions.push(
      this.jsonForm.get('tags')?.valueChanges.subscribe(tags => {
        if (this.loadoutPreview) {
          this.loadoutPreview = {
            ...this.loadoutPreview,
            tags
          };
        }
      }) || new Subscription()
    );
  }

  ngOnInit() {
    this.renderer.addClass(document.body, 'show-captcha-badge');
  }

  ngOnDestroy() {
    this.renderer.removeClass(document.body, 'show-captcha-badge');
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  onPaste(event: ClipboardEvent) {
    const text = event.clipboardData?.getData('text');
    if (text) {
      this.jsonForm.patchValue({ json: text });
      this.jsonInputSubject.next(text);  // Trigger immediate parsing for paste
    }
  }

  async pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      this.jsonForm.patchValue({ json: text });
      this.jsonInputSubject.next(text);  // Trigger immediate parsing for paste
    } catch (err) {
      console.error('Failed to read clipboard:', err);
      this.snackBar.open('Failed to read from clipboard', 'Close', {
        duration: 3000
      });
    }
  }

  async parseJson(text: string) {
    try {
      // First, try to detect the format
      if (text.startsWith('banktaglayoutsplugin:') || text.startsWith('banktags,')) {
        // Validate format
        if (!this.isValidBankTagFormat(text)) {
          throw new Error('Invalid bank tag format');
        }

        // Parse as bank tag layout or bank tag
        const bankTagLayout = this.bankTagLayoutService.parseExport(text);
        
        // Preserve existing category and tags if we're reparsing
        const category = this.loadoutPreview?.category || this.jsonForm.get('category')?.value || 'Custom';
        const tags = this.loadoutPreview?.tags || this.jsonForm.get('tags')?.value || [];
        
        this.loadoutPreview = {
          setup: {
            name: bankTagLayout.name,
            inv: new Array(28).fill(null),  // Empty inventory
            eq: new Array(14).fill(null),   // Empty equipment
            afi: bankTagLayout.items.reduce((acc: Record<string, Item>, item: BankTagLayoutItem) => {
              acc[item.position.toString()] = { id: item.id, q: item.q };
              return acc;
            }, {})
          },
          type: text.startsWith('banktaglayoutsplugin:') ? 'banktaglayout' : 'banktag',
          category,
          tags,
          originalFormat: text  // Store original format
        };
        return;
      }

      // Try to parse as inventory setup JSON
      let jsonData: LoadoutPreview;
      try {
        jsonData = JSON.parse(text);
      } catch {
        jsonData = text as unknown as LoadoutPreview;
      }

      // Validate the setup structure
      if (!jsonData?.setup?.name || !Array.isArray(jsonData.setup.inv) || !Array.isArray(jsonData.setup.eq)) {
        throw new Error('Invalid loadout format');
      }

      // Validate array lengths
      if (jsonData.setup.inv.length !== 28 || jsonData.setup.eq.length !== 14) {
        throw new Error('Invalid loadout format: incorrect inventory or equipment size');
      }

      // Preserve existing category and tags if we're reparsing
      const category = this.loadoutPreview?.category || this.jsonForm.get('category')?.value || 'Custom';
      const tags = this.loadoutPreview?.tags || this.jsonForm.get('tags')?.value || [];

      this.loadoutPreview = {
        ...jsonData,
        type: 'inventory',
        category,
        tags
      };
    } catch (error) {
      console.error('Failed to parse input:', error);
      this.snackBar.open(
        error instanceof Error ? error.message : 'Invalid format',
        'Close',
        { duration: 3000 }
      );
      this.loadoutPreview = null;
    }
  }

  private isValidBankTagFormat(text: string): boolean {
    if (text.startsWith('banktaglayoutsplugin:')) {
      // Validate bank tag layout format
      const [layoutPart, tagPart] = text.split('banktag:');
      if (!layoutPart || !tagPart) return false;

      // Check if layout part has valid item:position pairs
      const itemStrings = layoutPart.split(',').slice(1); // Skip the name
      return itemStrings.every(str => {
        if (!str.includes(':')) return true; // Skip non-item strings
        const [idStr, posStr] = str.split(':');
        const id = parseInt(idStr);
        const pos = parseInt(posStr);
        return !isNaN(id) && !isNaN(pos) && pos >= 0;
      });
    } else if (text.startsWith('banktags,')) {
      // Validate bank tag format
      const parts = text.split(',');
      if (parts.length < 4) return false; // Need at least version, name, and one item

      // Check if all item IDs are valid numbers
      return parts.slice(3).every(idStr => {
        const id = parseInt(idStr);
        return !isNaN(id);
      });
    }
    return false;
  }

  getItemImageUrl(id: number): string {
    return this.osrsApi.getItemImageUrl(Math.abs(id));
  }

  getItemName(id: number): string {
    return this.osrsApi.getItemName(Math.abs(id));
  }

  getAfiItems(): KeyValue<string, Item>[] {
    if (!this.loadoutPreview?.setup?.afi) return [];
    return Object.entries(this.loadoutPreview.setup.afi).map(([key, value]) => ({
      key,
      value
    }));
  }

  hasAfiItems(): boolean {
    const afi = this.loadoutPreview?.setup?.afi;
    return !!afi && Object.keys(afi).length > 0;
  }

  get bankTagLayout() {
    if (!this.loadoutPreview || !this.loadoutPreview.setup.afi) return null;
    
    return {
      name: this.loadoutPreview.setup.name,
      items: Object.entries(this.loadoutPreview.setup.afi).map(([pos, item]) => ({
        id: item.id,
        position: parseInt(pos),
        q: item.q || 1
      })),
      bankTag: Object.values(this.loadoutPreview.setup.afi).map(item => item.id),
      width: 8,
      originalFormat: this.loadoutPreview.originalFormat
    } as BankTagLayout;
  }

  async onSubmit() {
    if (!this.loadoutPreview) return;

    try {
      const loadoutRef = doc(collection(this.firebaseService.getFirestore(), 'loadouts'));
      const loadoutId = loadoutRef.id;

      // Only include layout for inventory setups
      const layout = this.loadoutPreview.type === 'inventory' 
        ? this.loadoutPreview.layout?.map(val => 
            typeof val === 'string' ? parseInt(val, 10) : val
          ).filter((val): val is number => typeof val === 'number' && !isNaN(val))
        : undefined;

      const userId = await firstValueFrom(this.firebaseService.currentUser$);
      if (!userId) {
        throw new Error('Must be logged in to create a loadout');
      }

      const loadoutData: LoadoutData = {
        id: loadoutId,
        userId: userId.uid,
        setup: this.loadoutPreview.setup,
        ...(layout && { layout }), // Only include layout if it exists
        category: this.jsonForm.get('category')?.value || 'Custom',
        tags: this.jsonForm.get('tags')?.value || [],
        likes: 0,
        views: 0,
        isPublic: true,
        version: 1,
        type: this.loadoutPreview.type || 'inventory',
        createdAt: serverTimestamp() as unknown as Timestamp,
        updatedAt: serverTimestamp() as unknown as Timestamp,
        ...(this.loadoutPreview.originalFormat && { originalFormat: this.loadoutPreview.originalFormat }) // Include originalFormat if it exists
      };

      await this.loadoutService.createLoadout(loadoutData);
      this.dialogRef.close(true);
    } catch (error) {
      console.error('Failed to save loadout:', error);
      let errorMessage = 'Failed to save loadout';
      
      if (error instanceof Error) {
        if (error.message.includes('reCAPTCHA')) {
          errorMessage = error.message;
        } else if (error.message === 'Must be logged in to create a loadout') {
          errorMessage = error.message;
        }
      }
      
      this.snackBar.open(errorMessage, 'Close', { duration: 3000 });
    }
  }

  copyToClipboard(): void {
    if (!this.loadoutPreview) return;

    let exportText: string;
    if (this.loadoutPreview.type === 'banktag' || this.loadoutPreview.type === 'banktaglayout') {
      // Export as bank tag layout
      const layout = this.bankTagLayout;
      if (layout) {
        exportText = this.bankTagLayoutService.exportLayout(layout);
      } else {
        throw new Error('Failed to generate bank tag layout');
      }
    } else {
      // Export as inventory setup
      const setup = {
        setup: this.loadoutPreview.setup,
        layout: this.loadoutPreview.layout
      };
      exportText = JSON.stringify(setup);
    }

    navigator.clipboard.writeText(exportText)
      .then(() => {
        this.snackBar.open('Copied to clipboard!', 'Close', {
          duration: 3000
        });
      })
      .catch(err => {
        console.error('Failed to copy:', err);
        this.snackBar.open('Failed to copy to clipboard', 'Close', {
          duration: 3000
        });
      });
  }
} 