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

