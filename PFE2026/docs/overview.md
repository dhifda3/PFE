# 🔴 CRITICAL TABLES - Phase 1 (MVP Essentials)

**Priority**: MUST IMPLEMENT FIRST  
**Estimated Time**: 2-3 days  
**Dependencies**: None (can start immediately)

---

## Overview

These tables are **essential** for the e-commerce platform to function. Without them, users cannot browse products, add to cart, or place orders.

---

## 1. CATEGORIES TABLE

### Purpose
Hierarchical product categorization system for Tunisian cosmetics (multi-level nested categories).

### Database Schema

```typescript
// infrastructure/db/schema/categories.ts
import { pgTable, varchar, text, timestamp } from 'drizzle-orm/pg-core';

export const categories = pgTable('categories', {
  id: varchar('id', { length: 255 }).primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  description: text('description'),
  parentId: varchar('parent_id', { length: 255 }).references(() => categories.id, { onDelete: 'cascade' }),
  displayOrder: integer('display_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});
```

### Entity

```typescript
// core/entities/Category.ts
export class Category {
  constructor(
    public readonly id: string,
    public name: string,
    public slug: string,
    public description: string | null,
    public parentId: string | null,
    public displayOrder: number = 0,
    public isActive: boolean = true,
    public createdAt: Date = new Date(),
    public updatedAt: Date = new Date()
  ) {}

  isRootCategory(): boolean {
    return this.parentId === null;
  }

  isSubcategory(): boolean {
    return this.parentId !== null;
  }
}
```

### Sample Data (Tunisian Cosmetics)

```typescript
// Seed data examples:
const rootCategories = [
  { name: 'Face Care', slug: 'face-care' },
  { name: 'Body Care', slug: 'body-care' },
  { name: 'Hair Care', slug: 'hair-care' },
  { name: 'Makeup', slug: 'makeup' },
  { name: 'Fragrances', slug: 'fragrances' },
  { name: 'Natural & Organic', slug: 'natural-organic' }
];

const subcategories = [
  // Face Care
  { name: 'Cleansers', slug: 'cleansers', parent: 'face-care' },
  { name: 'Moisturizers', slug: 'moisturizers', parent: 'face-care' },
  { name: 'Serums', slug: 'serums', parent: 'face-care' },
  { name: 'Face Masks', slug: 'face-masks', parent: 'face-care' },
  { name: 'Sunscreen', slug: 'sunscreen', parent: 'face-care' },
  
  // Body Care
  { name: 'Body Lotions', slug: 'body-lotions', parent: 'body-care' },
  { name: 'Body Scrubs', slug: 'body-scrubs', parent: 'body-care' },
  { name: 'Hand Cream', slug: 'hand-cream', parent: 'body-care' },
  
  // Hair Care
  { name: 'Shampoo', slug: 'shampoo', parent: 'hair-care' },
  { name: 'Conditioner', slug: 'conditioner', parent: 'hair-care' },
  { name: 'Hair Oils', slug: 'hair-oils', parent: 'hair-care' },
  { name: 'Hair Masks', slug: 'hair-masks', parent: 'hair-care' },
  
  // Makeup
  { name: 'Lipstick', slug: 'lipstick', parent: 'makeup' },
  { name: 'Foundation', slug: 'foundation', parent: 'makeup' },
  { name: 'Mascara', slug: 'mascara', parent: 'makeup' },
  { name: 'Eyeliner', slug: 'eyeliner', parent: 'makeup' }
];
```

### Repository Interface

```typescript
// core/repositories/ICategoryRepository.ts
export interface ICategoryRepository {
  findById(id: string): Promise<Category | null>;
  findAll(): Promise<Category[]>;
  findBySlug(slug: string): Promise<Category | null>;
  findByParentId(parentId: string | null): Promise<Category[]>;
  findRootCategories(): Promise<Category[]>;
  findSubcategories(parentId: string): Promise<Category[]>;
  getCategoryTree(): Promise<Category[]>; // Hierarchical structure
  create(category: Category): Promise<Category>;
  update(category: Category): Promise<Category>;
  delete(id: string): Promise<void>;
}
```

### Use Cases Needed

- `CreateCategoryUseCase`
- `GetCategoryUseCase`
- `ListCategoriesUseCase`
- `GetCategoryTreeUseCase` (hierarchical)
- `UpdateCategoryUseCase`
- `DeleteCategoryUseCase`

### Controller Endpoints

```
POST   /api/v1/categories          - Create category (admin)
GET    /api/v1/categories          - List all categories
GET    /api/v1/categories/tree     - Get hierarchical tree
GET    /api/v1/categories/:id      - Get single category
GET    /api/v1/categories/slug/:slug - Get by slug
PATCH  /api/v1/categories/:id      - Update category (admin)
DELETE /api/v1/categories/:id      - Delete category (admin)
```

---

## 2. PRODUCT VARIANTS TABLE

### Purpose
Handle product variations (size, color, scent, formulation) with different prices, SKUs, and stock levels.

### Database Schema

```typescript
// infrastructure/db/schema/product_variants.ts
import { pgTable, varchar, decimal, integer, boolean, jsonb, timestamp } from 'drizzle-orm/pg-core';

export const productVariants = pgTable('product_variants', {
  id: varchar('id', { length: 255 }).primaryKey(),
  productId: varchar('product_id', { length: 255 }).notNull().references(() => products.id, { onDelete: 'cascade' }),
  sku: varchar('sku', { length: 100 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(), // e.g., "50ml - Rose Scent"
  
  // Variant attributes (size, color, scent, etc.)
  attributes: jsonb('attributes').$type<{
    size?: string;      // e.g., "50ml", "100ml", "200ml"
    color?: string;     // e.g., "Red", "Pink", "Nude"
    scent?: string;     // e.g., "Rose", "Lavender", "Unscented"
    formulation?: string; // e.g., "Dry Hair", "Oily Hair", "Normal Hair"
  }>().notNull(),
  
  price: decimal('price', { precision: 10, scale: 2 }).notNull(),
  compareAtPrice: decimal('compare_at_price', { precision: 10, scale: 2 }), // Original price (for discounts)
  stock: integer('stock').notNull().default(0),
  lowStockThreshold: integer('low_stock_threshold').notNull().default(10),
  
  images: jsonb('images').$type<string[]>().notNull().default([]), // Variant-specific images
  
  isActive: boolean('is_active').notNull().default(true),
  isDefault: boolean('is_default').notNull().default(false), // One variant is default
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Index for faster queries
CREATE INDEX idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX idx_product_variants_sku ON product_variants(sku);
```

### Entity

```typescript
// core/entities/ProductVariant.ts
export interface VariantAttributes {
  size?: string;
  color?: string;
  scent?: string;
  formulation?: string;
}

export class ProductVariant {
  constructor(
    public readonly id: string,
    public productId: string,
    public sku: string,
    public name: string,
    public attributes: VariantAttributes,
    public price: number,
    public compareAtPrice: number | null,
    public stock: number,
    public lowStockThreshold: number = 10,
    public images: string[] = [],
    public isActive: boolean = true,
    public isDefault: boolean = false,
    public createdAt: Date = new Date(),
    public updatedAt: Date = new Date()
  ) {}

  isLowStock(): boolean {
    return this.stock <= this.lowStockThreshold && this.stock > 0;
  }

  isOutOfStock(): boolean {
    return this.stock <= 0;
  }

  hasDiscount(): boolean {
    return this.compareAtPrice !== null && this.compareAtPrice > this.price;
  }

  getDiscountPercentage(): number | null {
    if (!this.hasDiscount() || !this.compareAtPrice) return null;
    return Math.round(((this.compareAtPrice - this.price) / this.compareAtPrice) * 100);
  }
}
```

### Update Products Table

```typescript
// Add to existing products table
export const products = pgTable('products', {
  // ... existing fields ...
  hasVariants: boolean('has_variants').notNull().default(false),
  
  // These fields are nullable when hasVariants = true
  // (price/stock managed at variant level)
  price: decimal('price', { precision: 10, scale: 2 }),
  stock: integer('stock'),
});
```

### Repository Interface

```typescript
// core/repositories/IProductVariantRepository.ts
export interface IProductVariantRepository {
  findById(id: string): Promise<ProductVariant | null>;
  findBySku(sku: string): Promise<ProductVariant | null>;
  findByProductId(productId: string): Promise<ProductVariant[]>;
  findDefaultVariant(productId: string): Promise<ProductVariant | null>;
  findLowStockVariants(): Promise<ProductVariant[]>;
  create(variant: ProductVariant): Promise<ProductVariant>;
  update(variant: ProductVariant): Promise<ProductVariant>;
  reduceStock(id: string, quantity: number): Promise<void>;
  delete(id: string): Promise<void>;
}
```

### Use Cases Needed

- `CreateProductVariantUseCase`
- `GetProductVariantUseCase`
- `ListProductVariantsUseCase`
- `UpdateProductVariantUseCase`
- `DeleteProductVariantUseCase`
- `CheckVariantStockUseCase`

---

## 3. REVIEWS TABLE

### Purpose
Star ratings for products (1-5 stars).

### Database Schema

```typescript
// infrastructure/db/schema/reviews.ts
import { pgTable, varchar, text, integer, boolean, timestamp } from 'drizzle-orm/pg-core';

export const reviews = pgTable('reviews', {
  id: varchar('id', { length: 255 }).primaryKey(),
  productId: varchar('product_id', { length: 255 }).notNull().references(() => products.id, { onDelete: 'cascade' }),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => user.id, { onDelete: 'cascade' }),
  orderId: varchar('order_id', { length: 255 }).references(() => orders.id), // Verified purchase
  
  rating: integer('rating').notNull(), // 1-5 stars
  title: varchar('title', { length: 255 }),
  comment: text('comment'),
  
  isVerifiedPurchase: boolean('is_verified_purchase').notNull().default(false),
  isApproved: boolean('is_approved').notNull().default(false), // Moderation
  
  helpfulCount: integer('helpful_count').notNull().default(0), // "Was this helpful?" votes
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Indexes
CREATE INDEX idx_reviews_product_id ON reviews(product_id);
CREATE INDEX idx_reviews_user_id ON reviews(user_id);
CREATE UNIQUE INDEX idx_reviews_user_product ON reviews(user_id, product_id); // One review per user per product
```

### Entity

```typescript
// core/entities/Review.ts
export class Review {
  constructor(
    public readonly id: string,
    public productId: string,
    public userId: string,
    public orderId: string | null,
    public rating: number, // 1-5
    public title: string | null,
    public comment: string | null,
    public isVerifiedPurchase: boolean = false,
    public isApproved: boolean = false,
    public helpfulCount: number = 0,
    public createdAt: Date = new Date(),
    public updatedAt: Date = new Date()
  ) {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }
  }
}
```

### Update Products Table (Add Aggregate Rating)

```typescript
// Add to products table
export const products = pgTable('products', {
  // ... existing fields ...
  averageRating: decimal('average_rating', { precision: 3, scale: 2 }), // e.g., 4.56
  reviewCount: integer('review_count').notNull().default(0),
});
```

### Repository Interface

```typescript
// core/repositories/IReviewRepository.ts
export interface IReviewRepository {
  findById(id: string): Promise<Review | null>;
  findByProductId(productId: string): Promise<Review[]>;
  findByUserId(userId: string): Promise<Review[]>;
  findPendingReviews(): Promise<Review[]>; // For moderation
  hasUserReviewedProduct(userId: string, productId: string): Promise<boolean>;
  create(review: Review): Promise<Review>;
  update(review: Review): Promise<Review>;
  delete(id: string): Promise<void>;
  incrementHelpfulCount(id: string): Promise<void>;
  updateProductAverageRating(productId: string): Promise<void>; // Recalculate average
}
```

### Use Cases Needed

- `CreateReviewUseCase` (check: user bought product, hasn't reviewed yet)
- `GetProductReviewsUseCase`
- `UpdateReviewUseCase`
- `DeleteReviewUseCase`
- `ApproveReviewUseCase` (admin)
- `MarkReviewHelpfulUseCase`

---

## 4. WISHLISTS TABLE

### Purpose
Users can save favorite products for later.

### Database Schema

```typescript
// infrastructure/db/schema/wishlists.ts
import { pgTable, varchar, timestamp } from 'drizzle-orm/pg-core';

export const wishlists = pgTable('wishlists', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => user.id, { onDelete: 'cascade' }),
  productId: varchar('product_id', { length: 255 }).notNull().references(() => products.id, { onDelete: 'cascade' }),
  productVariantId: varchar('product_variant_id', { length: 255 }).references(() => productVariants.id, { onDelete: 'cascade' }),
  
  addedAt: timestamp('added_at').notNull().defaultNow()
});

// Indexes
CREATE INDEX idx_wishlists_user_id ON wishlists(user_id);
CREATE UNIQUE INDEX idx_wishlists_user_product ON wishlists(user_id, product_id, product_variant_id);
```

### Entity

```typescript
// core/entities/WishlistItem.ts
export class WishlistItem {
  constructor(
    public readonly id: string,
    public userId: string,
    public productId: string,
    public productVariantId: string | null,
    public addedAt: Date = new Date()
  ) {}
}
```

### Repository Interface

```typescript
// core/repositories/IWishlistRepository.ts
export interface IWishlistRepository {
  findByUserId(userId: string): Promise<WishlistItem[]>;
  isInWishlist(userId: string, productId: string, variantId?: string): Promise<boolean>;
  addToWishlist(item: WishlistItem): Promise<WishlistItem>;
  removeFromWishlist(userId: string, productId: string, variantId?: string): Promise<void>;
  clearWishlist(userId: string): Promise<void>;
}
```

### Use Cases Needed

- `AddToWishlistUseCase`
- `GetWishlistUseCase`
- `RemoveFromWishlistUseCase`
- `ClearWishlistUseCase`

### Controller Endpoints

```
GET    /api/v1/wishlist              - Get user's wishlist
POST   /api/v1/wishlist              - Add to wishlist
DELETE /api/v1/wishlist/:productId   - Remove from wishlist
DELETE /api/v1/wishlist              - Clear wishlist
```

---

## 5. ADDRESSES TABLE

### Purpose
Single shipping address per order (stored in orders), but reusable address templates for user convenience.

### Database Schema

```typescript
// infrastructure/db/schema/addresses.ts
import { pgTable, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core';

export const addresses = pgTable('addresses', {
  id: varchar('id', { length: 255 }).primaryKey(),
  userId: varchar('user_id', { length: 255 }).notNull().references(() => user.id, { onDelete: 'cascade' }),
  
  label: varchar('label', { length: 100 }), // "Home", "Work", "Parents"
  
  fullName: varchar('full_name', { length: 255 }).notNull(),
  phoneNumber: varchar('phone_number', { length: 50 }).notNull(),
  
  streetAddress: text('street_address').notNull(),
  city: varchar('city', { length: 100 }).notNull(), // Delegation/Municipality
  governorate: varchar('governorate', { length: 100 }).notNull(), // One of 24 governorates
  postalCode: varchar('postal_code', { length: 20 }).notNull(),
  
  additionalInfo: text('additional_info'), // Apartment number, floor, etc.
  
  isDefault: boolean('is_default').notNull().default(false),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Index
CREATE INDEX idx_addresses_user_id ON addresses(user_id);
```

### Tunisian Governorates Enum

```typescript
// core/entities/Address.ts
export enum TunisianGovernorate {
  ARIANA = 'Ariana',
  BEJA = 'Béja',
  BEN_AROUS = 'Ben Arous',
  BIZERTE = 'Bizerte',
  GABES = 'Gabès',
  GAFSA = 'Gafsa',
  JENDOUBA = 'Jendouba',
  KAIROUAN = 'Kairouan',
  KASSERINE = 'Kasserine',
  KEBILI = 'Kébili',
  KEF = 'Kef',
  MAHDIA = 'Mahdia',
  MANOUBA = 'Manouba',
  MEDENINE = 'Médenine',
  MONASTIR = 'Monastir',
  NABEUL = 'Nabeul',
  SFAX = 'Sfax',
  SIDI_BOUZID = 'Sidi Bouzid',
  SILIANA = 'Siliana',
  SOUSSE = 'Sousse',
  TATAOUINE = 'Tataouine',
  TOZEUR = 'Tozeur',
  TUNIS = 'Tunis',
  ZAGHOUAN = 'Zaghouan'
}
```

### Entity

```typescript
// core/entities/Address.ts
export class Address {
  constructor(
    public readonly id: string,
    public userId: string,
    public label: string | null,
    public fullName: string,
    public phoneNumber: string,
    public streetAddress: string,
    public city: string,
    public governorate: TunisianGovernorate,
    public postalCode: string,
    public additionalInfo: string | null,
    public isDefault: boolean = false,
    public createdAt: Date = new Date(),
    public updatedAt: Date = new Date()
  ) {}

  getFormattedAddress(): string {
    return `${this.streetAddress}, ${this.city}, ${this.governorate} ${this.postalCode}`;
  }
}
```

### Update Orders Table

```typescript
// Update orders table to reference address OR store snapshot
export const orders = pgTable('orders', {
  // ... existing fields ...
  
  // Option 1: Reference (if address deleted, order keeps reference)
  addressId: varchar('address_id', { length: 255 }).references(() => addresses.id),
  
  // Option 2: Snapshot (recommended - preserve exact address at order time)
  shippingAddress: jsonb('shipping_address').$type<{
    fullName: string;
    phoneNumber: string;
    streetAddress: string;
    city: string;
    governorate: string;
    postalCode: string;
    additionalInfo?: string;
  }>().notNull(),
});
```

### Repository Interface

```typescript
// core/repositories/IAddressRepository.ts
export interface IAddressRepository {
  findById(id: string): Promise<Address | null>;
  findByUserId(userId: string): Promise<Address[]>;
  findDefaultAddress(userId: string): Promise<Address | null>;
  create(address: Address): Promise<Address>;
  update(address: Address): Promise<Address>;
  setAsDefault(userId: string, addressId: string): Promise<void>;
  delete(id: string): Promise<void>;
}
```

### Use Cases Needed

- `CreateAddressUseCase`
- `GetUserAddressesUseCase`
- `UpdateAddressUseCase`
- `SetDefaultAddressUseCase`
- `DeleteAddressUseCase`

---

## Implementation Checklist

### For Each Table Above:

- [ ] Create database schema in `infrastructure/db/schema/`
- [ ] Create entity in `core/entities/`
- [ ] Create repository interface in `core/repositories/`
- [ ] Create repository implementation in `adapters/repositories/`
- [ ] Create mapper in `adapters/repositories/<name>/mappers/`
- [ ] Create use cases in `core/usecases/<name>/`
- [ ] Create DTOs in `api/dtos/`
- [ ] Create controller in `api/controllers/`
- [ ] Register repository in `config/AppContainers.ts`
- [ ] Register use cases in `config/AppContainers.ts`
- [ ] Export controller in `api/controllers/index.ts`
- [ ] Run `npm run db:generate` to create migration
- [ ] Run `npm run db:migrate` to apply to database
- [ ] Test endpoints in Postman/Scalar docs

---

## Database Migration Order

```bash
# 1. Create migration
npm run db:generate

# 2. Review generated SQL in drizzle/ folder

# 3. Apply migration
npm run db:migrate

# 4. Verify in Drizzle Studio
npm run db:studio
```

---

## Testing Priority

1. **Categories**: Create root category → Create subcategory → Get category tree
2. **Product Variants**: Create product with variants → Check stock management
3. **Reviews**: Create review → Verify average rating calculation
4. **Wishlist**: Add to wishlist → Remove from wishlist
5. **Addresses**: Create address → Set as default → Use in checkout

---

## 🚨 IMPORTANT NOTES

1. **Foreign Keys**: All tables use `onDelete: 'cascade'` - when a product is deleted, its variants/reviews are auto-deleted
2. **Indexes**: Added for common query patterns (product_id, user_id)
3. **Validation**: All DTOs must use `class-validator` decorators
4. **Result Pattern**: All use cases return `Result<T>`
5. **Events**: Emit events for: ReviewCreated, ProductAddedToWishlist, AddressCreated

---

**NEXT**: After completing these critical tables, proceed to `02-IMPORTANT-TABLES.md`