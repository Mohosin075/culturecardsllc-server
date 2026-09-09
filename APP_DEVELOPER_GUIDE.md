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
