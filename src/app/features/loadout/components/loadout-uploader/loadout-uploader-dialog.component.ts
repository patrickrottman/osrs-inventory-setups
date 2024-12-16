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
import { OsrsApiService } from '../../../../core/services/osrs-api.service';
import { LoadoutService } from '../../../../core/services/loadout.service';
import { FirebaseService } from '../../../../core/services/firebase.service';
import { LoadoutData, Setup, Category, Item } from '../../../../shared/models/inventory.model';
import { firstValueFrom } from 'rxjs';
import { serverTimestamp, collection, doc, Timestamp } from 'firebase/firestore';

interface LoadoutPreview {
  setup: Setup;
  layout?: (string | number)[];
  category?: Category['type'];
  tags?: string[];
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
    EquipmentSlotsComponent
  ]
})
export class LoadoutUploaderDialogComponent implements OnInit, OnDestroy {
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
    private renderer: Renderer2
  ) {
    this.jsonForm = this.fb.group({
      json: ['', Validators.required],
      category: ['Boss', Validators.required],
      tags: [[]]
    });

    // Listen to form changes to update preview
    this.jsonForm.get('category')?.valueChanges.subscribe(category => {
      if (this.loadoutPreview) {
        this.loadoutPreview = {
          ...this.loadoutPreview,
          category
        };
      }
    });

    this.jsonForm.get('tags')?.valueChanges.subscribe(tags => {
      if (this.loadoutPreview) {
        this.loadoutPreview = {
          ...this.loadoutPreview,
          tags
        };
      }
    });
  }

  ngOnInit() {
    // Show reCAPTCHA badge when dialog is opened
    this.renderer.addClass(document.body, 'show-captcha-badge');
  }

  ngOnDestroy() {
    // Hide reCAPTCHA badge when dialog is closed
    this.renderer.removeClass(document.body, 'show-captcha-badge');
  }

  onPaste(event: ClipboardEvent) {
    event.preventDefault();
    const text = event.clipboardData?.getData('text');
    if (text) {
      this.jsonForm.get('json')?.setValue(text);
      this.parseJson(text);
    }
  }

  async pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText();
      this.jsonForm.get('json')?.setValue(text);
      this.parseJson(text);
    } catch (error) {
      console.error('Failed to read clipboard:', error);
      this.snackBar.open('Failed to read clipboard', 'Close', {
        duration: 3000
      });
    }
  }

  async parseJson(text: string) {
    try {
      // Try to parse the input if it's a string
      let jsonData: LoadoutPreview;
      try {
        jsonData = JSON.parse(text);
      } catch {
        // If JSON.parse fails, check if it's already an object
        jsonData = text as unknown as LoadoutPreview;
      }

      // Validate the setup structure
      if (!jsonData?.setup?.name || !Array.isArray(jsonData.setup.inv) || !Array.isArray(jsonData.setup.eq)) {
        throw new Error('Invalid loadout format: missing required fields');
      }

      // Validate array lengths
      if (jsonData.setup.inv.length !== 28 || jsonData.setup.eq.length !== 14) {
        throw new Error('Invalid loadout format: incorrect inventory or equipment size');
      }

      this.loadoutPreview = {
        ...jsonData,
        category: this.jsonForm.get('category')?.value || 'custom',
        tags: this.jsonForm.get('tags')?.value || []
      };
    } catch (error) {
      console.error('Failed to parse JSON:', error);
      this.snackBar.open(
        error instanceof Error ? error.message : 'Invalid loadout format',
        'Close',
        { duration: 3000 }
      );
      this.loadoutPreview = null;
    }
  }

  getItemImageUrl(id: number): string {
    return this.osrsApi.getItemImageUrl(id);
  }

  getItemName(id: number): string {
    return this.osrsApi.getItemName(id);
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

  async onSubmit() {
    if (!this.loadoutPreview) return;

    try {
      const loadoutRef = doc(collection(this.firebaseService.getFirestore(), 'loadouts'));
      const loadoutId = loadoutRef.id;

      // Convert layout to numbers if it exists
      const layout = this.loadoutPreview?.layout?.map(val => 
        typeof val === 'string' ? parseInt(val, 10) : val
      ).filter((val): val is number => typeof val === 'number' && !isNaN(val));

      const userId = await firstValueFrom(this.firebaseService.currentUser$);
      if (!userId) {
        throw new Error('Must be logged in to create a loadout');
      }

      const loadoutData: LoadoutData = {
        id: loadoutId,
        userId: userId.uid,
        setup: this.loadoutPreview!.setup,
        layout,
        category: this.jsonForm.get('category')?.value || 'custom',
        tags: this.jsonForm.get('tags')?.value || [],
        likes: 0,
        views: 0,
        isPublic: true,
        version: 1,
        createdAt: serverTimestamp() as unknown as Timestamp,
        updatedAt: serverTimestamp() as unknown as Timestamp
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
} 