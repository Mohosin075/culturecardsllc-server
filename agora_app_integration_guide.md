# 📱 Agora Token Integration Guide for Flutter Developers

এই ডকুমেন্টে ফ্লাটার অ্যাপ ডেভেলপারের জন্য ব্যাকএন্ড সার্ভার থেকে Agora RTC টোকেন নিয়ে চ্যানেলে সিকিউরলি জয়েন করার সম্পূর্ণ গাইডলাইন দেওয়া হলো।

---

## 🔗 ১. Backend API Details (এপিআই স্পেসিফিকেশন)

ফ্লাটার অ্যাপ থেকে Agora-তে জয়েন করার আগে নিচের এন্ডপয়েন্ট কল করে টোকেন ও সঠিক App ID সংগ্রহ করতে হবে।

* **Method:** `GET`
* **URL:** `http://<SERVER_IP>:<PORT>/api/v1/auctions/token`
* **Query Parameters:**
  
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `channelName` | String | **Yes** | যে চ্যানেলে ইউজার জয়েন করবে (যেমন: `stream_123`) |
| `uid` | Integer | No | ইউজারের আইডি (ডিফল্ট `0` পাঠালে এগোরা অটো-আইডি জেনারেট করে) |
| `role` | String | No | লাইভ স্ট্রিম হোস্টের জন্য `publisher`, দর্শকদের জন্য `subscriber` (default: `subscriber`) |

### এপিআই রিকোয়েস্টের উদাহরণ:
```http
GET http://10.10.7.50:5007/api/v1/auctions/token?channelName=stream_777&uid=0&role=publisher
```

### রেসপন্স ফরম্যাট (JSON Response):
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Agora token generated successfully.",
  "data": {
    "token": "007eJxTYL...", // এই টোকেনটি জয়েন করতে লাগবে
    "appId": "3489839a598f43fe9b4825c74388dfcf", // ব্যাকএন্ডে কনফিগার করা Agora App ID
    "channelName": "stream_777",
    "uid": 0
  }
}
```

---

## 🛠️ ২. Flutter/Dart Implementation Steps

ফ্লাটার অ্যাপে টোকেন-বেসড কানেকশন সফল করার জন্য নিচের কোড স্ট্রাকচারটি অনুসরণ করুন:

### ধাপ A: টোকেন ডাটা মডেল তৈরি (Optional but recommended)
```dart
class AgoraTokenResponse {
  final String token;
  final String appId;
  final String channelName;
  final int uid;

  AgoraTokenResponse({
    required this.token,
    required this.appId,
    required this.channelName,
    required this.uid,
  });

  factory AgoraTokenResponse.fromJson(Map<String, dynamic> json) {
    final data = json['data'];
    return AgoraTokenResponse(
      token: data['token'],
      appId: data['appId'],
      channelName: data['channelName'],
      uid: data['uid'] ?? 0,
    );
  }
}
```

### ধাপ B: ব্যাকএন্ড থেকে টোকেন নিয়ে আসার সার্ভিস মেথড
```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class AgoraTokenService {
  // আপনার ব্যাকএন্ড আইপি এবং পোর্ট এখানে সেট করুন
  static const String baseUrl = 'http://10.10.7.50:5007/api/v1';

  static Future<AgoraTokenResponse?> fetchToken({
    required String channelName,
    int uid = 0,
    String role = 'subscriber',
  }) async {
    final url = Uri.parse('$baseUrl/auctions/token?channelName=$channelName&uid=$uid&role=$role');

    try {
      final response = await http.get(url);
      if (response.statusCode == 200) {
        final jsonResponse = jsonDecode(response.body);
        if (jsonResponse['success'] == true) {
          return AgoraTokenResponse.fromJson(jsonResponse);
        }
      } else {
        print("Failed to load token: Status Code ${response.statusCode}");
      }
    } catch (e) {
      print("Error fetching Agora token: $e");
    }
    return null;
  }
}
```

### ধাপ C: Agora Engine-এ টোকেন ও App ID দিয়ে জয়েন করা
```dart
import 'package:agora_rtc_engine/agora_rtc_engine.dart';

Future<void> initializeAndJoinStream({
  required String channelName,
  required String userRole, // 'publisher' (host) or 'subscriber' (audience)
}) async {
  // ১. প্রথমে ব্যাকএন্ড থেকে টোকেন ডাটা নিয়ে আসুন
  AgoraTokenResponse? tokenData = await AgoraTokenService.fetchToken(
    channelName: channelName,
    role: userRole,
  );

  if (tokenData == null) {
    print("Could not join stream: Token retrieval failed.");
    return;
  }

  // ২. Agora Engine ইনিশিয়েট করুন ব্যাকএন্ড থেকে প্রাপ্ত সঠিক App ID দিয়ে
  RtcEngine agoraEngine = createAgoraRtcEngine();
  await agoraEngine.initialize(
    RtcEngineContext(
      appId: tokenData.appId, // ডাইনামিক App ID (ব্যাকএন্ড থেকে আসা)
      channelProfile: ChannelProfileType.channelProfileLiveBroadcasting,
    ),
  );

  // ৩. ক্লায়েন্ট রোল সেট করুন (Host নাকি Audience)
  ClientRoleType role = userRole == 'publisher' 
      ? ClientRoleType.clientRoleBroadcaster 
      : ClientRoleType.clientRoleAudience;
      
  await agoraEngine.setClientRole(role: role);
  await agoraEngine.enableVideo();
  await agoraEngine.startPreview();

  // ৪. টোকেন ও চ্যানেল নাম দিয়ে জয়েন করুন
  await agoraEngine.joinChannel(
    token: tokenData.token, // ব্যাকএন্ড থেকে পাওয়া জেনারেটেড টোকেন
    channelId: tokenData.channelName,
    uid: tokenData.uid, // সাধারণত 0 দিলে এগোরা নিজ দায়িত্বে আইডি দেয়
    options: const ChannelMediaOptions(),
  );

  print("Joined Agora Channel: ${tokenData.channelName} successfully!");
}
```

---

## 🚨 গুরুত্বপূর্ণ সতর্কতা (Tips & Troubleshooting)

1. **IP Address:** লোকাল সার্ভারে ডেভেলপ করার সময় ডেমো URL-এর `localhost` বা `127.0.0.1` ফ্লাটার ইমুলেটর/রিয়েল ডিভাইসে কাজ করবে না। অবশ্যই আপনার পিসির **লোকাল আইপি এড্রেস** (যেমন `10.10.7.50` বা `192.168.x.x`) ব্যবহার করতে হবে।
2. **App ID Matching:** `initialize` করার সময় হার্ডকোডেড App ID-র চেয়ে ব্যাকএন্ড রেসপন্স থেকে আসা `tokenData.appId` ব্যবহার করা নিরাপদ। এতে ব্যাকএন্ডের আইডি পরিবর্তন হলে ফ্রন্টএন্ডে আর কোড হাত দিতে হবে না।
3. **Token Expiry:** ব্যাকএন্ড থেকে পাওয়া টোকেনটি ২ ঘণ্টার জন্য ভ্যালিড থাকবে। লাইভ স্ট্রিম বেশিক্ষণ চললে এগোরা টোকেন রিনিউ করতে পারে, তবে সাধারণ ব্যবহারের জন্য জয়েন করার সময় একবার টোকেন আনাই যথেষ্ট।
