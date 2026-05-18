# PART 5: Use Cases, DI Registration, Testing and Deployment

**⚠️ PART 4 (Listeners) must be completed before starting this part!**

**🚨 THIS IS THE FINAL PART - READ CAREFULLY BEFORE IMPLEMENTATION**

---

## Table of Contents
1. Use Case Modifications
2. DI Registration (CRITICAL)
3. Testing
4. Deployment Checklist
5. Monitoring
6. Final Summary

---

## Use Case Modifications

### 1. UpdateProductVariantUseCase - Emit Stock Events

Add stock event emission when inventory is updated:

```typescript
// core/usecases/product/UpdateProductVariantUseCase.ts
import { Service, Inject } from 'typedi';
import { IDomainEventEmitter } from '../../events/IDomainEventEmitter.js';
import { VariantStockLowEvent } from '../../events/VariantStockLowEvent.js';
import { VariantOutOfStockEvent } from '../../events/VariantOutOfStockEvent.js';

@Service()
export class UpdateProductVariantUseCase implements IUpdateProductVariantUseCase {
  constructor(
    @Inject('IProductVariantRepository') private variantRepo: IProductVariantRepository,
    @Inject('IProductRepository') private productRepo: IProductRepository,
    @Inject('IDomainEventEmitter') private eventEmitter: IDomainEventEmitter
  ) {}

  async execute(input: UpdateProductVariantInput): Promise<Result<ProductVariant>> {
    try {
      // 1. Get existing variant
      const existingVariant = await this.variantRepo.findById(input.variantId);
      if (!existingVariant) {
        return ResultHelper.failure('Product variant not found', ErrorCode.NOT_FOUND);
      }

      // 2. Get product details (for event notifications)
      const product = await this.productRepo.findById(existingVariant.productId);
      if (!product) {
        return ResultHelper.failure('Product not found', ErrorCode.NOT_FOUND);
      }

      // 3. Update variant
      const updatedVariant = {
        ...existingVariant,
        ...input,
        updatedAt: new Date(),
      };

      await this.variantRepo.update(updatedVariant);

      // 4. Check stock levels and emit events if needed
      const previousStock = existingVariant.stock;
      const newStock = updatedVariant.stock;

      // Emit OUT OF STOCK event (stock reached 0)
      if (newStock === 0 && previousStock > 0) {
        console.log(`[UpdateProductVariantUseCase] 🚨 Variant ${input.variantId} is now OUT OF STOCK`);
        
        await this.eventEmitter.emit(
          new VariantOutOfStockEvent({
            variantId: updatedVariant.id,
            productId: product.id,
            productName: product.name,
            variantName: updatedVariant.name,
            sku: updatedVariant.sku,
          })
        );
      }
      // Emit LOW STOCK event (stock <= threshold but not 0)
      else if (
        newStock > 0 &&
        newStock <= updatedVariant.lowStockThreshold &&
        previousStock > updatedVariant.lowStockThreshold
      ) {
        console.log(`[UpdateProductVariantUseCase] ⚠️ Variant ${input.variantId} is LOW ON STOCK`);
        
        await this.eventEmitter.emit(
          new VariantStockLowEvent({
            variantId: updatedVariant.id,
            productId: product.id,
            productName: product.name,
            variantName: updatedVariant.name,
            sku: updatedVariant.sku,
            currentStock: newStock,
            threshold: updatedVariant.lowStockThreshold,
          })
        );
      }

      return ResultHelper.success(updatedVariant);
    } catch (error) {
      console.error('[UpdateProductVariantUseCase] Error:', error);
      return ResultHelper.failure('Failed to update variant', ErrorCode.INTERNAL_ERROR);
    }
  }
}
```

### 2. CreateReviewUseCase - Emit Review Events

```typescript
// core/usecases/review/CreateReviewUseCase.ts
import { Service, Inject } from 'typedi';
import { IDomainEventEmitter } from '../../events/IDomainEventEmitter.js';
import { ReviewCreatedEvent } from '../../events/ReviewCreatedEvent.js';
import { v4 as uuidv4 } from 'uuid';

@Service()
export class CreateReviewUseCase implements ICreateReviewUseCase {
  constructor(
    @Inject('IReviewRepository') private reviewRepo: IReviewRepository,
    @Inject('IDomainEventEmitter') private eventEmitter: IDomainEventEmitter
  ) {}

  async execute(input: CreateReviewInput): Promise<Result<Review>> {
    try {
      // 1. Check if user already reviewed this product
      const hasReviewed = await this.reviewRepo.hasUserReviewedProduct(
        input.userId,
        input.productId
      );

      if (hasReviewed) {
        return ResultHelper.failure(
          'You have already reviewed this product',
          ErrorCode.CONFLICT
        );
      }

      // 2. Create review entity
      const review = new Review(
        uuidv4(),
        input.userId,
        input.productId,
        input.rating,
        input.comment,
        input.images || [],
        !!input.orderId, // isVerifiedPurchase
        false, // isApproved (needs moderation)
        new Date(),
        new Date()
      );

      // 3. Save to database
      await this.reviewRepo.create(review);

      // 4. Emit event for async processing (notifications to admins)
      await this.eventEmitter.emit(
        new ReviewCreatedEvent({
          reviewId: review.id,
          productId: review.productId,
          userId: review.userId,
          rating: review.rating,
          comment: review.comment,
          isVerifiedPurchase: review.isVerifiedPurchase,
        })
      );

      return ResultHelper.success(review);
    } catch (error) {
      console.error('[CreateReviewUseCase] Error:', error);
      return ResultHelper.failure('Failed to create review', ErrorCode.INTERNAL_ERROR);
    }
  }
}
```

### 3. ApproveReviewUseCase - Emit Approval Event

```typescript
// core/usecases/review/ApproveReviewUseCase.ts
import { Service, Inject } from 'typedi';
import { IDomainEventEmitter } from '../../events/IDomainEventEmitter.js';
import { ReviewApprovedEvent } from '../../events/ReviewApprovedEvent.js';

@Service()
export class ApproveReviewUseCase implements IApproveReviewUseCase {
  constructor(
    @Inject('IReviewRepository') private reviewRepo: IReviewRepository,
    @Inject('IDomainEventEmitter') private eventEmitter: IDomainEventEmitter
  ) {}

  async execute(input: ApproveReviewInput): Promise<Result<void>> {
    try {
      // 1. Get review
      const review = await this.reviewRepo.findById(input.reviewId);
      if (!review) {
        return ResultHelper.failure('Review not found', ErrorCode.NOT_FOUND);
      }

      // 2. Check if already approved
      if (review.isApproved) {
        return ResultHelper.failure('Review already approved', ErrorCode.CONFLICT);
      }

      // 3. Approve review
      review.isApproved = true;
      review.updatedAt = new Date();
      await this.reviewRepo.update(review);

      // 4. Emit event (notify customer, update product rating)
      await this.eventEmitter.emit(
        new ReviewApprovedEvent({
          reviewId: review.id,
          productId: review.productId,
          userId: review.userId,
          rating: review.rating,
        })
      );

      return ResultHelper.success(undefined);
    } catch (error) {
      console.error('[ApproveReviewUseCase] Error:', error);
      return ResultHelper.failure('Failed to approve review', ErrorCode.INTERNAL_ERROR);
    }
  }
}
```

---

## DI Registration (CRITICAL - RULE 3)

**⚠️ CRITICAL:** All services MUST be registered in the TypeDI container in `config/AppContainers.ts`.

### Complete Registration Example

```typescript
// config/AppContainers.ts
import { Container } from 'typedi';

// ============================================
// EXISTING REGISTRATIONS (keep these)
// ============================================
import { UserRepository } from '../adapters/repositories/UserRepository.js';
import { ProductRepository } from '../adapters/repositories/ProductRepository.js';
// ... other existing imports

Container.set('IUserRepository', Container.get(UserRepository));
Container.set('IProductRepository', Container.get(ProductRepository));
// ... other existing registrations

// ============================================
// NEW REGISTRATIONS FOR EVENTS
// ============================================

// Event Listeners
import { VariantStockLowListener } from '../infrastructure/events/listeners/stock/VariantStockLowListener.js';
import { VariantOutOfStockListener } from '../infrastructure/events/listeners/stock/VariantOutOfStockListener.js';
import { ReviewCreatedListener } from '../infrastructure/events/listeners/review/ReviewCreatedListener.js';
import { ReviewApprovedListener } from '../infrastructure/events/listeners/review/ReviewApprovedListener.js';
import { ProductAddedToWishlistListener } from '../infrastructure/events/listeners/wishlist/ProductAddedToWishlistListener.js';
import { AddressCreatedListener } from '../infrastructure/events/listeners/address/AddressCreatedListener.js';

Container.set('VariantStockLowListener', Container.get(VariantStockLowListener));
Container.set('VariantOutOfStockListener', Container.get(VariantOutOfStockListener));
Container.set('ReviewCreatedListener', Container.get(ReviewCreatedListener));
Container.set('ReviewApprovedListener', Container.get(ReviewApprovedListener));
Container.set('ProductAddedToWishlistListener', Container.get(ProductAddedToWishlistListener));
Container.set('AddressCreatedListener', Container.get(AddressCreatedListener));

// Repositories (ensure these are registered if new)
import { ReviewRepository } from '../adapters/repositories/ReviewRepository.js';
import { WishlistRepository } from '../adapters/repositories/WishlistRepository.js';
import { AddressRepository } from '../adapters/repositories/AddressRepository.js';

Container.set('IReviewRepository', Container.get(ReviewRepository));
Container.set('IWishlistRepository', Container.get(WishlistRepository));
Container.set('IAddressRepository', Container.get(AddressRepository));

console.log('[DI] ✅ All event-related services registered');

export default Container;
```

### Important Notes:

1. **Notification classes** (like `LowStockAlertNotification`) do NOT need DI registration - instantiate them inline
2. **Event classes** (like `VariantStockLowEvent`) do NOT need DI registration - instantiate them inline
3. **Listeners** MUST be registered in the container
4. **Use cases** MUST be registered in the container

---

## Testing

### Unit Test Example: VariantStockLowListener

```typescript
// tests/unit/listeners/VariantStockLowListener.spec.ts
import { VariantStockLowListener } from '../../../infrastructure/events/listeners/stock/VariantStockLowListener.js';
import { VariantStockLowEvent } from '../../../core/events/VariantStockLowEvent.js';

describe('VariantStockLowListener', () => {
  let listener: VariantStockLowListener;
  let mockNotificationManager: jest.Mocked<NotificationManager>;
  let mockUserRepository: jest.Mocked<IUserRepository>;

  beforeEach(() => {
    mockNotificationManager = { send: jest.fn() } as any;
    mockUserRepository = { findAdmins: jest.fn() } as any;

    listener = new VariantStockLowListener(
      mockNotificationManager,
      mockUserRepository
    );
  });

  it('should notify all admins when stock is low', async () => {
    const mockAdmins = [
      { id: 'admin1', email: 'admin1@test.com' },
      { id: 'admin2', email: 'admin2@test.com' },
    ];

    mockUserRepository.findAdmins.mockResolvedValue(mockAdmins);

    const event = new VariantStockLowEvent({
      variantId: 'var123',
      productId: 'prod123',
      productName: 'Test Product',
      variantName: '50ml',
      sku: 'TEST-50',
      currentStock: 5,
      threshold: 10,
    });

    await listener.handle(event);

    expect(mockUserRepository.findAdmins).toHaveBeenCalledTimes(1);
    expect(mockNotificationManager.send).toHaveBeenCalledTimes(2);
  });

  it('should handle case when no admins exist', async () => {
    mockUserRepository.findAdmins.mockResolvedValue([]);

    const event = new VariantStockLowEvent({
      variantId: 'var123',
      productId: 'prod123',
      productName: 'Test Product',
      variantName: '50ml',
      sku: 'TEST-50',
      currentStock: 5,
      threshold: 10,
    });

    await expect(listener.handle(event)).resolves.not.toThrow();
    expect(mockNotificationManager.send).not.toHaveBeenCalled();
  });

  it('should be retryable', () => {
    expect(listener.retryable).toBe(true);
    expect(listener.maxRetries).toBe(3);
  });
});
```

---

## Deployment Checklist

### Phase 0: Prerequisites (DO THIS FIRST) ✅

- [ ] Add missing repository interface methods
- [ ] Implement repository methods
- [ ] Verify NotificationManager works
- [ ] Verify BullMQ worker is running

### Phase 1: Critical Events (Stock Alerts) 🔴

- [ ] Create event classes (VariantStockLowEvent, VariantOutOfStockEvent)
- [ ] Create notification classes (LowStockAlertNotification, OutOfStockAlertNotification)
- [ ] Create listeners (VariantStockLowListener, VariantOutOfStockListener)
- [ ] Register listeners in AppContainers.ts ⚠️
- [ ] Update EVENT_LISTENER_MAP
- [ ] Modify UpdateProductVariantUseCase
- [ ] Unit test listeners
- [ ] Integration test: Stock reduction → Admin notification
- [ ] Deploy to staging → Test → Deploy to production

### Phase 2: Review Events 🟡

- [ ] Create DTOs (ReviewDtos.ts with validation) ⚠️
- [ ] Create event classes (ReviewCreatedEvent, ReviewApprovedEvent)
- [ ] Create notification classes (ReviewModerationNotification, ReviewApprovedNotification)
- [ ] Create listeners (ReviewCreatedListener, ReviewApprovedListener)
- [ ] Register listeners in AppContainers.ts ⚠️
- [ ] Update EVENT_LISTENER_MAP
- [ ] Create/modify use cases (CreateReviewUseCase, ApproveReviewUseCase)
- [ ] Test review workflow
- [ ] Deploy to production

### Phase 3: Low-Priority Events 🟢

- [ ] Create DTOs (WishlistDtos.ts, AddressDtos.ts) ⚠️
- [ ] Create event classes
- [ ] Create listeners
- [ ] Register in AppContainers.ts ⚠️
- [ ] Update EVENT_LISTENER_MAP
- [ ] Modify use cases
- [ ] Deploy to production

---

## Monitoring

### Redis Queue Monitoring

```bash
# Check queue status
npm run events:worker:dev

# Monitor with BullBoard (if configured)
# http://localhost:3000/admin/queues
```

### Event Processing Logs

The EventProcessor logs:
- ✅ Total listeners executed
- ✅ Success/failure count
- ✅ Processing time
- ✅ Error details

---

## Final Summary

**✅ 100% COMPLIANT with Antigravity 10 Mandatory Rules**

**Priority Order:**
1. 🔴 Prerequisites (1-2 hours) - Repository methods
2. 🔴 Stock alerts (3-4 hours) - Critical inventory management
3. 🟡 Review moderation (3-4 hours) - Quality control
4. 🟢 Analytics events (1-2 hours) - Business insights

**Total Implementation Time:** 8-10 hours

**Key Benefits:**
- ✅ Real-time admin alerts for stock issues
- ✅ Automated review moderation workflow
- ✅ Analytics tracking
- ✅ Non-blocking async processing
- ✅ Automatic retries for critical events
- ✅ Full system compatibility

---

🚀 **Start with Phase 1 (stock alerts) and test thoroughly before proceeding!**

⚠️ **Remember: Test each phase in staging before production deployment!**