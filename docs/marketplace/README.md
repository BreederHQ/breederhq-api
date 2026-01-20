# Marketplace Documentation

Documentation for the BreederHQ Marketplace dual-entry system.

## Overview

The BreederHQ Marketplace has **two separate entry points** serving different purposes:

1. **Embedded Mode** (`app.breederhq.com/marketplace`) - Breeder management portal
2. **Standalone Mode** (`marketplace.breederhq.com`) - Public marketplace

Both share the same components and API backend but use different routing and authentication contexts.

## Documentation Index

### Getting Started

📘 **[Developer Quick Start](./DEVELOPER-QUICK-START.md)**
- Quick reference for common tasks
- Code examples and patterns
- Testing checklist
- Cheat sheet

### Architecture

📐 **[Dual-Entry Architecture](./DUAL-ENTRY-ARCHITECTURE.md)**
- Complete architectural overview
- Component stack diagrams
- GateContext API
- UrlSync implementation
- Storefront drawer pattern
- Best practices
- Troubleshooting guide

### Visual Guides

🎨 **[Routing Visual Guide](./ROUTING-VISUAL-GUIDE.md)**
- Visual diagrams and flowcharts
- Component tree structures
- URL flow examples
- Data flow diagrams
- Navigation patterns

### Integration

🔌 **[Integration Strategy](./INTEGRATION-STRATEGY.md)**
- Platform integration details
- Module loading
- Context sharing

## Quick Links

### Key Concepts

- **Embedded Mode**: Marketplace module loaded inside platform portal for breeders to manage their listings
- **Standalone Mode**: Public-facing marketplace website for buyers and sellers
- **MemoryRouter**: React Router isolated from browser URL (used in embedded mode)
- **BrowserRouter**: Standard React Router with URL control (used in standalone mode)
- **UrlSync**: Bidirectional sync between MemoryRouter and browser URL
- **GateContext**: Shared context providing `isSeller` and `tenantId` to both modes
- **StorefrontDrawer**: Modal overlay for editing marketplace storefront settings

### Entry Points

```typescript
// Embedded entry point
apps/marketplace/src/embed/MarketplaceEmbedded.tsx

// Standalone entry point
apps/marketplace/src/gate/MarketplaceGate.tsx
```

### Shared Components

```typescript
// Homepage (shows different view based on isSeller)
apps/marketplace/src/marketplace/pages/HomePage.tsx

// Storefront management (supports embedded mode)
apps/marketplace/src/breeder/pages/MarketplaceManagePortal.tsx

// Drawer overlay
apps/marketplace/src/breeder/components/StorefrontDrawer.tsx
```

## Common Use Cases

### I need to...

**Add a new marketplace page**
→ See: [Developer Quick Start - Add a New Page](./DEVELOPER-QUICK-START.md#add-a-new-marketplace-page)

**Check if user is a seller**
→ See: [Developer Quick Start - Check if User is Seller](./DEVELOPER-QUICK-START.md#check-if-user-is-a-seller)

**Create a seller-only feature**
→ See: [Developer Quick Start - Add a Seller-Only Page](./DEVELOPER-QUICK-START.md#add-a-seller-only-page)

**Understand the routing flow**
→ See: [Routing Visual Guide - URL Flow](./ROUTING-VISUAL-GUIDE.md#url-flow-embedded-mode)

**Debug routing issues**
→ See: [Dual-Entry Architecture - Troubleshooting](./DUAL-ENTRY-ARCHITECTURE.md#troubleshooting)

**Understand UrlSync**
→ See: [Dual-Entry Architecture - UrlSync Component](./DUAL-ENTRY-ARCHITECTURE.md#urlsync-component)

## Architecture Diagrams

### High-Level Overview

```
┌────────────────────────────────────────────────────────┐
│              BreederHQ Marketplace                      │
├────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────────────┐    ┌────────────────────┐   │
│  │   Embedded Mode      │    │  Standalone Mode   │   │
│  │                      │    │                    │   │
│  │  app.breederhq.com/  │    │  marketplace.      │   │
│  │  marketplace         │    │  breederhq.com     │   │
│  │                      │    │                    │   │
│  │  • Sellers only      │    │  • Buyers/Sellers  │   │
│  │  • MemoryRouter      │    │  • BrowserRouter   │   │
│  │  • Platform nav      │    │  • Marketplace nav │   │
│  │  • UrlSync bridge    │    │  • Full auth flow  │   │
│  └──────────────────────┘    └────────────────────┘   │
│                                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │          Shared Components & APIs              │    │
│  │                                                 │    │
│  │  • HomePage (SellerHomePage / PublicHomePage)  │    │
│  │  • MarketplaceManagePortal (w/ embedded mode)  │    │
│  │  • Management pages (Animals, Programs, etc.)  │    │
│  │  • GateContext (isSeller, tenantId)           │    │
│  │  • API Client (marketplace APIs)              │    │
│  └────────────────────────────────────────────────┘    │
│                                                          │
└────────────────────────────────────────────────────────┘
```

### Component Flow

See detailed diagrams in:
- [Routing Visual Guide - Component Trees](./ROUTING-VISUAL-GUIDE.md#component-tree-embedded-mode)
- [Dual-Entry Architecture - Component Stack](./DUAL-ENTRY-ARCHITECTURE.md#entry-point-1-embedded-mode)

## Key Design Decisions

### Why Two Entry Points?

1. **Separation of Concerns**
   - Breeders manage listings inside their portal (embedded)
   - Buyers browse listings on public marketplace (standalone)

2. **Different User Contexts**
   - Embedded: Always authenticated sellers with tenant context
   - Standalone: Mixed - buyers (no tenant) and sellers (with tenant)

3. **Different Navigation**
   - Embedded: Platform owns navigation shell
   - Standalone: Marketplace owns navigation

4. **SEO Requirements**
   - Embedded: No SEO needed (behind auth)
   - Standalone: Full SEO optimization for public pages

### Why MemoryRouter in Embedded Mode?

The platform controls the browser's URL bar for routing between modules (Animals, Breeding, Marketplace, etc.). Using MemoryRouter keeps React Router's state isolated from the platform's routing, while UrlSync ensures both stay in sync.

See: [Dual-Entry Architecture - Why MemoryRouter?](./DUAL-ENTRY-ARCHITECTURE.md#why-memoryrouter)

### Why Storefront Drawer Pattern?

Instead of navigating to a separate page, the storefront settings open in a drawer overlay. This:
- Keeps context of the dashboard visible
- Provides better UX for quick edits
- Avoids navigation overhead
- Works consistently in both embedded and standalone modes

See: [Dual-Entry Architecture - Storefront Settings Drawer](./DUAL-ENTRY-ARCHITECTURE.md#storefront-settings-drawer)

## Testing

### Run Both Modes Locally

```bash
# Terminal 1: Platform (embedded mode)
cd apps/platform && npm run dev
# Visit: http://app.breederhq.test:5175/marketplace

# Terminal 2: Marketplace standalone
cd apps/marketplace && npm run dev
# Visit: http://marketplace.breederhq.test:5176
```

### Test Checklist

- [ ] Embedded mode loads at `/marketplace`
- [ ] SellerHomePage shows stats correctly
- [ ] Green storefront banner opens drawer
- [ ] Drawer shows storefront settings (no extra headers/cards)
- [ ] Management cards navigate correctly
- [ ] UrlSync keeps browser URL in sync with MemoryRouter
- [ ] Standalone mode shows public homepage
- [ ] Standalone authentication flow works
- [ ] Seller vs buyer views render correctly
- [ ] TopNav shows correct links
- [ ] API calls work in both modes
- [ ] Routes are identical in both modes

## Related Documentation

### API Documentation
- [Marketplace API v2](../marketplace-api-v2.md)
- [Breeder Management API](../breeder-marketplace-management-api.md)
- [Service Provider API](../SERVICE_PROVIDER_API_IMPLEMENTATION.md)

### Platform Documentation
- [Integration Strategy](./INTEGRATION-STRATEGY.md)
- [Platform Module System](../../platform/MODULE-SYSTEM.md) *(if exists)*

## Contributing

When adding new marketplace features:

1. **Add routes to BOTH entry points** (MarketplaceEmbedded.tsx and MarketplaceRoutes.tsx)
2. **Use GateContext hooks** (`useIsSeller`, `useTenantId`) for conditional logic
3. **Support embedded mode** if component appears in drawer/modal
4. **Test in both modes** before merging
5. **Update documentation** if changing routing or context behavior

## Questions?

Check the documentation in this order:

1. **Quick task?** → [Developer Quick Start](./DEVELOPER-QUICK-START.md)
2. **Need diagrams?** → [Routing Visual Guide](./ROUTING-VISUAL-GUIDE.md)
3. **Deep dive?** → [Dual-Entry Architecture](./DUAL-ENTRY-ARCHITECTURE.md)
4. **Integration issues?** → [Integration Strategy](./INTEGRATION-STRATEGY.md)

---

**Last Updated**: January 2026

**Maintained By**: BreederHQ Engineering Team
