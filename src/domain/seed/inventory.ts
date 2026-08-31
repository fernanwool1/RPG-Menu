import type { FinancialSnapshot, InventoryItem, InventoryLocation, ItemCondition } from '../types';

/* ------------------------------------------------------------------ */
/* Inventory seed                                                      */
/*                                                                     */
/* Real possessions and real money, not fantasy loot. Values are        */
/* obvious round-number samples and every one is editable.             */
/*                                                                     */
/* No serial numbers, account numbers, student ids or addresses are    */
/* seeded anywhere - the sensitiveIdentifier field exists but ships    */
/* empty, and is masked by default when a user fills it in.            */
/* ------------------------------------------------------------------ */

interface LocationSpec {
  slug: string;
  name: string;
  icon: string;
  virtual?: boolean;
}

const LOCATIONS: LocationSpec[] = [
  { slug: 'on-person', name: 'On Person', icon: 'person' },
  { slug: 'bag', name: 'Bag', icon: 'backpack' },
  { slug: 'home', name: 'Home', icon: 'home' },
  { slug: 'storage', name: 'Storage', icon: 'box' },
  { slug: 'all-assets', name: 'All Assets', icon: 'layers', virtual: true },
];

interface ItemSpec {
  slug: string;
  name: string;
  category: string;
  location: string;
  carried?: boolean;
  condition: ItemCondition;
  value: number;
  image?: string;
  notes?: string;
}

const ITEMS: ItemSpec[] = [
  /* --- Bag: the current loadout from the reference ---------------- */
  { slug: 'laptop', name: 'Laptop', category: 'Computer', location: 'bag', carried: true, condition: 'good', value: 1100, image: 'laptop' },
  { slug: 'ipad', name: 'iPad', category: 'Tablet', location: 'bag', carried: true, condition: 'good', value: 520, image: 'tablet' },
  { slug: 'mac-mini-neo', name: 'Mac Mini Neo', category: 'Desktop', location: 'bag', carried: true, condition: 'new', value: 780, image: 'desktop' },
  { slug: 'phone', name: 'Phone', category: 'Phone', location: 'bag', carried: true, condition: 'good', value: 640, image: 'phone' },
  { slug: 'headphones-i', name: 'Headphones I', category: 'Audio', location: 'bag', carried: true, condition: 'good', value: 180, image: 'headphones' },
  { slug: 'headphones-ii', name: 'Headphones II', category: 'Audio', location: 'bag', carried: true, condition: 'worn', value: 90, image: 'headphones' },
  { slug: 'id', name: 'ID', category: 'Documents', location: 'bag', carried: true, condition: 'good', value: 0, image: 'card', notes: 'Identifier field left empty on purpose.' },
  { slug: 'wallet', name: 'Wallet', category: 'Documents', location: 'bag', carried: true, condition: 'good', value: 40, image: 'wallet' },

  /* --- On person --------------------------------------------------- */
  { slug: 'keys', name: 'Keys', category: 'Everyday', location: 'on-person', carried: true, condition: 'good', value: 0, image: 'generic' },
  { slug: 'watch', name: 'Watch', category: 'Everyday', location: 'on-person', carried: true, condition: 'good', value: 60, image: 'generic' },
  { slug: 'notebook', name: 'Pocket Notebook', category: 'Everyday', location: 'on-person', carried: true, condition: 'worn', value: 12, image: 'generic' },

  /* --- Home -------------------------------------------------------- */
  { slug: 'acoustic-guitar', name: 'Acoustic Guitar', category: 'Instrument', location: 'home', condition: 'good', value: 280, image: 'generic' },
  { slug: 'electric-guitar', name: 'Electric Guitar', category: 'Instrument', location: 'home', condition: 'good', value: 340, image: 'generic' },
  { slug: 'audio-interface', name: 'Audio Interface', category: 'Audio', location: 'home', condition: 'good', value: 80, image: 'generic' },
  { slug: 'studio-monitors', name: 'Studio Monitors', category: 'Audio', location: 'home', condition: 'good', value: 110, image: 'generic' },
  { slug: 'external-monitor', name: 'External Monitor', category: 'Computer', location: 'home', condition: 'good', value: 100, image: 'generic' },
  { slug: 'mechanical-keyboard', name: 'Mechanical Keyboard', category: 'Computer', location: 'home', condition: 'good', value: 55, image: 'generic' },
  { slug: 'drawing-tablet', name: 'Drawing Tablet', category: 'Creative', location: 'home', condition: 'good', value: 85, image: 'generic' },
  { slug: 'camera', name: 'Camera', category: 'Creative', location: 'home', condition: 'good', value: 160, image: 'generic' },
  { slug: 'desk-lamp', name: 'Desk Lamp', category: 'Furniture', location: 'home', condition: 'good', value: 25, image: 'generic' },
  { slug: 'desk-chair', name: 'Desk Chair', category: 'Furniture', location: 'home', condition: 'worn', value: 65, image: 'generic' },
  { slug: 'bicycle', name: 'Bicycle', category: 'Sport', location: 'home', condition: 'good', value: 120, image: 'generic' },
  { slug: 'bookshelf', name: 'Bookshelf', category: 'Furniture', location: 'home', condition: 'good', value: 30, image: 'generic' },

  /* --- Storage ------------------------------------------------------ */
  { slug: 'old-laptop', name: 'Old Laptop', category: 'Computer', location: 'storage', condition: 'worn', value: 90, image: 'laptop' },
  { slug: 'amplifier', name: 'Practice Amplifier', category: 'Instrument', location: 'storage', condition: 'worn', value: 55, image: 'generic' },
  { slug: 'cable-box', name: 'Cable Box', category: 'Everyday', location: 'storage', condition: 'unknown', value: 20, image: 'generic' },
  { slug: 'winter-gear', name: 'Winter Gear', category: 'Clothing', location: 'storage', condition: 'good', value: 35, image: 'generic' },
];

export const locationId = (slug: string) => `loc_${slug}`;
export const itemId = (slug: string) => `itm_${slug}`;

export interface SeededInventory {
  locations: InventoryLocation[];
  items: InventoryItem[];
  finances: FinancialSnapshot;
}

export function buildInventorySeed(at: string): SeededInventory {
  return {
    locations: LOCATIONS.map((spec, index) => ({
      id: locationId(spec.slug),
      name: spec.name,
      icon: spec.icon,
      order: index,
      virtual: spec.virtual ?? false,
      createdAt: at,
      updatedAt: at,
    })),
    items: ITEMS.map((spec) => ({
      id: itemId(spec.slug),
      name: spec.name,
      category: spec.category,
      locationId: locationId(spec.location),
      carried: spec.carried ?? false,
      condition: spec.condition,
      estimatedValue: spec.value,
      purchaseDate: null,
      lastCheckedAt: at,
      notes: spec.notes,
      image: spec.image ?? 'generic',
      archived: false,
      createdAt: at,
      updatedAt: at,
    })),
    finances: {
      cash: 120,
      bank: 2840,
      currency: 'USD',
      updatedAt: at,
    },
  };
}
