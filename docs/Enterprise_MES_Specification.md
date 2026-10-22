### Enterprise Architecture: Ambar Furniture Workshop ERP & Manufacturing Execution System (MES)

This advanced specification transitions your workshop operations from static spreadsheets into an automated, event-driven Manufacturing Execution System (MES) and Inventory ERP.

``` 
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              AMBAR WORKSHOP CLOUD CORE                                 │
└──────────────────────────────────────────┬─────────────────────────────────────────────┘
                                           │
         ┌─────────────────────────────────┼─────────────────────────────────┐
         ▼                                 ▼                                 ▼
┌──────────────────┐             ┌───────────────────┐             ┌───────────────────┐
│ PRODUCTION & MES │             │ INVENTORY & BOM   │             │ SALES & CRM       │
│ • QR Work Orders │             │ • BOM Explosion   │             │ • Stock Hold/Sell │
│ • Stage Routing  │             │ • Scrap Factor    │             │ • Commission Calc │
│ • Labor Tracking │             │ • Auto-Reorder    │             │ • Digital Receipt │
└────────┬─────────┘             └─────────┬─────────┘             └─────────┬─────────┘
         │                                 │                                 │
         └─────────────────────────────────┼─────────────────────────────────┘
                                           │
                                           ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                       EVENT BUS & AUTOMATION ENGINE (APPS SCRIPT / API)                │
│ • Ethiopian ⇄ Gregorian Engine  • Low Stock Webhooks  • Telegram / WhatsApp Dispatch   │
└────────────────────────────────────────────────────────────────────────────────────────┘

```

-----

### 1\. Relational Database Schema & Data Dictionary

To support multi-stage routing, bill of materials, and audit logging, replace flat tables with this normalized relational schema:

``` 
                  ┌──────────────────────┐
                  │       products       │
                  ├──────────────────────┤
                  │ product_id (PK)      │
                  │ model_code           │
                  │ category_id (FK)     │
                  │ base_price           │
                  └──────────┬───────────┘
                             │ 1
                             │
                             │ M
                  ┌──────────┴───────────┐
                  │  bill_of_materials   │
                  ├──────────────────────┤
                  │ bom_id (PK)          │
                  │ product_id (FK)      │
                  │ material_id (FK)     │
                  │ qty_required         │
                  │ scrap_factor_pct     │
                  └──────────┬───────────┘
                             │ M
                             │
                             │ 1
┌─────────────────────────┐  │  ┌─────────────────────────┐
│      work_orders        │  │  │    raw_materials        │
├─────────────────────────┤  │  ├─────────────────────────┤
│ order_id (PK)           │  │  │ material_id (PK)        │
│ serial_number (Unique)  │  │  │ sku                     │
│ product_id (FK) ────────┼──┘  │ material_type           │
│ order_type (Enum)       │     │ current_stock           │
│ priority (Enum)         │     │ reserved_stock          │
│ current_stage (Enum)    │     │ reorder_point           │
│ assigned_sales_rep (FK) │     │ unit_cost               │
│ ethiopian_start_date    │     └────────────┬────────────┘
│ greg_start_date         │                  │ 1
│ qr_code_url             │                  │
└────────────┬────────────┘                  │ M
             │ 1                             │
             │                               │
             │ M                             │
┌────────────┴────────────┐     ┌────────────┴────────────┐
│   stage_time_logs       │     │  material_transactions  │
├─────────────────────────┤     ├─────────────────────────┤
│ log_id (PK)             │     │ txn_id (PK)             │
│ order_id (FK)           │     │ material_id (FK)        │
│ stage_name              │     │ work_order_id (FK)      │
│ worker_id (FK)          │     │ txn_type (IN/OUT/ADJ)   │
│ timestamp_in            │     │ quantity_change         │
│ timestamp_out           │     │ unit_cost_at_time       │
└─────────────────────────┘     └─────────────────────────┘

```

#### Table Definitions

1.  **`products`**: Defines catalogue items (e.g., `E4`, `E6`, `G6`, `TV`, `CT`).
    
      - Fields: `product_id` (UUID), `model_code` (VARCHAR), `description` (TEXT), `category` (ENUM: `SHOE_SHELF`, `TV_UNIT`, `COFFEE_TABLE`, `CUSTOM`), `std_labor_hours` (DECIMAL), `base_selling_price` (DECIMAL).

2.  **`bill_of_materials` (BOM)**: Explicit recipe of raw materials per product unit.
    
      - Fields: `bom_id` (UUID), `product_id` (FK), `material_id` (FK), `qty_required` (DECIMAL), `scrap_factor_pct` (DECIMAL, default `1.10` for 10% cutting waste).

3.  **`raw_materials`**: Inventory stockroom records.
    
      - Fields: `material_id` (UUID), `name` (e.g., `18mm Oak`, `Normal MDF 12mm`, `Australia 4x5`), `category` (ENUM: `SHEET_WOOD`, `SOLID_TIMBER`, `HARDWARE`, `FINISHING_CHEMICAL`), `unit_of_measure` (`SHEET`, `METER`, `PIECE`, `LITER`), `current_stock` (DECIMAL), `reserved_stock` (DECIMAL), `safety_reorder_level` (DECIMAL), `last_purchase_price` (DECIMAL).

4.  **`work_orders`**: Individual items moving through manufacturing.
    
      - Fields: `order_id` (UUID), `serial_no` (e.g., `AMB-2026-0891`), `product_id` (FK), `order_type` (`READY_STOCK`, `CUSTOMER_ORDER`), `priority` (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`), `customer_name` (VARCHAR, nullable), `assigned_sales_rep` (VARCHAR), `current_stage` (`QUEUED`, `CUTTING`, `ASSEMBLY`, `FINISHING`, `QC_CHECK`, `IN_STOCK`, `SOLD`), `start_date_ethiopian` (VARCHAR), `start_date_gregorian` (DATE), `finished_date_gregorian` (DATE), `qr_code_payload` (TEXT).

5.  **`stage_time_logs`**: Micro-level operational tracking per stage.
    
      - Fields: `log_id` (UUID), `order_id` (FK), `stage_name` (VARCHAR), `technician_name` (VARCHAR), `time_started` (TIMESTAMP), `time_completed` (TIMESTAMP), `defect_flag` (BOOLEAN), `defect_notes` (TEXT).

-----

### 2\. Automated Bill of Materials (BOM) Explosion Engine

When a new Work Order is created, do not rely on carpenters to estimate wood sheets. The system automatically computes and reserves exact material quantities.

$$\\text{Quantity Allocated} = \\text{BOM Unit Quantity} \\times \\text{Batch Size} \\times \\left(1 + \\frac{\\text{Scrap Factor %}}{100}\\right)$$

``` 
[New Work Order Submitted: Model E4 Full Oak (Batch: 2 Units)]
                             │
                             ▼
               [Execute BOM Explosion Routine]
                             │
       ┌─────────────────────┼─────────────────────┐
       ▼                     ▼                     ▼
18mm Oak Sheets       6mm MDF Backing       Australia Morale Timber
Unit Req: 1.5         Unit Req: 0.5         Unit Req: 4.0 meters
Scrap: +10%           Scrap: +5%            Scrap: +10%
Total: 3.3 Sheets     Total: 1.05 Sheets    Total: 8.8 Meters
       │                     │                     │
       └─────────────────────┼─────────────────────┘
                             │
                             ▼
         [Run Availability & Reservation Check]
                             │
          ┌──────────────────┴──────────────────┐
          │                                     │
   [Stock Sufficient]                   [Stock Insufficient]
   • Move from Available to             • Set Status: AWAITING_MATERIALS
     Reserved Stock                     • Trigger Procurement Alert
   • Set Status: READY_FOR_CUTTING        via Webhook to Manager

```

-----

### 3\. Multi-Stage Production Routing with QR Code Tracking

Instead of generic "In Progress" or "Finishing" statuses, each piece follows a strict 6-gate routing pipeline:

``` 
[Stage 1: Cut & Prep] ──► [Stage 2: Assembly] ──► [Stage 3: Sanding]
                                                           │
[Stage 6: Showroom]  ◄── [Stage 5: QC Gate]  ◄── [Stage 4: Spray Booth]

```

#### Physical QR Traveler Workflow

1.  When a work order is initialized, the app generates a unique **QR Traveler Tag** printable on a thermal/label printer and attached to the work piece.
2.  The payload encodes a REST endpoint: `https://api.ambarfurniture.com/orders/{order_id}/advance`.
3.  Technicians on the workshop floor carry low-cost Android tablets or smartphones running the app:
      - **Step 1:** The carpenter scans the QR tag. The screen displays the engineering blueprint, exact cut list, and customer specifications (e.g., `FULL OAK - WHITE 160`).
      - **Step 2:** The technician taps **"Begin Assembly"**. The system logs `timestamp_in` and worker ID.
      - **Step 3:** Upon completion, the spray technician scans the tag and taps **"Begin Spray Booth / Lacquer"**.
      - **Step 4 (Quality Control Gate):** Before entering `IN_STOCK`, a supervisor must complete a digital checklist:
        - [ ] Dimension accuracy verified ($\\pm 2\\text{ mm}$).
        - [ ] Surface finish/paint uniformity confirmed.
        - [ ] Hardware/drawer slides tested.
      - If passed: Order status automatically updates to `IN_STOCK` and enters the showroom inventory catalogue.
      - If failed: Order is routed back to `REWORK` with mandatory photographic evidence attached.

-----

### 4\. Dual Ethiopian–Gregorian Algorithmic Calendar Engine

Because your team operates internally on the Ethiopian Calendar (*Meskerem, Tekemt, Hidar, etc.*), while external hardware suppliers and timestamps operate on the Gregorian standard, implement this dual-calendar conversion module.

#### Calendar Logic

  - Ethiopian year consists of 12 months of 30 days each, plus a 13th month (*Pagumē*) of 5 days (6 days in a leap year).
  - The Ethiopian year is 7 or 8 years behind the Gregorian year.
  - Ethiopian New Year (*Enkutatash*) falls on September 11 (or September 12 in a Gregorian leap year).

#### Implementation Script (Google Apps Script / Node.js Backend)

``` javascript
/**
 * Converts a Gregorian Date to an Ethiopian Calendar Date String.
 * @param {Date} date - The Gregorian Date object.
 * @return {string} Format: "DD/MM/YYYY ET (MonthName)"
 */
function convertGregorianToEthiopian(date) {
  const gYear = date.getFullYear();
  const gMonth = date.getMonth() + 1; // 1-indexed
  const gDay = date.getDate();

  // Ethiopian month names
  const ethMonthNames = [
    "Meskerem", "Tekemt", "Hidar", "Tahsas", "Tir", "Yekatit",
    "Megabit", "Miyazia", "Ginbot", "Sene", "Hamle", "Nehase", "Pagume"
  ];

  // Base Julian Day calculation for astronomical accuracy
  const a = Math.floor((14 - gMonth) / 12);
  const y = gYear + 4800 - a;
  const m = gMonth + 12 * a - 3;
  const jdn = gDay + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;

  // JDN offset for Ethiopian Calendar epoch
  const r = (jdn - 1723856) % 1461;
  const n = (r % 365) + 365 * Math.floor(r / 1460);

  const ethYear = 4 * Math.floor((jdn - 1723856) / 1461) + Math.floor(r / 365) - Math.floor(r / 1460);
  const ethMonth = Math.floor(n / 30) + 1;
  const ethDay = (n % 30) + 1;

  const monthLabel = ethMonthNames[ethMonth - 1] || "Pagume";
  return `${String(ethDay).padStart(2, '0')}/${String(ethMonth).padStart(2, '0')}/${ethYear} ET (${monthLabel})`;
}

```

Every record stores both:

  - `timestamp_iso`: Indexed UTC timestamp (`2026-10-29T11:45:00Z`) for sorting, filtering, and cross-platform sync.
  - `display_date_ethiopian`: Human-readable localized string for workshop displays and invoices.

-----

### 5\. Point-of-Sale (POS) & Stock Discharge Automation

When a piece on the showroom floor is sold:

``` 
                          [Showroom Floor Sales Flow]
                                       │
                                       ▼
                   [Sales Rep Scans Product QR Code on Unit]
                                       │
                                       ▼
               [Modal Displays: Model, Specs, Base Price, Margin]
                                       │
                                       ▼
                 [Input: Customer Details, Agreed Price, Payment]
                                       │
                                       ▼
                     [System Executes Atomic Transaction]
                                       │
       ┌───────────────────────────────┼───────────────────────────────┐
       ▼                               ▼                               ▼
[Inventory Ledger]            [Commission Engine]            [Digital Invoice]
• Status: SOLD                • Assigns commission credit    • Generates PDF delivery
• Available Units: -1           to Sales Rep (Daniel/Mule)     pass with QR verification
• Archives to Closed Sales    • Logs commission balance      • Dispatches via SMS/
                                                               Telegram to Customer

```

-----

### 6\. Role-Based Access Control (RBAC) Matrix

To prevent unauthorized edits and keep screens uncluttered for floor staff, establish 4 application roles:

| Feature / Workspace Screen       | Workshop Floor Tech | Lead Supervisor | Showroom Sales Rep | General Manager / Admin |
| :------------------------------- | :-----------------: | :-------------: | :----------------: | :---------------------: |
| **Scan QR & Advance Stage**      | Read/Update Only    | Full Access     | No Access          | Full Access             |
| **BOM Configuration**            | No Access           | Read Only       | No Access          | Full Access             |
| **Log Raw Material Usage**       | Create Only         | Full Access     | No Access          | Full Access             |
| **Sell Item / Discharge POS**    | No Access           | No Access       | Create/Update      | Full Access             |
| **View Profit Margins / Costs**  | No Access           | No Access       | No Access          | Full Access             |
| **Modify Holiday / Social Plan** | No Access           | No Access       | Update Only        | Full Access             |

-----

### 7\. Event-Driven Alerts & External Webhooks

Connect workshop events to automated notifications using Google Apps Script triggers or a lightweight webhook worker:

1.  **Safety Stock Alert**:
    
      - Condition: `raw_materials.current_stock <= raw_materials.safety_reorder_level`
      - Trigger: Daily cron job or post-usage database hook.
      - Action: Sends an automated Telegram message to the Procurement Manager:
        > ⚠️ *Low Material Alert: Normal MDF 18mm has reached 4 sheets remaining. Minimum threshold is 10 sheets. Tap here to approve Purchase Order.*

2.  **Production Bottleneck Monitor**:
    
      - Condition: Work Order remains in `FINISHING` or `SPRAY_BOOTH` for $\> 72\\text{ hours}$.
      - Action: Flags the item on the Executive Dashboard with a red pulse tag and alerts the workshop supervisor.

3.  **Customer Delivery Notification**:
    
      - Condition: Work order passes `QC_GATE` and enters `IN_STOCK`.
      - Action: If tagged as `CUSTOMER_ORDER`, triggers an automated SMS to the customer:
        > *Dear Customer, your custom order \[Model E4 Full Oak\] has passed inspection and is ready for pickup/delivery at Ambar Furniture.*

-----

### 8\. Implementation Steps: Moving from Spreadsheet to App

#### Phase 1: Data Sanitization (Current File)

1.  In Google Drive, open `workshop sheet-2.xlsx` and choose **File \> Save as Google Sheets**.
2.  Clean merged header rows (e.g., `A2:N3` in `TEKEMT WORKFLOOW`) to establish standard, single-row headers.
3.  Replace free-form text dates with standardized ISO dates (`YYYY-MM-DD`).

#### Phase 2: Deploying the No-Code Engine (AppSheet or Glide)

1.  In Google Sheets, navigate to **Extensions \> AppSheet \> Create an App**.
2.  Set table references based on the normalized schema above (`products`, `work_orders`, `raw_materials`, `stage_time_logs`).
3.  Set column types to `Enum`, `Ref`, and `Image/Barcode` to activate native camera scanning on mobile devices.
4.  Implement the Ethiopian calendar conversion as a custom Apps Script function bound to sheet edits.

#### Phase 3: Hardware Provisioning on the Workshop Floor

1.  Install 1–2 ruggedized Android tablets running AppSheet/Glide in the workshop (Station 1: Cutting & Assembly; Station 2: Spray Booth & QC).
2.  Connect a desktop thermal label printer for Work Order QR tags.
3.  Provide showroom staff with mobile app access for real-time stock lookups and one-click checkout.
