# CultureCards Mobile App - Partner & Promo Code Integration Specification

> **Target Audience**: Mobile App Engineering Team (iOS & Android)
> **Backend Base URL**: `https://api.areisco.com`
> **System Status**: Existing Server Architecture Intact & Fully Functional

---

## 1. Integration Requirements Overview

| Requirement ID | Mobile App Feature | Priority | Implementation Summary |
| :--- | :--- | :---: | :--- |
| **REQ-APP-01** | **Sign Up Promo Code Field** | `CRITICAL` | Add optional `Promo / Referral Code` input field on Sign Up Screen. |
| **REQ-APP-02** | **Deep Link Handling** | `HIGH` | Auto-detect `promo` parameter from deep links (`culturecards://signup?promo=OG`) and pre-fill field. |
| **REQ-APP-03** | **Profile Promo Code Settings** | `MEDIUM` | Allow users who missed entering a promo code during registration to attach one later in Profile Settings. |
| **REQ-APP-04** | **Automatic Commission Processing** | `AUTOMATED` | Backend automatically processes 50/50 revenue share on transactions for linked users. |

---

## 2. Exact API Endpoint Specifications

### 2.1 User Registration / Sign Up (`POST /auth/signup`)

Include the optional `promoCode` string in the user registration payload.

**Endpoint**: `POST /api/v1/auth/signup`

#### Request Payload
```json
{
  "name": "Alex Collector",
  "email": "alex@example.com",
  "password": "Password123!",
  "promoCode": "OG"
}
```

> [!IMPORTANT]
> - The correct registration path is **`/auth/signup`** (NOT `/auth/register`).
> - `promoCode` is optional.
> - Case-insensitive on backend (automatically converts `og` to `OG`).
> - Linking `referredByPartnerId` to the partner is handled automatically by the server.

---

### 2.2 Add / Attach Promo Code Later (`PATCH /users/promo-code`)

For users who registered without a promo code and want to link to an influencer partner later via Profile Settings.

**Endpoint**: `PATCH /api/v1/users/promo-code`
**Headers**: `Authorization: Bearer <user_jwt_token>`

#### Request Payload
```json
{
  "promoCode": "OG"
}
```

> [!IMPORTANT]
> - The correct user route prefix is **`/users/promo-code`** (plural `/users/`, NOT `/user/`).

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Promo code applied successfully!",
  "data": {
    "referredByPartnerId": "65f8a123bc456789de012345",
    "promoCode": "OG",
    "partnerName": "Mohosin"
  }
}
```

---

### 2.3 Validate Promo Code (`GET /partner/validate-code`)

Optional helper API to check if a promo code is active before submission.

**Endpoint**: `GET /api/v1/partner/validate-code?code=OG`

#### Success Response (`200 OK`)
```json
{
  "success": true,
  "statusCode": 200,
  "message": "Promo code is valid",
  "data": {
    "valid": true,
    "promoCode": "OG",
    "partnerName": "Mohosin"
  }
}
```

---

## 3. UI/UX Wireframe Guidelines

### Sign Up Screen Field Placement

```
+-------------------------------------------------------+
|                       Create Account                  |
|                                                       |
|  Full Name                                            |
|  [ Alex Collector                                  ]  |
|                                                       |
|  Email Address                                        |
|  [ alex@example.com                                ]  |
|                                                       |
|  Password                                             |
|  [ ••••••••••••••••                                ]  |
|                                                       |
|  Promo / Referral Code (Optional)                     |
|  +-------------------------------------------------+  |
|  | 🏷️  OG                                          |  |
|  +-------------------------------------------------+  |
|  💡 Enter an influencer promo code                    |
|                                                       |
|  [                CREATE ACCOUNT                   ]  |
+-------------------------------------------------------+
```

---

## 4. Deep Link Configuration (iOS & Android)

### iOS Universal Link / Deep Link Configuration
- **URL Scheme**: `culturecards://signup?promo=OG`
- **Universal Link**: `https://areisco.com/signup?promo=OG`

```json
{
  "applinks": {
    "details": [
      {
        "appIDs": [ "9JA6B9Q855.com.culturecards.app" ],
        "components": [
          { "/": "/signup*", "query": { "promo": "?*" } }
        ]
      }
    ]
  }
}
```

### Android App Link Configuration
- **Package Name**: `com.culturecards.app`

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.culturecards.app",
    "sha256_cert_fingerprints": [
      "14:6D:E9:31:8B:2A:42:01:42:85:69:B5:E8:EE:B2:3D:DF:25:A8:DF:BF:37:37:EB:AC:97:DF:22:98:97:8D:18"
    ]
  }
}]
```

---

## 5. QA Testing & Verification Checklist

- [ ] **Sign Up Submission**: Test registering a user with promo code `OG` to `POST /api/v1/auth/signup` and verify `201 Created` response.
- [ ] **Case Sensitivity**: Enter `og` in lowercase and verify server links it to `OG`.
- [ ] **Admin Dashboard Audit**: Log into `/partners` on Admin Dashboard to verify referred collector count increments.
- [ ] **Profile Code Attachment**: Test calling `PATCH /api/v1/users/promo-code` for existing users.
