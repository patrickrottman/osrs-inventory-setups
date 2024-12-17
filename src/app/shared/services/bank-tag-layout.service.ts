import { Injectable } from '@angular/core';
import { BankTagLayout, BankTagLayoutItem } from '../models/bank-tag-layout.model';

@Injectable({
  providedIn: 'root'
})
export class BankTagLayoutService {
  constructor() {}

  parseExport(text: string): BankTagLayout {
    if (text.startsWith('banktaglayoutsplugin:')) {
      return this.parseBankTagLayoutFormat(text);
    } else if (text.startsWith('banktags,')) {
      return this.parseBankTagFormat(text);
    }
    throw new Error('Invalid bank tag format');
  }

  exportLayout(layout: BankTagLayout): string {
    if (layout.originalFormat) {
      return layout.originalFormat;
    }

    const itemParts = layout.items
      .filter(item => item.id && item.position !== undefined)
      .map(item => `${item.id}:${item.position}`)
      .join(',');
    const tagPart = layout.bankTag.join(',');
    return `banktaglayoutsplugin:${layout.name},${itemParts}banktag:${tagPart}`;
  }

  private parseBankTagLayoutFormat(text: string): BankTagLayout {
    const [layoutPart, tagPart] = text.split('banktag:');
    const parts = layoutPart.replace('banktaglayoutsplugin:', '').split(',');
    const name = parts[0];
    
    const items: BankTagLayoutItem[] = [];
    for (let i = 1; i < parts.length; i++) {
      if (!parts[i].includes(':')) continue;
      const [idStr, posStr] = parts[i].split(':');
      items.push({
        id: parseInt(idStr),
        position: parseInt(posStr),
        q: 1
      });
    }

    const bankTag = tagPart.split(',').map(id => parseInt(id));
    return { 
      name, 
      items, 
      bankTag, 
      width: 8,
      originalFormat: text 
    };
  }

  private parseBankTagFormat(text: string): BankTagLayout {
    const parts = text.split(',');
    if (parts.length < 4) throw new Error('Invalid bank tag format');

    const name = parts[2];
    const bankTag = parts.slice(3).map(id => parseInt(id));
    const items = bankTag.map((id, index) => ({
      id,
      position: index,
      q: 1
    }));

    return { 
      name, 
      items, 
      bankTag, 
      width: 8,
      originalFormat: text 
    };
  }
} 