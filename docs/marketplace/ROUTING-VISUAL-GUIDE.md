# Marketplace Routing Visual Guide

Visual diagrams and flow charts for understanding the marketplace dual-entry routing system.

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    BreederHQ Marketplace                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────────────────┐      ┌─────────────────────────┐   │
│  │   Embedded Mode        │      │   Standalone Mode        │   │
│  │                        │      │                          │   │
│  │  app.breederhq.com/    │      │  marketplace.           │   │
│  │  marketplace           │      │  breederhq.com          │   │
│  │                        │      │                          │   │
│  │  Sellers Only          │      │  Buyers & Sellers        │   │
│  │  Management Portal     │      │  Public Marketplace      │   │
│  └────────────────────────┘      └─────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Entry Point Comparison

```
┌──────────────────────────────┬──────────────────────────────┐
│      Embedded Mode           │      Standalone Mode          │
├──────────────────────────────┼──────────────────────────────┤
│                              │                               │
│  Platform App                │  Marketplace App              │
│    │                         │    │                          │
│    └─► NavShell              │    └─► BrowserRouter         │
│         │                    │         │                     │
│         └─► RouteView        │         └─► MarketplaceGate  │
│              │               │              │                │
│              └─► Marketplace │              ├─► Auth Check  │
│                   Embedded   │              ├─► Entitlement │
│                   │          │              └─► Layout      │
│                   │          │                   │          │
│                   └─► Memory │                   └─► Routes │
│                       Router │                              │
│                       │      │                              │
│                       ├─► Url│                              │
│                       │  Sync│                              │
│                       │      │                              │
│                       └─► Routes                            │
│                                                              │
└──────────────────────────────┴──────────────────────────────┘
```

## URL Flow: Embedded Mode

```
User Action                 Browser URL                    MemoryRouter State
───────────────────────────────────────────────────────────────────────────────

1. Click "Marketplace"
   in platform nav
                            app.breederhq.com
                            /marketplace              →    path: "/"

2. Platform loads module
   (MarketplaceEmbedded)
                            app.breederhq.com
                            /marketplace              →    path: "/"

3. HomePage shows
   SellerHomePage
                            (no change)               →    (no change)

4. Click "Individual
   Animals" card
                            app.breederhq.com
                            /marketplace/manage/      →    path: "/manage/
                            individual-animals             individual-animals"

   UrlSync: MemoryRouter navigate → browser URL pushState

5. Click browser back
   button
                            app.breederhq.com
                            /marketplace              ←    path: "/"

   UrlSync: popstate event → MemoryRouter navigate

6. Click "Edit Storefront"
   banner
                            (no change - drawer)      →    (no change)

   StorefrontDrawer opens, no navigation
```

## URL Flow: Standalone Mode

```
User Action                 Browser URL                    Router State
───────────────────────────────────────────────────────────────────────────────

1. Visit marketplace
   homepage
                            marketplace.breederhq.com
                            /                         →    path: "/"

2. Not authenticated
                            marketplace.breederhq.com
                            /login                    →    path: "/login"

3. After login
                            marketplace.breederhq.com
                            /                         →    path: "/"

4. Click "Animals"
                            marketplace.breederhq.com
                            /animals                  →    path: "/animals"

5. If seller, click
   "Manage Storefront"
                            marketplace.breederhq.com
                            /manage/breeder           →    path: "/manage/
                                                            breeder"
```

## Component Tree: Embedded Mode

```
Platform App
│
└─ NavShell
    │
    ├─ Platform Header (logo, nav, user menu)
    │
    └─ RouteView
        │
        └─ [/marketplace] → MarketplaceEmbedded
            │
            ├─ GateContext.Provider
            │   value: { isSeller: true, tenantId: "abc123" }
            │
            └─ MemoryRouter
                │
                ├─ UrlSync (keeps URL in sync)
                │
                └─ EmbeddedContent (styling wrapper)
                    │
                    └─ Routes
                        │
                        ├─ [/] → HomePage
                        │   │
                        │   └─ SellerHomePage
                        │       │
                        │       ├─ Stats cards
                        │       ├─ Green storefront banner
                        │       │   onClick → setDrawerOpen(true)
                        │       │
                        │       ├─ 4 management cards
                        │       │   (navigate to routes below)
                        │       │
                        │       └─ StorefrontDrawer
                        │           │
                        │           └─ MarketplaceManagePortal
                        │               (embedded=true)
                        │
                        ├─ [/manage/breeder]
                        │   → MarketplaceManagePortal
                        │
                        ├─ [/manage/individual-animals]
                        │   → ManageAnimalsPage
                        │
                        └─ ... (other routes)
```

## Component Tree: Standalone Mode

```
Marketplace App
│
└─ BrowserRouter
    │
    └─ MarketplaceGate
        │
        ├─ [if not authenticated] → LoginPage
        ├─ [if not entitled] → PaywallPage
        │
        └─ [if entitled] → Authenticated Flow
            │
            ├─ GateContext.Provider
            │   value: { isSeller: bool, tenantId: string|null }
            │
            └─ MarketplaceLayout
                │
                ├─ TopNav (marketplace header)
                │
                └─ Routes
                    │
                    ├─ [/] → HomePage
                    │   │
                    │   ├─ [if isSeller] → SellerHomePage
                    │   │   (same as embedded)
                    │   │
                    │   └─ [if !isSeller] → PublicHomePage
                    │       │
                    │       ├─ Hero section
                    │       ├─ Browse categories
                    │       ├─ Featured breeders
                    │       └─ Featured listings
                    │
                    ├─ [/animals] → AnimalsIndexPage
                    ├─ [/breeders] → BreedersIndexPage
                    ├─ [/services] → ServicesIndexPage
                    │
                    └─ [/manage/breeder] (SellerOnly)
                        → MarketplaceManagePortal
```

## SellerHomePage Flow

```
SellerHomePage Loaded
│
├─ Fetch Stats (API calls)
│   ├─ Total animals
│   ├─ Total services
│   ├─ Offspring groups
│   └─ Pending inquiries
│
├─ Render Dashboard
│   │
│   ├─ Stats Grid (4 cards)
│   │   └─ Display fetched numbers
│   │
│   ├─ Green "Breeding Program Storefront" Banner
│   │   │
│   │   └─ onClick → setStorefrontDrawerOpen(true)
│   │
│   ├─ 4 Management Cards
│   │   ├─ Individual Animals
│   │   │   └─ <Link to="/manage/individual-animals" />
│   │   │
│   │   ├─ Animal Programs
│   │   │   └─ <Link to="/manage/animal-programs" />
│   │   │
│   │   ├─ Breeding Programs
│   │   │   └─ <Link to="/manage/breeding-programs" />
│   │   │
│   │   └─ Your Services
│   │       └─ <Link to="/manage/your-services" />
│   │
│   └─ Secondary Actions
│       ├─ View Inquiries
│       └─ Waitlist Management
│
└─ StorefrontDrawer
    │
    ├─ open={storefrontDrawerOpen}
    ├─ onClose={() => setStorefrontDrawerOpen(false)}
    │
    └─ Children: <MarketplaceManagePortal embedded />
```

## StorefrontDrawer Component Flow

```
Click Green Banner
│
└─ setStorefrontDrawerOpen(true)
    │
    └─ StorefrontDrawer Renders
        │
        ├─ createPortal to document.body
        │   (overlays entire screen)
        │
        ├─ Backdrop (dark overlay)
        │   └─ onClick → onClose()
        │
        └─ Drawer Container
            │
            ├─ Header
            │   ├─ Title: "Marketplace Storefront Settings"
            │   └─ Close Button (×)
            │       └─ onClick → onClose()
            │
            └─ Content (scrollable)
                │
                └─ MarketplaceManagePortal
                    (embedded=true)
                    │
                    ├─ [Hidden] Page header
                    ├─ [Hidden] Management banner
                    ├─ [Hidden] 4 hero cards
                    │
                    └─ [Shown] Storefront Forms
                        │
                        ├─ Tab Navigation
                        │   ├─ Business Profile
                        │   ├─ Your Breeds
                        │   ├─ Standards & Credentials
                        │   ├─ Placement Policies
                        │   └─ Breeding Programs
                        │
                        └─ Form Content
                            ├─ Business Name
                            ├─ Logo Upload
                            ├─ Location
                            ├─ Breeds Selection
                            ├─ Health Testing
                            ├─ Policies
                            └─ Save/Publish Buttons
```

## MarketplaceManagePortal Rendering Modes

```
┌────────────────────────────────────────────────────────────────┐
│                  MarketplaceManagePortal                        │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Props: { embedded?: boolean }                                  │
│                                                                  │
├──────────────────────┬───────────────────────────────────────┤
│  embedded={false}    │  embedded={true}                       │
│  (Default / Page)    │  (Inside Drawer)                       │
├──────────────────────┼───────────────────────────────────────┤
│                      │                                         │
│  ✓ Page header       │  ✗ Page header                         │
│  ✓ Status banner     │  ✓ Status banner                       │
│  ✓ Manage banner     │  ✗ Manage banner                       │
│  ✓ 4 hero cards      │  ✗ 4 hero cards                        │
│  ✓ Storefront tabs   │  ✓ Storefront tabs (always visible)   │
│  ✓ Form sections     │  ✓ Form sections (always visible)      │
│                      │                                         │
│  Full page layout    │  Compact drawer layout                 │
│  with bg & padding   │  minimal padding                        │
│                      │                                         │
└──────────────────────┴───────────────────────────────────────┘
```

## GateContext State Flow

```
┌────────────────────────────────────────────────────────────────┐
│                       GateContext                               │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Embedded Mode               Standalone Mode                    │
│                                                                  │
│  Source:                     Source:                            │
│  window.__BHQ_TENANT_ID__    Authenticated Session              │
│                                                                  │
│  Value:                      Value (varies):                    │
│  {                           {                                  │
│    status: "entitled",         status: varies,                  │
│    isEntitled: true,           isEntitled: varies,              │
│    userProfile: null,          userProfile: {...},              │
│    tenantId: "abc123",         tenantId: "abc123" | null,       │
│    isSeller: true              isSeller: true | false           │
│  }                           }                                  │
│                                                                  │
│  Always seller context       Can be buyer or seller             │
│  No auth check needed        Full auth/entitlement check        │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
```

## Route Resolution Order

### Embedded Mode Routes

```
Path: /marketplace/manage/individual-animals

1. Platform Router
   └─ Matches: /marketplace → Load MarketplaceEmbedded module

2. MemoryRouter (inside MarketplaceEmbedded)
   └─ Receives: /manage/individual-animals
   └─ Matches: <Route path="/manage/individual-animals" />
   └─ Renders: ManageAnimalsPage
```

### Standalone Mode Routes

```
Path: /manage/breeder

1. BrowserRouter
   └─ Matches: /manage/breeder
   └─ Goes through: MarketplaceGate

2. MarketplaceGate
   └─ Checks: Authentication → ✓
   └─ Checks: Entitlement → ✓
   └─ Provides: GateContext

3. Routes (inside MarketplaceGate)
   └─ Matches: <Route path="/manage/breeder" />
   └─ Wrapped: SellerOnlyRoute

4. SellerOnlyRoute
   └─ Checks: isSeller from GateContext
   └─ If true → Render: MarketplaceManagePortal
   └─ If false → Redirect: "/"
```

## Data Flow Example: Loading Seller Stats

```
SellerHomePage Component
│
├─ 1. Get Tenant Context
│   │
│   ├─ Embedded: tenantId = window.__BHQ_TENANT_ID__
│   └─ Standalone: tenantId = useTenantId()
│
├─ 2. Fetch Data in Parallel
│   │
│   ├─ getBreederAnimalListings(tenantId)
│   │   └─ GET /api/marketplace/{tenantId}/animals
│   │
│   ├─ getBreederOffspringGroups(tenantId)
│   │   └─ GET /api/marketplace/{tenantId}/offspring-groups
│   │
│   ├─ getBreederServices(tenantId)
│   │   └─ GET /api/marketplace/{tenantId}/services
│   │
│   └─ getBreederInquiries(tenantId, status=pending)
│       └─ GET /api/marketplace/{tenantId}/inquiries?status=pending
│
├─ 3. Process Responses
│   │
│   └─ setStats({
│         totalAnimals: animalsRes.total,
│         totalOffspring: offspringRes.total,
│         totalServices: servicesRes.total,
│         pendingInquiries: inquiriesRes.total
│       })
│
└─ 4. Render Stats Cards
    │
    ├─ Animal Listings: {stats.totalAnimals}
    ├─ Offspring Listings: {stats.totalOffspring}
    ├─ Service Listings: {stats.totalServices}
    └─ Pending Inquiries: {stats.pendingInquiries}
```

## Navigation Pattern Comparison

```
┌────────────────────────────────────────────────────────────────┐
│           Link Click: /manage/individual-animals                │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Embedded Mode:                Standalone Mode:                 │
│                                                                  │
│  1. <Link to="/manage/        1. <Link to="/manage/            │
│     individual-animals" />       individual-animals" />         │
│                                                                  │
│  2. MemoryRouter navigate     2. BrowserRouter navigate         │
│     updates internal state       updates browser URL            │
│                                                                  │
│  3. UrlSync detects change    3. Browser URL changes            │
│     pushes to browser URL        directly                       │
│                                                                  │
│  4. Browser URL:              4. Browser URL:                   │
│     app.breederhq.com/           marketplace.breederhq.com/     │
│     marketplace/manage/          manage/individual-animals      │
│     individual-animals                                          │
│                                                                  │
│  5. Component renders         5. Component renders              │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
```

## Quick Reference: When to Use What

```
┌──────────────────────────────┬────────────────────┬──────────────────┐
│ Scenario                      │ Use Embedded       │ Use Standalone   │
├──────────────────────────────┼────────────────────┼──────────────────┤
│ User is authenticated breeder │        ✓           │        ✓         │
│ User is buyer                 │        ✗           │        ✓         │
│ Accessed from platform        │        ✓           │        ✗         │
│ Accessed from marketing site  │        ✗           │        ✓         │
│ Has tenant context            │        ✓           │    Maybe         │
│ Needs platform navigation     │        ✓           │        ✗         │
│ Needs marketplace TopNav      │        ✗           │        ✓         │
│ Public SEO pages              │        ✗           │        ✓         │
│ Management dashboard          │        ✓           │        ✓         │
└──────────────────────────────┴────────────────────┴──────────────────┘
```

## Related Diagrams

See also:
- [Dual-Entry Architecture](./DUAL-ENTRY-ARCHITECTURE.md) - Detailed technical documentation
- [Developer Quick Start](./DEVELOPER-QUICK-START.md) - Code examples and patterns
