import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BankTagLayout } from '../../../../shared/models/bank-tag-layout.model';
import { BankTagLayoutService } from '../../../../shared/services/bank-tag-layout.service';
import { OsrsApiService } from '../../../../core/services/osrs-api.service';

@Component({
  selector: 'app-bank-tag-layout-grid',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './bank-tag-layout-grid.component.html',
  styleUrls: ['./bank-tag-layout-grid.component.scss']
})
export class BankTagLayoutGridComponent implements OnInit {
  @Input() layout!: BankTagLayout;
  rows: (BankTagLayout['items'][0] | null)[][] = [];

  constructor(
    private bankTagLayoutService: BankTagLayoutService,
    private osrsApi: OsrsApiService
  ) {}

  ngOnInit() {
    this.updateGrid();
  }

  get gridTemplateColumns(): string {
    const minWidth = '28px';
    const maxWidth = '48px';
    return `repeat(${this.layout.width}, minmax(${minWidth}, ${maxWidth}))`;
  }

  private updateGrid() {
    const maxPosition = Math.max(...this.layout.items.map(item => item.position));
    const numRows = Math.floor(maxPosition / this.layout.width) + 1;
    
    this.rows = Array(numRows).fill(null).map((_, rowIndex) => {
      const startPos = rowIndex * this.layout.width;
      const endPos = startPos + this.layout.width;
      
      return Array(this.layout.width).fill(null).map((_, colIndex) => {
        const position = startPos + colIndex;
        return this.layout.items.find(item => item.position === position) || null;
      });
    });
  }

  getItemImageUrl(id: number): string {
    return this.osrsApi.getItemImageUrl(Math.abs(id));
  }

  getItemName(id: number): string {
    return this.osrsApi.getItemName(Math.abs(id));
  }

  onImageError(event: Event) {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }
} 