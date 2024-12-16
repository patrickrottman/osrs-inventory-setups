import { Component, Inject } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { LoadoutData, Setup } from '../../../../shared/models/inventory.model';
import { InventoryGridComponent } from '../../../inventory/components/inventory-grid/inventory-grid.component';
import { EquipmentSlotsComponent } from '../../../equipment/components/equipment-slots/equipment-slots.component';
import { RunePouchComponent } from '../../../inventory/components/rune-pouch/rune-pouch.component';
import { OsrsApiService } from '../../../../core/services/osrs-api.service';
import { FirebaseService } from '../../../../core/services/firebase.service';
import { LoadoutService } from '../../../../core/services/loadout.service';
import { Observable } from 'rxjs';
import { FirebaseDatePipe } from '../../../../shared/pipes/firebase-date.pipe';
import { DeleteConfirmationComponent } from './delete-confirmation.component';

interface Spellbook {
  name: string;
  image: string;
}

type SpellbookMap = Record<number, Spellbook>;

@Component({
  selector: 'app-loadout-modal',
  templateUrl: './loadout-modal.component.html',
  styleUrls: ['./loadout-modal.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatChipsModule,
    MatMenuModule,
    MatDividerModule,
    InventoryGridComponent,
    EquipmentSlotsComponent,
    RunePouchComponent,
    FirebaseDatePipe
  ],
  providers: [DatePipe]
})
export class LoadoutModalComponent {
  readonly SPELLBOOKS: SpellbookMap = {
    0: { name: 'Standard', image: 'Standard_spellbook_icon.png' },
    1: { name: 'Ancient', image: 'Ancient_spellbook_icon.png' },
    2: { name: 'Lunar', image: 'Lunar_spellbook_icon.png' },
    3: { name: 'Arceuus', image: 'Arceuus_spellbook_icon.png' }
  };

  isOwner = false;
  isLoggedIn$: Observable<boolean>;
  hasLiked = false;

  constructor(
    public dialogRef: MatDialogRef<LoadoutModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: LoadoutData,
    private osrsApi: OsrsApiService,
    private snackBar: MatSnackBar,
    private firebaseService: FirebaseService,
    private loadoutService: LoadoutService,
    private dialog: MatDialog
  ) {
    console.log('Modal data:', {
      loadoutId: data.id,
      userId: data.userId,
      name: data.setup.name
    });
    this.isLoggedIn$ = this.firebaseService.isLoggedIn$;
    this.isOwner = this.firebaseService.isLoadoutOwner(this.data);
    this.checkLikeStatus();
  }

  private async checkLikeStatus(): Promise<void> {
    if (!this.data.id) {
      console.error('Loadout ID is missing');
      return;
    }
    this.hasLiked = await this.loadoutService.hasUserLiked(this.data.id);
  }

  async toggleLike(): Promise<void> {
    try {
      if (!this.data.id) {
        throw new Error('Loadout ID is missing');
      }

      await this.loadoutService.toggleLike(this.data.id);
      this.hasLiked = !this.hasLiked;
      this.data.likes = (this.data.likes || 0) + (this.hasLiked ? 1 : -1);
      
      this.snackBar.open(
        this.hasLiked ? 'Added to your likes' : 'Removed from your likes',
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

  getItemImageUrl(id: number): string {
    return this.osrsApi.getItemImageUrl(id);
  }

  getItemName(id: number): string {
    return this.osrsApi.getItemName(id);
  }

  getFilteredItems() {
    if (!this.data.setup.afi) return [];
    return Object.values(this.data.setup.afi);
  }

  getSpellbookImage(spellbookId: number): string {
    const spellbook = this.SPELLBOOKS[spellbookId] || this.SPELLBOOKS[0];
    return `https://oldschool.runescape.wiki/images/${spellbook.image}`;
  }

  getSpellbookName(spellbookId: number): string {
    const spellbook = this.SPELLBOOKS[spellbookId] || this.SPELLBOOKS[0];
    return `${spellbook.name} Spellbook`;
  }

  async deleteLoadout(): Promise<void> {
    // Show confirmation dialog
    const dialogRef = this.dialog.open(DeleteConfirmationComponent, {
      width: '400px',
      data: { name: this.data.setup.name }
    });

    const confirmed = await dialogRef.afterClosed().toPromise();
    if (!confirmed) return;

    try {
      if (!this.data.id) {
        throw new Error('Loadout ID is missing');
      }

      await this.firebaseService.deleteLoadout(this.data.id);
      
      this.snackBar.open('Loadout deleted successfully', 'Close', {
        duration: 3000,
        panelClass: ['success-snackbar']
      });
      this.dialogRef.close('deleted');
    } catch (error) {
      console.error('Error deleting loadout:', error);
      this.snackBar.open('Failed to delete loadout', 'Close', {
        duration: 3000,
        panelClass: ['error-snackbar']
      });
    }
  }

  copyLoadout(): void {
    const setup: Setup = {
      inv: this.data.setup.inv,
      eq: this.data.setup.eq,
      rp: this.data.setup.rp,
      name: this.data.setup.name,
      hc: this.data.setup.hc,
      hd: this.data.setup.hd,
      fb: this.data.setup.fb,
      uh: this.data.setup.uh,
      sb: this.data.setup.sb
    };

    const layout = this.calculateLayout(setup);

    const essentialData = {
      setup,
      layout
    };

    navigator.clipboard.writeText(JSON.stringify(essentialData))
      .then(() => {
        this.snackBar.open('Loadout copied to clipboard!', 'Close', {
          duration: 3000
        });
      })
      .catch(err => {
        console.error('Error copying loadout:', err);
        this.snackBar.open('Failed to copy loadout', 'Close', {
          duration: 3000
        });
      });
  }

  private calculateLayout(setup: Setup): number[] {
    const layout: number[] = new Array(56).fill(-1);  // Increased size to 56 to match expected layout
    
    // Map inventory items first (starting at index 4)
    if (setup.inv) {
      setup.inv.forEach((item, index) => {
        if (item) {
          layout[index + 4] = item.id;
        }
      });
    }

    // Map equipment items
    if (setup.eq) {
      // Equipment mapping based on the expected layout
      const eqMapping = [
        { slot: 0, index: 1 },  // Head
        { slot: 1, index: 8 },  // Cape
        { slot: 2, index: 9 },  // Neck
        { slot: 3, index: 16 }, // Weapon
        { slot: 4, index: 17 }, // Body
        { slot: 5, index: 18 }, // Shield
        { slot: 6, index: 25 }, // Legs
        { slot: 7, index: 26 }, // Hands
        { slot: 8, index: 27 }, // Feet
        { slot: 9, index: 32 }, // Ring
        { slot: 10, index: 33 }, // Ammo
        { slot: 11, index: 34 }, // Extra 1
        { slot: 12, index: 35 }, // Extra 2
        { slot: 13, index: 10 }  // Extra 3
      ];

      setup.eq.forEach((item, slot) => {
        if (item) {
          const mapping = eqMapping[slot];
          if (mapping) {
            layout[mapping.index] = item.id;
          }
        }
      });
    }

    // Map rune pouch items (starting at index 40)
    if (setup.rp) {
      setup.rp.forEach((item, index) => {
        if (item) {
          layout[index + 40] = item.id;
        }
      });
    }

    return layout;
  }

  close(): void {
    this.dialogRef.close();
  }
} 