import type { Timestamp } from 'firebase/firestore';
import type { Item } from './inventory.model';

export interface BankTagLayoutItem {
  id: number;
  position: number;
  q: number;
}

export interface BankTagLayout {
  name: string;
  items: BankTagLayoutItem[];
  bankTag: number[];
  width: number;
  originalFormat: string;
}

// The full Firestore document data
export interface BankTagLayoutData {
  id: string;
  userId: string;
  layout: BankTagLayout;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  likes?: number;
  views?: number;
  isPublic?: boolean;
  version?: number;
}

// Format for import/export
export interface BankTagLayoutExport {
  name: string;
  itemPositions: string;  // Format: "itemId:position,itemId:position,..."
  bankTag: string;        // Format: "banktag:name,id1,id2,..."
  originalFormat: string;
} 