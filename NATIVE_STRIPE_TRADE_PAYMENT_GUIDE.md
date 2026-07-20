# Native Stripe PaymentSheet Guide (Flutter)

এই ডকুমেন্টে অ্যাপ ডেভেলপারদের জন্য **Native Stripe PaymentSheet (Android/iOS BottomSheet)** ইমপ্লিমেন্ট করার গাইড দেওয়া হলো। 

পূর্বে ব্যাকএন্ড থেকে Stripe Checkout URL (ওয়েবভিউ) রিটার্ন করা হতো, কিন্তু এখন সিকিউর ইন-অ্যাপ পেমেন্টের জন্য **Stripe PaymentIntent** ইমপ্লিমেন্ট করা হয়েছে।

---

## ১. API রেসপন্স পরিবর্তন (API Response Updates)

নিচের দুটি API তেই এখন `checkoutUrl` এর বদলে ৩টি গুরুত্বপূর্ণ টোকেন (`clientSecret`, `ephemeralKey`, `customer`) রিটার্ন করা হবে:

### A. General Payment API
* **Endpoint:** `POST /api/v1/payment/create-checkout-session`
* **Response:**
  ```json
  {
    "success": true,
    "message": "Checkout session created successfully",
    "data": {
      "clientSecret": "pi_3Mxxxxxxxxx_secret_yyyyyyyyyyyy",
      "ephemeralKey": "ek_test_xxxxxxxxxxxxxxxxxxxxxx",
      "customer": "cus_Nxxxxxxxxxxxxx",
      "paymentIntentId": "pi_3Mxxxxxxxxx"
    }
  }
  ```

### B. Trade Offer (Cash Supplement) API
* **Endpoint:** `POST /trades/complete/:offerId` (বা সংশ্লিষ্ট Complete Trade API)
* **Response:**
  ```json
  {
    "success": true,
    "message": "Payment required to complete trade.",
    "data": {
      "clientSecret": "pi_3Mxxxxxxxxx_secret_yyyyyyyyyyyy",
      "ephemeralKey": "ek_test_xxxxxxxxxxxxxxxxxxxxxx",
      "customer": "cus_Nxxxxxxxxxxxxx"
    }
  }
  ```

---

## ২. Flutter অ্যাপে ইন্টিগ্রেশন (Flutter Integration)

আপনার অ্যাপে [flutter_stripe](https://pub.dev/packages/flutter_stripe) প্যাকেজটি ইন্সটল করা থাকতে হবে। এই ৩টি টোকেন পাওয়ার পর নিচের কোড স্নাইপেটের মতো করে PaymentSheet ইনিশিয়ালাইজ এবং প্রেজেন্ট করতে হবে:

### Step 1: PaymentSheet ইনিশিয়ালাইজ করা (Init)
```dart
import 'package:flutter_stripe/flutter_stripe.dart';

Future<void> initPaymentSheet(Map<String, dynamic> apiResponseData) async {
  try {
    await Stripe.instance.initPaymentSheet(
      paymentSheetParameters: SetupPaymentSheetParameters(
        paymentIntentClientSecret: apiResponseData['clientSecret'],
        customerEphemeralKeySecret: apiResponseData['ephemeralKey'],
        customerId: apiResponseData['customer'],
        merchantDisplayName: 'Culture Cards LLC', // আপনার অ্যাপের নাম
        // applePay: const PaymentSheetApplePay(merchantCountryCode: 'US'), // অপশনাল
        // googlePay: const PaymentSheetGooglePay(merchantCountryCode: 'US', testEnv: true), // অপশনাল
      ),
    );
    
    // ইনিশিয়ালাইজ হওয়ার পর পেমেন্ট শিট ওপেন করুন
    await presentPaymentSheet();
  } catch (e) {
    print("Error initializing payment sheet: $e");
  }
}
```

### Step 2: PaymentSheet ওপেন করা (Present)
```dart
Future<void> presentPaymentSheet() async {
  try {
    await Stripe.instance.presentPaymentSheet();
    
    // পেমেন্ট সফল হলে এই লাইন এক্সিকিউট হবে
    print("Payment Success!");
    // এখানে Success UI বা ডাটা রিফ্রেশ করুন
    
  } on StripeException catch (e) {
    print("Stripe Error: ${e.error.localizedMessage}");
    // পেমেন্ট ক্যানসেল বা ফেইল হওয়ার মেসেজ দিন
  } catch (e) {
    print("Error presenting payment sheet: $e");
  }
}
```

---

## সামারি (Summary)
1. **No WebViews:** এখন আর কোনো ব্রাউজার ওপেন হবে না।
2. **Publishable Key:** অ্যাপের `main.dart` ফাইলে আগে থেকেই `Stripe.publishableKey = 'pk_test_...';` বসিয়ে রাখতে হবে (ডট-এনভায়রনমেন্ট বা কনফিগারেশন থেকে)।
3. ব্যাকএন্ড থেকে আসা `clientSecret`, `ephemeralKey` এবং `customer` ফিল্ডগুলো দিয়ে `initPaymentSheet` কল করতে হবে এবং তারপর `presentPaymentSheet` কল করলেই ইউজারের সামনে সুন্দর একটি কার্ড পেমেন্টের পপআপ চলে আসবে।
