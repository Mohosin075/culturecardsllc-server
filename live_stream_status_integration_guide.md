# 📱 Live Stream Status Integration Guide (Frontend)

This document provides simple instructions and step-by-step integration steps for frontend developers to implement **Live Stream Status Transitions** and **Real-Time Ending**.

---

## 🔗 1. REST API: Update Stream Status
This API changes the state of a live stream (e.g., from `scheduled` to `live` when starting, or `live` to `ended` when stopping).

* **Method:** `PATCH`
* **URL:** `/api/v1/auctions/stream/:streamId/status`
* **Headers:**
  ```http
  Authorization: Bearer <ACCESS_TOKEN>
  Content-Type: application/json
  ```
* **Request Body (JSON):**
  ```json
  {
    "status": "live" // Allowed values: "scheduled", "live", "ended"
  }
  ```

### 🛠️ Step-by-Step API Integration Steps:
1. **Get Authorization Token:** Retrieve the user's login session token (Bearer token).
2. **Send PATCH Request:** Set the path parameter `:streamId` to the stream ID, and pass `{ "status": "live" }` when the host clicks "Go Live", or `{ "status": "ended" }` when the host clicks "Stop Live".
3. **Check Response Status:**
   * **200 OK:** Status successfully updated.
   * **401 Unauthorized:** Missing or expired bearer token.
   * **403 Forbidden:** The authenticated user is NOT the seller/owner of this stream.

---

## ⚡ 2. Socket.IO: Real-Time Stream Ending
For real-time room communication, the host ends the stream via a WebSocket event, which notifies all viewers instantly.

### A. Ending the Stream (Host Action)
* When the seller ends the stream, emit the `end-stream` socket event:
  ```json
  // Emit Event Name: "end-stream"
  {
    "streamId": "STREAM_ID",
    "sellerId": "HOST_SELLER_ID"
  }
  ```

### B. Listening for Stream End (Audience Action)
* Every listener/viewer in the stream room must listen for `stream-ended`:
  ```json
  // Listen Event Name: "stream-ended"
  {
    "streamId": "STREAM_ID",
    "status": "ended"
  }
  ```
  * **Action on Trigger:** Once received, the app should close the player, navigate the user back to the feeds page, or show a "Stream Has Ended" overlay.

---

## 🚨 Integration Instructions & Best Practices

1. **Host-Only Permissions:** Only the creator (seller) of the stream is allowed to end it or modify its status. Any unauthorized attempt will result in a `403 Forbidden` API error or `stream-error` socket event.
2. **Graceful Failures (Fallback):**
   * If the host ends the stream, they should emit the socket event first for instant audience termination.
   * If the WebSocket connection fails or disconnects during the stream, the frontend should fall back to calling the **REST PATCH API** endpoint to ensure the database status is reliably set to `ended`.
3. **Feed Filtering:**
   * Always filter home feed items to only query `status=live` for the active feeds, and `status=scheduled` for upcoming events.
