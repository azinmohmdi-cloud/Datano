# Component Development Framework

> A Clean Architecture-inspired approach for building scalable, testable, and maintainable components in Next.js 16 (App Router).

## Table of Contents

- [Three Levels of Architecture](#three-levels-of-architecture)
- [Component Layer (Level 3) — The Core](#component-layer-level-3--the-core)
  - [Conceptual Packages](#conceptual-packages)
  - [Flat Layout: UI → Dependency Injectors](#flat-layout-ui--dependency-injectors)
  - [Tier 1: UI (`index.tsx`)](#tier-1-ui-indextsx)
  - [Tier 2: Dependency Injector (`<Name>.tsx`)](#tier-2-dependency-injector-nametsx)
  - [Shared Logic Hooks (`use<ComponentName><Logic>.ts`)](#shared-logic-hooks-useComponentName-logicts)
  - [Loading / Error UI (`loading.tsx`, `error.tsx`)](#loading--error-ui-loadingtsx-errortsx)
  - [Data Hooks (`data/feature/`)](#data-hooks-datafeature)
  - [Tier Interaction Summary](#tier-interaction-summary)
- [Route Layer (Level 2) — Page Composition](#route-layer-level-2--page-composition)
- [App Layer (Level 1) — Global Setup](#app-layer-level-1--global-setup)
  - [Providers](#providers)
  - [Layout Shells](#layout-shells)
- [Development Workflow](#development-workflow)
- [Principles & Rationale](#principles--rationale)

---

## Three Levels of Architecture

Every application built with this framework is organized in three concentric levels:

| Level            | Scope         | Responsibility                                          |
| ---------------- | ------------- | ------------------------------------------------------- |
| **1. App**       | Global        | Providers, layouts, shared configuration                |
| **2. Route**     | Per-page      | Compose concrete injectors and pass route inputs |
| **3. Component** | Per-component | UI rendering, isolated data logic, dependency injection |

Each level has clear boundaries. A level never reaches across another level — a Component does not fetch route params, a Route does not implement UI minutiae.

---

## Component Layer (Level 3) — The Core

Component-level code lives under `@/components/` and is divided into three conceptual packages:

### Conceptual Packages

```
components/
├── ui/              # Building-block, non-smart components
│   ├── button.tsx
│   ├── table.tsx
│   └── ...
├── feature/         # Domain-specific feature components (Clean Architecture)
│   └── item/
│       └── InvoicesTable/
│           ├── index.tsx                   # Pure UI (no dependencies)
│           ├── AdminInvoicesTable.tsx       # Dep. Injector (admin version)
│           ├── MyInvoicesTable.tsx          # Dep. Injector (user version)
│           ├── loading.tsx                 # Optional shared loading UI
│           ├── error.tsx                   # Optional shared error UI
│           ├── useInvoicesTableFormatting.ts   # Optional shared logic (formatting)
│           ├── useInvoicesTableFiltering.ts    # Optional shared logic (filtering)
│           └── ...                              # One file per concern
└── layout/          # Layout-level components
    ├── providers.tsx
    └── ExampleLayout/
        ├── index.tsx
        ├── header.tsx
        └── footer.tsx
```

Data-layer hooks live in a separate directory tree:

```
data/
└── feature/
    ├── cart/
    │   ├── useGetCart.ts
    │   └── useAddCartItem.ts
    └── invoice/
        ├── useGetAdminInvoices.ts
        └── useGetMyInvoices.ts
```

| Package         | Role                                                         | Dependencies                                        |
| --------------- | ------------------------------------------------------------ | --------------------------------------------------- |
| `ui/`           | Reusable primitives (buttons, tables, inputs) | UI libraries, React, shared utilities; no domain fetching/models |
| `feature/`      | Domain components built with the Dependency Injector pattern | May reference `ui/`, data-layer hooks, shared hooks |
| `layout/`       | Global layout wrappers (providers, shells)                   | Any                                                 |
| `data/feature/` | Data-layer hooks, one concern per file                       | External API clients, `@tanstack/react-query`       |

---

### Flat Layout: UI → Dependency Injectors

A feature component directory holds a shared pure UI (`index.tsx`) plus one or more **Dependency Injector** files that wire data into it:

```
InvoicesTable/                       # Abstract component directory
├── index.tsx                        # Tier 1 — Pure UI (no dependencies)
├── AdminInvoicesTable.tsx           # Tier 2 — Dep. Injector (admin)
├── MyInvoicesTable.tsx              # Tier 2 — Dep. Injector (user)
├── loading.tsx                      # Optional shared loading UI
├── error.tsx                        # Optional shared error UI
├── useInvoicesTableFormatting.ts   # Optional shared logic (formatting)
└── useInvoicesTableFiltering.ts    # Optional shared logic (filtering)
```

> **Naming convention**: The abstract component directory (`InvoicesTable/`) holds `index.tsx` as the pure UI. Concrete Dependency Injectors (`AdminInvoicesTable.tsx`, `MyInvoicesTable.tsx`, etc.) are flat files in the same directory. No nested sub-folders. Loading/error UIs and shared logic hooks across injectors live as sibling files (`loading.tsx`, `error.tsx`, `use<ComponentName><Logic>.ts`).

---

### Tier 1: UI (`index.tsx`)

**Purpose**: Presentation isolated from application logic and API/domain models. Shared UI primitives, React, and presentation utilities are valid dependencies.

**Rules**:

1. Define and export an interface named `<ComponentName>UIProps` alongside the component (or use inline types if the props are small).
2. Props use locally defined presentation types: strings, numbers, booleans, callbacks, and records/arrays composed from these values. Do not import API/domain models into pure UI.
3. Props are named based on **UI semantics**, not business logic:
   - ✅ `onClickButton` (what the UI does when clicked)
   - ❌ `handleAddToCart` (what happens in the business layer)
4. Group text and handlers into the following objects when needed; presentation data such as `rows` remains a separate locally typed prop:
   - `translations` — All text/string content (labels, `ariaLabel`, status strings, etc.)
   - `callbacks` — Event handlers (`onClickButton`, `onChange`, etc.)
5. This file is the directory entry point (`index.tsx`). Export a **default** component. Consumers import from the directory path, never directly from the file.
6. **Internal sub-components for large modules**: When the UI component grows beyond a single screen (~50 lines of JSX), extract each logical card/block into a non-exported function at the bottom of the same file. Pass only the props each block needs (destructure at the function signature). This keeps the root component's return readable as a tree of named sections without premature abstraction into separate files.

**Large UI example with internal sub-components**:

```tsx
// components/feature/product/ProductDetail/index.tsx

export default function ProductDetailUI(props: ProductDetailUIProps) {
  // galleryIndex and callbacks are controlled presentation props from the injector.
  // Keep feature state and effects in the injector/data layer.

  return (
    <div className="...">
      <div className="flex-1 flex flex-col gap-5">
        <ProductInfoCard
          images={props.images} title={props.title}
          rating={props.rating} translations={props.translations}
          attributes={props.attributes}
          maxVisibleThumbs={4}
          extraCount={props.images.gallery.length - 4}
          onGalleryOpen={props.callbacks.onGalleryOpen}
        />
        <VendorsCard
          vendors={props.vendors}
          translations={props.translations}
        />
        <DescriptionCard
          description={props.description}
          attributes={props.attributes}
          translations={props.translations}
        />
      </div>
      <PurchaseCard ... />
      {props.galleryIndex !== null && <GalleryModal ... />}
    </div>
  );
}

// --- Internal sub-components (non-exported) ---

function ProductInfoCard({ ... }) { /* ... */ return (...); }
function PurchaseCard({ ... }) { /* ... */ return (...); }
function VendorsCard({ ... }) { /* ... */ return (...); }
function DescriptionCard({ ... }) { /* ... */ return (...); }
function GalleryModal({ ... }) { /* ... */ return (...); }
```

Key rules for internal sub-components:

- **Non-exported**: Each function uses `function Name(...)` without `export`.
- **Explicit props**: Destructure all props at the function signature. No closure over the parent scope.
- **Types via indexed access**: Use `ProductDetailUIProps["translations"]` to reuse the parent type without redefining it.
- **Bottom of file**: Group all internal components after the main export with a `// --- Internal sub-components ---` comment.
- **Readable root**: The main component's return becomes a flat tree of named sections — easy to scan without scrolling.

---

### Tier 2: Dependency Injector (`<Name>.tsx`)

**Purpose**: The concrete Dependency Injector file that wires data hooks, shared logic hooks, loading/error UIs together into a final consumable component. This is the only file consumers import from `@/components/feature/`.

**Rules**:

1. Export a **default** component named after the variant (`AdminXxx`, `MyXxx`, `SimpleXxx`, `FancyXxx`, etc.).
2. Accept props that make sense at the usage site (or no props for self-contained widgets).
3. Import data hooks from `@/data/feature/` — call them at the top and handle their states (loading, error, success).
4. Import shared logic hooks from the same directory (e.g., `useInvoicesTableFormatting.ts`) — each hook covers one specific concern. Injectors only import what they need.
5. Import shared loading/error UIs from sibling files (`loading.tsx`, `error.tsx`) or use inline fallbacks.
6. Own feature UI state (`useState`) here if needed; pass controlled values/callbacks to pure UI. Data fetching/cache state stays in data hooks.
7. Render the pure UI component by mapping data to `UIProps` within the success branch.

**Example — Invoices Table (self-contained, no props)**:

```tsx
// components/feature/item/InvoicesTable/AdminInvoicesTable.tsx

"use client";

import useGetAdminInvoices from "@/data/feature/invoice/useGetAdminInvoices";
import InvoicesTableUI from ".";
import useInvoicesTableFormatting from "./useInvoicesTableFormatting";

export default function AdminInvoicesTable() {
  const { invoices, succeed } = useGetAdminInvoices();
  const { rows } = useInvoicesTableFormatting(invoices);

  if (succeed === null) {
    return <InvoicesTableLoadingUI />;
  }
  if (succeed === false) {
    return <InvoicesTableErrorUI />;
  }
  return (
    <InvoicesTableUI
      translations={{
        tableCaption: "A list of all users invoices.",
        tableHead: {
          invoice: "Invoice",
          status: "Status",
          method: "Method",
          amount: "Amount",
        },
      }}
      rows={rows}
    />
  );
}
```

> The Dependency Injector file is the **only module** that the rest of the app imports directly. It orchestrates the data layer, formatting layer, and UI layer into one ready-to-use component. Routes never import from `index.tsx` or data hooks directly — they go through the injector.

---

### Shared Logic Hooks (`use<ComponentName><Logic>.ts`)

**Purpose**: Optional hooks that extract reusable logic shared between Dependency Injectors in the same directory. Each file covers **one specific concern** — formatting, filtering, sorting, validation, etc. Multiple hooks per component directory are encouraged when different injectors need different slices of logic (ISP).

**Rules**:

1. Export a **default** function named `use<ComponentName><Logic>` describing the domain concept (e.g., `useInvoicesTableFormatting`, `useInvoicesTableFiltering`).
2. Accept raw data as input, return derived/transformed data.
3. No data fetching, no side effects — pure logic only.
4. Reuse across injectors: `AdminInvoicesTable` and `MyInvoicesTable` both call the same hook.
5. Create separate files for unrelated concerns — do not combine formatting, filtering, validation, etc. into a single hook.

**Example — formatting**:

```tsx
// components/feature/item/InvoicesTable/useInvoicesTableFormatting.ts

import { Invoice } from "@/lib/types/Invoice";

export default function useInvoicesTableFormatting(invoices: Invoice[]) {
  const rows = invoices.map((invoice) => ({
    invoice: invoice.id,
    method: invoice.method,
    status: invoice.status,
    amount: invoice.amount.toLocaleString(),
  }));

  return { rows };
}
```

**Example — filtering**:

```tsx
// components/feature/item/InvoicesTable/useInvoicesTableFiltering.ts

import { Invoice } from "@/lib/types/Invoice";

export default function useInvoicesTableFiltering(
  invoices: Invoice[],
  query: string,
) {
  const filtered = invoices.filter((inv) =>
    inv.id.toLowerCase().includes(query.toLowerCase()),
  );

  return { filtered };
}
```

### Loading / Error UI (`loading.tsx`, `error.tsx`)

**Purpose**: Shared placeholder UIs for loading and error states. Defined as optional sibling files in the feature directory so multiple Dependency Injectors in the same directory can reuse them instead of duplicating inline `div`s.

**Rules**:

1. Each file exports a **default** component named `<ComponentName>LoadingUI` / `<ComponentName>ErrorUI`.
2. Keep them minimal — they are placeholders, not full-featured pages.
3. Injectors may still use inline fallbacks for one-off cases.

**Example**:

```tsx
// components/feature/item/InvoicesTable/loading.tsx
export default function InvoicesTableLoadingUI() {
  return <div>Loading invoices...</div>;
}
```

```tsx
// components/feature/item/InvoicesTable/error.tsx
export default function InvoicesTableErrorUI() {
  return <div>Failed to load invoices.</div>;
}
```

---

### Data Hooks (`data/feature/`)

**Purpose**: General-purpose, reusable data-layer logic — fetching, mutating, caching. These live in `@/data/feature/<FeatureName>/` and are named by their data-layer purpose, not by the component that uses them.

**Rules**:

1. Export a **default** function (`useGetXxx`, `useXxx`).
2. Define and export a `UseXxxReturn` interface that serves as the contract for consumers.
3. Each hook focuses on a **single data concern** (one API endpoint, one resource type).
4. Hooks can mock data internally until the real backend integration is ready — the `UseXxxReturn` contract stays the same.
5. Hooks are shared across features — any Dependency Injector can import any data hook.
6. Query key management, cache invalidation, and optimistic updates belong here.

**Illustrative `useQuery` / `useMutation` example**: cart endpoints are hypothetical and are not implemented Datano APIs. Generated names/signatures must be verified against actual OpenAPI before use. Query identity must include request inputs and the authenticated account; `userId` below is that verified account identity.

```tsx
// data/feature/cart/useGetCart.ts

import { useQuery } from "@tanstack/react-query";
import { getCart } from "@/lib/api/v1";

export default function useGetCart(userId: string) {
  return useQuery({
    queryKey: ["cart", userId],
    queryFn: () => getCart({ user_id: userId }),
  });
}
```

```tsx
// data/feature/cart/useAddCartItem.ts

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { postCartItems } from "@/lib/api/v1";

export default function useAddCartItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      variantId,
      quantity,
      userId,
    }: {
      variantId: string;
      quantity: number;
      userId: string;
    }) =>
      postCartItems({ variant_id: variantId, quantity }, { user_id: userId }),
    onSuccess: (_result, variables) =>
      queryClient.invalidateQueries({ queryKey: ["cart", variables.userId] }),
  });
}
```

**Example with mock data and return contract**:

```tsx
// data/feature/invoice/useGetAdminInvoices.ts

import { Invoice } from "@/lib/types/Invoice";
import { useEffect, useState } from "react";

export interface UseGetAdminInvoicesReturn {
  invoices: Invoice[];
  succeed: boolean | null;
}

export default function useGetAdminInvoices(): UseGetAdminInvoicesReturn {
  const [data, setData] = useState<Invoice[]>([]);
  const [succeed, setSucceed] = useState<boolean | null>(null);

  useEffect(() => {
    if (Math.random() > 0.15) {
      setData(MOCKED_ADMIN_INVOICES);
      setSucceed(true);
    } else {
      setSucceed(false);
    }
  }, []);

  return { invoices: data, succeed };
}
```

> **Directory structure**: `data/feature/{product,cart,brand,category,...}/useGetXxx.ts`. Hooks are organized by domain, not by UI component. This makes them reusable across multiple Dependency Injectors; pages compose those injectors.

---

### Tier Interaction Summary

```
┌──────────────────────────────────────────────────────────────┐
│  Route / Page (Level 2)                                      │
│  - Imports DI component only (e.g. AdminInvoicesTable)       │
│  - No direct access to data hooks or UI components          │
└─────────────────────┬────────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────────┐
│  AdminInvoicesTable.tsx  (Dependency Injector)                │
│  - Imports data hook from data/feature/                       │
│  - Imports shared hooks (e.g. useInvoicesTableFormatting)      │
│  - Imports loading/error UIs from sibling files               │
│  - Renders <InvoicesTableUI {...uiProps} />                  │
└──────┬─────────────────────────┬──────────────────┬──────────┘
       │                         │                  │
       ▼                         ▼                  ▼
┌──────────────┐  ┌───────────────────────┐  ┌────────────────┐
│  index.tsx   │  │  data/feature/        │  │  loading.tsx   │
│  (Pure UI)   │  │  useGetAdminInvoices  │  │  error.tsx     │
│              │  │  useGetMyInvoices     │  └────────────────┘
│  - Primitives│  │                      │  ┌────────────────┐
│  - No deps   │  │  - Return interface  │  │  useInvoicesTable │
│  - Default   │  │  - Mocks allowed     │  │  Formatting.ts    │
│    export    │  │  - Default export    │  │  (shared hook)    │
│    export    │  │  - Default export    │  └────────────────┘
└──────────────┘  └──────────────────────┘
```

**Benefits of this separation**:

- **UI can be developed and reviewed in isolation** — just pass mocked props to the UI component.
- **Data hooks are reusable** — `useGetAdminInvoices` is shared across injectors; pages consume injectors rather than importing data hooks.
- **Multiple injectors** of the same abstract UI (e.g., `AdminInvoicesTable`, `MyInvoicesTable`) share `index.tsx` while having their own data/formatting strategy.
- **API adaptation** belongs in `data/feature/`. Presentation-contract changes may also require injector/UI changes; do not claim every API change is invisible to consumers.
- **Loading/error states** are shared across injectors via standalone files, avoiding duplication.

---

## Route Layer (Level 2) — Page Composition

A route (page in App Router) acts as the **consumer** — it only imports Dependency Injector components. Routes never import `index.tsx` (pure UI) directly, never import data hooks, and never wire up data manually.

**Rules**:

1. Only import from `@/components/feature/Xxx/XxxInjectorName` (Dependency Injector files).
2. No direct import of `index.tsx` from feature components.
3. No direct import of hooks from `@/data/feature/`.
4. Pass props that the injector needs (if any), or just render it without props.

Routes do **not** implement UI logic or low-level data operations — they only compose ready-made components.

**Example — self-contained injector (no props)**:

```tsx
// app/examples/admin/invoices/page.tsx

import AdminInvoicesTable from "@/components/feature/item/InvoicesTable/AdminInvoicesTable";

export default function Page() {
  return (
    <div>
      <h1>Admin Invoices</h1>
      <AdminInvoicesTable />
    </div>
  );
}
```

---

## App Layer (Level 1) — Global Setup

The app layer sets up shared infrastructure — providers, global styles, fonts, and page-level layout shells.

### Providers

```tsx
// components/layout/providers.tsx

"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 5 * 60 * 1000, retry: 1 },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

This is consumed by the root layout (`app/layout.tsx`), not by individual pages or components.

### Layout Shells

Layout components follow the same directory pattern — `index.tsx` as the main entry, with named sections extracted into sibling files:

```
components/layout/ExampleLayout/
├── index.tsx     # Main layout composition
├── header.tsx    # Header section
└── footer.tsx    # Footer section
```

```tsx
// components/layout/ExampleLayout/index.tsx

import { PropsWithChildren } from "react";
import MainLayoutHeader from "./header";
import MainLayoutFooter from "./footer";

export default function ExampleLayout({ children }: PropsWithChildren) {
  return (
    <div className="w-full min-h-screen flex flex-col justify-between">
      <MainLayoutHeader />
      <main className="h-full">{children}</main>
      <MainLayoutFooter />
    </div>
  );
}
```

```tsx
// components/layout/ExampleLayout/header.tsx
export default function ExampleLayoutHeader() {
  return (
    <header className="w-full h-8 flex justify-center items-center border-b">
      Header
    </header>
  );
}
```

---

## Development Workflow

The recommended workflow builds top-down: UI first, then wiring, while following red–green–refactor for behavioral changes. Use approved fixtures to define the presentation contract; this workflow does not replace tests.

### Phase 1 — UI First

1. Define the `index.tsx` with the `<ComponentName>UIProps` interface and a `export default` component.
2. Build and refine the UI in isolation by passing hardcoded props.
3. Review the rendered component against the approved design/task. Ordinary choices already authorized by that task do not require repeated approval; ask only about unresolved material scope/design changes.

### Phase 2 — Shared Support Files

1. If loading/error states are needed, create `loading.tsx` and `error.tsx` as default-exported components.
2. If reusable logic (e.g., formatting, filtering, sorting) can be extracted, create `use<ComponentName><Logic>.ts` files — one per concern.
3. Multiple injectors in the same directory share these files.

### Phase 3 — Build Dependency Injector

1. Create `<VariantName>.tsx` (e.g., `AdminInvoicesTable.tsx`) as a default-exported component.
2. Import the UI from `./index.tsx`, shared hooks from `./use<ComponentName><Logic>.ts` (only the ones needed), and loading/error UIs from siblings.
3. Import data hooks from `@/data/feature/` — if they don't exist, create them with mock data.
4. Handle the loading/error/success states and render the UI component.

### Phase 4 — Real Data

1. Replace mock data in hooks with real API calls via `useQuery`/`useMutation`.
2. Test end-to-end.
3. No changes to `index.tsx` or the injector are needed — only the data hook changes.

---

## Principles & Rationale

**1. UI is the highest-level module.**  
Presentation components depend on local UI props and shared presentation dependencies, not domain/API models or data fetching. They can be tested independently; presentation-contract changes may still require updates.

**2. Single-entry point per Dependency Injector.**  
The injector file (`<Name>.tsx`) is the only file consumers ever import. It wires data hooks, formatting, and presentation props; fetching/cache logic stays in data hooks. No consumer ever imports the UI file or data hooks directly.

**3. Data hooks are general-purpose, not component-specific.**  
Hooks live in `data/feature/` organized by domain, enabling reuse across injectors. Pages consume the concrete injectors. A hook does one thing — fetch or mutate — and returns a defined data contract. The `UseXxxReturn` interface stabilizes consumers; contract changes still need coordinated updates.

**4. Fast-paced, parallel development.**  
UI developers work on `index.tsx` in isolation. Data-layer developers create hooks in `data/feature/`. Deterministic fixtures support design/tests before the backend is ready; randomized invoice mocks are existing examples and must not become routine test fixtures or live product data. Shared logic hooks and loading/error UIs further decouple concerns.

**5. Full testability.**

- UI: render with any combination of props.
- Hook: test data logic (or mock contract) with `UseXxxReturn`.
- Shared hook: pure function test with domain data input.
- Injector: test wiring with mocked hooks.
- Integration: test the composed component with mocked data layer.

**6. Multiple Dependency Injectors, shared UI.**  
One abstract UI component (`index.tsx`) can have many concrete injectors (`AdminXxx.tsx`, `MyXxx.tsx`, `SimpleXxx.tsx`, `FancyXxx.tsx`), each with its own data strategy and loading/error presentation.

**7. No mega components — component per feature.**  
A component directory owns one coherent feature. If a component grows to handle multiple unrelated concerns, split it into separate feature component directories. Each directory should answer "what feature does this deliver?" — not "what type of UI is this?".

## Dashboard adapters and composition — 2026-10-15

`analytics/DashboardReport/index.tsx` composes the overview/GA4, Search and Ads
slots without domain dependencies. The existing concrete injectors own period,
metric selection and presentation mapping. `TrafficOverview/index.tsx` is the
shared source-aware Recharts presentation; `SourceTrend/series.ts` validates
GSC/Ads daily snapshot inputs independently from KPI totals and top rows.
These TypeScript inputs are presentation contracts, not a proposed HTTP schema.

Future FE-037/039/041 hooks consume the actual generated client and adapt its
report to exact website/source/property/metric/window snapshots. Preserve query
filters, aggregation/attribution basis, source timezone, coverage, finality,
receipt time and currency; refuse incompatible comparisons. Source daily rows
and whole-window aggregates remain separate, especially unique GA4 users and
GSC top rows. The adapter must not synthesize daily values from totals, infer
zero for missing dates, or fetch in pure UI. Provider compatibility and real
OpenAPI are validated in the corresponding backend/integration tasks.

Private daily fixtures and their illustrative distribution helpers live only in
`feature/internal/DashboardReview`; product modules never import them. Native
metric disclosures are presentation state and do not refetch, mutate observations,
create routes, or erase details when collapsed.
