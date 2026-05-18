# PART 3: Notification Classes

**⚠️ PART 2 (DTOs and Events) must be completed before starting this part!**

---

## Notification Classes

All notifications extend the base `Notification` class and implement channel-specific methods.

### 1. LowStockAlertNotification (ADMIN)

**Purpose:** Alert admins when stock falls below threshold  
**Channels:** FCM + Email + Database (all channels for critical alert)

```typescript
// core/notifications/LowStockAlertNotification.ts
import { Notification } from './Notification.js';

export class LowStockAlertNotification extends Notification {
  private alertData: {
    productName: string;
    variantName: string;
    sku: string;
    currentStock: number;
    threshold: number;
  };

  constructor(alertData: {
    productName: string;
    variantName: string;
    sku: string;
    currentStock: number;
    threshold: number;
  }) {
    super();
    this.alertData = alertData;
  }

  /**
   * Send to admins via all channels (critical alert)
   */
  via(notifiable: any): string[] {
    return ['fcm', 'email', 'database'];
  }

  /**
   * Database notification
   */
  toDatabase(notifiable: any): Record<string, any> {
    return {
      title: '⚠️ Low Stock Alert',
      body: `${this.alertData.productName} - ${this.alertData.variantName} is running low (${this.alertData.currentStock} remaining)`,
      data: {
        type: 'low_stock_alert',
        productName: this.alertData.productName,
        variantName: this.alertData.variantName,
        sku: this.alertData.sku,
        currentStock: this.alertData.currentStock,
        threshold: this.alertData.threshold,
        severity: 'warning',
        actionUrl: '/admin/inventory',
      },
    };
  }

  /**
   * Email notification
   */
  toMail(notifiable: any): Record<string, any> {
    return {
      subject: `⚠️ Low Stock Alert: ${this.alertData.productName}`,
      html: this.generateEmailHTML(),
      text: this.generateEmailText(),
      data: {
        type: 'low_stock_alert',
        sku: this.alertData.sku,
        actionUrl: `${process.env.APP_URL}/admin/inventory`,
      },
    };
  }

  /**
   * FCM push notification
   */
  toFCM(notifiable: any): { title: string; body: string; data?: Record<string, any> } {
    return {
      title: '⚠️ Low Stock Alert',
      body: `${this.alertData.productName} - ${this.alertData.variantName}: ${this.alertData.currentStock} left`,
      data: {
        type: 'low_stock_alert',
        sku: this.alertData.sku,
        severity: 'warning',
        actionUrl: '/admin/inventory',
      },
    };
  }

  private generateEmailHTML(): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .alert-box { background-color: #fff3cd; border: 2px solid #ffc107; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .stock-info { background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 15px 0; }
            .button { display: inline-block; padding: 12px 24px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; }
            .label { font-weight: bold; color: #495057; }
          </style>
        </head>
        <body>
          <div class="alert-box">
            <h1>⚠️ Low Stock Alert</h1>
            <p><strong>Immediate action required!</strong></p>
          </div>
          
          <div class="stock-info">
            <div><span class="label">Product:</span> ${this.alertData.productName}</div>
            <div><span class="label">Variant:</span> ${this.alertData.variantName}</div>
            <div><span class="label">SKU:</span> ${this.alertData.sku}</div>
            <div><span class="label">Current Stock:</span> <strong>${this.alertData.currentStock}</strong></div>
            <div><span class="label">Threshold:</span> ${this.alertData.threshold}</div>
          </div>

          <p>This product variant is running low on stock. Please reorder or adjust inventory to prevent stockouts.</p>

          <p>
            <a href="${process.env.APP_URL}/admin/inventory" class="button">
              Manage Inventory
            </a>
          </p>
        </body>
      </html>
    `;
  }

  private generateEmailText(): string {
    return `
⚠️ Low Stock Alert

Immediate action required!

Product: ${this.alertData.productName}
Variant: ${this.alertData.variantName}
SKU: ${this.alertData.sku}
Current Stock: ${this.alertData.currentStock}
Threshold: ${this.alertData.threshold}

This product variant is running low on stock. Please reorder or adjust inventory to prevent stockouts.

Manage Inventory: ${process.env.APP_URL}/admin/inventory
    `.trim();
  }
}
```

---

### 2. OutOfStockAlertNotification (ADMIN)

**Purpose:** URGENT alert when product goes out of stock  
**Channels:** FCM + Email + Database (all channels for critical alert)

```typescript
// core/notifications/OutOfStockAlertNotification.ts
import { Notification } from './Notification.js';

export class OutOfStockAlertNotification extends Notification {
  private alertData: {
    productName: string;
    variantName: string;
    sku: string;
  };

  constructor(alertData: {
    productName: string;
    variantName: string;
    sku: string;
  }) {
    super();
    this.alertData = alertData;
  }

  via(notifiable: any): string[] {
    return ['fcm', 'email', 'database']; // All channels for critical alert
  }

  toDatabase(notifiable: any): Record<string, any> {
    return {
      title: '🚨 Out of Stock!',
      body: `${this.alertData.productName} - ${this.alertData.variantName} is now out of stock`,
      data: {
        type: 'out_of_stock_alert',
        productName: this.alertData.productName,
        variantName: this.alertData.variantName,
        sku: this.alertData.sku,
        severity: 'critical',
        actionUrl: '/admin/inventory',
      },
    };
  }

  toMail(notifiable: any): Record<string, any> {
    return {
      subject: `🚨 URGENT: ${this.alertData.productName} Out of Stock`,
      html: this.generateEmailHTML(),
      text: this.generateEmailText(),
      data: {
        type: 'out_of_stock_alert',
        sku: this.alertData.sku,
        actionUrl: `${process.env.APP_URL}/admin/inventory`,
      },
    };
  }

  toFCM(notifiable: any): { title: string; body: string; data?: Record<string, any> } {
    return {
      title: '🚨 Out of Stock',
      body: `${this.alertData.productName} - ${this.alertData.variantName} is OUT OF STOCK`,
      data: {
        type: 'out_of_stock_alert',
        sku: this.alertData.sku,
        severity: 'critical',
        actionUrl: '/admin/inventory',
      },
    };
  }

  private generateEmailHTML(): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .critical-box { background-color: #f8d7da; border: 2px solid #dc3545; padding: 20px; border-radius: 8px; margin: 20px 0; }
            .stock-info { background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin: 15px 0; }
            .button { display: inline-block; padding: 12px 24px; background-color: #dc3545; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="critical-box">
            <h1>🚨 CRITICAL: Out of Stock</h1>
            <p><strong>This product is now unavailable for purchase!</strong></p>
          </div>
          
          <div class="stock-info">
            <div><strong>Product:</strong> ${this.alertData.productName}</div>
            <div><strong>Variant:</strong> ${this.alertData.variantName}</div>
            <div><strong>SKU:</strong> ${this.alertData.sku}</div>
            <div><strong>Stock Level:</strong> <span style="color: #dc3545; font-weight: bold;">0 (OUT OF STOCK)</span></div>
          </div>

          <p>This product variant has run out of stock. Customers cannot purchase it until inventory is replenished.</p>

          <p>
            <a href="${process.env.APP_URL}/admin/inventory" class="button">
              Reorder Now
            </a>
          </p>
        </body>
      </html>
    `;
  }

  private generateEmailText(): string {
    return `
🚨 CRITICAL: Out of Stock

This product is now unavailable for purchase!

Product: ${this.alertData.productName}
Variant: ${this.alertData.variantName}
SKU: ${this.alertData.sku}
Stock Level: 0 (OUT OF STOCK)

This product variant has run out of stock. Customers cannot purchase it until inventory is replenished.

Reorder Now: ${process.env.APP_URL}/admin/inventory
    `.trim();
  }
}
```

---

### 3. ReviewModerationNotification (ADMIN)

**Purpose:** Notify admins of new reviews needing moderation  
**Channels:** FCM + Database

```typescript
// core/notifications/ReviewModerationNotification.ts
import { Notification } from './Notification.js';

export class ReviewModerationNotification extends Notification {
  private reviewData: {
    reviewId: string;
    productId: string;
    rating: number;
    comment?: string;
    isVerifiedPurchase: boolean;
  };

  constructor(reviewData: {
    reviewId: string;
    productId: string;
    rating: number;
    comment?: string;
    isVerifiedPurchase: boolean;
  }) {
    super();
    this.reviewData = reviewData;
  }

  via(notifiable: any): string[] {
    return ['fcm', 'database']; // FCM for immediate alert, DB for history
  }

  toDatabase(notifiable: any): Record<string, any> {
    const stars = '⭐'.repeat(this.reviewData.rating);
    return {
      title: 'New Review to Moderate',
      body: `${stars} review submitted${this.reviewData.isVerifiedPurchase ? ' (Verified Purchase)' : ''}`,
      data: {
        type: 'review_moderation',
        reviewId: this.reviewData.reviewId,
        productId: this.reviewData.productId,
        rating: this.reviewData.rating,
        isVerifiedPurchase: this.reviewData.isVerifiedPurchase,
        actionUrl: `/admin/reviews/${this.reviewData.reviewId}`,
      },
    };
  }

  toFCM(notifiable: any): { title: string; body: string; data?: Record<string, any> } {
    const stars = '⭐'.repeat(this.reviewData.rating);
    return {
      title: 'New Review to Moderate',
      body: `${stars}${this.reviewData.isVerifiedPurchase ? ' ✓ Verified' : ''}`,
      data: {
        type: 'review_moderation',
        reviewId: this.reviewData.reviewId,
        actionUrl: `/admin/reviews/${this.reviewData.reviewId}`,
      },
    };
  }
}
```

---

### 4. ReviewApprovedNotification (CUSTOMER)

**Purpose:** Notify customer their review is published  
**Channels:** Database only (non-intrusive)

```typescript
// core/notifications/ReviewApprovedNotification.ts
import { Notification } from './Notification.js';

export class ReviewApprovedNotification extends Notification {
  private reviewData: {
    reviewId: string;
    productId: string;
    productName: string;
  };

  constructor(reviewData: {
    reviewId: string;
    productId: string;
    productName: string;
  }) {
    super();
    this.reviewData = reviewData;
  }

  via(notifiable: any): string[] {
    return ['database']; // Database only, non-intrusive
  }

  toDatabase(notifiable: any): Record<string, any> {
    return {
      title: '✅ Your Review is Live!',
      body: `Your review for ${this.reviewData.productName} has been approved and published`,
      data: {
        type: 'review_approved',
        reviewId: this.reviewData.reviewId,
        productId: this.reviewData.productId,
        actionUrl: `/products/${this.reviewData.productId}`,
      },
    };
  }
}
```

---

## Next Steps

✅ **After completing this part:**
1. Create all notification class files
2. Test notification payload generation
3. Verify email HTML renders correctly
4. Move to PART 4: Event Listeners and Integration

⚠️ **DO NOT proceed to PART 4 until all notification classes are created and tested!**