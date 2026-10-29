# E-Studio — Architecture & Technical Specifications

## 1. Executive Summary & Product Scope

**E-Studio** is an enterprise-grade retail label-design and print-production studio. It unifies template authoring, multi-source catalog data ingestion, tiered pricing calculation, batch imposition, and mobile handheld barcode scanning into a single, cohesive local-first web application.

### Core Objectives
1. **Precision Template Design**: High-fidelity 2D canvas with millimetric precision, dynamic product field binding, QR/EAN-13/Code128 barcodes, and custom pictograms.
2. **Master Catalog & Ingestion**: 51-field enterprise schema supporting Excel/CSV imports, column mapping, normalization, deduplication, and local persistence.
3. **Price Rules & Tier Engine**: Calculation of unit prices, degressive volume breaks, discount thresholds, and anomaly detection.
4. **Imposition & Industrial Output**: Multi-up sheet layout (Avery presets, custom grids), waste reduction, and multi-format exports (PDF, PPTX, ZPL).
5. **Mobile Terminal & PWA**: Offline-first handheld scanning station with real-time pairing and batch synchronization.

---

## 2. System Architecture & Layer Boundaries

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                       │
│  App Shell  •  Workspace Header  •  Design System Tokens    │
└──────────────┬───────────────────────────────┬──────────────┘
               │                               │
┌──────────────▼──────────────┐ ┌──────────────▼──────────────┐
│       Feature Modules       │ │       Context & State       │
│ • Home Dashboard            │ │ • AppProviders / AppStore   │
│ • Template Studio           │ │ • Tooltip Context           │
│ • Batch Imposition          │ │ • Mapping Dictionary        │
│ • Master Catalog Studio     │ │ • Offline Storage Manager   │
│ • Rules & Omni-Channel      │ └─────────────────────────────┘
│ • Mobile Terminal & Sync    │
└──────────────┬──────────────┘
               │
┌──────────────▼──────────────────────────────────────────────┐
│                        Domain Layer                         │
│ • Template Model & Parser   • Pricing & Tier Math Engine    │
│ • Barcode & QR Generators   • Semantic Snapping & Guides    │
│ • Avery & Grid Imposition   • Export Adapters (PDF/PPTX/ZPL)│
└──────────────┬──────────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────────────┐
│                      Persistence Layer                      │
│ • Catalog Repository        • Template Storage Manager      │
│ • IndexedDB / Local Fallback• Audit Trail Logger            │
└─────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

1. **Presentation / Shell Layer (`/src/app`, `/src/components`)**:
   - Manages top navigation, active view switches, theme preferences, and global modal dialogs.
   - Decoupled from direct data mutation; dispatches through typed handlers and context providers.

2. **Domain Layer (`/src/domains`, `/src/utils`)**:
   - Pure, deterministic business logic independent of UI components.
   - Enforces mathematical accuracy: millimeters-to-pixels conversion at 96 DPI (3.78 px/mm), GS1 check-digit verification for EAN-13, and step-graph tier staircases.

3. **Persistence Layer (`/src/services`, `/src/utils/offlineStorage.ts`)**:
   - Local-first architecture with structured repository abstractions.
   - Safe serialization, automated schema migration, and isolated audit logging.
   - **Zero Fabricated Data Guarantee**: Strictly handles genuine user data. Absences of data are treated as valid application states requiring explicit empty-state views.

---

## 3. Core Domain Models & Data Contracts

### 3.1 Template Domain (`/src/domains/templates/Template.ts`, `/src/types.ts`)
```typescript
interface LabelTemplate {
  id: string;
  name: string;
  width_mm: number;
  height_mm: number;
  orientation: 'landscape' | 'portrait';
  target_printer?: 'laser' | 'thermal' | 'esl';
  inner_margins_mm: { top: number; right: number; bottom: number; left: number };
  items: TemplateItem[];
  default_imposition?: ImpositionConfig;
  status?: 'draft' | 'valid' | 'has_warnings';
  updatedAt: string;
}
```

### 3.2 Catalog & Product Domain (`/src/domains/catalog/ProductRecord.ts`, `/src/types.ts`)
```typescript
interface ProductRecord {
  id: string;
  ITEMNAME: string;
  SELLING_PRICE: number;
  PRODUCT_SCAN?: string;
  PARTNO?: string;
  UNIT_PRICE_MEASURE?: string;
  UNIT_PRICE_BASE?: number;
  UNIT_MEASURE?: string;
  PROMO_PRICE?: number;
  PROMO_START?: string;
  PROMO_END?: string;
  DEPT_NAME?: string;
  CATEGORY_NAME?: string;
  VENDOR_NAME?: string;
  ORIGIN?: string;
  price_tiers?: PriceTierBreak[];
  [key: string]: any;
}
```

### 3.3 Imposition & Print Domain (`/src/utils/impositionCalculator.ts`)
```typescript
interface ImpositionConfig {
  sheet_format: 'A4' | 'A3' | 'A5' | 'Letter' | 'Roll';
  rows: number;
  cols: number;
  margin_top_mm: number;
  margin_bottom_mm: number;
  margin_left_mm: number;
  margin_right_mm: number;
  gap_x_mm: number;
  gap_y_mm: number;
  start_offset_slot?: number;
}
```

---

## 4. UI/UX Design System & Workflow Specifications

### 4.1 Primary Workspaces
1. **Dashboard (`HomeDashboard`)**: High-level telemetry, recently edited templates, quick print actions, and workspace backup/restore.
2. **Template Editor (`TemplateEditor`)**: Interactive visual layout engine featuring:
   - Millimeter canvas with interactive rulers and viewport zoom (25%–400%).
   - Dynamic snap guides, alignment distribution, and rotation handles.
   - Property inspector for fine-tuned positioning, typography, barcodes, and dynamic field binding.
3. **Generation & Imposition Workspace (`GenerationWorkspace`)**:
   - Product list filtering and selection.
   - Real-time sheet layout preview with Avery preset matching.
   - Offset slot selection for reusing partially printed sticker sheets.
   - Batch export in PDF, PowerPoint (PPTX), and Zebra Programming Language (ZPL).
4. **Master Catalog Studio (`MasterDatabaseStudio`)**:
   - Virtualized data grid supporting 51 enterprise retail attributes.
   - CSV and XLSX multi-sheet import with column mapping and data cleaning studio.
   - Deduplication, price re-indexing, and conflict resolution.
5. **Tier Pricing Studio (`TierPricingStudio`)**:
   - Staircase step-graph visualizer for bulk price degradation.
   - Anomaly detection (e.g., higher volume with higher unit price).
   - Implicit multi-row ERP consolidation.
6. **Mobile Sync Hub & Terminal (`MobileSyncHubModal`, `MobileTerminalView`)**:
   - PWA-compatible camera barcode scanner.
   - Device pairing with 4-digit security PIN.
   - Offline batch scanning buffer and station sync.

### 4.2 State Machine Standards
Every asynchronous or data-dependent view must implement the following standardized states:
- **Empty State**: Clear explanation with immediate call-to-action (e.g., "Import Products" or "Create Template").
- **Loading State**: Accessible spinner or skeleton without layout shift.
- **Error State**: Informative error description with recovery recommendations.
- **Offline State**: Visual connectivity badge with local storage fallback indicator.

---

## 5. Security & Persistence Standards

1. **Local-First Reliability**:
   - All workspace data persists to browser storage (`localStorage` & `IndexedDB`) via `CatalogRepository` and `OfflineStorageManager`.
   - Automatic export to single-file JSON backup for migration between machines.
2. **Zero Sensitive Defaults**:
   - Mobile pairing requires runtime PIN generation; no hardcoded credentials.
   - All server communication validates payload types and guards against injection.
3. **Data Integrity Guarantee**:
   - No mock or fictitious business records are injected into user datasets.
   - Barcode checksum validation (GS1-compliant EAN-13 algorithm) ensures printability before batch production.

---

## 6. Verification & Quality Assurance

- **Static Analysis**: TypeScript 5.7+ running under `strict: false` with complete type definitions (`npm run lint`).
- **Production Bundling**: Vite 6+ optimized roll-up with zero chunk circularity (`npm run build`).
- **Output Validation**:
  - Vector PDF output accurately calibrated to physical label sheet millimeter dimensions.
  - Barcodes rendered with crisp SVG vector paths and quiet margins.
