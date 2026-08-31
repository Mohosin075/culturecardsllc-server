# ✅ Backend Update Log — Live Auction System

> **Date:** 2026-08-31
> **Updated By:** Backend Developer

---

## কী কী পরিবর্তন করা হয়েছে

### 1. নতুন Socket Event যোগ করা হয়েছে: `new-auction-item`


**কী হয়েছে:**
আগে সেলার নতুন প্রোডাক্ট অকশনে তুললে (`POST /api/v1/auctions/item`) শুধু ডাটাবেসে সেভ হতো। ভিউয়ারদের কাছে কোনো রিয়েল-টাইম সিগন্যাল যেত না।

**এখন:**
সেলার নতুন প্রোডাক্ট অকশনে তোলার সাথে সাথে ব্যাকএন্ড স্বয়ংক্রিয়ভাবে লাইভ রুমের সব ভিউয়ারকে `new-auction-item` সকেট ইভেন্ট পাঠায়।

**অ্যাপ ডেভেলপারকে যা করতে হবে:**

লাইভ স্ট্রিম স্ক্রিনে যেখানে Socket listeners সেট আপ করা হয় (সাধারণত `initState()` বা স্ক্রিন লোড হওয়ার সময়), সেখানে নিচের listener যোগ করো:

```dart
// লাইভ স্ক্রিন চালু হওয়ার সময় এই listener যোগ করো
socket.on('new-auction-item', (data) {
  final item = data['auctionItem'];
  /*
    item এর মধ্যে পাবে:
      item['_id']              → auctionItemId (বিড করার সময় লাগবে)
      item['currentBid']       → শুরুর দাম
      item['bidIncrement']     → প্রতিবার কত টাকা বাড়বে
      item['endsAt']           → কখন টাইমার শেষ হবে (ISO String)
      item['productId']        → প্রোডাক্টের পুরো ডিটেইলস
        item['productId']['title']   → প্রোডাক্টের নাম
        item['productId']['images']  → ছবির লিস্ট
  */

  setState(() {
    currentAuctionItemId = item['_id'];       // ← বিড করার সময় এটা পাঠাতে হবে
    currentBid          = item['currentBid'];
    endsAt              = DateTime.parse(item['endsAt']);
    currentProduct      = item['productId'];
  });

  // endsAt দিয়ে UI-তে কাউন্টডাউন টাইমার শুরু করো
  startCountdownTimer(DateTime.parse(item['endsAt']));
});
```

**কোথায় যোগ করবে (Flutter উদাহরণ):**
```dart
@override
void initState() {
  super.initState();
  _joinStreamRoom();     // socket.emit('join-stream', ...)
  _setupSocketListeners(); // ← এখানে উপরের listener যোগ করো
}

void _setupSocketListeners() {
  // ✅ নতুন — এটা আগে ছিল না, এখন যোগ করতে হবে
  socket.on('new-auction-item', (data) {
    // উপরের কোড
  });

  // এগুলো আগে থেকেই থাকার কথা — পরিবর্তন নেই
  socket.on('new-bid', (data) { ... });
  socket.on('new-chat-message', (data) { ... });
  socket.on('new-reaction', (data) { ... });
  socket.on('auction-won', (data) { ... });
  socket.on('stream-ended', (data) { ... });
}

@override
void dispose() {
  socket.off('new-auction-item'); // ← স্ক্রিন বন্ধ হলে remove করো
  socket.emit('leave-stream', {'streamId': streamId, 'userId': userId});
  super.dispose();
}
```

---

### 2. LiveStream-এ `pinnedProductId` অটো-আপডেট

**ফাইল:** `src/app/modules/auction/auction.service.ts`

**কী হয়েছে:**
প্রতিবার নতুন প্রোডাক্ট অকশনে তোলার পর `LiveStream` ডকুমেন্টের `pinnedProductId` ফিল্ড স্বয়ংক্রিয়ভাবে আপডেট হয়।

**অ্যাপে কোনো পরিবর্তন নেই।**
এটা ব্যাকএন্ড-ইন্টার্নাল আপডেট। `GET /api/v1/auctions/streams` থেকে ফেচ করলে `pinnedProductId`-এ সবসময় সর্বশেষ প্রোডাক্ট দেখাবে।

---

## আগের কোনো ফিচার পরিবর্তন হয়নি

| ফিচার | স্ট্যাটাস |
|:---|:---:|
| Agora Token (`GET /auctions/token`) | ✅ অপরিবর্তিত |
| Live Stream তৈরি (`POST /auctions/stream`) | ✅ অপরিবর্তিত |
| Bidding (`POST /auctions/bid` / socket `place-bid`) | ✅ অপরিবর্তিত |
| Auction Complete + Auto-Pay (`POST /auctions/item/:id/complete`) | ✅ অপরিবর্তিত |
| Chat (`stream-chat` / `new-chat-message`) | ✅ অপরিবর্তিত |
| Likes/Hearts (`stream-reaction` / `new-reaction`) | ✅ অপরিবর্তিত |
| Spin Wheel (`trigger-spin` / `spin-result`) | ✅ অপরিবর্তিত |
| End Stream (`end-stream` / `stream-ended`) | ✅ অপরিবর্তিত |
