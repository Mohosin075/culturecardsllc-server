# 📦 Shipping, Tracking & Label — Mobile App Integration Guide

> **Module:** `/orders`  
> **Base URL:** `https://your-api-domain.com/api/v1`  
> **Backend Status:** ✅ Fully Automated & Ready for App Integration

---

## 📑 সূচিপত্র
1. [শিপিং সিস্টেম কীভাবে কাজ করে (Overview)](#1-শিপিং-সিস্টেম-কীভাবে-কাজ-করে-overview)
2. [অটো শিপিং কস্ট ও ১২ ঘণ্টার বান্ডেল পলিসি](#2-অটো-শিপিং-কস্ট-ও-১২-ঘণ্টার-বান্ডেল-পলিসি)
3. [API Response ডেটা স্ট্রাকচার](#3-api-response-ডেটা-স্ট্রাকচার)
4. [অ্যাপে Shipping Label (PDF) দেখানো ও প্রিন্ট করা](#4-অ্যাপে-shipping-label-pdf-দেখানো-ও-প্রিন্ট-করা)
5. [অর্ডার ডিটেইলস স্ক্রিন ডিজাইন (UI Reference)](#5-অর্ডার-ডিটেইলস-স্ক্রিন-ডিজাইন-ui-reference)
6. [Flutter কোড ইমপ্লিমেন্টেশন](#6-flutter-কোড-ইমপ্লিমেন্টেশন)
7. [ডেভেলপার চেকলিস্ট](#7-ডেভেলপার-চেকলিস্ট)

---

## 1. শিপিং সিস্টেম কীভাবে কাজ করে (Overview)

অ্যাপ ডেভেলপারকে কোনো ক্যালকুলেশন বা লেবেল তৈরির কাজ করতে হবে না। ব্যাকএন্ড স্বয়ংক্রিয়ভাবে সবকিছু প্রসেস করে:

```
Buyer Buys Item / Wins Auction
            ↓
Payment Succeeded
            ↓
Backend Auto-Generates:
  ├── 1. Tracking Number: USPS-CC-XXXXXXXXXX (Carrier: USPS)
  ├── 2. Shipping Cost: $5.00 + (Weight × $0.50)
  ├── 3. Standard 4x6 inch PDF Shipping Label (File Stored on Server)
  └── 4. 12-Hour Bundling: একই সেলার থেকে ১২ ঘণ্টার মধ্যে অর্ডার হলে শিপিং $0
            ↓
App Calls: GET /orders/:id বা GET /orders/user
            ↓
App Displays: Tracking Info, Price Breakdown & "View Shipping Label" Button
```

---

## 2. অটো শিপিং কস্ট ও ১২ ঘণ্টার বান্ডেল পলিসি

### ক. শিপিং কস্ট হিসাবের নিয়ম:
- সেলার শুধু প্রোডাক্ট আপলোড করার সময় প্রোডাক্টের ওজন (`shippingWeight`) দেয় (পাউন্ড/lbs হিসেবে)। ডিফল্ট: `1 lb`।
- ব্যাকএন্ডের ফর্মুলা:
  $$\text{Shipping Cost} = \$5.00 + (\text{Weight} \times \$0.50)$$
  *যেমন: 1 lb = $5.50 | 2 lbs = $6.00 | 4 lbs = $7.00*

### খ. ১২ ঘণ্টার বান্ডেলিং (Combined Shipping):
- একজন ক্রেতা যদি একই সেলার থেকে **১২ ঘণ্টার মধ্যে** ২য় বা ৩য় প্রোডাক্ট কেনে:
  - ২য় অর্ডারের শিপিং ফি স্বয়ংক্রিয়ভাবে **`$0.00`** হয়ে যাবে।
  - ২য় অর্ডারে আগের অর্ডারের **একই ট্র্যাকিং নাম্বার** ও **লেবেল** অ্যাসাইন হবে।
  - সেলার সব কার্ড এক প্যাকেটে একসাথে পাঠাবে।

### গ. ডেলিভারি স্ট্যাটাস ও অটো-ডেলিভারি পলিসি:
- **সেলার পার্ট:** পার্সেল পাঠানোর পর সেলার অ্যাপে দেবে: `Mark as Shipped` (`deliveryStatus: 'shipped'`).
- **বায়ার পার্ট:** বায়ার প্রোডাক্ট হাতে পেয়ে অ্যাপে দেবে: `Confirm Received` (`deliveryStatus: 'delivered'`).
- **১৪ দিনের অটো-ডেলিভারি (System Fallback):** বায়ার যদি কনফার্ম করতে ভুলে যায়, শিপ হওয়ার **১৪ দিন পর** ব্যাকএন্ড Cron Job স্বয়ংক্রিয়ভাবে অর্ডারটিকে `delivered` মার্ক করে দেবে এবং উভয়কে চ্যাট/পুশ নোটিফিকেশন পাঠাবে।

---

## 3. API Response ডেটা স্ট্রাকচার

অর্ডার ডিটেইলস API (`GET /orders/:id` বা `GET /orders/user`)-এর রেসপন্স থেকে নিচের ফিল্ডগুলো ব্যবহার করবেন:

```json
{
  "success": true,
  "statusCode": 200,
  "data": {
    "_id": "64f1a2b3c4d5e6f7a8b9c0d1",
    "deliveryStatus": "pending", // 'pending' | 'shipped' | 'delivered' | 'cancelled'
    "shippingWeight": 2,
    "shippingLabelUrl": "/uploads/labels/label-USPS-CC-8472910384.pdf",
    "amountDetails": {
      "itemSubtotal": 120.00,
      "shipping": 6.00, // বান্ডেল অর্ডারের ক্ষেত্রে এটি 0 হবে
      "totalPaid": 126.00
    },
    "trackingDetails": {
      "carrier": "USPS",
      "trackingNumber": "USPS-CC-8472910384",
      "estimatedDelivery": "2026-09-05T00:00:00.000Z"
    },
    "shippingAddress": {
      "street": "123 Collectors Ave",
      "city": "New York",
      "state": "NY",
      "postalCode": "10001",
      "country": "USA"
    }
  }
}
```

---

## 4. অ্যাপে Shipping Label (PDF) দেখানো ও প্রিন্ট করা

ব্যাকএন্ডে তৈরি হওয়া ৪×৬ ইঞ্চি লেবেলের রিলেটিভ পাথ `order.shippingLabelUrl`-এ থাকে।

### ফুল URL তৈরির নিয়ম:
```dart
final String baseUrl = "https://your-api-domain.com"; // আপনার সার্ভারের বেস URL
final String fullPdfUrl = "$baseUrl${order.shippingLabelUrl}";
// আউটপুট: https://your-api-domain.com/uploads/labels/label-USPS-CC-8472910384.pdf
```

### PDF ওপেন করার ২ টি সহজ উপায়:

#### অপশন ১: External Browser / PDF Viewer (সবচেয়ে সহজ ও দ্রুত)
`url_launcher` প্যাকেজ দিয়ে ওপেন করুন:
```dart
import 'package:url_launcher/url_launcher.dart';

void openShippingLabel(String relativePath) async {
  final url = Uri.parse("https://your-api-domain.com$relativePath");
  if (await canLaunchUrl(url)) {
    await launchUrl(url, mode: LaunchMode.externalApplication);
  }
}
```

#### অপশন ২: ইন-অ্যাপ PDF প্রিভিউয়ার
`syncfusion_flutter_pdfviewer` প্যাকেজ দিয়ে অ্যাপের স্ক্রিনেই লেবেল দেখাতে পারেন:
```dart
import 'package:syncfusion_flutter_pdfviewer/pdfviewer.dart';

SfPdfViewer.network(fullPdfUrl)
```

---

## 5. অর্ডার ডিটেইলস স্ক্রিন ডিজাইন (UI Reference)

```
┌───────────────────────────────────────────────────────────┐
│  📦 Order #64F1A2B3                                       │
├───────────────────────────────────────────────────────────┤
│  Status:          [ Pending / Shipped Badge ]             │
│                                                           │
│  Carrier:         USPS Priority Mail                      │
│  Tracking #:      USPS-CC-8472910384         [ 📋 Copy ]  │
│  Weight:          2.0 lbs                                 │
│                                                           │
│  Shipping Fee:    $6.00                                   │
│  (বা বান্ডেল হলে)  Free (Bundled 12h Shipment 🎁)          │
│                                                           │
│  📍 Delivery Address:                                     │
│  123 Collectors Ave, New York, NY 10001                   │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  📄 [ View / Print Shipping Label (PDF) ]           │  │
│  └─────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────┘
```

---

## 6. Flutter কোড ইমপ্লিমেন্টেশন

### মডেল ক্লাস (Dart Model):
```dart
class OrderShippingInfo {
  final String id;
  final String deliveryStatus;
  final double shippingWeight;
  final String? shippingLabelUrl;
  final double shippingFee;
  final double totalPaid;
  final String carrier;
  final String trackingNumber;

  OrderShippingInfo({
    required this.id,
    required this.deliveryStatus,
    required this.shippingWeight,
    this.shippingLabelUrl,
    required this.shippingFee,
    required this.totalPaid,
    required this.carrier,
    required this.trackingNumber,
  });

  factory OrderShippingInfo.fromJson(Map<String, dynamic> json) {
    return OrderShippingInfo(
      id: json['_id'] ?? '',
      deliveryStatus: json['deliveryStatus'] ?? 'pending',
      shippingWeight: (json['shippingWeight'] as num?)?.toDouble() ?? 0.0,
      shippingLabelUrl: json['shippingLabelUrl'],
      shippingFee: (json['amountDetails']?['shipping'] as num?)?.toDouble() ?? 0.0,
      totalPaid: (json['amountDetails']?['totalPaid'] as num?)?.toDouble() ?? 0.0,
      carrier: json['trackingDetails']?['carrier'] ?? 'USPS',
      trackingNumber: json['trackingDetails']?['trackingNumber'] ?? '',
    );
  }

  // বান্ডেল অর্ডার চেক
  bool get isBundled => shippingFee == 0;
}
```

### UI Widget (Shipping Card):
```dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

class ShippingCardWidget extends StatelessWidget {
  final OrderShippingInfo order;
  final String baseUrl;

  const ShippingCardWidget({
    super.key,
    required this.order,
    required this.baseUrl,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      elevation: 2,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              "📦 Shipping Details",
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const Divider(height: 20),

            // Carrier & Tracking
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text("Carrier: ${order.carrier}"),
                Row(
                  children: [
                    Text(
                      order.trackingNumber,
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                    IconButton(
                      icon: const Icon(Icons.copy, size: 18),
                      onPressed: () {
                        Clipboard.setData(ClipboardData(text: order.trackingNumber));
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text("Tracking number copied!")),
                        );
                      },
                    ),
                  ],
                ),
              ],
            ),

            // Shipping Fee & Bundle Check
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4.0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text("Shipping Cost:"),
                  order.isBundled
                      ? const Chip(
                          label: Text("Free (Bundled) 🎁", style: TextStyle(color: Colors.white, fontSize: 12)),
                          backgroundColor: Colors.green,
                          visualDensity: VisualDensity.compact,
                        )
                      : Text(
                          "\$${order.shippingFee.toStringAsFixed(2)}",
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                ],
              ),
            ),

            const SizedBox(height: 12),

            // View Label Button
            if (order.shippingLabelUrl != null && order.shippingLabelUrl!.isNotEmpty)
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  icon: const Icon(Icons.picture_as_pdf),
                  label: const Text("View / Print Shipping Label"),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.blueAccent,
                    foregroundColor: Colors.white,
                  ),
                  onPressed: () async {
                    final fullUrl = Uri.parse("$baseUrl${order.shippingLabelUrl}");
                    if (await canLaunchUrl(fullUrl)) {
                      await launchUrl(fullUrl, mode: LaunchMode.externalApplication);
                    }
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }
}
```

---

## 7. ডেভেলপার চেকলিস্ট

| কাজ | স্ট্যাটাস | নোট |
| :--- | :---: | :--- |
| **ক্যালকুলেশন ও লেবেল জেনারেশন** | ✅ ব্যাকএন্ড | ব্যাকএন্ড স্বয়ংক্রিয়ভাবে তৈরি করে |
| **১২-ঘণ্টার বান্ডেল শিপিং** | ✅ ব্যাকএন্ড | ১২ ঘণ্টার মধ্যে একাধিক অর্ডার হলে $0 চার্জ |
| **API ডেটা পার্সিং** | 📱 অ্যাপ | `trackingNumber`, `shipping`, `shippingLabelUrl` পড়ুন |
| **View Label বাটন** | 📱 অ্যাপ | `url_launcher` দিয়ে PDF ওপেন করুন |
| **বান্ডেল ব্যাজ দেখানো** | 📱 অ্যাপ | `shippingFee == 0` হলে "Free (Bundled)" দেখান |
