# 🏁 Live Auction to Payment Complete: Full Integration Guide

This document outlines the step-by-step developer integration flow from starting a live stream auction to checkout, real-time socket events, Stripe payment completion, and order fulfillment.

---

## 🗺️ Process Workflow Overview

```mermaid
sequenceDiagram
    autonumber
    actor Host as Seller (Host)
    actor Winner as Buyer (Winner)
    participant App as Mobile/Web Client
    participant Server as Node.js Backend
    participant Socket as Socket.io Server
    participant Stripe as Stripe API/Webhook

    %% 1. Stream Setup
    Host->>App: Clicks "Go Live"
    App->>Server: GET /api/v1/auctions/token (Agora Token)
    Server-->>App: Agora Token
    App->>Server: POST /api/v1/auctions/stream (Create Stream)
    Server-->>App: Stream Data & Channel Details
    App->>Server: PATCH /api/v1/auctions/stream/:streamId/status (status: "live")
    App->>Socket: Emit "join-stream" (streamId, sellerId)

    %% 2. Viewer Joins
    Winner->>Socket: Emit "join-stream" (streamId, userId)
    Socket-->>Winner: Receive "viewer-count-update"

    %% 3. Auction Starts & Bidding
    Host->>App: Creates Auction Item
    App->>Server: POST /api/v1/auctions/item (Register product)
    Server-->>App: Auction Item Created
    Note over Winner, Socket: Real-time Bidding
    Winner->>Socket: Emit "place-bid" (streamId, auctionItemId, bidAmount, bidderId)
    Socket->>Server: Run secure bidding validation (placeBidSecure)
    Server-->>Socket: Success
    Socket->>Winner: Broadcast "new-bid" (currentBid, highestBidder, endsAt)

    %% 4. Completion & Checkout Session
    Host->>App: Auction ends/Host clicks complete
    App->>Server: POST /api/v1/auctions/item/:id/complete
    Note over Server: Validates highest bid & reservePrice
    Server->>Stripe: Create Stripe Checkout Session (metadata: purchaseType=auction_win)
    Stripe-->>Server: Stripe Checkout URL
    Server->>Socket: Emit "auction-won" to Winner (checkoutUrl)
    Socket-->>Winner: Display "You Won!" & Redirect to Checkout

    %% 5. Payment & Webhook Fulfillment
    Winner->>Stripe: Completes Payment on Checkout Page
    Stripe->>Server: Webhook: checkout.session.completed
    Server->>Server: Create Order (paymentStatus: 'paid'), Update Product (status: 'sold')
    Server->>Socket: Emit "auction-payment-received" to Host
    Socket-->>Host: Show Payment Confirmed, Ship Item
```

---

## 🛠️ Step-by-Step Developer Integration Details

### Step 1: Starting the Live Stream (Host)

Before broadcasting, the host needs an Agora Token to join the video channel, registers the stream session in the database, and transitions its status to `live`.

#### A. Generate Agora Token
* **Endpoint:** `GET /api/v1/auctions/token`
* **Headers:** `Authorization: Bearer <HOST_ACCESS_TOKEN>`
* **Response:**
  ```json
  {
    "success": true,
    "message": "Token generated successfully",
    "data": {
      "token": "AGORA_RTC_TOKEN"
    }
  }
  ```

#### B. Create Live Stream Session
* **Endpoint:** `POST /api/v1/auctions/stream`
* **Headers:** `Authorization: Bearer <HOST_ACCESS_TOKEN>`
* **Request Body:**
  ```json
  {
    "title": "Vintage Trading Card Unboxing & Live Auction!",
    "description": "Bidding on rare cards starts now.",
    "agoraChannel": "stream-channel-123",
    "scheduledAt": "2026-07-23T12:00:00.000Z"
  }
  ```
* **Response:** Returns stream details including `_id` (referred to as `streamId`).

#### C. Transition Status to Live
* **Endpoint:** `PATCH /api/v1/auctions/stream/:streamId/status`
* **Headers:** `Authorization: Bearer <HOST_ACCESS_TOKEN>`
* **Request Body:**
  ```json
  {
    "status": "live"
  }
  ```

#### D. Join WebSocket Stream Room
Connect to the Socket.io server and subscribe to the stream channel to handle real-time interactions.
* **Emit Event:** `join-stream`
* **Payload:**
  ```json
  {
    "streamId": "STREAM_ID",
    "userId": "HOST_SELLER_ID"
  }
  ```

---

### Step 2: Joining the Stream (Audience/Viewer)

* **Emit Event:** `join-stream`
* **Payload:**
  ```json
  {
    "streamId": "STREAM_ID",
    "userId": "VIEWER_USER_ID"
  }
  ```
* **Listener - Viewer Count Updates:** Listen for real-time count updates to display on screen:
  * **Event Name:** `viewer-count-update`
  * **Data Received:**
    ```json
    {
      "streamId": "STREAM_ID",
      "viewersCount": 42
    }
    ```

---

### Step 3: Launching Auction Item & Bidding

#### A. Register Auction Item (Host Action)
To start bidding on a specific card/product, the host publishes the product into the live stream:
* **Endpoint:** `POST /api/v1/auctions/item`
* **Headers:** `Authorization: Bearer <HOST_ACCESS_TOKEN>`
* **Request Body:**
  ```json
  {
    "productId": "PRODUCT_OBJECT_ID",
    "streamId": "STREAM_OBJECT_ID",
    "startBid": 10.00,
    "duration": 60, // Duration in seconds
    "reservePrice": 50.00 // Optional
  }
  ```

#### B. Placing Bids (Audience Action)
Bidders place bids instantly via WebSockets to minimize latency.
* **Emit Event:** `place-bid`
* **Payload:**
  ```json
  {
    "streamId": "STREAM_ID",
    "auctionItemId": "AUCTION_ITEM_ID",
    "bidAmount": 65.00,
    "bidderId": "BUYER_USER_ID"
  }
  ```

#### C. Bidding Success/Failure Broadcasts
* **On Success (Broadcast to all room members):**
  * **Event Name:** `new-bid`
  * **Data Received:**
    ```json
    {
      "streamId": "STREAM_ID",
      "auctionItemId": "AUCTION_ITEM_ID",
      "currentBid": 65.00,
      "highestBidder": {
        "_id": "BUYER_USER_ID",
        "fullName": "John Doe",
        "email": "john@example.com"
      },
      "endsAt": "2026-07-23T12:05:00.000Z"
    }
    ```
* **On Error (Emitted only to the sender socket):**
  * **Event Name:** `bid-error`
  * **Data Received:**
    ```json
    {
      "auctionItemId": "AUCTION_ITEM_ID",
      "message": "Bid must be higher than current bid of $65.00"
    }
    ```

---

### Step 4: Completing the Auction (Host Action)

When the auction timer runs out or the host manually closes bidding:
* **Endpoint:** `POST /api/v1/auctions/item/:id/complete` (Where `:id` is the `auctionItemId`)
* **Headers:** `Authorization: Bearer <HOST_ACCESS_TOKEN>`
* **Response:**
  ```json
  {
    "success": true,
    "message": "Auction completed. Checkout link generated.",
    "data": {
      "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_test_..."
    }
  }
  ```

#### 🏆 Socket Event Triggered for Winner:
Simultaneously, the backend automatically emits an `auction-won` event to the winner's personal notification room (room name matching their `userId`):
* **Event Name:** `auction-won`
* **Data Received:**
  ```json
  {
    "auctionItemId": "AUCTION_ITEM_ID",
    "productTitle": "Charizard 1st Edition Shadowless",
    "winningBid": 65.00,
    "checkoutUrl": "https://checkout.stripe.com/c/pay/cs_test_...",
    "message": "🏆 You won the auction for Charizard 1st Edition Shadowless! Please complete your payment."
  }
  ```

* **Frontend Action:** The winner's app should display a beautiful "You Won!" celebration popup dialog with a **"Pay Now"** button redirecting them directly to the `checkoutUrl`.

---

### Step 5: Payment Processing & Webhook Fulfillment

1. **User Checkout:** The winner enters their payment details inside the Stripe checkout page.
2. **Stripe Webhook:** On successful transaction, Stripe sends a secure `checkout.session.completed` event to the backend.
3. **Database Fulfillment Updates:**
   * Creates a new **Order** object:
     * `purchaseType`: `"auction_win"`
     * `paymentStatus`: `"paid"`
     * `deliveryStatus`: `"pending"`
   * Transitions the **Product** status to `"sold"` (sets stock to `0`).
   * Inserts an order update system message into the chat history between the buyer and seller.
4. **Seller Notification (WebSockets):**
   The backend emits an event directly to the seller's room to let them know the buyer has successfully checked out:
   * **Event Name:** `auction-payment-received`
   * **Data Received:**
     ```json
     {
       "orderId": "ORDER_ID",
       "productId": "PRODUCT_ID",
       "message": "Auction payment received! Order created."
     }
     ```
   * **Frontend Action:** The host's app displays a notification alerting them that payment has been received, and prompts them to ship the item.

---

### Step 6: Ending the Live Stream (Host Action)

When the seller finishes streaming, they change the stream status to `ended`.

#### A. WebSocket Live Broadcast End
* **Emit Event:** `end-stream`
* **Payload:**
  ```json
  {
    "streamId": "STREAM_ID",
    "sellerId": "HOST_SELLER_ID"
  }
  ```

#### B. Audience Listener
Viewers in the room listen for the stream termination to close the player UI and return to the main feed:
* **Event Name:** `stream-ended`
* **Data Received:**
  ```json
  {
    "streamId": "STREAM_ID",
    "status": "ended"
  }
  ```

#### C. Database Fallback (REST API)
If socket connections drop, call the REST API as a reliable fallback:
* **Endpoint:** `PATCH /api/v1/auctions/stream/:streamId/status`
* **Request Body:** `{ "status": "ended" }`
