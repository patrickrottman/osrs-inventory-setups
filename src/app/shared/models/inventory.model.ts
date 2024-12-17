import type { Timestamp } from 'firebase/firestore';

export interface Item {
  id: number;
  q?: number;  // quantity for stackable items
}

export type Equipment = Item;
export type InventoryItem = Item;

export interface Setup {
  inv: (Item | null)[];  // 28 slots
  eq: (Item | null)[];   // 14 slots
  afi?: Record<string, Item>;  // Additional filtered items
  rp?: (Item | null)[];  // Rune pouch slots
  name: string;
  notes?: string;
  hc?: string;  // highlight color
  hd?: boolean; // hide duplicates
  fb?: boolean; // filter bank
  uh?: boolean; // unordered highlight
  sb?: number;  // spellbook id
}

// The raw JSON data that can be imported/exported
export interface LoadoutJson {
  setup: Setup;
  layout?: (string | number)[];  // Optional layout information
  category?: Category['type'];
  tags?: string[];
}

// The full Firestore document data
export interface LoadoutData {
  id: string;
  userId: string;
  setup: Setup;
  layout?: number[];
  category: Category['type'];
  tags?: string[];
  likes?: number;
  views?: number;
  isPublic?: boolean;
  version?: number;
  type?: 'inventory' | 'banktag' | 'banktaglayout';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  originalFormat?: string;  // Add originalFormat property
}

export interface Category {
  type: 'Boss' | 'Skill' | 'Custom';
  name: string;
}

export interface SpecialAttack extends Item {
  name: string;
  description: string;
  energyCost: number;
} 