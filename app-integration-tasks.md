# Mobile App (Flutter) Task List & Frontend Integration Guide

This guide details the specific UI changes, form updates, API request payloads, and Socket.io event listeners that the **Mobile App (Flutter) Developer** needs to implement in the app, matching the backend updates.

---

## 🚀 Feature 1: Shipping Weight & Auto-Label Generation

### 1. Product Upload Screen
* **UI Update:** Add a numeric input field labeled `"Shipping Weight"` (supporting lbs/oz or kg).
* **Payload Update:** When creating/editing a product (`POST /products`), send the weight:
  ```json
  {
    "title": "Vintage Card",
    "shippingWeight": 1.5, // Send as a positive number
    ...
  }
  ```

### 2. Order Details & Tracking Screen
* **UI Update:** For both buyers and sellers, check if `shippingLabelUrl` is present in the Order details object. If present, render a **"Print Shipping Label"** button.
* **Action:** When tapped, open a PDF viewer screen to load the file from the full URL:
  `https://<YOUR_SERVER_URL>/uploads/labels/label-<TRACKING_NUMBER>.pdf` (or read the relative path returned in `shippingLabelUrl`).

### 3. PDF Label Viewer Screen
* **UI Update:** Implement a PDF reader widget (e.g. `flutter_pdfview` or `syncfusion_flutter_pdfviewer`) to show the label. Add native system options to **Download** or **Share** the PDF file.

---

## 🤝 Feature 2: "Buy Now" Custom Offers & Limits

### 1. Product Listing/Upload Screen
* **UI Update:** Under the "Buy Now Price" field, add:
  * A toggle switch labeled **"Allow Offers"** (`allowOffers`).
  * If enabled, show a decimal input field labeled **"Minimum Acceptable Offer"** (`minOfferAmount`).
* **Payload Update:** Include these values in the product upload request:
  ```json
  {
    "allowOffers": true,
    "minOfferAmount": 15.00
  }
  ```

### 2. Product Details Screen
* **UI Update:** Check if `allowOffers` is `true`. If so, show a **"Make an Offer"** button next to the standard "Buy Now" button.

### 3. Make Offer Popup Modal
* **UI Update:** Display an input dialog asking the buyer to input their custom price offer.
* **API Call:** When confirmed, call `POST /trades/offer`:
  ```json
  {
    "senderProductId": "BUYER_ITEM_ID",
    "receiverProductId": "SELLER_ITEM_ID",
    "cashSupplement": 12.00 // Custom cash amount offered
  }
  ```
* **Error Handling:** If the cash offer does not meet the seller's minimum requirements, the backend throws a `400 Bad Request` error. Catch this error and display the response message to the user: `"Your offer total value is below the seller's minimum..."`

---

## 🎥 Feature 3: Live Bidding (Short Timers & Likes)

### 1. Host Screen (Seller Controls)
* **UI Update:** Before starting an auction item, add options to the duration dropdown for shorter timers: **5s**, **10s**, **15s**.
* **Payload Update:** Pass the chosen duration in seconds via the `timerDuration` field when creating/starting the auction.

### 2. Live Audience Screen (Hearts & Reactions)
* **Local Animation:** Detect screen taps or taps on a heart icon, and trigger floating heart/like animations locally on the device canvas.
* **Socket.IO Emitter (App to Backend):** Each tap should emit the reaction:
  ```dart
  socket.emit('stream-reaction', {
    'streamId': 'CURRENT_STREAM_ID',
    'reactionType': 'heart'
  });
  ```
* **Socket.IO Listener (Backend to App):** Listen for reactions sent by other viewers:
  ```dart
  socket.on('new-reaction', (data) {
    // data = { "streamId": "...", "reactionType": "heart", "likesCount": 123 }
    
    // 1. Update the stream likes counter in the UI header using data['likesCount']
    // 2. Trigger floating heart animations on screen for this guest reaction
  });
  ```

---

## 💳 Feature 4: Live Auction Instant Auto-Payment

### 1. Payment Onboarding Screen
* **Trigger:** Force or prompt buyers to configure a payment card before entering an auction stream.
* **Stripe Setup Flow:**
  1. Call backend API `POST /payment/create-setup-intent` to retrieve `clientSecret`.
  2. Load the Stripe Card input sheet or card form using the `clientSecret`.
  3. Stripe will securely bind the payment card to the user's Customer account for off-session use.

### 2. Auction Winning Overlay Screen
* **UI Update:** As soon as an auction ends and the local buyer wins, trigger a full-screen overlay saying: `"Congratulations! Your payment is processing. Please wait..."`
* **Socket Listener:** Listen for the `auction-won` event:
  ```dart
  socket.on('auction-won', (data) {
    // data = { "isAutoPaid": true, "winningBid": 100, ... }
    
    // Close the processing overlay immediately and show a toast/dialog with the winning message.
  });
  ```

---

## 👤 Feature 5: Upcoming Shows on Profile

### 1. Seller Profile Screen
* **API Integration:** Call profile details API (`GET /users/profile` for the logged-in user, or `GET /users/:userId` for another user by ID). The backend returns a list of scheduled live streams inside the user object under the key `upcomingShows`.
* **UI Update:** Render an horizontal scrolling cards carousel named **"Upcoming Shows"**.
* **Data Fields:** Iterate through the `upcomingShows` array to show each show's thumbnail, title, and start time (`scheduledAt`).
  ```json
  "upcomingShows": [
    {
      "_id": "...",
      "title": "Live Card Break",
      "scheduledAt": "2026-08-25T18:00:00.000Z"
    }
  ]
  ```

---

## 🎡 Feature 6: Anti-Gambling Spin Wheel Policy

### 1. Spin Wheel Information Board
* **UI Update:** Render a persistent rules card or tooltip indicating: `"Guaranteed Rewards! Every spin wins a coupon or sticker pack. No purchase necessary."`

### 2. Spin Wheel Animation Trigger
* **Socket Listener:** The wheel spin is triggered by the seller. The app must listen to the room-wide socket event `spin-result`:
  ```dart
  socket.on('spin-result', (data) {
    // data = { "prizeName": "Rare Card Sleeves", "degreeIndex": 245, ... }
    
    // 1. Start the Spin Wheel rotation animation.
    // 2. Force the wheel animation to decelerate and stop precisely on the degree angle received in data['degreeIndex'].
    // 3. Show a winner popup modal displaying the data['prizeName'].
  });
  ```
