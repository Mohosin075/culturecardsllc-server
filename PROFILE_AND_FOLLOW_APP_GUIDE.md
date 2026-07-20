# User Profile Stats & Follow System - Integration Guide

এই ডকুমেন্টে `culturecardsllc-server` ব্যাকএন্ডের **Follower System** এবং **User Profile Stats** কীভাবে কাজ করে, তা অ্যাপ ডেভেলপারদের জন্য বিস্তারিত আলোচনা করা হয়েছে।

---

## ১. ইউজার প্রোফাইল স্ট্যাটস (User Profile Stats)
অ্যাপে ইউজারের প্রোফাইল পেজে (যেখানে Trades, Rating, Followers দেখানো হয়) ডেটা দেখানোর জন্য আপনাকে নতুন কোনো API কল করতে হবে না। মেইন ইউজার ফেচ করার API তেই একটি নতুন `stats` অবজেক্ট যুক্ত করা হয়েছে।

**API Endpoints:**
* `GET /users/profile` (নিজের প্রোফাইল দেখার জন্য)
* `GET /users/:id` (অন্য ইউজারের প্রোফাইল দেখার জন্য)

**রেসপন্স স্ট্রাকচার:**
ইউজারের সাধারণ ডেটার পাশাপাশি আপনি রেসপন্সের ভেতরে নিচের মতো একটি `stats` ফিল্ড পাবেন:
```json
{
  "success": true,
  "data": {
    "_id": "60f7e...",
    "name": "John Doe",
    "email": "john@example.com",
    "stats": {
      "trades": 120,       // মোট কয়টি ট্রেড কমপ্লিট করেছে
      "rating": 4.8,       // ইউজারের এভারেজ রেটিং (Review থেকে)
      "positive": 99,      // কত পারসেন্ট পজিটিভ রিভিউ (>= 4 স্টার) পেয়েছে
      "followers": 1500,   // কতজন ইউজারকে ফলো করছে
      "following": 340     // ইউজার নিজে কতজনকে ফলো করছে
    }
  }
}
```

---

## ২. ফলো সিস্টেম API (Follow System APIs)
ইউজারদের ফলো এবং আনফলো করার জন্য সম্পূর্ণ আলাদা একটি মডিউল তৈরি করা হয়েছে। 

### A. ফলো / আনফলো করা (Toggle Follow)
এই এপিআইটি একটি **Toggle** হিসেবে কাজ করে। অর্থাৎ, একই API-তে হিট করলে ফলো হবে, আবার হিট করলে আনফলো হবে।

* **Endpoint:** `POST /follow/:id` (এখানে `:id` হলো যাকে ফলো করতে চান তার User ID)
* **Headers:** `Authorization: Bearer <token>`
* **Response (ফলো হলে):**
  ```json
  {
    "success": true,
    "message": "Followed successfully",
    "data": { "followed": true }
  }
  ```
* **Response (আনফলো হলে):**
  ```json
  {
    "success": true,
    "message": "Unfollowed successfully",
    "data": { "followed": false }
  }
  ```
* **অ্যাপের কাজ:** ইউজারের প্রোফাইলে থাকা "Follow" বাটনে ক্লিক করলে এই এপিআই কল করবেন। রেসপন্সে `followed: true` আসলে বাটনটি "Unfollow" করে দেবেন।

### B. ফলোয়ার লিস্ট বের করা (Get Followers)
কেউ কার কার ফলোয়ার, সেই লিস্ট বের করতে এই API কল করবেন।
* **Endpoint:** `GET /follow/:id/followers?page=1&limit=10`
* **রেসপন্স:**
  ```json
  {
    "success": true,
    "meta": {
      "page": 1,
      "limit": 10,
      "total": 1500
    },
    "data": [
      {
        "_id": "user_id_1",
        "name": "Jane Doe",
        "image": "url_to_image"
      }
    ]
  }
  ```

### C. কাকে কাকে ফলো করছে লিস্ট বের করা (Get Following)
ইউজার নিজে কাদের ফলো করছে, তার লিস্ট বের করতে এই API কল করবেন।
* **Endpoint:** `GET /follow/:id/following?page=1&limit=10`
* **রেসপন্স:** (একই রকম পেজিনেশনসহ ইউজার অবজেক্টের লিস্ট আসবে)

---

## সামারি চেকলিস্ট
1. [ ] প্রোফাইল পেজে ডেটা দেখানোর সময় `data.stats.trades`, `data.stats.rating` ইত্যাদি ফিল্ড ব্যবহার করুন।
2. [ ] প্রোফাইলে "Follow" বাটনে ট্যাপ করলে `POST /follow/:id` এপিআইটি কল করে UI টগল (Follow <-> Unfollow) করুন।
3. [ ] ফলোয়ার লিস্ট পেজে `GET /follow/:id/followers` কল করে লিস্ট রেন্ডার করুন।
