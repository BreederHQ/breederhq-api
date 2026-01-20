# Marketplace Dual-Entry Architecture

## Overview

The BreederHQ Marketplace supports **two distinct entry points** with different purposes, contexts, and user experiences:

1. **Embedded Mode** (`app.breederhq.com/marketplace`) - Breeder management portal
2. **Standalone Mode** (`marketplace.breederhq.com`) - Public marketplace

Both entry points share the same React components and API backend but are wrapped in different routing and context providers.

---

## Architecture Comparison

| Aspect | Embedded Mode | Standalone Mode |
|--------|--------------|-----------------|
| **Entry Point** | `MarketplaceEmbedded.tsx` | `MarketplaceGate.tsx` |
| **Router** | MemoryRouter | BrowserRouter |
| **URL Control** | Platform controls URL bar | Marketplace controls URL bar |
| **Authentication** | Handled by platform | Handled by MarketplaceGate |
| **Tenant Context** | `window.__BHQ_TENANT_ID__` | From authenticated session |
| **Navigation** | Platform's NavShell | Marketplace's TopNav |
| **User Type** | Always sellers (breeders) | Buyers and sellers |
| **Primary Purpose** | Manage marketplace presence | Browse and discover |

---

## Entry Point 1: Embedded Mode

**URL**: `app.breederhq.com/marketplace`

**Purpose**: Breeder's management dashboard for configuring marketplace presence and managing listings.

### Component Stack

```
Platform App (app.breederhq.com)
└── NavShell (platform navigation)
    └── RouteView (module router)
        └── MarketplaceEmbedded.tsx ← ENTRY POINT
            └── MemoryRouter
                └── UrlSync (bidirectional URL sync)
                    └── EmbeddedContent (styling wrapper)
                        └── GateContext.Provider (isSeller=true)
                            └── Routes
                                ├── "/" → HomePage → SellerHomePage
                                ├── "/manage/breeder" → MarketplaceManagePortal
                                ├── "/manage/individual-animals" → ManageAnimalsPage
                                ├── "/manage/animal-programs" → AnimalProgramsPage
                                ├── "/manage/breeding-programs" → ManageBreedingProgramsPage
                                ├── "/manage/your-services" → ManageServicesPage
                                └── ... (other management routes)
```

### Key Implementation Details

**File**: `apps/marketplace/src/embed/MarketplaceEmbedded.tsx`

```typescript
// Tenant ID from platform global
function getTenantId(): string | null {
  const w = typeof window !== "undefined" ? (window as any) : {};
  const tenantId = w.__BHQ_TENANT_ID__ || localStorage.getItem("BHQ_TENANT_ID");
  return tenantId ? String(tenantId) : null;
}

// Gate context - ALWAYS seller in embedded mode (prevents HMR flash)
const gateContextValue: GateContextValue = {
  status: isLoading ? "loading" : "entitled",
  isEntitled: !isLoading,
  userProfile: null,
  tenantId,
  isSeller: true, // ALWAYS true in embedded mode (platform = seller portal)
};

// MemoryRouter instead of BrowserRouter (platform owns URL)
<MemoryRouter initialEntries={[initialPath]}>
  <UrlSync /> {/* Syncs MemoryRouter ↔ browser URL */}
  <Routes>
    <Route path="/" element={<HomePage />} />
    {/* ... */}
  </Routes>
</MemoryRouter>
```

### UrlSync Component

Bridges MemoryRouter's internal state with the browser URL bar (controlled by platform):

```typescript
function UrlSync() {
  const navigate = useNavigate();
  const location = useLocation();

  // Browser URL changes (popstate) → update MemoryRouter
  React.useEffect(() => {
    const onPop = () => {
      const newPath = getMarketplacePath(); // Extract /marketplace/** path
      if (newPath !== location.pathname) {
        navigate(newPath, { replace: true });
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [navigate, location.pathname]);

  // MemoryRouter changes (Link clicks) → update browser URL
  React.useEffect(() => {
    const targetBrowserPath = BASE_PATH + location.pathname;
    if (window.location.pathname !== targetBrowserPath) {
      window.history.pushState(null, "", targetBrowserPath);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }
  }, [location.pathname]);
}
```

### Why MemoryRouter?

The platform shell owns the browser URL bar and handles top-level routing. MemoryRouter keeps React Router's state isolated while UrlSync ensures both stay in sync. This prevents conflicts between platform routing and marketplace routing.

---

## Entry Point 2: Standalone Mode

**URL**: `marketplace.breederhq.com`

**Purpose**: Public marketplace for buyers to discover breeders and animals, and for sellers to authenticate separately.

### Component Stack

```
Marketplace App (marketplace.breederhq.com)
└── main.tsx
    └── BrowserRouter
        └── MarketplaceGate ← ENTRY POINT
            └── AuthCheck
                ├── If not authenticated → Login/Signup flow
                ├── If not entitled → Paywall/Waitlist
                └── If entitled → MarketplaceLayout
                    ├── TopNav (marketplace header)
                    └── Routes
                        ├── "/" → HomePage
                        │   ├── isSeller → SellerHomePage
                        │   └── !isSeller → PublicHomePage
                        ├── "/animals" → AnimalsIndexPage
                        ├── "/breeders" → BreedersIndexPage
                        ├── "/services" → ServicesIndexPage
                        ├── "/manage/breeder" → MarketplaceManagePortal
                        └── ... (all routes)
```

### Key Implementation Details

**File**: `apps/marketplace/src/gate/MarketplaceGate.tsx`

The gate handles:
- Authentication check
- Entitlement verification
- Session-based tenant context
- Route protection (seller-only routes)

```typescript
export function MarketplaceGate() {
  const [gateState, setGateState] = useState<GateState>({ status: "loading" });

  useEffect(() => {
    async function checkAccess() {
      // 1. Check authentication
      const session = await getSession();
      if (!session) {
        setGateState({ status: "unauthenticated" });
        return;
      }

      // 2. Check marketplace entitlement
      const profile = await getMarketplaceUserProfile();
      if (!profile.isEntitled) {
        setGateState({ status: "not_entitled", userProfile: profile });
        return;
      }

      // 3. Grant access
      setGateState({
        status: "entitled",
        userProfile: profile,
        tenantId: profile.tenantId,
        isSeller: !!profile.tenantId,
      });
    }
    checkAccess();
  }, []);

  // Show login, paywall, or content based on state
  if (gateState.status === "loading") return <LoadingScreen />;
  if (gateState.status === "unauthenticated") return <LoginPage />;
  if (gateState.status === "not_entitled") return <PaywallPage />;

  return (
    <GateContext.Provider value={gateState}>
      <MarketplaceLayout>
        <MarketplaceRoutes />
      </MarketplaceLayout>
    </GateContext.Provider>
  );
}
```

---

## Shared Components

Both entry points use the same page components but with different contexts:

### HomePage / SellerHomePage

**File**: `apps/marketplace/src/marketplace/pages/HomePage.tsx`

```typescript
export function HomePage() {
  const isSeller = useIsSeller(); // From GateContext

  if (isSeller) {
    return <SellerHomePage />; // Dashboard with stats and management cards
  }

  return <PublicHomePage />; // Browse marketplace with featured listings
}
```

**SellerHomePage** shows:
- Marketplace stats (total animals, services, inquiries)
- Green "Breeding Program Storefront" banner → Opens drawer
- 4 management cards (Individual Animals, Animal Programs, Breeding Programs, Services)
- Drawer contains `MarketplaceManagePortal` with `embedded={true}`

**PublicHomePage** shows:
- Hero section with search
- Browse categories (Dogs, Cats, Horses, Services)
- Featured breeders and listings
- Trust section and recruitment CTAs

### MarketplaceManagePortal

**File**: `apps/marketplace/src/breeder/pages/MarketplaceManagePortal.tsx`

This component works in **two modes**:

```typescript
interface MarketplaceManagePortalProps {
  embedded?: boolean; // Controls rendering mode
}

export function MarketplaceManagePortal({ embedded = false }: MarketplaceManagePortalProps) {
  // When embedded={true}:
  // - Hide page header
  // - Hide "Manage Your Storefront" banner
  // - Hide 4 management cards
  // - Always show storefront settings tabs/forms
  // - Remove page-level background/spacing

  return (
    <div className={embedded ? "" : "min-h-screen bg-portal-surface"}>
      {!embedded && <PageHeader />}
      {!embedded && <ManageStorefrontBanner />}
      {!embedded && <FourManagementCards />}

      {/* Storefront settings tabs - always shown when embedded */}
      {(embedded || activeSection) && (
        <>
          <SectionTabs />
          <BusinessProfileForm />
          <BreedsForm />
          {/* ... other forms */}
        </>
      )}
    </div>
  );
}
```

**Usage in Drawer** (embedded):
```typescript
<StorefrontDrawer open={open} onClose={onClose}>
  <MarketplaceManagePortal embedded />
</StorefrontDrawer>
```

**Usage as Full Page** (standalone):
```typescript
<Route path="/manage/breeder" element={<MarketplaceManagePortal />} />
```

---

## Storefront Settings Drawer

**File**: `apps/marketplace/src/breeder/components/StorefrontDrawer.tsx`

Full-screen modal overlay that wraps MarketplaceManagePortal for embedded display on SellerHomePage.

```typescript
export function StorefrontDrawer({ open, onClose, children }: StorefrontDrawerProps) {
  // Portal to document.body for proper stacking
  return createPortal(
    <div className="fixed inset-0 z-50">
      <div className="backdrop" onClick={onClose} />
      <div className="drawer-container">
        <div className="drawer-header">
          <h2>Marketplace Storefront Settings</h2>
          <button onClick={onClose}>×</button>
        </div>
        <div className="drawer-content">
          {children} {/* MarketplaceManagePortal embedded */}
        </div>
      </div>
    </div>,
    document.body
  );
}
```

**Features**:
- Full-screen overlay with backdrop
- Escape key to close
- Prevents body scroll
- Clean header with title and close button
- Content scrolls independently

---

## GateContext API

Shared context provider used by both entry points:

```typescript
interface GateContextValue {
  status: "loading" | "unauthenticated" | "not_entitled" | "entitled";
  isEntitled: boolean;
  userProfile: UserProfile | null;
  tenantId: string | null;
  isSeller: boolean; // True if user has tenant context
}

// Hooks
const isSeller = useIsSeller(); // Returns boolean
const tenantId = useTenantId(); // Returns string | null
```

**In Embedded Mode**:
- `isSeller` is always `true` (breeders only)
- `tenantId` from `window.__BHQ_TENANT_ID__`
- No auth check (platform handles)

**In Standalone Mode**:
- `isSeller` depends on authenticated user's tenant
- `tenantId` from session data
- Full auth/entitlement check

---

## Routing Patterns

### Embedded Routes (MemoryRouter)

All routes are relative to `/marketplace` base path:

```typescript
// Platform URL: app.breederhq.com/marketplace
<Route path="/" element={<HomePage />} /> // Shows SellerHomePage

// Platform URL: app.breederhq.com/marketplace/manage/breeder
<Route path="/manage/breeder" element={<MarketplaceManagePortal />} />

// Links use relative paths
<Link to="/manage/individual-animals">Animals</Link>
```

### Standalone Routes (BrowserRouter)

Full control of URL:

```typescript
// Standalone URL: marketplace.breederhq.com/
<Route path="/" element={<HomePage />} /> // Shows Public or Seller based on isSeller

// Standalone URL: marketplace.breederhq.com/animals
<Route path="/animals" element={<AnimalsIndexPage />} />

// Seller-only routes with guard
<Route
  path="/manage/breeder"
  element={<SellerOnlyRoute><MarketplaceManagePortal /></SellerOnlyRoute>}
/>
```

### SellerOnlyRoute Guard

Redirects non-sellers trying to access management pages:

```typescript
function SellerOnlyRoute({ children }: { children: ReactNode }) {
  const isSeller = useIsSeller();

  if (!isSeller) {
    return <Navigate to="/" replace />; // Redirect to homepage
  }

  return <>{children}</>;
}
```

---

## User Flows

### Flow 1: Breeder Manages Marketplace (Embedded)

1. Breeder logs into platform at `app.breederhq.com`
2. Platform sets `window.__BHQ_TENANT_ID__`
3. Breeder clicks "Marketplace" in platform NavShell
4. Platform navigates to `/marketplace` → loads MarketplaceEmbedded module
5. MarketplaceEmbedded detects tenantId → sets `isSeller=true`
6. HomePage renders SellerHomePage with dashboard
7. Breeder clicks green "Breeding Program Storefront" banner
8. StorefrontDrawer opens with MarketplaceManagePortal (embedded)
9. Breeder edits business profile, breeds, credentials
10. Breeder closes drawer → returns to dashboard
11. Breeder clicks "Individual Animals" card → navigates to `/marketplace/manage/individual-animals`

### Flow 2: Buyer Browses Marketplace (Standalone)

1. User visits `marketplace.breederhq.com`
2. MarketplaceGate checks authentication → not authenticated
3. Shows login/signup page
4. User authenticates (no tenant = buyer)
5. MarketplaceGate sets `isSeller=false`
6. HomePage renders PublicHomePage (browse view)
7. User browses animals, breeders, services
8. User saves listings, sends inquiries

### Flow 3: Seller Accesses Standalone Marketplace

1. Breeder (with existing BreederHQ account) visits `marketplace.breederhq.com`
2. MarketplaceGate checks auth → authenticated with tenantId
3. MarketplaceGate sets `isSeller=true`
4. HomePage renders SellerHomePage (same as embedded)
5. Breeder can manage storefront via drawer or navigate to management pages
6. TopNav shows seller-specific links

---

## API Integration

Both modes use the same API client but with different context:

### API Client Setup

**File**: `apps/marketplace/src/api/client.ts`

```typescript
// Tenant ID resolver works in both modes
function getActiveTenantId(): string {
  // Embedded: from window global
  if (typeof window !== "undefined") {
    const tenantId = (window as any).__BHQ_TENANT_ID__;
    if (tenantId) return String(tenantId);
  }

  // Standalone: from localStorage or session
  const storedTenantId = localStorage.getItem("BHQ_TENANT_ID");
  if (storedTenantId) return storedTenantId;

  throw new Error("No tenant context available");
}

// Authenticated API calls
export async function getMarketplaceProfile(tenantId: string) {
  const response = await fetch(`/api/marketplace/${tenantId}/profile`, {
    credentials: "include", // Session cookie
  });
  return response.json();
}
```

---

## Best Practices

### When to Use Embedded Mode

- Breeder is already authenticated in platform
- User needs to manage their marketplace presence
- Access from breeder portal dashboard
- Tenant context is guaranteed

### When to Use Standalone Mode

- Public marketplace access
- Buyer discovery and browsing
- Seller authentication from marketing site
- SEO-optimized public pages

### Component Design Guidelines

1. **Use GateContext hooks** for conditional rendering:
   ```typescript
   const isSeller = useIsSeller();
   const tenantId = useTenantId();
   ```

2. **Support both routing contexts**:
   ```typescript
   // Use relative Links (work in both MemoryRouter and BrowserRouter)
   <Link to="/manage/breeder">Manage</Link>
   ```

3. **Design for embedded mode**:
   ```typescript
   // Accept embedded prop for dual-purpose components
   interface Props {
     embedded?: boolean;
   }
   ```

4. **Test in both modes**:
   - Verify component works at `app.breederhq.com/marketplace/**`
   - Verify component works at `marketplace.breederhq.com/**`

---

## Troubleshooting

### Issue: Double Rendering

**Symptom**: Both HomePage and MarketplaceManagePortal render simultaneously.

**Cause**: Routes are not mutually exclusive or MemoryRouter state is out of sync.

**Fix**: Check UrlSync component and ensure routes use `element` not `component`.

### Issue: Tenant Context Missing

**Symptom**: API calls fail with "No tenant ID" in embedded mode.

**Cause**: Platform hasn't set `window.__BHQ_TENANT_ID__`.

**Fix**: Verify platform loads marketplace module with tenant context.

### Issue: Authentication Fails in Standalone

**Symptom**: MarketplaceGate shows login even though user is authenticated.

**Cause**: Session cookie not being sent or CORS issue.

**Fix**: Check `credentials: "include"` in fetch calls and CORS headers.

### Issue: Links Don't Navigate in Embedded

**Symptom**: Clicking Links doesn't update browser URL.

**Cause**: UrlSync not running or MemoryRouter not mounted.

**Fix**: Verify UrlSync is inside MemoryRouter and effects are running.

---

## Future Enhancements

1. **Shared State Sync**: Sync marketplace state between embedded and standalone when user has both open
2. **Deep Linking**: Support deep links from marketing emails that work in both modes
3. **Offline Support**: Cache marketplace data for offline browsing in PWA
4. **Real-time Updates**: WebSocket connections for live inquiry notifications in both modes

---

## Related Documentation

- [Marketplace API v2](../marketplace-api-v2.md)
- [Integration Strategy](./INTEGRATION-STRATEGY.md)
- [Service Provider APIs](../SERVICE_PROVIDER_API_IMPLEMENTATION.md)
- [Breeder Management API](../breeder-marketplace-management-api.md)

---

## Recent Architectural Improvements (January 2025)

### 1. Fixed HMR Flash Issue in Embedded Mode

**Problem**: During hot module reload (HMR) in development, the embedded marketplace would briefly flash the public marketplace homepage before showing the seller dashboard.

**Root Cause**: The `isSeller` flag was derived from `tenantId`, which could be temporarily `null` during HMR before the context fully initialized.

**Solution**: Changed `isSeller` to always be `true` in embedded mode, since the embedded route (`app.breederhq.com/marketplace`) is only accessible to authenticated sellers.

```typescript
// Before (caused flash):
isSeller: !!tenantId

// After (fixed):
isSeller: true  // ALWAYS true in embedded mode
```

### 2. Removed Legacy "Breeding Programs" Tab

**Problem**: The MarketplaceManagePortal (Storefront Settings) had an inline "Breeding Programs" tab that was redundant with the new dedicated `/manage/breeding-programs` page.

**Changes**:
- Removed "Breeding Programs" tab from Storefront Settings navigation
- Deleted `BreedingProgramsSection` component (~216 lines)
- Updated `ActiveSection` type to remove "programs"
- Redirected "Add breeding program" links to `/manage/breeding-programs`

**Result**: Cleaner separation of concerns - Storefront Settings focuses on profile/credentials/policies, while breeding programs have their own dedicated management page.

### 3. Fixed Double `/marketplace/marketplace` URL Bug

**Problem**: Clicking "Back" links in management pages created URLs like `/marketplace/marketplace`.

**Root Cause**: Management pages used `to="/marketplace"` which, when combined with UrlSync's BASE_PATH prepending, resulted in double paths.

**Solution**: Changed all "Back to Marketplace" links to use `to="/"` (relative to MemoryRouter root).

**Files Fixed**:
- `AnimalProgramsPage.tsx`
- `ManageAnimalsPage.tsx`
- `ManageBreedingProgramsPage.tsx`
- `ManageServicesPage.tsx`

### 4. Added CTA Banners to Browse Pages

**Implementation**: Added compact, centered CTA banners above TopNav on:
- `/animals` - "Want to see your breeding program's animals listed here?"
- `/breeders` - "Want to see your breeding business here?"
- `/services` - "Do you offer animal services?"

**Technical Details**:
- Location: `MarketplaceLayout.tsx` lines 318-375
- Styling: Compact (`py-2`), centered text, minimal height
- Colors: Blue for animals/breeders, orange for services
- Only shown in standalone mode (not in embedded breeder portal)

### 5. Cleaned Up Legacy Routes and Pages

**Removed Unused Pages**:
- `CreateProgramPage.tsx` (not referenced)
- `ProgramsSettingsPage.tsx` (not referenced)
- `ServicesSettingsPage.tsx` (not referenced)
- `ProgramsPage.tsx` (not referenced)
- `ServiceDetailPage.tsx` (not referenced)

**Result**: Reduced codebase size and eliminated confusion about which pages are active.

### 6. Current Seller Management Structure

The seller management dashboard now has this hierarchy:

```
Seller Homepage (/)
├── Storefront Settings Drawer (modal overlay)
│   ├── Business Profile
│   ├── Your Breeds
│   ├── Standards & Credentials
│   └── Placement Policies
│
└── Management Cards (navigate to dedicated pages)
    ├── Individual Animals → /manage/individual-animals
    ├── Animal Programs → /manage/animal-programs
    ├── Breeding Programs → /manage/breeding-programs
    └── Your Services → /manage/your-services
```

**Design Philosophy**:
- **Storefront Settings** = Quick profile/credential edits in a drawer (doesn't navigate away)
- **Management Pages** = Full CRUD operations on listings/programs (dedicated routes)

---

## Key Architectural Principles

### 1. Seller Context is Implicit in Embedded Mode
- Embedded mode (`app.breederhq.com/marketplace`) is ONLY for authenticated sellers
- No need to check `isSeller` or handle buyer cases
- Tenant ID comes from platform context (`window.__BHQ_TENANT_ID__`)

### 2. Route Paths are Relative to Router Root
- In embedded MemoryRouter: `to="/"` goes to marketplace home
- In standalone BrowserRouter: `to="/"` also goes to marketplace home
- Never use absolute platform paths like `/marketplace` inside marketplace components

### 3. State Management Patterns
- Embedded mode: Minimal loading states (tenant ID usually available immediately)
- Standalone mode: Full auth/entitlement gate with loading spinners
- Both modes: Use same `GateContext` API for consistency

### 4. URL Synchronization
- MemoryRouter in embedded mode maintains own navigation state
- UrlSync bidirectionally syncs with browser URL controlled by platform
- This allows browser back/forward to work correctly

---

## Testing Checklist

When making changes to marketplace code, verify:

- [ ] Embedded mode loads seller dashboard without flash
- [ ] Standalone mode shows public homepage for buyers
- [ ] Standalone mode shows seller dashboard for sellers
- [ ] Back button works correctly (no duplicate paths)
- [ ] CTA banners appear on browse pages (standalone only)
- [ ] Storefront drawer opens/closes correctly
- [ ] Management page links navigate correctly
- [ ] Hot module reload doesn't break context
- [ ] No console errors on page load
- [ ] API calls include correct tenant context

