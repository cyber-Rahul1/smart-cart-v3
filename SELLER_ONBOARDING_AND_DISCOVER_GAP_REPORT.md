# SMART CART V3 — SELLER ONBOARDING & DISCOVER GAP REPORT
**Document Status:** Final Audit Deliverable (Audit-Only Task — Zero Code Modifications Made)  
**Subject:** Field-by-Field Gap Analysis Between Customer-Facing Discover UI and Seller Onboarding / Profile Management  
**Date of Inspection:** November 19, 2026  

---

## 1. OBJECTIVE & METHODOLOGY

The customer-facing Discover section (`frontend/app/listing/[type].tsx`) and individual storefront screens (`frontend/app/seller/[id].tsx`) present rich merchant cards featuring multi-image carousels, video badges, verification badges, contact buttons, directional routing, and ambience galleries.

This report establishes:
1. Exactly where each field displayed on the Discover UI originates (MongoDB document, seed data, synthetic client calculation, or hardcoded JSX).
2. Whether an authentic, newly registered merchant can provide, edit, or manage that field using the existing Seller Partner app (`frontend/app/partner/onboarding.tsx` and `frontend/app/partner/(tabs)/shop.tsx`).
3. The exact architectural and schema gaps preventing real sellers from appearing authentically in Discover.
4. A recommended enterprise-grade seller profile schema specification.

---

## 2. COMPREHENSIVE FIELD-BY-FIELD COMPARISON MATRIX

| Discover UI Element | Discover Code Location | Runtime Data Source | Real DB Value vs. Seed vs. Hardcoded Fallback | Can Seller Provide at Onboarding? (`onboarding.tsx`) | Can Seller Edit in Store Settings? (`shop.tsx`) | Status & Architectural Risk |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Store Name** | `listing/[type].tsx:764` | `seller.name` | Real MongoDB document field. | **YES** (`f.business_name`, line 60). | **NO** (Store name cannot be edited after onboarding). | **Functional** (Onboarding only). |
| **Store Logo Box (Text & Icon)** | `listing/[type].tsx:755-758` | Hardcoded JSX: `<Text>Test{"\n"}Kitchen</Text>` | **Hardcoded String**: Displays "Test Kitchen" on **every single discover card** across all shops. | **NO** (No logo field exists). | **NO** (No logo upload input). | **CRITICAL BUG**: Real merchant brand identity is completely replaced by "Test Kitchen". |
| **Hero Image Carousel** | `listing/[type].tsx:508-518` | `[banner_url, ...gallery, seller.image]` | For seeded shops: `store_gallery_map` (`seed.py:116`). For real shops: `banner_url` and `gallery` are null; falls back to single `seller.image`. | **PARTIAL**: Can choose 1 of 18 stock Unsplash presets (`image_key`, line 77). | **PARTIAL**: Can upload 1 custom cover photo via `PhotoPicker` (`shop.tsx:25`). **Cannot upload banner or gallery**. | **HIGH GAP**: Discover carousel is crippled for real sellers; backend supports `gallery` and `banner_url` (`seller.py:62-64`), but frontend has zero UI inputs. |
| **"New" Top Badge** | `listing/[type].tsx:684` | Hardcoded JSX: `<Text>New</Text>` | **Hardcoded String**: Unconditionally rendered on every card regardless of `seller.is_new` or opening date. | System-set (`is_new: true` on onboard). | **NO**. | **VISUAL BUG**: Older stores continue to show "New" badge indefinitely. |
| **Business Type Badge** | `listing/[type].tsx:690` | Hardcoded JSX: `<Text>Cloud Kitchen</Text>` | **Hardcoded String**: Unconditionally renders "Cloud Kitchen" on every card, even for supermarkets and dine-in restaurants. | **PARTIAL**: Selects `business_type` (`restaurant`, `cloud_kitchen`, `kirana`), but Discover ignores it! | **NO**. | **CRITICAL VISUAL DEFECT**: Kirana grocery stores and fine-dining restaurants are mislabeled as "Cloud Kitchen". |
| **Video Duration Badge ("0:20")** | `listing/[type].tsx:720-723` | Hardcoded JSX: `<Text>0:20</Text>` | **Completely Mock / Fake**: Renders a play icon and "0:20" on every card. No video streaming or upload exists. | **NO**. | **NO**. | **DECEPTIVE UI**: Customers expect a video teaser, but tapping does nothing. |
| **"FSSAI Verified" Badge** | `listing/[type].tsx:768` | Hardcoded JSX: `<Text>FSSAI Verified</Text>` | **Hardcoded String**: Unconditionally rendered green badge. Completely ignores `seller.fssai_status` (shows verified even if `submitted` or `not_required`). | Provides 14-digit text (`fssai`, line 70). | Can update number if rejected (`shop.tsx:112`). | **REGULATORY COMPLIANCE RISK**: Unverified food kitchens falsely display "FSSAI Verified" to consumers. |
| **Cuisines / Categories** | `listing/[type].tsx:774` | `seller.cuisine` | Real MongoDB field. Fallback to `"Biryani • Indian • Meals"`. | **YES** (`f.cuisine`, line 62). | **YES** (`shop.cuisine`, line 88). | **Functional**. |
| **Rating Score** | `listing/[type].tsx:781` | `seller.rating` | Defaults to `4.0` on onboarding (`seller.py:135`). Seeded stores have `4.2` to `4.6`. | System default (`4.0`). | **NO** (System calculated). | **Functional**. |
| **Review Count** | `listing/[type].tsx:591` | `seller.reviews_count` | Seeded stores lack this field; falls back to hardcoded `"1.2k"`. | **NO**. | **NO**. | **MOCK LEAK**: All stores display "1.2k reviews" regardless of real review volume. |
| **Store Description** | `listing/[type].tsx:563-566` | `description` or `seller.description` | Real stores have null description; falls back to `"Authentic Biryani, meals and homely Indian dishes..."`. | **NO** (Not asked during onboarding). | **NO** (Backend accepts `description` in `ShopUpdate`, but `shop.tsx` has no input!). | **HIGH GAP**: Grocery stores and ice cream parlors display the biryani fallback description. |
| **Delivery Time (ETA)** | `listing/[type].tsx:809` | `seller.eta_min` | Calculated in backend: `prep_time_min + int(distance * 4)`. | Configures prep time (`f.prep`, line 65). | Configures prep time (`shop.prep_time_min`, line 96). | **Functional**. |
| **Distance (km)** | `listing/[type].tsx:814` | `seller.distance_km` | Hardcoded to `1.5` on onboarding (`seller.py:135`). Not dynamically computed from user GPS. | **NO**. | **NO**. | **HIGH GAP**: Distance is static and does not reflect real user-to-store distance. |
| **Delivery Fee** | `listing/[type].tsx:819` | Hardcoded JSX: `<Text>₹30 delivery</Text>` | **Hardcoded String**: Always displays "₹30 delivery". | **NO**. | **NO**. | **MOCK LEAK**: Ignores dynamic cart delivery fee tiering. |
| **Address Line 1** | `listing/[type].tsx:596` | `(seller.address).split(",")[0]` | Takes first comma-delimited piece of registered address. | **YES** (`f.address`, line 63). | **NO** (Address cannot be edited). | **Functional** (Onboarding only). |
| **Address Line 2 (City & Pincode)** | `listing/[type].tsx:597` | Hardcoded String: `"Visakhapatnam, Andhra Pradesh - 530017"` | **CRITICAL BUG**: Hardcodes Visakhapatnam, AP on line 2 for ALL sellers nationwide! | **NO** (Cannot specify city/state/pin). | **NO**. | **CRITICAL REGIONAL DEFECT**: Bangalore or Mumbai sellers display Visakhapatnam address to customers. |
| **Contact Phone Number** | `listing/[type].tsx:851` | Hardcoded JSX: `<Text>+91 98765 43210</Text>` | **Hardcoded String**: Always displays `+91 98765 43210`. | Registers with phone, but not stored on store profile. | **NO**. | **PRIVACY & SUPPORT DEFECT**: Customers dial a dummy number instead of the store. |
| **Directions Action** | `listing/[type].tsx:605` | Google Maps URL with `seller.name, seller.address` | Opens Google Maps search with store name and address. | Address captured on onboarding. | **NO**. | **Partial** (Works if address is accurate; fails on storefront where it is a mock toast). |
| **Ambience Gallery Thumbs** | `listing/[type].tsx:570-585` | `gallery` or 4 Unsplash fallbacks | Four hardcoded Unsplash dining photos (`photo-1517248135467...`, etc.). | **NO** (Cannot upload gallery photos). | **NO** (No gallery upload in `shop.tsx`). | **MOCK LEAK**: Real stores display stock dining photos as their store ambience. |
| **Ambience "+5 More" Overlay** | `listing/[type].tsx:874` | Hardcoded JSX: `<Text>+5 More</Text>` | **Hardcoded Mock Overlay** on the 4th thumbnail. | **NO**. | **NO**. | **DECEPTIVE UI**: Implies 5 additional photos exist; clicking preview only shows the 4 thumbs. |
| **Storefront "Open till 11PM" Pill**| `seller/[id].tsx:737` | Hardcoded JSX: `<Text>Open</Text> till 11PM` | **Hardcoded String**: Ignores `shop.open` and `shop.closes_at`. | **NO**. | Sets `closes_at` in `shop.tsx:102`, **but storefront ignores it!** | **OPERATIONAL DEFECT**: Customers see "Open till 11PM" even when the merchant closed the store. |
| **Storefront Call & Directions** | `seller/[id].tsx:744, 753` | `onPress={() => toast("Calling...")}` | **Mock Toasts**: Triggers toast notification only; does NOT open phone dialer or map app. | **NO**. | **NO**. | **BROKEN BUTTONS**: Customer cannot call or navigate from the storefront header. |

---

## 3. ROOT CAUSE ANALYSIS & ARCHITECTURAL GAPS

### 3.1 Gap 1 — The Asymmetric Profile Management Problem
The backend `ShopUpdate` model (`backend/services/seller.py:53-66`) was thoughtfully designed to support rich store profiles:
```python
class ShopUpdate(BaseModel):
    open: Optional[bool] = None
    prep_time_min: Optional[int] = Field(None, ge=5, le=120)
    min_order: Optional[int] = Field(None, ge=0, le=2000)
    offer: Optional[str] = Field(None, max_length=60)
    cuisine: Optional[str] = Field(None, min_length=2, max_length=80)
    opens_at: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    closes_at: Optional[str] = Field(None, pattern=r"^\d{2}:\d{2}$")
    image_url: Optional[str] = Field(None, pattern=r"^/api/files/[0-9a-f-]{36}$")
    banner_url: Optional[str] = None
    description: Optional[str] = Field(None, max_length=500)
    gallery: Optional[list[str]] = None
    highlights: Optional[list[str]] = None
```
**The Failure:** The frontend mobile developer never implemented the UI components for `banner_url`, `description`, `gallery`, and `highlights` in `frontend/app/partner/(tabs)/shop.tsx`. As a result, this backend capability remains 100% dormant. Real merchants have no way to populate these fields.

### 3.2 Gap 2 — Hardcoded Mock Fallback Leaks in Discover UI
When `listing/[type].tsx` was developed to match high-fidelity visual Figma designs, the engineer hardcoded dummy text directly into the JSX tree rather than binding to `item.seller.*` attributes:
* `<Text style={discoverCardStyles.shopLogoText}>Test{"\n"}Kitchen</Text>` (Line 757)
* `<Text style={discoverCardStyles.fssaiVerifiedText}>FSSAI Verified</Text>` (Line 768)
* `const addressLine2 = "Visakhapatnam, Andhra Pradesh - 530017";` (Line 597)
* `<Text style={discoverCardStyles.callNumber}>+91 98765 43210</Text>` (Line 851)
* `<Text style={discoverCardStyles.badgeTextTop}>Cloud Kitchen</Text>` (Line 690)

### 3.3 Gap 3 — Absence of Structured Address & Geolocation
Onboarding collects address as a single unstructured multiline text string:
`"Shop 4, 1st Main, Koramangala"`
Because city, state, and postal code are never captured as distinct entities, the Discover card was unable to format a multi-line address, leading the developer to hardcode `addressLine2`. Furthermore, GPS coordinates are never captured via mobile GPS or map pin, forcing the backend to hardcode Koramangala coordinates (`[77.6245, 12.9352]`).

---

## 4. RECOMMENDED COMPLETE SELLER PROFILE SCHEMA

To permanently bridge the gap between Seller Partner capabilities and Customer Discover requirements, the following unified seller schema is recommended for implementation across MongoDB and frontend forms:

```typescript
export interface CompleteSellerProfile {
  // Identity & Branding
  id: string;
  owner_id: string;
  name: string;
  brand_logo_url: string;               // Dedicated square logo (resolves "Test Kitchen")
  cover_image_url: string;             // Main storefront card photo
  banner_url: string;                  // Wide header banner for Discover carousel
  gallery_urls: string[];              // Up to 6 real ambience/kitchen photos
  description: string;                 // Up to 500 characters rich bio
  highlights: string[];                // e.g. ["Pure Veg", "Award Winning Biryani", "Woodfired"]
  
  // Categorization
  category: "food" | "grocery" | "meat" | "bakery" | "pharmacy";
  business_type: "restaurant" | "cloud_kitchen" | "kirana" | "supermarket" | "sweet_shop";
  cuisine_tags: string[];              // Structured array e.g. ["North Indian", "Mughlai"]
  is_pure_veg: boolean;                // Explicit boolean (replaces regex search)
  
  // Structured Geolocation & Serviceability
  address: {
    line1: string;                     // Building / Shop No, Street
    line2?: string;                    // Area / Landmark
    city: string;                      // e.g. "Bengaluru"
    state: string;                     // e.g. "Karnataka"
    pincode: string;                   // e.g. "560034"
  };
  location: {
    type: "Point";
    coordinates: [number, number];     // [longitude, latitude] from GPS pin
  };
  serviceable_radius_km: number;       // Merchant configurable delivery radius (e.g. 5.0)
  
  // Contact & Support
  contact_phone: string;               // Customer support number (resolves dummy phone)
  contact_email: string;
  
  // Operational Schedule
  is_active: boolean;                  // Master merchant toggle (open / closed)
  auto_close_time?: string;
  operating_hours: Array<{
    day: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
    open: boolean;
    slots: Array<{ opens_at: string; closes_at: string }>; // Supports split lunch/dinner shifts
  }>;
  prep_time_min: number;               // Dynamic kitchen prep buffer
  min_order_amount: number;
  packaging_fee_fixed?: number;
  
  // Compliance & Regulatory
  fssai: {
    number: string;                    // 14-digit number
    certificate_url?: string;          // Uploaded PDF / Image
    status: "not_required" | "submitted" | "verified" | "rejected";
    verified_at?: string;
  };
  gstin?: {
    number: string;                    // 15-character GSTIN
    legal_name?: string;
    certificate_url?: string;
    verified: boolean;
  };
  pan: {
    number: string;                    // 10-character PAN
    entity_name: string;
  };
  
  // Payout & Banking
  bank_account: {
    account_number: string;
    ifsc_code: string;
    beneficiary_name: string;
    bank_name?: string;
    cheque_leaf_url?: string;
    verified: boolean;
  };
}
```
