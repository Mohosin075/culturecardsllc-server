# Mobile App Integration Guide: Backend Features Handover

This document outlines the backend implementations, API schemas, and socket events for the features defined in [conversation-details](file:///d:/Mohosin/projects/culturecardsllc-server/conversation-details). All backend endpoints, data models, logic layers, and real-time socket events are fully implemented and ready for integration in the Flutter app.

---

## 🚀 Feature 1: Shipping Weight & Auto-Label Generation

The backend handles weight properties, automatic rates calculation, PDF shipping label generation (mocked via PDFkit), and order bundling logic.

### 1. Database Schema Additions
* **`Product` model:** Added `shippingWeight` (number, optional).
  * Check: [`product.interface.ts`](file:///d:/Mohosin/projects/culturecardsllc-server/src/app/modules/product/product.interface.ts#L37)
* **`Order` model:** Added `shippingWeight` (number, optional) and `shippingLabelUrl` (string, optional).
  * Check: [`order.interface.ts`](file:///d:/Mohosin/projects/culturecardsllc-server/src/app/modules/order/order.interface.ts#L44)

### 2. Shipping Calculation & Mock PDF Labels
When an order is created or paid:
* **Shipping Cost Calculation:** `5.00 + (weight * 0.50)` USD. This rate is dynamically added to `amountDetails.shipping` and updates `amountDetails.totalPaid`.
* **PDF Label Generation:** Generates a professional 4x6 shipping label PDF stored on disk under `/uploads/labels/label-[TRACKING_NUMBER].pdf`.
* **Tracking Fields:** Automatically generates tracking number `USPS-CC-[random_digits]` and sets the carrier as `USPS`.
* Implementation Reference: [`shippingHelper.ts`](file:///d:/Mohosin/projects/culturecardsllc-server/src/helpers/shippingHelper.ts#L6-L152)

### 3. Order Bundling (Grouping)
If the same buyer and seller have an existing pending order (type `auction_win` or `buy_now`) created within the last **12 hours**:
* The backend automatically bundles the new order under the **same** shipping label and tracking number.
* Sets `shippingWeight` and `shipping` cost to `$0` on the bundled order to avoid duplicate shipping charges.
* Integration Reference: [`auction.service.ts`](file:///d:/Mohosin/projects/culturecardsllc-server/src/app/modules/auction/auction.service.ts#L363-L383) & [`webhook.service.ts`](file:///d:/Mohosin/projects/culturecardsllc-server/src/app/modules/payment/webhook.service.ts#L120-L135)

---

## 🤝 Feature 2: "Buy Now" Custom Offers & Limits

This feature allows buyers to make custom swap/cash offers on products, validated against the seller's minimum criteria.

### 1. Listing Schema
* **`Product` model:** Added `allowOffers: boolean` and `minOfferAmount: number`.
  * Check: [`product.model.ts`](file:///d:/Mohosin/projects/culturecardsllc-server/src/app/modules/product/product.model.ts#L85-L92)

### 2. Offer Submission Validation
* **Endpoint:** `POST /trades/offer` (mapped to `createTradeOffer`)
* **Logic:** If `allowOffers` is active, the backend calculates:
  $$\text{Total Offer Value} = \text{Sender Product Est. Value} + \text{Cash Supplement}$$
  If the total offer value is less than the seller's `minOfferAmount`, the API throws `400 Bad Request`.
* Integration Reference: [`trade.service.ts`](file:///d:/Mohosin/projects/culturecardsllc-server/src/app/modules/trade/trade.service.ts#L40-L49)

### 3. Chat Notification Message
* On successful offer creation, the backend creates an interactive chat message of `messageType: 'trade_proposal'` with custom metadata:
  * `statusLabel`: `"NEW TRADE OFFER 🎁"`
  * `eta`: `"24 Hours Expire"`
* Integration Reference: [`trade.service.ts`](file:///d:/Mohosin/projects/culturecardsllc-server/src/app/modules/trade/trade.service.ts#L78-L91)

---

## 🎥 Feature 3: Live Bidding (Short Timers & Reactions)

Provides real-time floating heart reaction broadcasting and customizable short timers for auction bids.

### 1. Short Bid Timers
* **`AuctionItem` model:** Configured to support and validate shorter durations (e.g. `5`, `10`, `15` seconds) via `timerDuration`.
  * Check: [`auction.model.ts`](file:///d:/Mohosin/projects/culturecardsllc-server/src/app/modules/auction/auction.model.ts#L101-L106)

### 2. Live Stream Hearts/Likes (Socket.IO)
To send float reaction/likes in a live auction room:
* **Socket Event to Send:** `stream-reaction`
  * Payload format:
    ```json
    {
      "streamId": "STREAM_OBJECT_ID",
      "reactionType": "heart"
    }
    ```
* **Socket Event to Listen:** `new-reaction`
  * Payload received by all clients:
    ```json
    {
      "streamId": "STREAM_OBJECT_ID",
      "reactionType": "heart",
      "likesCount": 42 // updated counter incremented securely on database
    }
    ```
* Integration Reference: [`socketHelper.ts`](file:///d:/Mohosin/projects/culturecardsllc-server/src/helpers/socketHelper.ts#L231-L250)

---

## 💳 Feature 4: Live Auction Instant Auto-Payment

Forces off-session auto-debits on Stripe when an auction is won, removing the manual checkout step.

### 1. Payment Cards & SetupIntent Setup
Before entering an auction room, prompt the buyer to save their card.
* **API Endpoint:** `POST /payment/create-setup-intent` (returns the Stripe `clientSecret`).
* Use the client secret in the Flutter Stripe SDK to securely attach the card. The default payment card is automatically attached to the buyer's Stripe Customer ID.
* Integration Reference: [`payment.service.ts`](file:///d:/Mohosin/projects/culturecardsllc-server/src/app/modules/payment/payment.service.ts#L710-L770)

### 2. Auto-Debit on Auction Completion
* **Action:** When the host triggers `/auctions/complete`, the backend retrieves the winner's saved card details.
* **Execution:** Calls Stripe API with `confirm: true` and `off_session: true`.
* **Success Flow:**
  * Sets the order status to `paid` and marks the product as `sold`.
  * Emits socket notification to seller: `auction-payment-received`.
  * Emits socket notification to winner: `auction-won` with the success status.
  * Adds an automatic order confirmation message in the chat: `🏆 Auction Won! Payment complete...`
* Integration Reference: [`auction.service.ts`](file:///d:/Mohosin/projects/culturecardsllc-server/src/app/modules/auction/auction.service.ts#L296-L331) & [`auction.service.ts`](file:///d:/Mohosin/projects/culturecardsllc-server/src/app/modules/auction/auction.service.ts#L394-L430)

---

## 👤 Feature 5: Upcoming Shows on Profile

Integrates scheduled live streams directly into the seller profile detail API response.

* **API Endpoint:** `GET /users/profile` (gets current user's profile) or `GET /users/:userId` (gets another user's profile by ID)
* **Response Extension:** The backend filters `LiveStream` records with `sellerId = userId` (or `userId` from path params), `status: 'scheduled'`, and `scheduledAt > now`. The matches are returned inside the user object under the key `upcomingShows`.
* **Example JSON Output:**
  ```json
  {
    "_id": "60d5ec4b1a4c8a2b5c8b4567",
    "name": "CardCollector99",
    "email": "collector@gmail.com",
    "stats": { "followers": 12, "itemsSold": 5 },
    "upcomingShows": [
      {
        "_id": "60d5ec4b1a4c8a2b5c8b9876",
        "title": "Vintage Pack Opening Event!",
        "scheduledAt": "2026-08-25T18:00:00.000Z",
        "status": "scheduled",
        "agoraChannelName": "agora-channel-123"
      }
    ]
  }
  ```
* Integration Reference: [`user.service.ts`](file:///d:/Mohosin/projects/culturecardsllc-server/src/app/modules/user/user.service.ts#L388-L397)

---

## 🎡 Feature 6: Anti-Gambling Spin Wheel Policy

Securely determines spin wheel outcomes on the server side, ensuring absolute compliance with anti-gambling laws.

### 1. Guaranteed Reward Distribution
No spin can yield an empty/loss drop. The prize drop rates are configured dynamically on the server:
* **Common (65%):** `"10% Shop Coupon"` (degree sector $0^{\circ} - 90^{\circ}$)
* **Rare (25%):** `"Free Mystery Sticker Pack"` (degree sector $91^{\circ} - 210^{\circ}$)
* **Epic (9%):** `"Rare Card Sleeves"` (degree sector $211^{\circ} - 330^{\circ}$)
* **Legendary (1%):** `"Vintage Booster Pack (Legendary Drop)"` (degree sector $331^{\circ} - 359^{\circ}$)
* Prize Definitions Reference: [`socketHelper.ts`](file:///d:/Mohosin/projects/culturecardsllc-server/src/helpers/socketHelper.ts#L7-L38)

### 2. Real-Time Socket Events
* **Trigger Spin (App to Server):** `trigger-spin`
  * Payload:
    ```json
    {
      "streamId": "STREAM_OBJECT_ID",
      "sellerId": "SELLER_USER_ID"
    }
    ```
* **Spin Outcome (Server to App):** `spin-result` (broadcasts to all users in the stream room)
  * Payload:
    ```json
    {
      "streamId": "STREAM_OBJECT_ID",
      "prizeName": "Rare Card Sleeves",
      "rarity": "Epic",
      "degreeIndex": 245, // Map this degree index directly to the Flutter Spin Wheel rotation angle
      "timestamp": "2026-08-19T10:50:00.000Z"
    }
    ```
* Integration Reference: [`socketHelper.ts`](file:///d:/Mohosin/projects/culturecardsllc-server/src/helpers/socketHelper.ts#L252-L296)

---

## 🛠️ Verification & Test Flow
* All models are validated using **Zod schemas**.
* Socket.IO rooms are automatically joined when a user starts or connects to a live stream (`stream:${streamId}`).
* For custom testing of webhook-based order processing, check [`webhook.service.ts`](file:///d:/Mohosin/projects/culturecardsllc-server/src/app/modules/payment/webhook.service.ts).
