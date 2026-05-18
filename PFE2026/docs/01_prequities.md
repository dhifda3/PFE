# PART 1: Prerequisites and Repository Setup

**READ THIS FIRST BEFORE IMPLEMENTING ANYTHING**

---

## Table of Contents
1. Prerequisites - Repository Interface Updates
2. Implementation Examples

---

## Prerequisites - Repository Interface Updates

**⚠️ CRITICAL:** Before implementing events, ensure these repository interface methods exist. If they don't, add them to the interfaces FIRST (RULE 5).

### 1. IUserRepository - Add Admin Lookup

```typescript
// core/repositories/IUserRepository.ts
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(user: User): Promise<User>;
  update(user: User): Promise<User>;
  delete(id: string): Promise<void>;
  search(query: string): Promise<User[]>;
  
  // ⚠️ ADD THIS METHOD if it doesn't exist:
  /**
   * Find all users with admin role
   * @returns Array of admin users
   */
  findAdmins(): Promise<User[]>;
}
```

### 2. IReviewRepository - Add Review Checks

```typescript
// core/repositories/IReviewRepository.ts
export interface IReviewRepository {
  findById(id: string): Promise<Review | null>;
  findByProductId(productId: string): Promise<Review[]>;
  findByUserId(userId: string): Promise<Review[]>;
  create(review: Review): Promise<Review>;
  update(review: Review): Promise<Review>;
  delete(id: string): Promise<void>;
  
  // ⚠️ ADD THESE METHODS if they don't exist:
  /**
   * Check if user has already reviewed a product
   * @param userId - User ID
   * @param productId - Product ID
   * @returns True if user has reviewed this product
   */
  hasUserReviewedProduct(userId: string, productId: string): Promise<boolean>;
  
  /**
   * Recalculate and update product's average rating
   * @param productId - Product ID
   */
  updateProductAverageRating(productId: string): Promise<void>;
}
```

### 3. IWishlistRepository - Add Duplicate Check

```typescript
// core/repositories/IWishlistRepository.ts
export interface IWishlistRepository {
  findByUserId(userId: string): Promise<WishlistItem[]>;
  addToWishlist(item: WishlistItem): Promise<WishlistItem>;
  removeFromWishlist(userId: string, productId: string, variantId?: string): Promise<void>;
  clearWishlist(userId: string): Promise<void>;
  
  // ⚠️ ADD THIS METHOD if it doesn't exist:
  /**
   * Check if product is already in user's wishlist
   * @param userId - User ID
   * @param productId - Product ID
   * @param variantId - Optional variant ID
   * @returns True if item is in wishlist
   */
  isInWishlist(userId: string, productId: string, variantId?: string): Promise<boolean>;
}
```

### 4. Implementation Example

If these methods don't exist, implement them in the repository classes:

```typescript
// adapters/repositories/UserRepository.ts
async findAdmins(): Promise<User[]> {
  const dbUsers = await this.db
    .select()
    .from(users)
    .where(eq(users.role, 'admin')); // Assuming you have a role column
    
  return dbUsers.map(dbUser => UserMapper.toDomain(dbUser));
}

// adapters/repositories/ReviewRepository.ts
async hasUserReviewedProduct(userId: string, productId: string): Promise<boolean> {
  const result = await this.db
    .select()
    .from(reviews)
    .where(and(
      eq(reviews.userId, userId),
      eq(reviews.productId, productId)
    ))
    .limit(1);
    
  return result.length > 0;
}

async updateProductAverageRating(productId: string): Promise<void> {
  // Get all approved reviews for this product
  const productReviews = await this.db
    .select()
    .from(reviews)
    .where(and(
      eq(reviews.productId, productId),
      eq(reviews.isApproved, true)
    ));

  if (productReviews.length === 0) {
    await this.db
      .update(products)
      .set({ 
        averageRating: null, 
        reviewCount: 0 
      })
      .where(eq(products.id, productId));
    return;
  }

  const totalRating = productReviews.reduce((sum, review) => sum + review.rating, 0);
  const averageRating = totalRating / productReviews.length;

  await this.db
    .update(products)
    .set({ 
      averageRating: averageRating.toFixed(2), 
      reviewCount: productReviews.length 
    })
    .where(eq(products.id, productId));
}

// adapters/repositories/WishlistRepository.ts
async isInWishlist(userId: string, productId: string, variantId?: string): Promise<boolean> {
  const conditions = [
    eq(wishlists.userId, userId),
    eq(wishlists.productId, productId)
  ];
  
  if (variantId) {
    conditions.push(eq(wishlists.productVariantId, variantId));
  }

  const result = await this.db
    .select()
    .from(wishlists)
    .where(and(...conditions))
    .limit(1);
    
  return result.length > 0;
}
```

---

## Events Overview

### Priority Matrix

| Event | Priority | Channels | Parallel? | Retryable? |
|-------|----------|----------|-----------|------------|
| **VariantStockLowEvent** | 🔴 Critical | FCM + Email + DB | Sequential | Yes (3x) |
| **VariantOutOfStockEvent** | 🔴 Critical | FCM + Email + DB | Sequential | Yes (3x) |
| **ReviewCreatedEvent** | 🟡 High | FCM + DB | Parallel | Yes (3x) |
| **ReviewApprovedEvent** | 🟡 High | DB | Parallel | Yes (3x) |
| **ProductAddedToWishlistEvent** | 🟢 Low | DB only | Parallel | No |
| **AddressCreatedEvent** | 🟢 Low | DB only | Parallel | No |

---

## Next Steps

✅ **After completing this part:**
1. Verify all repository interfaces have the required methods
2. Implement any missing methods in repository classes
3. Test the implementations
4. Move to PART 2: DTOs and Event Classes

⚠️ **DO NOT proceed to PART 2 until all repository methods are implemented and tested!**