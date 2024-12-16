import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { InventoryItem } from '../../../../shared/models/inventory.model';
import { OsrsApiService } from '../../../../core/services/osrs-api.service';

@Component({
  selector: 'app-rune-pouch',
  templateUrl: './rune-pouch.component.html',
  styleUrls: ['./rune-pouch.component.scss'],
  standalone: true,
  imports: [CommonModule, MatIconModule]
})
export class RunePouchComponent {
  @Input() runes: (InventoryItem | null)[] = [];

  constructor(private osrsApi: OsrsApiService) {}

  getItemImageUrl(id: number): string {
    return this.osrsApi.getItemImageUrl(id);
  }

  getItemName(id: number): string {
    return this.osrsApi.getItemName(id);
  }
} 