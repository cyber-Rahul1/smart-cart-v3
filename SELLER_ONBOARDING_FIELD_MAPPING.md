# SMART CART V3 — PHASE 1 SELLER ONBOARDING FIELD MAPPING SPECIFICATION

**Document Version:** 1.0 (Phase 1 Complete)  
**System Scope:** Merchant Onboarding, Business Profile Management, Admin Review, and Customer Discover Presentation  
**Authoritative Backend:** MongoDB `db.sellers` Collection (`backend/services/seller.py`)  
**Client Applications:** `frontend/app/partner/` (Merchant App), `frontend/app/admin/` (Admin Governance), `frontend/app/listing/` (Discover Storefront)  

---

## 1. COMPREHENSIVE FIELD MAPPING TABLE

| Field Display Name | Form Input / Type | Business Type Scope | Client-Side Validation | Backend Model & Field (`OnboardIn` / `ShopUpdate`) | MongoDB Document Field | Discover UI Representation | Editable by Seller After Onboard? | Admin Controlled / Verification Gate |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Business Name** | Text input (`onboard-name-input`) | All (Restaurant, Cloud Kitchen, Kirana, Supermarket) | Required, min 2 chars | `business_name: str (min 2, max 100)` | `db.sellers.name` | Prominent title on Discover card (`seller.name`) and Storefront header | No (Contact support / admin) | Immutable merchant identity |
| **Owner / Representative Name** | Text input (`onboard-owner-input`) | All | Required, min 2 chars | `owner_name: str (min 2, max 60)` | `db.sellers.owner_name` | Hidden from customer; displayed in Admin review pane | No | Legal applicant check |
| **Category** | Single-select chip group | Inferred: `food` or `grocery` | Enforced by type selection | `category: Literal["food", "grocery"]` | `db.sellers.category` | Discover category tab filtering (`/discover?category=food/grocery`) | No | Platform classification |
| **Business Type** | Single-select chip group (`onboard-type-*`) | `restaurant`, `cloud_kitchen`, `kirana`, `supermarket` | Required selection | `business_type: Literal[...]` | `db.sellers.business_type` | Purple badge on hero banner (e.g. "Restaurant", "Supermarket") | No | Platform classification |
| **Cuisines / Categories Sold** | Text input (`onboard-cuisine-input`) | All (Contextual placeholder) | Required, min 2 chars | `cuisine: str (min 2, max 120)` | `db.sellers.cuisine` | Subtitle below store name (e.g. "Biryani • North Indian") | **Yes** (`shop.tsx:143`) | Merchant managed |
| **Business Description** | Multiline text input (`onboard-desc-input`) | All | Max 1000 chars; fallback to auto-generated bio | `description: Optional[str] (max 1000)` | `db.sellers.description` | 2-line showcase bio on Discover card | **Yes** (`shop.tsx:146`) | Merchant managed |
| **Contact Phone Number** | Phone pad input (`onboard-phone-input`) | All | Standard phone regex | `contact_phone: Optional[str]` | `db.sellers.contact_phone` | "Call" action button & telephone dialer link | **Yes** (`shop.tsx:184`) | Dynamic telephony route |
| **Contact Email** | Email input (`onboard-email-input`) | All | Standard email format | `contact_email: Optional[str]` | `db.sellers.contact_email` | Admin review pane & customer support metadata | **Yes** (`shop.tsx:187`) | Merchant managed |
| **Pure Vegetarian Flag** | Boolean Switch | Food only (`restaurant`, `cloud_kitchen`) | Boolean toggle | `is_pure_veg: Optional[bool]` | `db.sellers.is_pure_veg` | Green "Pure Veg" leaf badge on Discover header | **Yes** (`shop.tsx:160`) | Merchant self-declaration |
| **Street Address** | Multiline text (`onboard-address-input`) | All | Required, min 5 chars | `address: str (min 5, max 300)` | `db.sellers.address` | Formatted Address Line 1 on Discover card | **Yes** (`shop.tsx:191`) | Address persistence |
| **City, State, Pincode** | Text & numeric inputs | All | Formatted into full address string | Structured into `address` | `db.sellers.address` | Address Line 2 on Discover card (Replaced static Vizag) | **Yes** | Geographic parsing |
| **GPS Latitude & Longitude** | Coordinate inputs / Geo point | All | Lat (-90 to 90), Lng (-180 to 180) | `latitude`, `longitude: float` | `db.sellers.location: {type: 'Point', coordinates: [lng, lat]}` | Distance computation (`distance_km`) and Maps Directions | **Yes** (`shop.tsx`) | Geo 2dsphere indexing |
| **Service Radius (km)** | Numeric input (defaults to 5.0 km) | All | Range: 0.5 to 50 km | `service_radius_km: float` | `db.sellers.service_radius_km` | Geo-boundary discovery eligibility | **Yes** | Merchant delivery area |
| **Kitchen Prep Time (min)** | Number pad input (`onboard-prep-input`) | All | Range: 5 to 120 mins | `prep_time_min: int` | `db.sellers.prep_time_min` | Delivery time calculation (`eta_min = prep + dist * 4`) | **Yes** (`shop.tsx:197`) | Merchant operational buffer |
| **Minimum Order Value (₹)** | Number pad input (`onboard-min-input`) | All | Range: 0 to 5000 INR | `min_order: int` | `db.sellers.min_order` | Storefront minimum order requirement | **Yes** (`shop.tsx:200`) | Merchant pricing threshold |
| **Operating Hours (Opens / Closes)** | HH:MM inputs (`onboard-opens/closes-input`) | All | 24-hr format (`^\d{2}:\d{2}$`) | `opens_at`, `closes_at: str` | `db.sellers.opens_at`, `closes_at` | "Open till [closes_at]" pill on Storefront header | **Yes** (`shop.tsx:205`) | Live status calculation |
| **FSSAI Licence Number** | 14-digit numeric (`onboard-fssai-input`) | Food only | Exactly 14 digits enforced | `fssai_number: Optional[str]` | `db.sellers.fssai_number` | Shown in Admin review; displays "FSSAI Verified" when approved | **Yes** (If rejected) | **Admin Approved Only** (`fssai_status === "verified"`) |
| **FSSAI Document Upload** | File picker (`onboard-fssai-doc`) | Food only | JPG, PNG, WEBP, PDF (<5 MB) | `fssai_doc_url: Optional[str]` | `db.sellers.fssai_doc_url` | Verified by admin in verification sheet | **Yes** | Secure object storage |
| **GSTIN Registration** | Text input (`onboard-gstin-input`) | Grocery only | Standard 15-char format | `gstin: Optional[str]` | `db.sellers.gstin` | Verified in Admin review pane | **Yes** | Tax compliance |
| **Business PAN** | Text input (`onboard-pan-input`) | Grocery only | Standard 10-char format | `pan: Optional[str]` | `db.sellers.pan` | Verified in Admin review pane | **Yes** | Identity compliance |
| **Store Logo Photo** | PhotoPicker (`onboard-logo`) | All | JPG, PNG, WEBP (<5 MB) | `logo_url: Optional[str]` | `db.sellers.logo_url` | Top-left brand avatar box on Discover card (Replaced "Test Kitchen") | **Yes** (`shop.tsx:103`) | Cloud Object Storage |
| **Storefront Cover Photo** | PhotoPicker (`onboard-cover`) | All | JPG, PNG, WEBP (<5 MB) | `image_url: Optional[str]` | `db.sellers.image` | Main showcase card image on Discover and Storefront | **Yes** (`shop.tsx:110`) | Cloud Object Storage |
| **Discover Header Banner** | PhotoPicker (`onboard-banner`) | All | JPG, PNG, WEBP (<5 MB) | `banner_url: Optional[str]` | `db.sellers.banner_url` | Primary hero carousel image on Discover card | **Yes** (`shop.tsx:117`) | Cloud Object Storage |
| **Ambience & Food Gallery** | Multi-photo management | All | Array of media URLs (up to 6) | `gallery: Optional[list[str]]` | `db.sellers.gallery` | 4-thumbnail ambience row on Discover card | **Yes** (`shop.tsx:125`) | Interactive photo reorder / remove |
| **Store Highlights** | Chip tags array | All | Dynamic tags (e.g. "Dum Biryani", "Family Dining") | `highlights: Optional[list[str]]` | `db.sellers.highlights` | Discover card highlight badges & search keywords | **Yes** (`shop.tsx:168`) | Merchant managed |
| **Accepting Orders Toggle** | Switch (`partner-open-switch`) | All | Boolean | `open: Optional[bool]` | `db.sellers.open` | Immediate customer checkout gate ("Open" / "Closed") | **Yes** (`shop.tsx:90`) | Real-time merchant kill-switch |

---

## 2. BUSINESS-TYPE SPECIFIC ONBOARDING FLOW

```
                          Select Business Type
                                  |
            +---------------------+---------------------+
            |                                           |
      Food Category                               Grocery Category
  (Restaurant / Cloud Kitchen)                (Kirana / Supermarket)
            |                                           |
  - Cuisines & Specialties                    - Provisions & Staples Sold
  - Pure Vegetarian Toggle (optional)         - FMCG Specialization
  - Mandatory 14-Digit FSSAI License          - Optional GSTIN Tax Identifier
  - FSSAI Certificate Upload                  - Optional Business PAN
  - Kitchen Prep Time (5-120 min)             - Fulfilment Buffer (5-60 min)
```

---

## 3. VERIFICATION STATE MACHINE & ACCESS CONTROLS

| Verification Status | Can Access Dashboard? | Can Manage Catalogue? | Visible in Customer Discover? | Can Accept Orders? | Discover Badge Displayed |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`pending_review`** | Yes (With pending alert) | Yes (Prepare initial menu) | **NO** (`approved: false`) | **NO** | None |
| **`approved`** | Yes | Yes | **YES** (If `open: true`) | **YES** | FSSAI Verified (if food) / Category Badge |
| **`rejected`** | Yes (With rejection note & resubmit CTA) | Yes | **NO** | **NO** | None |
| **`suspended`** | Read-Only | No | **NO** | **NO** | None |
