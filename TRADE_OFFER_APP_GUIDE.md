# ট্রেড অফার (ডিরেক্ট ইনবক্স অফার) - অ্যাপ ডেভেলপার ইন্টিগ্রেশন গাইড

এই ডকুমেন্টে `culturecardsllc-server` ব্যাকএন্ডের সাথে "ইনবক্সে ডিরেক্ট ট্রেড অফার" ফিচারটি অ্যাপ বা ফ্রন্টএন্ডে কীভাবে ইন্টিগ্রেট করতে হবে, তার পুরো ফ্লো এবং টেকনিক্যাল ডিটেইলস আলোচনা করা হয়েছে।

## ১. ওভারভিউ (Overview)
এই ফিচারের মাধ্যমে ইউজাররা ইনবক্সে চ্যাটের মাধ্যমেই প্রোডাক্ট এক্সচেঞ্জ বা সেল করার অফার পাঠাতে পারবে। যখন কোনো অফার ক্রিয়েট করা হয়, সেটি চ্যাটে একটি স্পেশাল মেসেজ হিসেবে শো করবে এবং ইউজার সরাসরি চ্যাট থেকেই অফারটি Accept বা Decline করতে পারবে।

---

## ২. চ্যাট মেসেজ স্ট্রাকচার (The Chat Message Structure)
যখন আপনি মেসেজ লিস্ট ফেচ করবেন বা সকেট ইভেন্ট থেকে মেসেজ পাবেন, তখন ট্রেড অফারের জন্য একটি নির্দিষ্ট মেসেজ টাইপ দেখতে পাবেন। 

**মেসেজ অবজেক্টের প্রধান ফিল্ডগুলো:**
```json
{
  "_id": "message_id",
  "chatId": "chat_id",
  "sender": "sender_user_id",
  "text": "Proposed a new trade swap offer: Product A for Product B.",
  "messageType": "trade_proposal",  // <--- খুব গুরুত্বপূর্ণ: এটি দিয়ে বুঝতে হবে যে এটি একটি অফার কার্ড
  "metadata": {
    "tradeOfferId": "offer_id_12345", // এই ID ব্যবহার করে Accept/Decline API কল করতে হবে
    "statusLabel": "NEW TRADE OFFER 🎁",
    "eta": "24 Hours Expire"
  },
  "createdAt": "2024-05-20T10:00:00Z"
}
```

### 🎨 UI/UX এর নিয়ম (UI/UX Handling)
চ্যাট লিস্ট রেন্ডার করার সময় অবশ্যই `messageType` চেক করতে হবে:
- যদি `messageType === 'text'` হয়, তবে সাধারণ চ্যাট বাবল (Text message) দেখাবেন।
- যদি `messageType === 'trade_proposal'` হয়, তবে **শুধু টেক্সট না দেখিয়ে** একটি কাস্টম **Offer Widget / Card** রেন্ডার করতে হবে।
- এই Offer Card-এর মধ্যে মেসেজের text, `statusLabel`, এবং দুটি অ্যাকশন বাটন থাকবে: **Accept** এবং **Decline**।

---

## ৩. ইন্টিগ্রেশন ফ্লো এবং এপিআই (Step-by-Step Flow)

### ধাপ ১: অফার সেন্ড করা (Sending a Trade Offer)
ইউজার যখন প্রোডাক্ট পেজ বা প্রোফাইল থেকে অফার তৈরি করে।

* **API Endpoint:** `POST /trade` (অথবা আপনাদের নির্দিষ্ট ক্রিয়েট অফার এন্ডপয়েন্ট)
* **Payload Example:**
  ```json
  {
    "senderId": "user_1",
    "receiverId": "user_2",
    "senderProductId": "prod_1",
    "receiverProductId": "prod_2",
    "cashSupplement": 0 
  }
  ```
* **ব্যাকএন্ডের কাজ:** ব্যাকএন্ড `TradeOffer` ক্রিয়েট করবে এবং অটোমেটিক্যালি ওই দুই ইউজারের ইনবক্সে একটি `trade_proposal` মেসেজ ড্রপ করবে।

### ধাপ ২: ইনবক্সে অফার দেখানো (Receiving & Displaying)
* অফার রিসিভার যখন ইনবক্স ওপেন করবে।
* অ্যাপটি `metadata.tradeOfferId` ব্যবহার করে **Offer Card** টি স্ক্রিনে রেন্ডার করবে।
* *পরামর্শ:* অফার কার্ডে প্রোডাক্টের ছবি দেখাতে চাইলে `GET /trade/:tradeOfferId` কল করে অফারের বিস্তারিত তথ্য ফেচ করে নিতে পারেন।

### ধাপ ৩: অফার একসেপ্ট করা (Accepting the Offer)
যখন রিসিভার Offer Card-এর **"Accept"** বাটনে ট্যাপ করবে।

* **API Endpoint:** `POST /trade/:tradeOfferId/accept` (ব্যাকএন্ড ডকুমেন্টেশন থেকে রাউট কনফার্ম করে নিন)
* **ব্যাকএন্ডের কাজ:** 
  * অফারের স্ট্যাটাস `accepted` হয়ে যাবে।
  * প্রোডাক্টগুলো সাময়িকভাবে লক হয়ে যাবে (`status: 'pending'`)।
  * ইনবক্সে একটি নতুন অটোমেটিক মেসেজ আসবে: *"Accepted the trade swap offer! Escrow service is now Active & Secured."*
* **রিয়েল-টাইম সকেট:** UI সাথে সাথে আপডেট করার জন্য `'trade-accepted'` সকেট ইভেন্টটিতে লিসেন করুন।

### ধাপ ৪: পেমেন্ট এবং ট্রেড কমপ্লিট করা (Completing the Trade & Payment Flow)
অফার Accept হওয়ার পর, যদি অফারের সাথে এক্সট্রা টাকার ডিল (`cashSupplement`) থাকে, তবে পেমেন্ট করতে হবে। এই পেমেন্ট প্রসেসটি **Stripe** এর মাধ্যমে সম্পন্ন হয়।

**কখন কাকে পেমেন্ট করতে হবে?**
* **cashSupplement = 0 :** কোনো পেমেন্ট লাগবে না। সরাসরি ট্রেড কমপ্লিট হয়ে যাবে।
* **cashSupplement > 0 :** যে **অফার পাঠিয়েছে (Sender)**, তাকে পেমেন্ট করতে হবে।
* **cashSupplement < 0 :** যে **অফার পেয়েছে (Receiver)**, তাকে পেমেন্ট করতে হবে।

**পেমেন্ট ইন্টিগ্রেশন প্রসেস (API Flow):**
* **API Endpoint:** ইউজার যখন পেমেন্ট করতে ট্যাপ করবে, তখন `POST /trade/:tradeOfferId/complete` কল করুন।
* **রেসপন্স:** পেমেন্ট দরকার হলে API একটি স্ট্রাইপ চেকআউট URL রিটার্ন করবে: 
  ```json
  { "checkoutUrl": "https://checkout.stripe.com/..." }
  ```
* **অ্যাপের কাজ (WebView):** অ্যাপটি এই `checkoutUrl` পেলে, অ্যাপের ভেতরের একটি **WebView** বা ইন-অ্যাপ ব্রাউজারে লিংকটি ওপেন করে দিতে হবে। ইউজার সেখানে তার কার্ড ডিটেইলস দিয়ে পেমেন্ট করবে।
* **পেমেন্টের পর ব্যাকএন্ডের কাজ (Webhook):** পেমেন্ট সাকসেসফুল হলে স্ট্রাইপ থেকে ব্যাকএন্ডে Webhook আসবে। ব্যাকএন্ড নিজে থেকেই প্রোডাক্টের মালিকানা পরিবর্তন করে দেবে এবং ইনবক্সে ফাইনাল মেসেজ পাঠাবে: *"Trade completed! Items have been exchanged. ✅"*
* **রিয়েল-টাইম সকেট:** পেমেন্ট কনফার্ম হয়ে ট্রেড শেষ হলে `'trade-completed'` সকেট ইভেন্টটিতে লিসেন করুন, যাতে চ্যাট উইন্ডো রিফ্রেশ করা যায়।

---

## ৪. সকেট ইভেন্টস (Socket Events)
ইনবক্সকে রিয়েল-টাইম ফিল দেওয়ার জন্য অ্যাপে নিচের সকেট ইভেন্টগুলো লিসেন করতে হবে:

* `'trade-accepted'`: যখন কারেন্ট ইউজারের পাঠানো কোনো অফার একসেপ্ট করা হয়।
  * Payload: `{ tradeOfferId, message }`
* `'trade-declined'`: যখন কারেন্ট ইউজারের পাঠানো অফার ডিক্লাইন করা হয়।
  * Payload: `{ tradeOfferId, message }`
* `'trade-completed'`: যখন ট্রেড পুরোপুরি কমপ্লিট হয়ে যায়।
  * Payload: `{ tradeOfferId, message }`

---

## ৫. অ্যাপ ডেভেলপারের চেকলিস্ট (Summary Checklist)
1. [ ] চ্যাট UI-তে `messageType` পার্স করুন।
2. [ ] `messageType === 'trade_proposal'` হলে একটি কাস্টম UI Card তৈরি করুন।
3. [ ] অফার কার্ডের বাটন থেকে `Accept` এবং `Decline` API কল ইমপ্লিমেন্ট করুন।
4. [ ] অফারটি যদি আর 'pending' অবস্থায় না থাকে, তবে Accept/Decline বাটনগুলো ডিজেবল বা হাইড করে দিন।
5. [ ] `completeTradeOffer` যদি `checkoutUrl` রিটার্ন করে, তবে Stripe WebView রিডাইরেক্ট হ্যান্ডেল করুন।
6. [ ] চ্যাট রিফ্রেশ বা টোস্ট নোটিফিকেশন দেখানোর জন্য সকেট ইভেন্টগুলোতে (`trade-accepted`, `trade-declined`, `trade-completed`) লিসেন করুন।
