# Marketplace Developer Quick Start

Quick reference for working with the BreederHQ Marketplace dual-entry system.

## The Two Entry Points

| Mode | URL | Purpose | User Type |
|------|-----|---------|-----------|
| **Embedded** | `app.breederhq.com/marketplace` | Breeder management portal | Sellers only |
| **Standalone** | `marketplace.breederhq.com` | Public marketplace | Buyers & sellers |

**🚨 Important Notes (January 2025)**:
- Embedded mode has `isSeller: true` hardcoded to prevent HMR flash issues
- Never use `to="/marketplace"` in Links - use `to="/"` for marketplace home
- Back links should always use relative paths (`to="/"` not `to="/marketplace"`)

## Key Files

```
apps/marketplace/src/
├── embed/
│   └── MarketplaceEmbedded.tsx        # Embedded entry point
├── gate/
│   └── MarketplaceGate.tsx            # Standalone entry point
├── routes/
│   └── MarketplaceRoutes.tsx          # Route definitions (standalone)
├── marketplace/pages/
│   └── HomePage.tsx                   # Shows SellerHomePage or PublicHomePage
├── breeder/
│   ├── pages/
│   │   └── MarketplaceManagePortal.tsx  # Storefront settings (supports embedded mode)
│   └── components/
│       └── StorefrontDrawer.tsx       # Drawer overlay for settings
└── layout/
    └── TopNav.tsx                     # Marketplace navigation (standalone only)
```

## Common Tasks

### Add a New Marketplace Page

1. Create component in `apps/marketplace/src/marketplace/pages/`
2. Add route to **both** routers:

**Embedded** (`MarketplaceEmbedded.tsx`):
```typescript
<Route path="/your-page" element={<YourPage />} />
```

**Standalone** (`MarketplaceRoutes.tsx`):
```typescript
<Route path="/your-page" element={<YourPage />} />
```

### Add a Seller-Only Page

Use `SellerOnlyRoute` wrapper in standalone mode:

```typescript
// MarketplaceRoutes.tsx
<Route
  path="/manage/your-feature"
  element={
    <SellerOnlyRoute>
      <YourFeaturePage />
    </SellerOnlyRoute>
  }
/>
```

Embedded mode doesn't need this (always sellers).

### Check if User is a Seller

```typescript
import { useIsSeller } from "../gate/MarketplaceGate";

function MyComponent() {
  const isSeller = useIsSeller();

  if (isSeller) {
    return <SellerView />;
  }

  return <BuyerView />;
}
```

### Get Tenant ID

```typescript
import { useTenantId } from "../gate/MarketplaceGate";

function MyComponent() {
  const tenantId = useTenantId();

  if (!tenantId) {
    return <div>No seller context</div>;
  }

  // Make API calls with tenantId
  return <div>Seller: {tenantId}</div>;
}
```

### Create a Component That Works in Both Modes

```typescript
interface Props {
  embedded?: boolean; // True when inside drawer/embedded context
}

export function MyComponent({ embedded = false }: Props) {
  return (
    <div className={embedded ? "p-4" : "container mx-auto"}>
      {!embedded && <PageHeader />}
      <Content />
    </div>
  );
}
```

### Navigate Between Pages

Use React Router `Link` or `useNavigate`:

```typescript
import { Link } from "react-router-dom";

// Works in both modes (relative paths)
<Link to="/manage/breeder">Manage Storefront</Link>
<Link to="/animals">Browse Animals</Link>

// Programmatic navigation
import { useNavigate } from "react-router-dom";

const navigate = useNavigate();
navigate("/manage/breeder");
```

### Open Storefront Settings Drawer

From SellerHomePage:

```typescript
const [drawerOpen, setDrawerOpen] = useState(false);

<button onClick={() => setDrawerOpen(true)}>
  Edit Storefront
</button>

<StorefrontDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
  <MarketplaceManagePortal embedded />
</StorefrontDrawer>
```

## API Calls

### Get Tenant ID for API Calls

```typescript
// In embedded mode
const tenantId = window.__BHQ_TENANT_ID__ || localStorage.getItem("BHQ_TENANT_ID");

// In standalone mode
const tenantId = useTenantId(); // From hook
```

### Make Authenticated API Calls

```typescript
import { getMarketplaceProfile } from "../api/client";

async function loadProfile() {
  const tenantId = getTenantId();
  const profile = await getMarketplaceProfile(tenantId);
  return profile;
}
```

All API calls include session cookies automatically via `credentials: "include"`.

## Testing

### Test in Embedded Mode

1. Run platform: `cd platform && npm run dev`
2. Navigate to: `http://app.breederhq.test:5175/marketplace`
3. Ensure `window.__BHQ_TENANT_ID__` is set
4. Verify MemoryRouter routes work
5. Check UrlSync keeps URL bar in sync

### Test in Standalone Mode

1. Run marketplace: `cd marketplace && npm run dev`
2. Navigate to: `http://marketplace.breederhq.test:5176`
3. Test authentication flow
4. Test buyer vs seller views
5. Verify TopNav navigation

### Test Both Entry Points

```bash
# Terminal 1: Platform
cd apps/platform && npm run dev

# Terminal 2: Marketplace standalone
cd apps/marketplace && npm run dev

# Visit both:
# http://app.breederhq.test:5175/marketplace
# http://marketplace.breederhq.test:5176
```

## Debugging

### Check Current Context

```typescript
// Add to component for debugging
const isSeller = useIsSeller();
const tenantId = useTenantId();

console.log("Context:", { isSeller, tenantId });
console.log("Router type:", window.location.href.includes("app.breederhq") ? "Embedded" : "Standalone");
```

### Verify UrlSync

In embedded mode, watch console:

```typescript
// In UrlSync component
console.log("MemoryRouter path:", location.pathname);
console.log("Browser URL:", window.location.pathname);
```

Both should stay synchronized.

### Check Tenant ID

```typescript
// Embedded mode
console.log("Tenant from window:", (window as any).__BHQ_TENANT_ID__);
console.log("Tenant from localStorage:", localStorage.getItem("BHQ_TENANT_ID"));

// Standalone mode
console.log("Tenant from hook:", useTenantId());
```

## Common Patterns

### Conditional Seller Features

```typescript
const isSeller = useIsSeller();

{isSeller && (
  <div>
    <Link to="/manage/breeder">Manage Storefront</Link>
    <Link to="/manage/individual-animals">Manage Animals</Link>
  </div>
)}
```

### Loading Seller Data

```typescript
const tenantId = useTenantId();
const [data, setData] = useState(null);

useEffect(() => {
  if (!tenantId) return;

  async function loadData() {
    const result = await getBreederData(tenantId);
    setData(result);
  }

  loadData();
}, [tenantId]);
```

### Page Title and SEO

```typescript
import { updateSEO } from "../utils/seo";

useEffect(() => {
  updateSEO({
    title: "Animals for Sale | BreederHQ Marketplace",
    description: "Browse animals from verified breeders",
    canonical: "https://marketplace.breederhq.com/animals",
  });
}, []);
```

## Styling

### Use Marketplace Theme

Components automatically get marketplace theme in both modes:

```css
/* Tailwind classes work everywhere */
className="bg-portal-bg text-white"
className="border-border-subtle"
className="text-text-muted"
```

### Embedded vs Standalone Styling

```typescript
function MyComponent({ embedded = false }: { embedded?: boolean }) {
  return (
    <div className={embedded ? "p-4" : "container mx-auto py-8"}>
      {/* Embedded: less padding, no container */}
      {/* Standalone: full page layout */}
    </div>
  );
}
```

## Cheat Sheet

| Task | Code |
|------|------|
| Check if seller | `const isSeller = useIsSeller()` |
| Get tenant ID | `const tenantId = useTenantId()` |
| Navigate | `<Link to="/path">` or `navigate("/path")` |
| Seller-only route | `<SellerOnlyRoute><Page /></SellerOnlyRoute>` |
| Embedded mode | `<Component embedded />` |
| Open drawer | `setDrawerOpen(true)` |
| API call | `await apiFunction(tenantId)` |
| SEO | `updateSEO({ title, description })` |

## Related Docs

- [Dual-Entry Architecture](./DUAL-ENTRY-ARCHITECTURE.md) - Full architectural overview
- [Marketplace API v2](../marketplace-api-v2.md) - Backend API reference
- [Integration Strategy](./INTEGRATION-STRATEGY.md) - Platform integration details

## Questions?

Check the [Dual-Entry Architecture](./DUAL-ENTRY-ARCHITECTURE.md) doc for detailed explanations of:
- MemoryRouter vs BrowserRouter
- UrlSync bidirectional sync
- GateContext API
- Storefront drawer pattern
- Troubleshooting guide

---

## Current Seller Management Structure (January 2025)

The seller dashboard has been reorganized for better UX:

### Homepage Layout (`/`)

```
SellerHomePage
├── Stats Cards (4 cards showing counts)
│   ├── Animal Listings
│   ├── Offspring Listings  
│   ├── Service Listings
│   └── Pending Inquiries
│
├── Storefront Settings Banner (opens drawer)
│   └── Click to edit business profile, breeds, credentials, policies
│
└── Management Cards (4 cards - navigate to pages)
    ├── Individual Animals → /manage/individual-animals
    ├── Animal Programs → /manage/animal-programs
    ├── Breeding Programs → /manage/breeding-programs
    └── Your Services → /manage/your-services
```

### Storefront Settings (Drawer Modal)

**Path**: Opened via button click (not a route)  
**Component**: `MarketplaceManagePortal` with `embedded={true}`

**Tabs**:
1. Business Profile - Name, logo, bio, location
2. Your Breeds - Species & breed selection
3. Standards & Credentials - Registrations, health testing, practices
4. Placement Policies - Waitlist, contracts, guarantees

**Note**: The legacy "Breeding Programs" tab was removed in January 2025. Use `/manage/breeding-programs` instead.

### Management Pages (Full Routes)

| Route | Page | Purpose |
|-------|------|---------|
| `/manage/individual-animals` | ManageAnimalsPage | List/edit individual animal listings |
| `/manage/individual-animals/new` | CreateDirectListingWizard | Create new animal listing |
| `/manage/animal-programs` | AnimalProgramsPage | Manage STUD, REHOME, GUARDIAN programs |
| `/manage/breeding-programs` | ManageBreedingProgramsPage | Manage breeding programs & offspring groups |
| `/manage/your-services` | ManageServicesPage | Manage service listings |
| `/manage/your-services/new` | CreateServiceWizard | Create new service listing |
| `/manage/breeder` | MarketplaceManagePortal | Full-page storefront settings (not drawer) |

---

## Common Patterns (Updated)

### Navigation Links

```typescript
// ✅ CORRECT - Use relative paths
<Link to="/">Back to Dashboard</Link>
<Link to="/manage/individual-animals">Manage Animals</Link>
<Link to="/animals">Browse Animals</Link>

// ❌ WRONG - Don't use /marketplace prefix
<Link to="/marketplace">Home</Link>  // Creates double path!
<Link to="/marketplace/animals">Animals</Link>  // Wrong!
```

### Opening Storefront Drawer

```typescript
const [drawerOpen, setDrawerOpen] = useState(false);

<button onClick={() => setDrawerOpen(true)}>
  Edit Storefront
</button>

<StorefrontDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
  <MarketplaceManagePortal embedded />
</StorefrontDrawer>
```

### Check if User is Seller (Updated)

```typescript
import { useIsSeller } from "../gate/MarketplaceGate";

function MyComponent() {
  const isSeller = useIsSeller();
  
  // Note: In embedded mode, isSeller is ALWAYS true
  // In standalone mode, it reflects actual user role
  
  if (isSeller) {
    return <SellerView />;
  }
  return <BuyerView />;
}
```

---

## Recent Changes (January 2025)

### Breaking Changes
- ❌ Removed "Breeding Programs" tab from Storefront Settings
- ❌ Removed unused pages: CreateProgramPage, ProgramsSettingsPage, ServicesSettingsPage, etc.
- ⚠️ Changed all "Back" links from `to="/marketplace"` to `to="/"`

### New Features
- ✅ Added CTA banners to `/animals`, `/breeders`, `/services` (standalone mode only)
- ✅ Fixed HMR flash by hardcoding `isSeller: true` in embedded mode
- ✅ Fixed double `/marketplace/marketplace` URL bug

### Behavioral Changes
- Embedded mode: `isSeller` is now always `true` (no longer derived from `tenantId`)
- StorefrontDrawer: Now only shows 4 tabs (Business, Breeds, Credentials, Policies)
- Breeding Programs: Must be managed at dedicated route `/manage/breeding-programs`

---

