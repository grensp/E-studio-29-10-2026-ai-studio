I’ll map both repositories’ indexed architecture first, then compare implemented workflows and identify concrete functionality present in ZPLab but missing or weaker in your `src`. I’ll keep this analysis-only—no source edits or rebuilds.

Ran terminal command: graft map
Tool execution failed with exit code 127

Ran terminal command: pwd && ls -la && ls -la /workspaces/ZPLab

Read 
Completed with input: {
  "path": "/workspaces/E-studio-Desktop-22-10/graft/INDEX.md"
}

Read 
Completed with input: {
  "path": "/workspaces/ZPLab/graft/INDEX.md"
}

Ran terminal command: find graft -maxdepth 2 -type f -print | sort; find /workspaces/ZPLab/graft -maxdepth 2 -type f -print | sort

Search Tools

The `graft` CLI isn’t installed here, but both repositories contain generated graph indexes. I’ll use those repository-local maps and source-level evidence for a read-only comparison; no code will be rebuilt or changed.

Delegated task

Read agent `Compare product workflows`
Completed with input: {
  "agent_id": "d749e4c6-62e2-42fc-a61d-ba3c33814673",
  "wait": true,
  "timeout": 180
}

Ran terminal command: find graft -maxdepth 3 -type f -print | sort

Ran terminal command: find /workspaces/ZPLab/graft -maxdepth 3 -type f -print | sort

Ran terminal command: find src -maxdepth 3 -type f -print | sort | head -200

Ran terminal command: find /workspaces/ZPLab/src -maxdepth 3 -type f -print | sort | head -200

Read 
Completed with input: {
  "path": "/workspaces/E-studio-Desktop-22-10/graft/INDEX.md"
}

Read 
Completed with input: {
  "path": "/workspaces/ZPLab/graft/INDEX.md"
}

Read 
Completed with input: {
  "path": "/workspaces/E-studio-Desktop-22-10/graft/.graph/wiring.json"
}

Read 
Completed with input: {
  "path": "/workspaces/ZPLab/graft/.graph/wiring.json"
}

Ran terminal command: find /workspaces/ZPLab/graft/src -type f -name '*.md' -print | sed 's#/workspaces/ZPLab/graft/##' | sort | head -220

Ran terminal command: find /workspaces/ZPLab/src -type f -print | sed 's#/workspaces/ZPLab/src/##' | sort | head -240

Ran terminal command: find src -type f -print | wc -l; find /workspaces/ZPLab/src -type f -print | wc -l; find graft/src -type f -name '*.md' | wc -l; find /workspaces/ZPLab/graft/src -type f -name '*.md' | wc -l

Search for `catalog|import|pricing|promotion|preflight|imposition|calibration|barcode|exp...`

Search for `##|^#|\.tsx?:[0-9]+|\.ts:[0-9]+`

Search for `catalog|import|pricing|promotion|preflight|imposition|calibration|barcode|exp...`

Ran terminal command: find /workspaces/ZPLab/src -maxdepth 3 -type f -print | sed 's#/workspaces/ZPLab/src/##' | sort | grep -E '(^App|Catalog|Import|Export|Output|Print|Template|Store|Barcode|Variable|Preflight|Printer|Setting|Canvas|Label|Price|Audit|History|Project)' | head -220

Ran terminal command: find /workspaces/ZPLab/graft/src -maxdepth 4 -type f -name '*.md' -print | sed 's#/workspaces/ZPLab/graft/src/##' | sort | grep -E '(^App|Catalog|Import|Export|Output|Print|Template|Store|Barcode|Variable|Preflight|Printer|Setting|Canvas|Label|Price|Audit|History|Project)' | head -220

Search for `^# src/|^## |· function ·|· const ·|· class ·`

Read 
Completed with input: {
  "path": "/workspaces/E-studio-Desktop-22-10/graft/src/app/App.md"
}

Read 
Completed with input: {
  "path": "/workspaces/E-studio-Desktop-22-10/graft/src/components/GenerationWorkspace.md"
}

Read 
Completed with input: {
  "path": "/workspaces/E-studio-Desktop-22-10/graft/src/services/projectFileService.md"
}

Read 
Completed with input: {
  "path": "/workspaces/E-studio-Desktop-22-10/graft/src/utils/catalogImport.md"
}

Read 
Completed with input: {
  "path": "/workspaces/ZPLab/graft/src/App.md"
}

Read 
Completed with input: {
  "path": "/workspaces/ZPLab/graft/src/components/AppShell.md"
}

Read 
Completed with input: {
  "path": "/workspaces/ZPLab/graft/src/hooks/useCsvImportActions.md"
}

Read 
Completed with input: {
  "path": "/workspaces/ZPLab/graft/src/components/Output/ZPLOutput.md"
}

Ran terminal command: nl -ba src/app/App.tsx | sed -n '1,240p'; nl -ba src/app/App.tsx | sed -n '280,470p'

Ran terminal command: nl -ba /workspaces/ZPLab/src/components/AppShell.tsx | sed -n '1,250p'; nl -ba /workspaces/ZPLab/src/components/AppShell.tsx | sed -n '250,590p'

Ran terminal command: nl -ba /workspaces/ZPLab/src/App.tsx; find /workspaces/ZPLab/src/store -maxdepth 3 -type f -name '*.ts' -print | sort | head -120; find /workspaces/ZPLab/src/lib -maxdepth 2 -type f -name '*.ts' -print | sort | head -150

Ran terminal command: nl -ba src/services/catalogRepository.ts | sed -n '1,260p'; nl -ba src/utils/catalogImport.ts | sed -n '1,260p'; nl -ba src/components/CatalogManagementStudio.tsx | sed -n '1,300p'

Ran terminal command: find /workspaces/ZPLab/src -maxdepth 2 -type d -print | sort

Search for `function AppShell|const \{.*\}|useCsvImportActions|ZPLOutput|PrintPreview|Var...`

Search for `catalog|price|promotion|preflight|imposition|calibration|template|save|load|e...`

Search for `function CatalogManagementStudio|function TemplateEditor|function GenerationW...`

Read , lines 1 to 205
Completed with input: {
  "path": "/workspaces/ZPLab/src/components/AppShell.tsx",
  "view_range": [
    1,
    205
  ]
}

Read , lines 205 to 380
Completed with input: {
  "path": "/workspaces/ZPLab/src/components/AppShell.tsx",
  "view_range": [
    205,
    380
  ]
}

Read , lines 1 to 190
Completed with input: {
  "path": "/workspaces/E-studio-Desktop-22-10/src/app/App.tsx",
  "view_range": [
    1,
    190
  ]
}

Read , lines 190 to 465
Completed with input: {
  "path": "/workspaces/E-studio-Desktop-22-10/src/app/App.tsx",
  "view_range": [
    190,
    465
  ]
}

Search for `<ObjectPalette|<LabelCanvas|<RightSidebar|<ZPLOutput|<OutputDialog|<PrinterSe...`

Search for `<HomeDashboard|<CatalogManagementStudio|<TemplateEditor|<GenerationWorkspace|...`

Search for `export function useDesignFileActions|function useDesignFileActions|export fun...`

Search for `function GenerationWorkspace|const prepareProductionBatch|const openPrintModa...`

Read , lines 465 to 575
Completed with input: {
  "path": "/workspaces/ZPLab/src/components/AppShell.tsx",
  "view_range": [
    465,
    575
  ]
}

Read , lines 475 to 632
Completed with input: {
  "path": "/workspaces/E-studio-Desktop-22-10/src/app/App.tsx",
  "view_range": [
    475,
    632
  ]
}

Read , lines 1 to 210
Completed with input: {
  "path": "/workspaces/ZPLab/src/hooks/useCsvImportActions.ts",
  "view_range": [
    1,
    210
  ]
}

Read , lines 1 to 180
Completed with input: {
  "path": "/workspaces/ZPLab/src/hooks/useDesignFileActions.ts",
  "view_range": [
    1,
    180
  ]
}

Search for `price|promotion|promo|catalog|ProductRecord|GTIN|SKU`

Search for `price|promotion|promo|catalog|ProductRecord|GTIN|SKU`

Search for `importExcel|Excel|sqlite|SQLite|server|database|connect|dataSourceRef|fetch|q...`

Search for `barcode|GS1|EAN|UPC|QR|DataMatrix|check digit|moduleWidth|quiet|quietZone|pre...`

Read , lines 150 to 285
Completed with input: {
  "path": "/workspaces/E-studio-Desktop-22-10/src/components/GenerationWorkspace.tsx",
  "view_range": [
    150,
    285
  ]
}

Read , lines 490 to 845
Completed with input: {
  "path": "/workspaces/E-studio-Desktop-22-10/src/components/GenerationWorkspace.tsx",
  "view_range": [
    490,
    845
  ]
}

Read , lines 1 to 250
Completed with input: {
  "path": "/workspaces/E-studio-Desktop-22-10/src/utils/pricingEngine.ts",
  "view_range": [
    1,
    250
  ]
}

Read , lines 1 to 230
Completed with input: {
  "path": "/workspaces/E-studio-Desktop-22-10/src/utils/preFlightEngine.ts",
  "view_range": [
    1,
    230
  ]
}

Read , lines 1 to 180
Completed with input: {
  "path": "/workspaces/ZPLab/src/components/Barcode/Gs1ContentModal.tsx",
  "view_range": [
    1,
    180
  ]
}

Read , lines 1 to 180
Completed with input: {
  "path": "/workspaces/ZPLab/src/lib/gs1BuilderPalette.ts",
  "view_range": [
    1,
    180
  ]
}

Read , lines 1 to 180
Completed with input: {
  "path": "/workspaces/ZPLab/src/components/Canvas/barcodePreflight.ts",
  "view_range": [
    1,
    180
  ]
}

Read , lines 1 to 210
Completed with input: {
  "path": "/workspaces/E-studio-Desktop-22-10/src/utils/barcodeGenerator.ts",
  "view_range": [
    1,
    210
  ]
}

Search for `export function|export async function|function handle|const .* = \(`

Search for `export function|export const|async function|case |return`

Search for `export function|export const|class |static |function`

Search for `export function|export const|class |static |function`

Read , lines 1 to 125
Completed with input: {
  "path": "/workspaces/ZPLab/src/hooks/useZplImportExport.ts",
  "view_range": [
    1,
    125
  ]
}

Read , lines 1 to 145
Completed with input: {
  "path": "/workspaces/ZPLab/src/components/Output/ZplImportModal.tsx",
  "view_range": [
    1,
    145
  ]
}

Read , lines 34 to 145
Completed with input: {
  "path": "/workspaces/ZPLab/src/components/Output/ZplSourceEditor.tsx",
  "view_range": [
    34,
    145
  ]
}

Read , lines 1 to 115
Completed with input: {
  "path": "/workspaces/ZPLab/src/lib/printTarget.ts",
  "view_range": [
    1,
    115
  ]
}

Search for `ean_invalid|barcode_invalid|empty_barcode|GS1|barcode|symbology|min.*module|q...`

Search for `GS1|check digit|quiet|EAN|barcode|barcodeEncodeFindings|preflight|DataMatrix|...`

Read , lines 1 to 230
Completed with input: {
  "path": "/workspaces/E-studio-Desktop-22-10/src/services/catalogRepository.ts",
  "view_range": [
    1,
    230
  ]
}

Read , lines 1 to 225
Completed with input: {
  "path": "/workspaces/E-studio-Desktop-22-10/src/utils/catalogImport.ts",
  "view_range": [
    1,
    225
  ]
}

Search for `GS1|gs1|Digital Link|DataMatrix|datamatrix|AI_SPECS|AI_BY_GROUP`

Read , lines 356 to 450
Completed with input: {
  "path": "/workspaces/E-studio-Desktop-22-10/src/components/GenerationWorkspace.tsx",
  "view_range": [
    356,
    450
  ]
}

Read , lines 340 to 425
Completed with input: {
  "path": "/workspaces/E-studio-Desktop-22-10/src/utils/preFlightEngine.ts",
  "view_range": [
    340,
    425
  ]
}

Read , lines 1 to 150
Completed with input: {
  "path": "/workspaces/E-studio-Desktop-22-10/src/utils/impositionCalculator.ts",
  "view_range": [
    1,
    150
  ]
}

Ran terminal command: find /workspaces/ZPLab/src/registry /workspaces/ZPLab/src/components/Palette -maxdepth 2 -type f -name '*.tsx' -print | sort | head -100; find /workspaces/ZPLab/src -maxdepth 2 -type f -name '*registry*' -print

Search for `registry|barcode|datamatrix|gs1databar|qrcode|pdf417|code128|ean13|ean8`

Search for `BarcodeSymbology|return \[|case '`

Read , lines 1 to 230
Completed with input: {
  "path": "/workspaces/E-studio-Desktop-22-10/src/components/ImpositionCalibrationBoard.tsx",
  "view_range": [
    1,
    230
  ]
}

Read , lines 1 to 150
Completed with input: {
  "path": "/workspaces/ZPLab/src/registry/palettePresets.ts",
  "view_range": [
    1,
    150
  ]
}

Read , lines 260 to 330
Completed with input: {
  "path": "/workspaces/ZPLab/src/components/Palette/ObjectPalette.tsx",
  "view_range": [
    260,
    330
  ]
}

Read , lines 1 to 240
Completed with input: {
  "path": "/workspaces/ZPLab/src/components/Variables/ConnectDataWizard.tsx",
  "view_range": [
    1,
    240
  ]
}

Read , lines 1 to 170
Completed with input: {
  "path": "/workspaces/ZPLab/src/hooks/useExcelImportActions.ts",
  "view_range": [
    1,
    170
  ]
}

Read , lines 1 to 240
Completed with input: {
  "path": "/workspaces/E-studio-Desktop-22-10/src/components/CatalogManagementStudio.tsx",
  "view_range": [
    1,
    240
  ]
}

Read , lines 1 to 90
Completed with input: {
  "path": "/workspaces/E-studio-Desktop-22-10/src/components/GenerationWorkspace.tsx",
  "view_range": [
    1,
    90
  ]
}

Read , lines 110 to 205
Completed with input: {
  "path": "/workspaces/E-studio-Desktop-22-10/src/utils/catalogImport.ts",
  "view_range": [
    110,
    205
  ]
}

Read , lines 1 to 185
Completed with input: {
  "path": "/workspaces/ZPLab/src/components/Barcode/ContentBuilderModal.tsx",
  "view_range": [
    1,
    185
  ]
}

Search for `persist|localStorage|indexedDB|save|hydrate|initialize|autosave|dirty|session...`

Search for `localStorage|indexedDB|projectSave|projectList|templateSave|catalogReplaceAll...`

Read , lines 1 to 90
Completed with input: {
  "path": "/workspaces/ZPLab/src/lib/printSheet.ts",
  "view_range": [
    1,
    90
  ]
}

Read , lines 1 to 155
Completed with input: {
  "path": "/workspaces/ZPLab/src/hooks/usePdfExport.ts",
  "view_range": [
    1,
    155
  ]
}

Read , lines 1 to 120
Completed with input: {
  "path": "/workspaces/ZPLab/src/lib/sendZpl.ts",
  "view_range": [
    1,
    120
  ]
}

Read , lines 1 to 105
Completed with input: {
  "path": "/workspaces/ZPLab/src/lib/usbPrint.ts",
  "view_range": [
    1,
    105
  ]
}

Read , lines 1 to 100
Completed with input: {
  "path": "/workspaces/ZPLab/src/lib/zebraPrint.ts",
  "view_range": [
    1,
    100
  ]
}

Read , lines 1 to 180
Completed with input: {
  "path": "/workspaces/ZPLab/src/components/Output/OutputDialog.tsx",
  "view_range": [
    1,
    180
  ]
}

Search for `printCapabilities|printListQueues|printTo|printZpl|zpl|jobInsert|jobList|cali...`

Search for `printerProfile|printTarget|sendViaNetwork|sendZplUsb|sendViaBrowserPrint|read...`

Read , lines 25 to 145
Completed with input: {
  "path": "/workspaces/E-studio-Desktop-22-10/src/services/api.ts",
  "view_range": [
    25,
    145
  ]
}

Read , lines 722 to 845
Completed with input: {
  "path": "/workspaces/E-studio-Desktop-22-10/src/components/GenerationWorkspace.tsx",
  "view_range": [
    722,
    845
  ]
}

Search for `function MainWorkspace|handleSaveProjectArchive|handleImportProjectArchive|ha...`

Search for `handleFileUpload|handleApplyMapping|handleExportZpl|handlePrintToConfiguredTa...`

Search for `handleValidateImport|handleCommitImport|processWorkbookData|handlePickNativeF...`

Search for `export function AppShell|<ObjectPalette|<LabelCanvas|<RightSidebar|<ZPLOutput...`

Search for `ZplSourceEditor|sourceEditing|enterSourceEdit|outputSource|editSource|openZpl...`

Search for `persistPartialize|name: 'zpl-designer-session'|version:|migrate:|storage: ses...`

Search for `static async exportEproj|async exportEproj|handleSaveProjectArchive|handleImp...`

Search for `page_size|gap_x_mm|margin_left_mm|calibration_x_mm|slot_nudges|ImpositionCali...`

Search for `const SourceStep|onPickSqlite|onPickServer|SourceCard|export function Connect...`

Search for `export function ObjectPalette|function ObjectPalette|addableGroupsFor|export ...`

Search for `const tabs|ClockAndTimeTab|EncodingAndLanguageTab|MaintenanceTab|RfidTab|Stor...`

Search for `class PricingEngine|isPromoActive|resolvePromoPrice|getDecimalsForCurrency|Ti...`

The comparison is still in progress. I’ll provide the source-backed findings once it’s complete.

Search for `handleFileUpload|handleValidateImport|handleCommitImport|handlePrintToConfigu...`

Search for `GS1_REQ_ENFORCED_TYPES|const valid =|roundTrips|segmentsToContent|export func...`

Search for `export function ZplImportModal|importZplText|commitImport|processImport|expor...`

Search for `PrintTransport|offeredTransports|export async function printLabel|export func...`

Search for `openGs1Builder|openContentBuilder|setGs1Builder|setContentBuilder|gs1BuilderO...`

Search for `openPrintModal\(|showPrintModal|handleGeneratePdf|handleExportZpl|onClick=\{....`

Search for `function ProjectStartScreen|onCreateProject|onOpenProject|onExportProject|onI...`

Search for `export const GS1_REQ_ENFORCED_TYPES|const GS1_COMMON_AIS|GS1_BUILDER_PRESETS|...`

Search for `importZpl|parseZpl|ZPL import|\.zpl|zpl.*import`

Search for `pptx|Pptx|PowerPoint|Presentation`

Search for `price|promotion|promo|PricingEngine|TierEngine|ProductRecord`

Search for `printCapabilities|printListQueues|printSubmitPdf|printSubmitZpl|jobInsert|job...`

Search for `barcodeEncodeFindings|PreflightOverlay|preflight|BarcodeObject|useLabelStore`

Search for `export function Gs1Controls|openGs1Builder|export function TypedContentSectio...`

Search for `native|isTauri|isDesktopShell|local|usb|network|browserprint|system`

Search for `^export function TemplateEditor|onSaveTemplate|Revision|revision|price_block|...`

Search for `PricingEngine|TierEngine|PROMOPRICE|SELLING_PRICE|PROMO_START|PROMO_END|retai...`

Search for `catalogUpsert|catalogReplaceAll|catalogSearch|async projectSave|async templat...`

Search for `function PricingEngine|static isPromoActive|static resolvePromoPrice|static g...`

Search for `export async function exportPages|function exportPages|exportPdf =|exportBatc...`

Read , lines 1 to 150
Completed with input: {
  "path": "/workspaces/ZPLab/src/hooks/useDbConnectActions.ts",
  "view_range": [
    1,
    150
  ]
}

Read , lines 1 to 160
Completed with input: {
  "path": "/workspaces/ZPLab/src/hooks/useSqliteConnectActions.ts",
  "view_range": [
    1,
    160
  ]
}

Read , lines 1 to 155
Completed with input: {
  "path": "/workspaces/ZPLab/src/hooks/useServerDbConnectActions.ts",
  "view_range": [
    1,
    155
  ]
}

Read , lines 448 to 565
Completed with input: {
  "path": "/workspaces/ZPLab/src/store/labelStore.ts",
  "view_range": [
    448,
    565
  ]
}

Search for `type: 'qr|qrcode|qr_code|data_matrix|datamatrix|qrGenerator|generateQrMatrix`

Search for `export function qr|generateQrMatrix|qr_code`

Search for `QR|qr`

Search for `^export function|^export const|type .*=`

Search for `Imposition|imposition|slot_nudge|slotNudge|labelsPerSheet|multi.?up|sheet layout`

Search for `audit|job history|PrintJob|jobInsert|PrintJobHistory|jobList`

Search for `handleSaveProjectArchive|exportZip|exportEproj|revision: \(updated.revision|A...`

Search for `const exportPdf|const exportBatchPdf|function printLabel|renderImposed|imposi...`

Search for `ZplSourceEditor|sourceEdit|parseZpl|importZpl|ZPL import|zplSource`

Background agent `Compare product workflows` is complete

Read agent `Compare product workflows`
Completed with input: {
  "agent_id": "d749e4c6-62e2-42fc-a61d-ba3c33814673",
  "since_turn": 0
}

Search for `\*\*Bottom line|Priority|Evidence|Gap|E-studio|ZPLab|Recommendation|Caveat|line`

Read , lines 1 to 75
Completed with input: {
  "path": "/tmp/1792869649687-copilot-tool-output-d4e11d1c3f61460993874aaba54f9265.txt",
  "view_range": [
    1,
    75
  ]
}

Read , lines 26 to 62
Completed with input: {
  "path": "/tmp/1792869649687-copilot-tool-output-d4e11d1c3f61460993874aaba54f9265.txt",
  "view_range": [
    26,
    62
  ]
}

## Summary

The two applications serve different production workflows, so ZPLab is not a drop-in replacement for E-studio. **E-studio is stronger in retail catalog, pricing, multi-up production, and job traceability. ZPLab adds useful capabilities around GS1 authoring, external data sources, printer connectivity, and working with existing ZPL.**

This comparison is based on application source in both `src` directories. I did **not** edit, merge, rebuild, or run tests.

## Functionality comparison

| Area | E-studio | ZPLab | What this means |
|---|---|---|---|
| **Catalog and data** | Product catalog import includes field mapping, validation, collision review, merge/replace, and import history. Product identity and price parsing are handled explicitly in the `catalog UI` and `import utilities`. | Supports mapped datasets from CSV; its connection wizard also exposes Excel and database sources, with desktop-only gates for some options (`connect wizard`, `SQLite connection flow`, `server database flow`). | ZPLab’s source connectivity is broader. E-studio’s product-specific identity and import workflow is richer and should remain the catalog’s source of truth. |
| **Pricing and promotions** | Includes promotion-window and tier-price resolution (`pricing engine`, `tier engine`). | No comparable retail pricing or promotion engine was identified in ZPLab’s `src`. | Preserve E-studio’s pricing logic; generic variable binding is not a substitute for retail pricing rules. |
| **Editor and templates** | Provides reusable retail templates and a generation workflow, with label elements such as price blocks (`app routes`, `template editor`). | Provides a canvas/palette editor, live ZPL output, and a ZPL source-editing surface (`app shell`, `palette`, `source editor`). | These are different editing models. ZPL-oriented source editing could complement E-studio, but does not automatically map to its retail-template model. |
| **Barcodes and validation** | Supports Code 128, EAN-8, EAN-13, GTIN-14, GS1-128, and QR; preflight includes encoded validity, contrast, and an EAN-13 width check (`barcode types`, `preflight`). | Offers a visible GS1 content builder and specialized barcode panels; canvas preflight performs an encoder-backed check (`GS1 builder`, `GS1 policies`, `canvas preflight`). | The notable gap is **GS1 authoring and carrier coverage**, not barcode validation in general. |
| **Layout and imposition** | Calculates multi-up sheet geometry and supports calibration offsets and per-slot nudges (`imposition calculator`, `calibration board`). | Supports canvas layout and multiple pages, but its PDF and print-sheet paths produce a label per page/sheet rather than E-studio-style multi-up imposition (`PDF export`, `print sheet`). | E-studio is stronger for sheet-based label production. Preserve its imposition and calibration workflows. |
| **Export and printing** | Supports PDF, PPTX, and ZPL exports; physical output includes CUPS PDF printing and configured network ZPL submission (`generation exports`, `print submission`). | Supports ZPL, PDF, PNG, and system print, with network, BrowserPrint, local, and USB choices, plus printer settings/status surfaces (`output dialog`, `print targets`, `USB printing`, `printer settings`). | ZPLab has more transport options and device tooling. E-studio already has real print paths; any additions should retain its preflight and job records. |
| **Persistence and history** | Has project storage, template revisions, and generated-job records with product/template snapshots and audit details (`project actions`, `generation records`, `storage API`). | Persists editor session state and supports design-file save/open and undo history (`label store`, `design-file actions`). | ZPLab’s persistent editing state is useful, while E-studio provides stronger production-job traceability. |

## Best candidates to integrate

1. **GS1 content builder and additional barcode carriers — highest-value functional addition when 2D/GS1 labels are needed.**  
   Add guided GS1 content construction and carrier-specific preflight to E-studio, while preserving its existing barcode checks. Extend the barcode model and relevant PDF/ZPL renderers together. The ZPLab builder uses `@zplab/core`, whose implementation is outside the compared `src` scope, so its complete AI coverage and encoding guarantees were not verified. Validate output on target printers and scanners before relying on it.

2. **Optional database-backed catalog imports — useful for retailers with product data in databases.**  
   Consider read-only source connectors that feed E-studio’s existing preview, identity matching, price validation, collision review, and commit path. Avoid writing connector results directly into the catalog or replacing catalog identity rules with generic variable mapping. Platform scope and credential handling need to be decided because the current apps gate database access differently.

3. **More printer transports and device checks — valuable only for the hardware operators actually use.**  
   Assess USB, BrowserPrint, and local-printer options behind a capability-aware transport layer. Preserve E-studio’s preflight and print-job snapshots, and report that a job was submitted or queued rather than claiming physical output was confirmed. Confirm target operating systems and printer models before choosing an implementation.

4. **Import existing ZPL — a focused migration or advanced-operator feature.**  
   ZPLab exposes an import-and-report flow and source editing (`ZPL import`, `source integration`). E-studio’s visible ZPL path is export-oriented (`generation export`). A safer first step would be importing a defined supported subset, retaining the original source, and reporting unsupported commands. Full source editing needs a clear mapping back to E-studio’s template elements.

## Keep E-studio’s strengths

Do not displace E-studio’s retail promotion/tier pricing, product identity and collision handling, calibrated multi-up imposition, or production job snapshots. Those are substantial capabilities that ZPLab’s `src` does not appear to provide in the same form.

This is a source-level functionality comparison, not a verification of printer behavior, native command correctness, or physical print quality.