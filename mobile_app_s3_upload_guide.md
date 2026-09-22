# 📱 Flutter App S3 Presigned Image Upload Integration Guide

> ⚠️ **NO REWRITING REQUIRED:** You do **NOT** need to rewrite your existing Flutter app architecture, UI, state management (GetX/Bloc/Provider), or models. 
> You only need to add **1 standalone helper function** and change **2 lines** where image URLs are assigned before making API calls.

---

## ⚡ The Minimal 2-Line Change (Before vs After)

Instead of passing a Base64 string to your existing API requests, simply upload the file to S3 first and pass the returned `https://...` URL:

### ❌ BEFORE (Causing Memory Overload & Server Rejection)
```dart
// Passing Base64 string directly into API payload
String coverImage = "data:image/jpeg;base64," + base64Encode(fileBytes);

// Calling your existing API
await apiService.createStream(title: title, coverImage: coverImage);
```

### ✅ AFTER (Production-Grade & Super Fast)
```dart
// 1. Upload to S3 (Only 1 line call)
String? coverImage = await S3UploadService.uploadToS3(imageFile: file, folder: 'streams', token: token);

// 2. Pass S3 URL to your EXISTING API function (Unchanged!)
await apiService.createStream(title: title, coverImage: coverImage);
```

---

## 🗺️ List of Backend Endpoints Requiring S3 Image URLs

| Feature Module | Endpoint | Image Field Name | S3 Folder Name |
| :--- | :--- | :--- | :--- |
| **Live Stream** | `POST /api/v1/auctions/stream` | `coverImage` (String) | `'streams'` |
| **Products** | `POST /api/v1/product/create` | `images` (List of Strings) | `'products'` |
| **Products** | `PATCH /api/v1/product/update/:id` | `images` (List of Strings) | `'products'` |
| **User Profile** | `PATCH /api/v1/user/update-profile` | `profile` (String), `coverPhoto` (String) | `'profiles'` |
| **Giveaways** | `POST /api/v1/giveaway/create` | `image` (String) | `'giveaways'` |
| **Support** | `POST /api/v1/support/ticket` | `attachments` (List of Strings) | `'support'` |

---

## 🛠️ Standalone S3 Upload Helper (Copy & Paste to your Utils/Services)

Add this single helper function into your project:

```dart
import 'dart:io';
import 'dart:convert';
import 'package:http/http.dart' as http;

class S3UploadService {
  static const String baseUrl = 'https://api.areisco.com/api/v1';

  /// Uploads a File to S3 via Presigned URL and returns public HTTPS URL
  static Future<String?> uploadToS3({
    required File imageFile,
    required String folder,
    required String token,
  }) async {
    try {
      final filename = 'img_${DateTime.now().millisecondsSinceEpoch}.jpg';

      // 1. Request Presigned Upload URL
      final presignRes = await http.post(
        Uri.parse('$baseUrl/upload/presign'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'filename': filename,
          'contentType': 'image/jpeg',
          'folder': folder,
        }),
      );

      if (presignRes.statusCode != 200) return null;
      final data = jsonDecode(presignRes.body)['data'];

      // 2. Upload Binary File Directly to S3
      final bytes = await imageFile.readAsBytes();
      final s3Res = await http.put(
        Uri.parse(data['uploadUrl']),
        headers: {'Content-Type': 'image/jpeg'},
        body: bytes,
      );

      return s3Res.statusCode == 200 ? data['fileUrl'] : null;
    } catch (e) {
      print('S3 Upload Error: $e');
      return null;
    }
  }
}
```
