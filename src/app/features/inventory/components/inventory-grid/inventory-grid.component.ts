import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { InventoryItem } from '../../../../shared/models/inventory.model';
import { OsrsApiService } from '../../../../core/services/osrs-api.service';

@Component({
  selector: 'app-inventory-grid',
  templateUrl: './inventory-grid.component.html',
  styleUrls: ['./inventory-grid.component.scss'],
  standalone: true,
  imports: [CommonModule]
})
export class InventoryGridComponent implements OnInit {
  @Input() items: (InventoryItem | null)[] = [];
  @Input() layout: (string | number)[] = [];
  @Input() compact = false;
  @Output() itemsChange = new EventEmitter<{ items: (InventoryItem | null)[] }>();

  readonly ROWS = 7;
  readonly COLS = 4;
  readonly TOTAL_SLOTS = 28;
  
  private itemMap = new Map<number | string, InventoryItem>();

  constructor(private osrsApi: OsrsApiService) {}

  ngOnInit() {
    // Create a map of item IDs to items for faster lookup
    this.items.forEach(item => {
      if (item) {
        this.itemMap.set(item.id, item);
        this.itemMap.set(item.id.toString(), item);
      }
    });
  }

  getItemAtPosition(index: number): InventoryItem | null {
    return index < this.items.length ? this.items[index] : null;
  }

  getItemImageUrl(id: number): string {
    return this.osrsApi.getItemImageUrl(id);
  }

  getItemName(id: number): string {
    const item = this.osrsApi.getCachedItem(id);
    if (!item) return `Item ${id}`;
    return item.name.replace(/_/g, ' ');
  }

  getSlots(): number[] {
    return Array(this.TOTAL_SLOTS).fill(0).map((_, i) => i);
  }

  trackByFn(index: number): number {
    return index;
  }
} 