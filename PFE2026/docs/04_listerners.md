# PART 4: Event Listeners and Use Case Integration

**⚠️ PART 3 (Notifications) must be completed before starting this part!**

---

## Table of Contents
1. Event Listeners
2. EVENT_LISTENER_MAP Updates
3. Use Case Modifications
4. DI Registration

---

## Event Listeners

### 1. VariantStockLowListener (CRITICAL)

**Purpose:** Send alerts to all admins when stock falls below threshold  
**Execution:** Sequential (not parallel) for critical path  
**Retryable:** Yes (3 attempts)

```typescript
// infrastructure/events/listeners/stock/VariantStockLowListener.ts
import { Service, Inject } from 'typedi';
import { IEventListener, IRetryableEventListener } from '../../../core/events/IEventListener.js';
import { DomainEvent } from '../../../core/events/DomainEvent.js';
import { VariantStockLowPayload } from '../../../core/events/VariantStockLowEvent.js';
import { NotificationManager } from '../../../core/notifications/NotificationManager.js';
import { LowStockAlertNotification } from '../../../core/notifications/LowStockAlertNotification.js';
import { IUserRepository } from '../../../core/repositories/IUserRepository.js';

/**
 * Listener for VARIANT_STOCK_LOW events
 * Sends critical alerts to all admins when variant stock is low
 * 
 * SEQUENTIAL execution (not parallel) to ensure proper processing
 * RETRYABLE with 3 attempts for critical notifications
 */
@Service()
export class VariantStockLowListener implements IEventListener<VariantStockLowPayload>, IRetryableEventListener<VariantStockLowPayload> {
  // IRetryableEventListener properties
  readonly retryable = true;
  readonly maxRetries = 3;

  constructor(
    @Inject('NotificationManager') private readonly notificationManager: NotificationManager,
    @Inject('IUserRepository') private readonly userRepository: IUserRepository
  ) {}

  async handle(event: DomainEvent<VariantStockLowPayload>): Promise<void> {
    console.log(`[VariantStockLowListener] Processing stock alert for SKU: ${event.payload.sku}`);

    try {
      // Get all admin users
      const admins = await this.userRepository.findAdmins();

      if (admins.length === 0) {
        console.warn('[VariantStockLowListener] No admin users found to notify');
        return;
      }

      // Create notification
      const notification = new LowStockAlertNotification({
        productName: event.payload.productName,
        variantName: event.payload.variantName,
        sku: event.payload.sku,
        currentStock: event.payload.currentStock,
        threshold: event.payload.threshold,
      });

      // Send to all admins
      for (const admin of admins) {
        await this.notificationManager.send(admin, notification);
      }

      console.log(`[VariantStockLowListener] Successfully notified ${admins.length} admins about low stock: ${event.payload.sku}`);
    } catch (error) {
      console.error(`[VariantStockLowListener] Failed to process low stock alert:`, error);
      throw error; // Rethrow to trigger retry
    }
  }
}
```

---

### 2. VariantOutOfStockListener (CRITICAL)

**Purpose:** Send URGENT alerts when product goes out of stock  
**Execution:** Sequential (critical path)  
**Retryable:** Yes (3 attempts)

```typescript
// infrastructure/events/listeners/stock/VariantOutOfStockListener.ts
import { Service, Inject } from 'typedi';
import { IEventListener, IRetryableEventListener } from '../../../core/events/IEventListener.js';
import { DomainEvent } from '../../../core/events/DomainEvent.js';
import { VariantOutOfStockPayload } from '../../../core/events/VariantOutOfStockEvent.js';
import { NotificationManager } from '../../../core/notifications/NotificationManager.js';
import { OutOfStockAlertNotification } from '../../../core/notifications/OutOfStockAlertNotification.js';
import { IUserRepository } from '../../../core/repositories/IUserRepository.js';

/**
 * Listener for VARIANT_OUT_OF_STOCK events
 * Sends URGENT alerts to all admins when variant is out of stock
 * 
 * SEQUENTIAL execution (not parallel) - critical path
 * RETRYABLE with 3 attempts
 */
@Service()
export class VariantOutOfStockListener implements IEventListener<VariantOutOfStockPayload>, IRetryableEventListener<VariantOutOfStockPayload> {
  readonly retryable = true;
  readonly maxRetries = 3;

  constructor(
    @Inject('NotificationManager') private readonly notificationManager: NotificationManager,
    @Inject('IUserRepository') private readonly userRepository: IUserRepository
  ) {}

  async handle(event: DomainEvent<VariantOutOfStockPayload>): Promise<void> {
    console.log(`[VariantOutOfStockListener] 🚨 CRITICAL: Product variant out of stock: ${event.payload.sku}`);

    try {
      // Get all admin users
      const admins = await this.userRepository.findAdmins();

      if (admins.length === 0) {
        console.error('[VariantOutOfStockListener] 🚨 CRITICAL: No admin users found to notify about stockout!');
        return;
      }

      // Create urgent notification
      const notification = new OutOfStockAlertNotification({
        productName: event.payload.productName,
        variantName: event.payload.variantName,
        sku: event.payload.sku,
      });

      // Send to all admins immediately
      for (const admin of admins) {
        await this.notificationManager.send(admin, notification);
      }

      console.log(`[VariantOutOfStockListener] Successfully sent urgent stockout alerts to ${admins.length} admins`);
    } catch (error) {
      console.error(`[VariantOutOfStockListener] Failed to send stockout alerts:`, error);
      throw error; // Rethrow to trigger retry
    }
  }
}
```

---

### 3. ReviewCreatedListener (HIGH PRIORITY)

**Purpose:** Notify admins about new reviews needing moderation  
**Execution:** Parallel (can run alongside other listeners)  
**Retryable:** Yes (3 attempts)

```typescript
// infrastructure/events/listeners/review/ReviewCreatedListener.ts
import { Service, Inject } from 'typedi';
import { IEventListener, IParallelEventListener, IRetryableEventListener } from '../../../core/events/IEventListener.js';
import { DomainEvent } from '../../../core/events/DomainEvent.js';
import { ReviewCreatedPayload } from '../../../core/events/ReviewCreatedEvent.js';
import { NotificationManager } from '../../../core/notifications/NotificationManager.js';
import { ReviewModerationNotification } from '../../../core/notifications/ReviewModerationNotification.js';
import { IUserRepository } from '../../../core/repositories/IUserRepository.js';

/**
 * Listener for REVIEW_CREATED events
 * Notifies admins about new reviews needing moderation
 * 
 * PARALLEL execution (can run alongside other listeners)
 * RETRYABLE with 3 attempts
 */
@Service()
export class ReviewCreatedListener implements 
  IEventListener<ReviewCreatedPayload>, 
  IParallelEventListener<ReviewCreatedPayload>,
  IRetryableEventListener<ReviewCreatedPayload> 
{
  readonly parallel = true;
  readonly retryable = true;
  readonly maxRetries = 3;

  constructor(
    @Inject('NotificationManager') private readonly notificationManager: NotificationManager,
    @Inject('IUserRepository') private readonly userRepository: IUserRepository
  ) {}

  async handle(event: DomainEvent<ReviewCreatedPayload>): Promise<void> {
    console.log(`[ReviewCreatedListener] New review created: ${event.payload.reviewId}, rating: ${event.payload.rating}`);

    try {
      // Get all admins for moderation
      const admins = await this.userRepository.findAdmins();

      if (admins.length === 0) {
        console.warn('[ReviewCreatedListener] No admin users found for review moderation');
        return;
      }

      // Create notification
      const notification = new ReviewModerationNotification({
        reviewId: event.payload.reviewId,
        productId: event.payload.productId,
        rating: event.payload.rating,
        comment: event.payload.comment,
        isVerifiedPurchase: event.payload.isVerifiedPurchase,
      });

      // Send to all admins
      for (const admin of admins) {
        await this.notificationManager.send(admin, notification);
      }

      console.log(`[ReviewCreatedListener] Successfully notified ${admins.length} admins about new review`);
    } catch (error) {
      console.error(`[ReviewCreatedListener] Failed to process review created event:`, error);
      throw error;
    }
  }
}
```

---

### 4. ReviewApprovedListener (HIGH PRIORITY)

**Purpose:** Notify customer review is live, update product rating  
**Execution:** Parallel  
**Retryable:** Yes (3 attempts)

```typescript
// infrastructure/events/listeners/review/ReviewApprovedListener.ts
import { Service, Inject } from 'typedi';
import { IEventListener, IParallelEventListener, IRetryableEventListener } from '../../../core/events/IEventListener.js';
import { DomainEvent } from '../../../core/events/DomainEvent.js';
import { ReviewApprovedPayload } from '../../../core/events/ReviewApprovedEvent.js';
import { NotificationManager } from '../../../core/notifications/NotificationManager.js';
import { ReviewApprovedNotification } from '../../../core/notifications/ReviewApprovedNotification.js';
import { IUserRepository } from '../../../core/repositories/IUserRepository.js';
import { IProductRepository } from '../../../core/repositories/IProductRepository.js';
import { IReviewRepository } from '../../../core/repositories/IReviewRepository.js';

/**
 * Listener for REVIEW_APPROVED events
 * 1. Notifies customer their review is live
 * 2. Updates product average rating
 * 
 * PARALLEL execution
 * RETRYABLE with 3 attempts
 */
@Service()
export class ReviewApprovedListener implements 
  IEventListener<ReviewApprovedPayload>,
  IParallelEventListener<ReviewApprovedPayload>,
  IRetryableEventListener<ReviewApprovedPayload>
{
  readonly parallel = true;
  readonly retryable = true;
  readonly maxRetries = 3;

  constructor(
    @Inject('NotificationManager') private readonly notificationManager: NotificationManager,
    @Inject('IUserRepository') private readonly userRepository: IUserRepository,
    @Inject('IProductRepository') private readonly productRepository: IProductRepository,
    @Inject('IReviewRepository') private readonly reviewRepository: IReviewRepository
  ) {}

  async handle(event: DomainEvent<ReviewApprovedPayload>): Promise<void> {
    console.log(`[ReviewApprovedListener] Review approved: ${event.payload.reviewId}`);

    try {
      // 1. Get user and product details
      const [user, product] = await Promise.all([
        this.userRepository.findById(event.payload.userId),
        this.productRepository.findById(event.payload.productId),
      ]);

      if (!user) {
        console.warn(`[ReviewApprovedListener] User not found: ${event.payload.userId}`);
        return;
      }

      if (!product) {
        console.warn(`[ReviewApprovedListener] Product not found: ${event.payload.productId}`);
        return;
      }

      // 2. Send notification to customer
      const notification = new ReviewApprovedNotification({
        reviewId: event.payload.reviewId,
        productId: event.payload.productId,
        productName: product.name,
      });

      await this.notificationManager.send(user, notification);

      // 3. Update product average rating (async - don't block on this)
      await this.reviewRepository.updateProductAverageRating(event.payload.productId);

      console.log(`[ReviewApprovedListener] Successfully processed review approval for ${event.payload.reviewId}`);
    } catch (error) {
      console.error(`[ReviewApprovedListener] Failed to process review approved event:`, error);
      throw error;
    }
  }
}
```

---

### 5. ProductAddedToWishlistListener (LOW PRIORITY)

**Purpose:** Track analytics for wishlist behavior  
**Execution:** Parallel  
**Retryable:** No (analytics, non-critical)

```typescript
// infrastructure/events/listeners/wishlist/ProductAddedToWishlistListener.ts
import { Service, Inject } from 'typedi';
import { IEventListener, IParallelEventListener } from '../../../core/events/IEventListener.js';
import { DomainEvent } from '../../../core/events/DomainEvent.js';
import { ProductAddedToWishlistPayload } from '../../../core/events/ProductAddedToWishlistEvent.js';

/**
 * Listener for PRODUCT_ADDED_TO_WISHLIST events
 * Tracks analytics for popular wishlisted products
 * 
 * PARALLEL execution
 * NOT retryable (analytics data, non-critical)
 */
@Service()
export class ProductAddedToWishlistListener implements 
  IEventListener<ProductAddedToWishlistPayload>,
  IParallelEventListener<ProductAddedToWishlistPayload>
{
  readonly parallel = true;

  async handle(event: DomainEvent<ProductAddedToWishlistPayload>): Promise<void> {
    console.log(`[ProductAddedToWishlistListener] Product added to wishlist: ${event.payload.productId} by user ${event.payload.userId}`);

    try {
      // Analytics tracking (future: send to analytics service)
      console.log('[ProductAddedToWishlistListener] Analytics tracked');
      
      // TODO: Future enhancement - notify user when price drops
      // TODO: Future enhancement - send personalized recommendations
    } catch (error) {
      // Don't throw - analytics failures shouldn't block other listeners
      console.error(`[ProductAddedToWishlistListener] Analytics tracking failed (non-critical):`, error);
    }
  }
}
```

---

### 6. AddressCreatedListener (LOW PRIORITY)

**Purpose:** Track analytics for shipping patterns  
**Execution:** Parallel  
**Retryable:** No (analytics, non-critical)

```typescript
// infrastructure/events/listeners/address/AddressCreatedListener.ts
import { Service } from 'typedi';
import { IEventListener, IParallelEventListener } from '../../../core/events/IEventListener.js';
import { DomainEvent } from '../../../core/events/DomainEvent.js';
import { AddressCreatedPayload } from '../../../core/events/AddressCreatedEvent.js';

/**
 * Listener for ADDRESS_CREATED events
 * Tracks analytics for shipping patterns
 * 
 * PARALLEL execution
 * NOT retryable (analytics data, non-critical)
 */
@Service()
export class AddressCreatedListener implements 
  IEventListener<AddressCreatedPayload>,
  IParallelEventListener<AddressCreatedPayload>
{
  readonly parallel = true;

  async handle(event: DomainEvent<AddressCreatedPayload>): Promise<void> {
    console.log(`[AddressCreatedListener] New address created in ${event.payload.governorate}, ${event.payload.city}`);

    try {
      // Analytics: Track popular delivery zones
      console.log(`[AddressCreatedListener] Tracking delivery zone: ${event.payload.governorate}`);
      
      // TODO: Future enhancement - Update shipping zone statistics
      // TODO: Future enhancement - Identify high-demand areas
    } catch (error) {
      console.error(`[AddressCreatedListener] Analytics tracking failed (non-critical):`, error);
    }
  }
}
```

---

## EVENT_LISTENER_MAP Updates

```typescript
// infrastructure/events/index.ts
import { UserSigninListener } from './listeners/notification/UserSigninListener.js';
import { VariantStockLowListener } from './listeners/stock/VariantStockLowListener.js';
import { VariantOutOfStockListener } from './listeners/stock/VariantOutOfStockListener.js';
import { ReviewCreatedListener } from './listeners/review/ReviewCreatedListener.js';
import { ReviewApprovedListener } from './listeners/review/ReviewApprovedListener.js';
import { ProductAddedToWishlistListener } from './listeners/wishlist/ProductAddedToWishlistListener.js';
import { AddressCreatedListener } from './listeners/address/AddressCreatedListener.js';

/**
 * Type for listener constructor functions that can be instantiated by TypeDI
 */
export type ListenerConstructor = new (...args: any[]) => any;

/**
 * Event listener registration map.
 * Maps event types to their corresponding listener class constructors.
 * These constructors will be used to dynamically instantiate listeners via TypeDI.
 */
export const EVENT_LISTENER_MAP: Record<string, ListenerConstructor[]> = {
  // Auth events
  'USER_SIGNIN': [UserSigninListener],
  
  // 🔴 CRITICAL - Stock alerts (Sequential, Retryable)
  'VARIANT_STOCK_LOW': [VariantStockLowListener],
  'VARIANT_OUT_OF_STOCK': [VariantOutOfStockListener],
  
  // 🟡 HIGH - Review events (Parallel, Retryable)
  'REVIEW_CREATED': [ReviewCreatedListener],
  'REVIEW_APPROVED': [ReviewApprovedListener],
  
  // 🟢 LOW - Analytics events (Parallel, Non-retryable)
  'PRODUCT_ADDED_TO_WISHLIST': [ProductAddedToWishlistListener],
  'ADDRESS_CREATED': [AddressCreatedListener],
};
```

---

## Next Steps

✅ **After completing this part:**
1. Create all listener files
2. Update EVENT_LISTENER_MAP
3. Test that listeners are properly registered
4. Move to PART 5: Use Cases and Final Integration

⚠️ **DO NOT proceed to PART 5 until all listeners are created and registered!**