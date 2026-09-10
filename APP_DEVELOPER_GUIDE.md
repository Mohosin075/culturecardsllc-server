# CultureCards LLC (Aries) - Mobile App Developer Integration Guide

This document contains step-by-step API integration details for the Flutter / Mobile App developer. It is updated feature-by-feature as backend points are implemented.

---

## 1. User Registration + Guest Mode & Compliance

### 📌 Overview
- **Guest Access:** The app opens directly to the marketplace and live streams without forcing user registration or payment information.
- **Public Read Access:** All public read APIs (`/products`, `/auctions/streams`, `/category`, `/public/safety-disclaimer`) work **without any Authorization header**.
- **On-Demand Auth:** When a guest user attempts a protected action (bidding, buying, messaging, bookmarking), the API returns `401 Unauthorized`. The app should present a sign-up / login modal.

---

### 📡 Endpoint 1.1: Fetch Safety & Compliance Disclaimer
Use this API on app startup / onboarding screen to display the safety disclaimer notice.

- **Method:** `GET`
- **URL:** `/api/v1/public/safety-disclaimer`
- **Headers:** None (Public)

#### 🟢 Response Example (200 OK):
```json
{
  "statusCode": 200,
  "success": true,
  "message": "safety-disclaimer retrieved successfully",
  "data": {
    "type": "safety-disclaimer",
    "content": "Welcome to CultureCards LLC! Enjoy browsing sports cards, trading cards, and live stream auctions safely. Registration and payment methods are only required when you decide to place a bid or complete a purchase. Please trade responsibly."
  }
}
```

---

### 📡 Endpoint 1.2: Public Product & Stream Browsing (Guest Access)
These endpoints require **NO token** and allow full guest browsing:

1. **Get Products:** `GET /api/v1/products`
2. **Get Single Product:** `GET /api/v1/products/:id`
3. **Get Live Streams:** `GET /api/v1/auctions/streams`
4. **Get Categories:** `GET /api/v1/category`

#### 🔴 Handling 401 Unauthorized for Protected Actions:
When a user without a valid JWT token calls protected endpoints (e.g., `POST /auctions/bid` or `POST /orders`), the server returns:

```json
{
  "statusCode": 401,
  "success": false,
  "message": "Token not found!"
}
```

**Flutter App Action:** Catch HTTP 401 status and trigger the **"Sign Up / Log In to continue"** modal.

---

## 2. Giveaway / Spin-Wheel Winner System (Anti-Gambling Compliance)

### 📌 Overview
- **Automatic Enrollment:** Every newly registered user is automatically enrolled in the active Giveaway pool (14 days duration) upon signup.
- **No Purchase Necessary:** Ensures compliance with US anti-gambling laws.
- **Real Winner Selection:** When a live stream host triggers the Spin Wheel via Socket, the backend selects a real active participant from the pool and broadcasts the winner to all viewers in the stream room.

---

### 📡 Endpoint 2.1: Draw Live Giveaway Winner
Call this API or trigger via Socket (`trigger-spin`) during a live stream session.

- **Method:** `POST`
- **URL:** `/api/v1/giveaway/draw-winner`
- **Headers:** `Authorization: Bearer <SELLER_OR_ADMIN_JWT>`
- **Body:**
```json
{
  "streamId": "65ab1234c567890011223344"
}
```

#### 🟢 Response Example (200 OK):
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Giveaway winner drawn successfully: John Doe",
  "data": {
    "_id": "65cb99887766554433221100",
    "userId": "65ab1234c567890011223344",
    "name": "John Doe",
    "status": "won",
    "wonAt": "2026-09-09T10:15:00.000Z"
  }
}
```

---

### 🔌 Socket Event: `trigger-spin` & `spin-result`
- **Emit Event:** `trigger-spin`
  - Payload: `{ "streamId": "<STREAM_ID>", "sellerId": "<SELLER_USER_ID>" }`
- **Listen Event:** `spin-result`
  - Broadcast Payload:
```json
{
  "streamId": "65ab1234c567890011223344",
  "prizeName": "Rare Card Sleeves",
  "rarity": "Epic",
  "degreeIndex": 215,
  "winner": {
    "id": "65ab1234c567890011223344",
    "name": "John Doe"
  },
  "timestamp": "2026-09-09T10:15:00.000Z"
}
```

**Flutter App Action:** Play wheel spin animation mapping `degreeIndex`, then present the Overlay: **"🎉 Winner: John Doe won the Giveaway!"**.

---

## 3. Live Show Media & Go Live vs Schedule Show

### 📌 Overview
- **Go Live Immediately:** Seller inputs `title` and `coverImage` to start live streaming right away (`status: "live"`).
- **Schedule Show:** Seller inputs `title`, `coverImage`, optional `promoVideo` (3–10s preview), `scheduledStartTime`, and optional `inventoryIds` (product list linked to the show) to schedule for a future date/time (`status: "scheduled"`).
- **1-Tap Start Scheduled Show:** Seller can start a previously scheduled show with a single tap, switching its status to `"live"`.

---

### 📡 Endpoint 3.1: Create Live Stream (Go Live or Schedule Show)
- **Method:** `POST`
- **URL:** `/api/v1/auctions/stream`
- **Headers:** `Authorization: Bearer <SELLER_JWT>`
- **Body Example (Go Live Immediately):**
```json
{
  "title": "Friday Night Grail Card Breaks!",
  "coverImage": "https://s3.amazonaws.com/culturecards/cover1.jpg",
  "status": "live"
}
```

- **Body Example (Schedule Show for Future):**
```json
{
  "title": "Sunday Pokemon & Sports Break",
  "coverImage": "https://s3.amazonaws.com/culturecards/cover2.jpg",
  "promoVideo": "https://s3.amazonaws.com/culturecards/promo.mp4",
  "scheduledStartTime": "2026-09-12T18:00:00.000Z",
  "status": "scheduled",
  "inventoryIds": [
    "65ab1234c567890011223344",
    "65ab1234c567890011223345"
  ]
}
```

#### 🟢 Response Example (201 Created):
```json
{
  "statusCode": 201,
  "success": true,
  "message": "Live stream session initialized successfully.",
  "data": {
    "_id": "65dd99887766554433221122",
    "sellerId": "65ab1234c567890011223344",
    "title": "Sunday Pokemon & Sports Break",
    "coverImage": "https://s3.amazonaws.com/culturecards/cover2.jpg",
    "promoVideo": "https://s3.amazonaws.com/culturecards/promo.mp4",
    "scheduledStartTime": "2026-09-12T18:00:00.000Z",
    "status": "scheduled",
    "agoraChannelName": "channel_1773229200000_452",
    "inventoryIds": ["65ab1234c567890011223344", "65ab1234c567890011223345"]
  }
}
```

---

### 📡 Endpoint 3.2: Start Scheduled Show (1-Tap Go Live)
Seller starts a previously scheduled stream when showtime arrives.

- **Method:** `POST`
- **URL:** `/api/v1/auctions/stream/start-scheduled/:streamId`
- **Headers:** `Authorization: Bearer <SELLER_JWT>`

#### 🟢 Response Example (200 OK):
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Scheduled show started successfully.",
  "data": {
    "_id": "65dd99887766554433221122",
    "status": "live",
    "startedAt": "2026-09-12T18:00:01.000Z"
  }
}
```

---

## 4. Saved Shows / Bookmarks & Push Reminders

### 📌 Overview
- **Save / Bookmark Show:** Buyers can toggle bookmarking on scheduled shows.
- **Push Reminders:** The server background scheduler automatically sends push notifications to all bookmarked users **15 minutes before showtime**.

---

### 📡 Endpoint 4.1: Toggle Bookmark / Save Show
- **Method:** `POST`
- **URL:** `/api/v1/auctions/stream/:streamId/bookmark`
- **Headers:** `Authorization: Bearer <USER_JWT>`

#### 🟢 Response Example (200 OK - Bookmarked):
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Show bookmarked successfully.",
  "data": {
    "isBookmarked": true
  }
}
```

#### 🟢 Response Example (200 OK - Unbookmarked):
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Show bookmark removed.",
  "data": {
    "isBookmarked": false
  }
}
```

---

### 📡 Endpoint 4.2: Get User's Saved Upcoming Shows
- **Method:** `GET`
- **URL:** `/api/v1/auctions/saved-shows`
- **Headers:** `Authorization: Bearer <USER_JWT>`

#### 🟢 Response Example (200 OK):
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Saved shows retrieved successfully.",
  "data": [
    {
      "_id": "65dd99887766554433221122",
      "title": "Sunday Pokemon & Sports Break",
      "coverImage": "https://s3.amazonaws.com/culturecards/cover2.jpg",
      "promoVideo": "https://s3.amazonaws.com/culturecards/promo.mp4",
      "scheduledStartTime": "2026-09-12T18:00:00.000Z",
      "status": "scheduled",
      "sellerId": {
        "_id": "65ab1234c567890011223344",
        "name": "Collector Pro",
        "photo": "https://s3.amazonaws.com/culturecards/profile.jpg"
      },
      "inventoryIds": [
        {
          "_id": "65ab1234c567890011223344",
          "title": "1999 Charizard Holo PSA 10",
          "price": 500
        }
      ]
    }
  ]
}
```

---

## 5. Live Show Inventory Integration & Quick-Start Auction

### 📌 Overview
- **Include Inventory:** Sellers select products from their marketplace listings before or during a live stream.
- **On-Screen Inventory List:** Viewers and hosts can view the pre-linked card inventory of the stream.
- **1-Click Quick-Start Auction:** Host picks any card from the show inventory and launches an active auction in 1 click without re-entering product information.

---

### 📡 Endpoint 5.1: Attach / Update Live Stream Inventory
- **Method:** `PATCH`
- **URL:** `/api/v1/auctions/stream/:streamId/inventory`
- **Headers:** `Authorization: Bearer <SELLER_JWT>`
- **Body:**
```json
{
  "inventoryIds": [
    "65ab1234c567890011223344",
    "65ab1234c567890011223345"
  ]
}
```

#### 🟢 Response Example (200 OK):
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Stream inventory updated successfully.",
  "data": {
    "_id": "65dd99887766554433221122",
    "title": "Sunday Pokemon & Sports Break",
    "inventoryIds": [
      {
        "_id": "65ab1234c567890011223344",
        "title": "1999 Charizard Holo PSA 10",
        "startingBid": 100,
        "images": ["https://s3.amazonaws.com/culturecards/card1.jpg"]
      }
    ]
  }
}
```

---

### 📡 Endpoint 5.2: Get Stream Inventory Products
- **Method:** `GET`
- **URL:** `/api/v1/auctions/stream/:streamId/inventory`
- **Headers:** None (Public)

#### 🟢 Response Example (200 OK):
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Stream inventory products retrieved successfully.",
  "data": [
    {
      "_id": "65ab1234c567890011223344",
      "title": "1999 Charizard Holo PSA 10",
      "condition": "Mint",
      "estValue": 500,
      "startingBid": 100,
      "images": ["https://s3.amazonaws.com/culturecards/card1.jpg"]
    }
  ]
}
```

---

### 📡 Endpoint 5.3: 1-Click Quick-Start Active Auction
Seller picks a product from inventory and instantly starts the auction on-stream.

- **Method:** `POST`
- **URL:** `/api/v1/auctions/item/quick-start`
- **Headers:** `Authorization: Bearer <SELLER_JWT>`
- **Body:**
```json
{
  "streamId": "65dd99887766554433221122",
  "productId": "65ab1234c567890011223344",
  "startingBid": 50,
  "timerDuration": 60,
  "bidIncrement": 1
}
```

#### 🟢 Response Example (201 Created):
```json
{
  "statusCode": 201,
  "success": true,
  "message": "Active auction launched successfully.",
  "data": {
    "_id": "65ee99887766554433229999",
    "streamId": "65dd99887766554433221122",
    "productId": "65ab1234c567890011223344",
    "currentBid": 50,
    "bidIncrement": 1,
    "timerDuration": 60,
    "status": "active",
    "endsAt": "2026-09-09T10:45:00.000Z"
  }
}
```

**Real-Time Socket Event:** Emits `auction-item-started` to room `stream:${streamId}` so all viewers' UI updates instantly with the new active card auction.

---

## 6. Fixed $1 Bid Increment & Fast 1-Tap Bidding

### 📌 Overview
- **Fast 1-Tap Bidding:** Live auctions run on fast 5, 10, or 15-second timers. To eliminate delay from typing custom bid amounts, bidding is strictly enforced with a **Fixed $1 Bid Increment**.
- **Simplified Payload:** Buyers can place a bid by sending only `{ "auctionItemId": "..." }`. The server automatically calculates `currentBid + $1` (or starting price for first bid).

---

### 📡 Endpoint 6.1: Place Fast $1 Increment Bid (1-Tap Bid)
- **Method:** `POST`
- **URL:** `/api/v1/auctions/bid`
- **Headers:** `Authorization: Bearer <BUYER_JWT>`
- **Body Example (1-Tap Bid - No bidAmount required):**
```json
{
  "auctionItemId": "65ee99887766554433229999"
}
```

- **Body Example (Optional explicit bidAmount - MUST equal currentBid + 1):**
```json
{
  "auctionItemId": "65ee99887766554433229999",
  "bidAmount": 51
}
```

#### 🟢 Response Example (200 OK):
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Bid placed successfully.",
  "data": {
    "_id": "65ee99887766554433229999",
    "currentBid": 51,
    "highestBidderId": "65ab1234c567890011223344",
    "endsAt": "2026-09-09T10:45:15.000Z"
  }
}
```

#### 🔴 Error Example (If invalid bid amount sent):
```json
{
  "statusCode": 400,
  "success": false,
  "message": "Fixed $1 bid increment required. Expected bid is $51."
}
```

**Real-Time Socket Event:** Emits `new-bid` to room `stream:${streamId}` with updated `currentBid`, `highestBidder`, and `endsAt`.

---

## 7. Admin, Compliance & Data Retention Policy

### 📌 Overview
- **Legal Webview Endpoints:** App developers can render live webviews or fetch legal content for Privacy Policy and Terms & Conditions.
- **Data Retention & Auto-Delete Policy:** Enforces US CCPA/CPRA compliance.
  - Notifications older than **90 days** are purged automatically.
  - Expired OTP and session tokens are deleted automatically.
  - Deleted user accounts PII (`status === "deleted"`) is anonymized / purged after **30 days** of deletion.

---

### 📡 Endpoint 7.1: Public Legal Document Webviews (HTML)
Mobile apps can load these URLs inside a Webview widget:

- **Privacy Policy URL:** `GET /privacy-policy`
- **Terms & Conditions URL:** `GET /terms-and-conditions`

---

### 📡 Endpoint 7.2: Public Legal Document API (JSON Data)
If building native UI screens instead of Webviews:

- **Privacy Policy:** `GET /api/v1/public/privacy-policy`
- **Terms & Conditions:** `GET /api/v1/public/terms-and-condition`

#### 🟢 Response Example (200 OK):
```json
{
  "statusCode": 200,
  "success": true,
  "message": "privacy-policy retrieved successfully",
  "data": {
    "type": "privacy-policy",
    "content": "<div class=\"legal-document\">...</div>"
  }
}
```

---

## 8. Card Management & Pay with Saved Card

### 📡 Endpoint 8.1: Add New Card (Create Setup Intent)
Call this when the user taps "Add Card" in the app.

- **Method:** `POST`
- **URL:** `/api/v1/payment/create-setup-intent`
- **Headers:** `Authorization: Bearer <JWT_TOKEN>`
- **Body:** `{}` (empty)

#### 🟢 Response Example (200 OK):
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Setup intent created successfully",
  "data": {
    "clientSecret": "seti_1PXXXX_secret_YYYYY"
  }
}
```

#### 📱 Mobile App Flow (Flutter / React Native):
1. Call `POST /api/v1/payment/create-setup-intent` to get `clientSecret`.
2. Pass `clientSecret` to Stripe SDK (e.g. `initPaymentSheet` or `confirmSetup`).
3. User enters card details into the Stripe sheet.
4. On success, Stripe securely saves the card under the user's customer profile.

---

### 📡 Endpoint 8.2: Show Saved Cards (Get Cards List)
Call this to display the list of cards saved by the user.

- **Method:** `GET`
- **URL:** `/api/v1/payment/methods`
- **Headers:** `Authorization: Bearer <JWT_TOKEN>`

#### 🟢 Response Example (200 OK):
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Payment methods retrieved successfully",
  "data": [
    {
      "id": "pm_1PXXXX",
      "brand": "visa",
      "last4": "4242",
      "expMonth": 12,
      "expYear": 2028,
      "isDefault": true
    }
  ]
}
```

---

### 📡 Endpoint 8.3: Pay Using Existing Saved Card (1-Tap Charge)
Call this when a user wants to pay directly using one of their saved cards.

- **Method:** `POST`
- **URL:** `/api/v1/payment/create-payment-intent`
- **Headers:** `Authorization: Bearer <JWT_TOKEN>`
- **Body:**
```json
{
  "amount": 25.00,
  "paymentMethodId": "pm_1PXXXX",
  "orderId": "65ab1234c567890011223344"
}
```

#### 🟢 Response Example (200 OK):
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Payment intent created successfully",
  "data": {
    "clientSecret": "pi_1PXXXX_secret_YYYYY",
    "paymentIntentId": "pi_1PXXXX",
    "amount": 25.00,
    "status": "succeeded"
  }
}
```
*(When `paymentMethodId` is provided, the backend auto-confirms the charge off-session and returns `status: "succeeded"` immediately).*

---

## 9. Community Trade Voting System ("Who Won The Trade?")

### 📌 Overview & How It Works (Backend Behavior)

When two users **complete a card trade**, the backend **automatically** creates a `TradeVote` record — the app developer does **not** need to trigger this manually. It is fully event-driven.

**Automatic trigger points:**
1. `POST /api/v1/trades/complete/:id` → Trade with **no cash supplement** completes → vote entry created instantly.
2. **Stripe Webhook** (`payment_intent.succeeded` with `purchaseType: trade_supplement`) → Trade with cash supplement completes after payment → vote entry created instantly.

The app only needs to **display the feed** and **allow casting votes**.

---

### 🧠 UI State Logic

Each feed item has these fields the UI must react to:

| Field | Value | UI Action |
|---|---|---|
| `hasVoted` | `false` | Show "Vote Trader A" / "Vote Trader B" buttons |
| `hasVoted` | `true` | Hide buttons, show result bar + "You voted for Trader X" |
| `votedOption` | `"A"` or `"B"` | Highlight the user's chosen side |
| `votedOption` | `null` | User has not voted (or guest) |

**Guest user (no token):** Feed loads normally with `hasVoted: false`. Tapping vote triggers a login prompt (server returns `401`).

---

### 📡 Endpoint 9.1: Fetch Trade Voting Feed

- **Method:** `GET`
- **URL:** `/api/v1/trades/votes/feed`
- **Query Parameters:** `?page=1&limit=10`
- **Headers:** `Authorization: Bearer <TOKEN>` *(Optional — guest browsing supported)*

#### 🟢 Response Example (200 OK):
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Trade voting feed retrieved successfully",
  "meta": {
    "page": 1,
    "limit": 10,
    "total": 24,
    "totalPage": 3
  },
  "data": [
    {
      "_id": "65f123abc456789012345678",
      "tradeId": "65ee99887766554433221100",
      "category": "Trading Cards",
      "timeAgo": "Completed 2h ago",
      "itemA": {
        "name": "1986 Michael Jordan Fleer #57 PSA 8",
        "value": "$1,800",
        "image": "https://cdn.example.com/card-mj.jpg",
        "traderName": "CollectorKing"
      },
      "itemB": {
        "name": "2003 LeBron James Topps Chrome PSA 9",
        "value": "$2,100",
        "image": "https://cdn.example.com/card-lbj.jpg",
        "traderName": "HoopsLegacy"
      },
      "votesA": 14,
      "votesB": 36,
      "totalVotes": 50,
      "percentageA": 28,
      "percentageB": 72,
      "hasVoted": false,
      "votedOption": null,
      "completedAt": "2026-09-10T12:00:00.000Z"
    }
  ]
}
```

**Key fields for UI rendering:**

| Field | Type | Usage |
|---|---|---|
| `_id` | String | Pass as `:id` when casting a vote |
| `timeAgo` | String | Display as-is (e.g. "Completed 2h ago") |
| `percentageA` / `percentageB` | Number | Drive progress bar widths (always sum to 100) |
| `hasVoted` | Boolean | Toggle between vote buttons vs result view |
| `votedOption` | `"A"` / `"B"` / `null` | Highlight user's chosen side |
| `totalVotes` | Number | Display total vote count |

---

### 📡 Endpoint 9.2: Cast a Vote on a Trade

- **Method:** `POST`
- **URL:** `/api/v1/trades/votes/:id/cast`
  - `:id` = the `_id` from the feed item (**NOT** the `tradeId`)
- **Headers:** `Authorization: Bearer <JWT_TOKEN>` *(Required — guests get 401)*
- **Body:**
```json
{
  "option": "A"
}
```
*(Use `"option": "A"` for Trader A, `"option": "B"` for Trader B)*

#### 🟢 Response Example (200 OK):
```json
{
  "statusCode": 200,
  "success": true,
  "message": "Vote cast successfully",
  "data": {
    "tradeVoteId": "65f123abc456789012345678",
    "votesA": 15,
    "votesB": 36,
    "totalVotes": 51,
    "percentageA": 29,
    "percentageB": 71,
    "hasVoted": true,
    "votedOption": "A"
  }
}
```

> **After a successful vote:** Update the feed item **locally** using the returned `data` object. Do **not** re-fetch the entire feed.

---

### 🔴 Error Reference

| HTTP Status | Scenario | App Action |
|---|---|---|
| `200 OK` | Vote cast successfully | Update card UI with returned `data` |
| `400 Bad Request` | Voting closed / invalid ID | Show toast: *"This vote is no longer active."* |
| `401 Unauthorized` | Guest — no token | Show **Login / Sign Up** dialog |
| `403 Forbidden` | Trader voting on own trade | Show toast: *"You can't vote on your own trade."* |
| `409 Conflict` | Already voted | Show toast: *"You've already voted on this trade!"* |
| `404 Not Found` | Vote record not found | Remove card from feed silently |

---

### ✅ Implementation Checklist

- [ ] Feed screen calls `GET /api/v1/trades/votes/feed` with optional auth header
- [ ] Infinite scroll pagination via `?page=&limit=` using `meta.totalPage`
- [ ] Guest mode — feed loads without token; vote tap triggers login dialog
- [ ] `hasVoted: true` → hide vote buttons, show result bar + "You voted for Trader X"
- [ ] Vote tap → `POST /api/v1/trades/votes/:id/cast` with `{ "option": "A" }` or `{ "option": "B" }`
- [ ] Update card locally with response `data` — no full-feed reload
- [ ] Handle error codes: `400`, `401`, `403`, `409` with distinct messages
- [ ] Traders see `403` when attempting to vote on their own trade
