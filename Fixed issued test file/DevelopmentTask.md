Development Module Breakdown & Task Lists

Module 0: Foundation & Setup (Infrastructure & Core)

Goal: Set up the project structure, development environment, CI/CD pipeline, and essential configurations.

Tasks:

[Infra] Initialize Monorepo structure (e.g., using Turborepo or Lerna).

[Infra] Set up backend Node.js/Express application skeleton.

[Infra] Set up frontend Next.js application skeleton (App Router).

[Infra] Configure Dockerfiles for backend, frontend, and docker-compose.yml for local development (including MongoDB service).

[Infra] Set up basic CI/CD pipeline (e.g., GitHub Actions for linting, testing, building).

[Backend] Configure environment variable handling (e.g., dotenv).

[Backend] Establish database connection (Mongoose setup).

[Backend] Implement basic error handling middleware.

[Backend] Set up core utilities (e.g., logger).

[Frontend] Configure Tailwind CSS and theme.

[Frontend] Set up Shadcn/UI (or chosen component library).

[Frontend] Implement main authenticated layout structure (/dashboard/layout.js).

[Frontend] Implement basic unauthenticated layout structure (/auth/layout.js).

[Frontend] Set up API client/wrapper for frontend requests.

[Shared] Define core TypeScript types/interfaces (e.g., User, Company basics) in a shared package (optional).

Module 1: Tenant & Auth Management

Goal: Enable company registration, user login/logout, password management, staff management, and enforce role-based access and multi-tenancy.

Tasks:

[Backend] Create Company Mongoose schema.

[Backend] Create User Mongoose schema (with password hashing, comparison methods, unique index per company).

[Backend] Implement /api/auth/register endpoint (creates Company, Admin User).

[Backend] Implement /api/auth/login endpoint (issues JWT/session token).

[Backend] Implement /api/auth/logout endpoint.

[Backend] Implement Password Reset flow endpoints (/request-password-reset, /reset-password) including token generation/validation and email sending service integration.

[Backend] Implement Company profile endpoints (/api/companies/my GET/PUT).

[Backend] Implement Staff CRUD endpoints (/api/staff GET list, POST create, /api/staff/{userId} GET/PUT/DELETE).

[Backend] Implement Staff Invite endpoint (/api/staff/invite) including token generation and email sending.

[Backend] Implement Staff Activate/Deactivate endpoint (/api/staff/{userId}/status PUT).

[Backend] Implement Roles endpoint (/api/roles GET - initially can be static).

[Backend] Implement Authentication middleware (verifies JWT/session).

[Backend] Implement RBAC middleware (checks user role against required permissions for endpoints).

[Backend] Implement Multi-Tenancy middleware/service (ensures companyId is automatically added to DB queries based on authenticated user). CRITICAL

[Frontend] Create Login page (/auth/login) with <LoginForm> component and API integration.

[Frontend] Create Register page (/auth/register) with <RegisterForm> component and API integration.

[Frontend] Create Forgot Password page (/auth/forgot-password) and API integration.

[Frontend] Create Reset Password page (/auth/reset-password) handling token from URL and API integration.

[Frontend] Implement Auth Context/State Management (e.g., Zustand, Context API) to store user session/profile globally.

[Frontend] Implement Protected Routes logic (redirect unauthenticated users from dashboard pages).

[Frontend] Create Company Profile page (/dashboard/settings/company) with form and API integration.

[Frontend] Create Staff List page (/dashboard/settings/staff) with <StaffTable> component and API integration (fetching/displaying).

[Frontend] Create Staff New/Edit page (/dashboard/settings/staff/new, .../[userId]/edit) with <StaffForm> component, <RoleSelector>, and API integration.

[Frontend] Create Staff Invite page (/dashboard/settings/staff/invite) with <InviteForm> and API integration.

[Frontend] Implement staff activate/deactivate functionality in <StaffTable>.

Module 2: Settings Management

Goal: Allow Tenant Admins to configure company-wide settings like units, T&C, charges, and GST.

Tasks:

[Backend] Create Setting Mongoose schema.

[Backend] Implement GET /api/settings endpoint (fetch or create default for company).

[Backend] Implement PUT /api/settings endpoint (update various fields).

[Backend] Implement CRUD endpoints for predefined charges (/api/settings/charges, .../{chargeId}).

[Backend] Implement endpoints for Help/Changelog (can be simple static content initially or redirect).

[Frontend] Create General Settings page (/dashboard/settings/general) combining <UnitSettingsForm>, <GstSettingsForm>, <TermsEditor> components.

[Frontend] Integrate Rich Text Editor component for T&C.

[Frontend] Create Predefined Charges page (/dashboard/settings/charges) with <ChargesTable> and <ChargeForm>.

[Frontend] Create Notifications Settings page (/dashboard/settings/notifications).

[Frontend] Create Help/Changelog pages (/dashboard/help, /dashboard/changelog).

[Frontend] Ensure settings data is fetched and used contextually (e.g., display correct units). Consider a Settings Context.

Module 3: Client Management (CRM)

Goal: Provide tools to manage customer information and interactions.

Tasks:

[Backend] Create Client Mongoose schema (including notes subdocument).

[Backend] Implement Client CRUD endpoints (/api/clients, .../{clientId}). Include filtering/pagination/search on GET list.

[Backend] Implement Add Note endpoint (/api/clients/{clientId}/notes POST).

[Backend] Implement Get History endpoint (/api/clients/{clientId}/history GET - query related Quotes/Orders).

[Backend] Implement Update Status endpoint (/api/clients/{clientId}/status PUT).

[Frontend] Create Client List page (/dashboard/clients) with <ClientTable>, filters, search, pagination.

[Frontend] Create Client New/Edit page (/dashboard/clients/new, .../[clientId]/edit) with <ClientForm>.

[Frontend] Create Client Detail page (/dashboard/clients/[clientId]) with tabs for Info (<ClientInfoCard>), History (<ClientHistoryFeed>), Notes (<NotesSection> with input).

[Frontend] Implement Status update UI in Client Detail/Table.

Module 4: Product & Formula Management (REVISED)
Goal: Define window types and their associated material cut length/quantity formulas, ensuring unit consistency with Inventory.
Tasks:
[Backend] Create revised ProductType Mongoose schema (as per PRDUpdated: includes materialCategorySnapshot, formulaInputUnit, quantityUnit which must align with Material.usageUnit).
[Backend] Implement ProductType CRUD endpoints (/api/products, .../{productId}).
[Backend] Implement Formula Validation endpoint (/api/products/validate-formula).
[Backend] Create backend Formula Evaluation Service/Utility (using mathjs or similar) to parse and evaluate formulas given W, H, and formulaInputUnit, producing a result in quantityUnit.
[Backend] Implement /api/products/calculate-cost endpoint (for raw material cost estimation).
NEW/UPDATED: [Backend] During ProductType create/update (in POST /api/products and PUT /api/products/{productId}):
For each entry in ProductType.materials[]:
Fetch the corresponding Material document by materialId.
Validate that the provided ProductType.materials.quantityUnit is compatible/identical with the fetched Material.usageUnit. Reject if incompatible.
Store Material.category as materialCategorySnapshot.
[Frontend] Create Product List page (/dashboard/products) with <ProductTable>.
[Frontend] Create Product New/Edit page (/dashboard/products/new, .../[productId]/edit) with <ProductForm>.
UPDATED: [Frontend] Implement complex <MaterialFormulaInput> component within <ProductForm>:
Material selection (dropdown linked to Inventory, should fetch Material.usageUnit and Material.category on selection).
Display Material.category (read-only).
Input fields for multiple formula strings per material.
Input for formulaInputUnit (e.g., inches, mm).
Input/Dropdown for quantityUnit: This should be heavily guided. Ideally, it defaults to the selected Material.usageUnit and might be read-only or offer only compatible units if any variation is allowed (though strict matching is safer).
Checkbox for isCutRequired (defaults to true if Material.category is 'Profile').
Input for defaultGauge (optional, shown if Material.category is 'Profile').
Integrate formula validation endpoint feedback.


Module 5: Inventory Management (FURTHER REVISED)
Goal: Track materials with category-specific units and stock handling: profiles by standard length/gauge, other materials by total quantity.
Tasks:
UPDATED: [Backend] Implement the further revised Material Mongoose schema (with category, stockUnit, usageUnit, standardLengths, stockByLength, gaugeSpecificWeights, weightUnit, totalStockQuantity, unitRateForStockUnit, lowStockThresholdForStockUnit, supplier, brand, hsnCode, description, and indexes).
UPDATED: [Backend] Implement the revised StockTransaction Mongoose schema (with type enum update, length, lengthUnit, required quantityUnit, unitRateAtTransaction, totalValueChange, and pre-save hook).
UPDATED: [Backend] Implement/Update Material CRUD endpoints (/api/inventory/materials, .../{materialId}):
POST /api/inventory/materials and PUT /api/inventory/materials/{materialId}: Logic must be conditional based on category to correctly save fields like stockByLength vs. totalStockQuantity.
GET /api/inventory/materials (list) and GET /api/inventory/materials/{materialId} (detail): Response should include stock information relevant to the material's category.
NEW: [Backend] Implement POST /api/inventory/stock/inward-profile endpoint:
Accepts payload as defined in PRD (materialId/details, gauge, stdLengthPerPiece, numPieces, totalWeight, totalCost etc.).
Implement associated service function recordProfileStockInward(companyId, userId, data) to perform calculations (weight/unit length), update Material.gaugeSpecificWeights, Material.standardLengths, Material.stockByLength, and create a StockTransaction (type 'Inward'/'InitialStock', quantityUnit: 'pcs').
UPDATED: [Backend] Implement POST /api/inventory/stock/adjust endpoint:
Logic to differentiate adjustment type based on material.category and input params:
If material.category is 'Profile' AND length & lengthUnit are provided: Adjust Material.stockByLength[specific_length].quantity. StockTransaction.quantityUnit will be 'pcs'.
If material.category is 'Profile' AND adjusting bulk (e.g. by 'kg'): Adjust Material.totalStockQuantity. StockTransaction.quantityUnit will be material.stockUnit (e.g., 'kg').
If material.category is NOT 'Profile': Adjust Material.totalStockQuantity. StockTransaction.quantityUnit will be material.stockUnit.
Ensure a StockTransaction is created for every adjustment, capturing the correct quantityChange and quantityUnit.
UPDATED: [Backend] Implement GET /api/inventory/stock/history/{materialId} endpoint, ensuring response includes quantityUnit, length, and lengthUnit where applicable.
[Backend] Implement GET /api/inventory/categories endpoint.
[Backend] Create getWeight(material, gauge, cutLength, cutLengthUnit) utility function.
UPDATED: [Frontend] Create Inventory List page (/dashboard/inventory) with <InventoryTable>:
Table should dynamically display stock based on material.category:
For 'Profile': Show stock levels per standardLength from stockByLength array. Implement low stock indicators for each length.
For other categories: Show totalStockQuantity (with stockUnit). Implement low stock indicator based on lowStockThresholdForStockUnit.
Add category filters.
NEW: Add a button/action for "Profile Stock Inward" (e.g., opens a modal or navigates to a form).
UPDATED: [Frontend] Create Material New/Edit page (/dashboard/inventory/new, .../[materialId]/edit) with a highly dynamic <MaterialForm>:
Implement category selector.
On category change:
Dynamically show/hide form sections relevant to the category.
Dynamically populate stockUnit and usageUnit dropdowns with valid options (use helper functions like getValidStockUnits(category), getValidUsageUnits(category)).
Pre-fill default stockUnit and usageUnit for the selected category (e.g., Profile -> stockUnit: 'pipe', usageUnit: 'ft').
For category: 'Profile':
Show sections for managing standardLengths (array input for length & unit).
Show sections for managing gaugeSpecificWeights (array input for gauge, weight/unit length, unit length).
Show section to view/manage initial stockByLength (array input for length, unit, quantity, low stock threshold, unit rate per pipe). (Note: Ongoing stock entries often via "Inward Profile" or "Adjustments").
Input for weightUnit.
For category: 'Glass', 'Hardware', 'Accessories', 'Consumables':
Show input for totalStockQuantity (label should include dynamic stockUnit).
Show input for unitRateForStockUnit (label should include dynamic stockUnit).
Show input for lowStockThresholdForStockUnit.
Common fields: name, supplier, brand, hsnCode, description, isActive.
NEW: [Frontend] Create a dedicated <ProfileStockInwardForm> component (can be a modal or separate page):
Inputs: Select existing Profile Material or enter new name; gauge, standardLengthPerPiece, standardLengthUnit, numberOfPieces, totalWeightForPieces, weightUnitForTotal, totalPurchaseCostForPieces, supplier, purchaseDate.
Submits data to POST /api/inventory/stock/inward-profile.
UPDATED: [Frontend] Create Stock Adjustment page (/dashboard/inventory/adjust) with dynamic <StockAdjustmentForm>:
Material selector (fetches material.category, material.stockUnit, material.standardLengths on select).
If selected material.category is 'Profile':
Radio button/select: "Adjust Specific Standard Length" or "Adjust Total Stock" (if profile can also be tracked in bulk, e.g., by kg).
If "Adjust Specific Standard Length": Show standardLength selector (populated from material.standardLengths). quantityUnit field shows 'pcs' (read-only or default).
If "Adjust Total Stock": quantityUnit field shows material.stockUnit (e.g., 'kg').
If selected material.category is NOT 'Profile': quantityUnit field shows material.stockUnit.
Input for quantityChange.
Selector for adjustment type (Inward, Outward-Manual, Correction, Scrap).
Notes input.
UPDATED: [Frontend] Create Stock History page (/dashboard/inventory/[materialId]/history) displaying <StockHistoryTable>. Ensure table columns dynamically show quantityUnit, and length/lengthUnit for relevant transactions.


Impact on Module 6: Material Estimation
Yes, Module 6 (Material Estimation) is affected by these changes, primarily in how materials are calculated and costed.
Material Calculation Logic (POST /api/estimations/{estimationId}/calculate):
When an estimation item uses a ProductType, the backend will iterate through ProductType.materials.
For each material, it will evaluate the formulas using the provided W, H, and ProductType.materials.formulaInputUnit.
The result of the formula is a quantity in ProductType.materials.quantityUnit.
Change: This quantityUnit now directly corresponds to the Material.usageUnit (e.g., inches for profile cuts, sqft for glass, pcs for hardware).
The Estimation.calculatedMaterials[] array will store:
materialId
materialNameSnapshot
totalQuantity: This is the sum of quantities calculated from formulas, and this quantity is in the unit defined by Material.usageUnit.
quantityUnit: This will be the Material.usageUnit.
manualUnitRate: Crucial Change for User Input: When the user inputs a manualUnitRate on the estimation costing screen, this rate must be per the Material.usageUnit.
Example 1: If a profile's usageUnit is 'ft', and total required length is 120 ft, the user enters cost per foot.
Example 2: If glass usageUnit is 'sqft', and total area is 50 sqft, user enters cost per sqft.
Example 3: If hardware usageUnit is 'pcs', and total count is 10 pcs, user enters cost per piece.
calculatedCost: Will be totalQuantity * manualUnitRate.
Frontend Estimation Costing Page (/dashboard/estimations/[estimationId]/calculate):
When displaying the <MaterialCostingTable> for calculatedMaterials:
The quantityUnit displayed for each material should be its Material.usageUnit.
The input field for manualUnitRate must clearly indicate that the rate should be per this Material.usageUnit.


Module 6: Material Estimation (REVISED)
Goal: Provide a pre-quote tool for rough material and cost estimation, accurately reflecting material usage units.
Tasks:
[Backend] Update Estimation Mongoose schema:
Ensure dimensionUnitUsed allows for 'ft', 'm' in addition to 'inches', 'mm'.
In calculatedMaterials sub-document:
Add materialCategorySnapshot: String.
Ensure quantityUnit is required: true and its enum matches Material.usageUnit's enum.
Set manualUnitRate default: '0.00'.
Add subtotalMaterials, subtotalManualCharges, totalEstimatedCost, markupPercentage, markedUpTotal fields with defaults.
Implement pre-save hook to calculate calculatedCost for each material, and all subtotals/totals.
[Backend] Implement Estimation CRUD endpoints (/api/estimations, .../{estimationId}).
POST /api/estimations: Initialize with basic project info.
PUT /api/estimations/{estimationId}: Allow updates to items, manualUnitRate in calculatedMaterials, manualCharges, markupPercentage, etc. The pre-save hook will handle recalculations.
UPDATED: [Backend] Implement Calculation endpoint (POST /api/estimations/{estimationId}/calculate):
For each item in Estimation.items:
Fetch the ProductType and its materials array.
For each material in ProductType.materials:
Evaluate formulas using item W, H, and ProductType.materials.formulaInputUnit (converting item W, H if Estimation.dimensionUnitUsed is different from ProductType.materials.formulaInputUnit).
The result is a quantity in ProductType.materials.quantityUnit.
Aggregate these calculated quantities for each unique materialId across all estimation items.
Populate/update the Estimation.calculatedMaterials array:
materialId, materialNameSnapshot.
materialCategorySnapshot (from the Material document).
totalQuantity (aggregated sum).
quantityUnit (this must be the Material.usageUnit for the materialId).
Initialize manualUnitRate (e.g., to 0 or attempt to fetch a default/last used rate if such logic exists).
calculatedCost will be computed by the pre-save hook later or on update.
Save the Estimation document (triggers pre-save hook for cost calculations).
[Backend] Implement PDF generation endpoint (GET /api/estimations/{estimationId}/pdf) using a PDF library. Ensure PDF clearly shows quantities with their respective units.
[Backend] Implement Convert-to-Quotation endpoint (POST /api/estimations/{estimationId}/to-quotation - optional TBD, will need to map estimated data to quotation structure).
[Frontend] Create Estimation List page (/dashboard/estimations) with <EstimationTable>.
[Frontend] Create Estimation New/Edit page (/dashboard/estimations/new, .../[estimationId]/edit) implementing <EstimationItemInputGrid> (for project info, client, dimensionUnitUsed selector, and items list [product type, W, H, Qty, Label]).
UPDATED: [Frontend] Create/Update Estimation Calculate/Summary page (e.g., /dashboard/estimations/[estimationId]/calculate or as a section in the edit page):
Display <MaterialCostingTable> for calculatedMaterials from the Estimation document:
For each material, clearly display materialNameSnapshot, totalQuantity, and quantityUnit (this is the Material.usageUnit).
Provide an input field for manualUnitRate. The label for this input must explicitly state "Rate per [quantityUnit]" (e.g., "Rate per ft", "Rate per sqft", "Rate per pcs").
Display calculatedCost (dynamically updated as manualUnitRate changes, or on save via backend).
Display <ManualChargesForm> for adding/editing manual charges.
Display input for markupPercentage.
Display summary totals (subtotalMaterials, subtotalManualCharges, totalEstimatedCost, markedUpTotal).
[Frontend] Implement PDF download/preview functionality using an <EstimationSummaryReport> component that renders the PDF data.

Module 7: Quotation Management

Goal: Create, manage, and send formal quotations based on area pricing and calculated dimensions.

Tasks:

[Backend] Create Quotation Mongoose schema (capturing snapshots, area calculation rules, calculated values per item).

[Backend] Implement logic for generating unique, sequential quotationIdDisplay (e.g., counter collection).

[Backend] Implement Quotation CRUD endpoints (/api/quotations, .../{quotationId}). POST should take client, items, and calculate totals.

[Backend] Implement Send endpoint (/api/quotations/{quotationId}/send POST - updates status, triggers notifications if integrated later).

[Backend] Implement Status Update endpoint (/api/quotations/{quotationId}/status PUT).

[Backend] Implement PDF Generation endpoint (/api/quotations/{quotationId}/pdf) - Create a well-formatted PDF template.

[Backend] Implement optional SVG Preview endpoint (/api/quotations/{quotationId}/svg/{itemId} GET).

[Backend] Implement robust Area Calculation Service: Takes W, H, dimensionUnit, areaUnit, roundingRule, minArea; returns raw, rounded, chargeable areas. CRITICAL FOR ACCURACY.

[Backend] Ensure creation/updates snapshot relevant data (Client details, Product names, T&C, units, rules).

[Frontend] Create Quotation List page (/dashboard/quotations) with <QuotationTable>, filters (by status, client), search.

[Frontend] Create Quotation New/Edit page (/dashboard/quotations/new, .../[quotationId]/edit) with <QuotationForm> (potentially multi-step):

Client selection.

Item input section using <QuotationItemInput> component (ProductType select, W, H, Qty, Label, Price/AreaUnit). Area calculation should happen dynamically on frontend or via backend call.

Charges section using <ChargeInput> (predefined & custom).

Discount input.

Display <QuotationTotalsSummary>.

T&C display/edit.

Notes.

[Frontend] Create Quotation Detail page (/dashboard/quotations/[quotationId]) using <QuotationDetailView> and <StatusUpdater>.

[Frontend] Implement PDF preview/download functionality (<QuotationPDFView>).

[Frontend] Implement optional <SVGWindowPreview> component.

Module 8: Order Management (REVISED)

Goal: Convert accepted quotes to orders, manage final measurements, and prepare the list of required cuts for manufacturing.

Tasks:

[Backend] Create revised Order Mongoose schema (linking Quotation, storing final values, requiredMaterialCuts, linking CuttingPlan).

[Backend] Implement logic for generating unique, sequential orderIdDisplay.

[Backend] Implement Convert-from-Quotation endpoint (/api/orders/from-quotation/{quotationId} POST):

Verify quotation status is 'Accepted'.

Copy relevant data (client snapshot, items, charges, etc.).

Set initial status to 'Pending' or 'Measurement Confirmed' based on flow.

Calculate initial requiredMaterialCuts based on quoted dimensions/formulas/quantity.

[Backend] Implement Order GET/List endpoints (/api/orders, .../{orderId}).

[Backend] Implement Confirm Measurements endpoint (/api/orders/{orderId}/confirm-measurements PUT):

Requires specific permissions.

Updates finalWidth, finalHeight, finalQuantity on items.

Recalculates requiredMaterialCuts based on final values.

Recalculates final totals (finalItemSubtotal, finalGrandTotal, etc.).

Updates status (e.g., to 'Ready for Optimization').

Records who confirmed and when.

[Backend] Implement Required Cuts endpoint (/api/orders/{orderId}/required-cuts GET): Aggregates all cutLengths from order.items.requiredMaterialCuts grouped by materialId. Returns list like [{ materialId, materialName, usageUnit, requiredCuts: [numbers...] }].

[Backend] Implement Basic Stock Check endpoint (/api/orders/{orderId}/check-stock POST): Compares sum of required cut lengths (from required-cuts endpoint) against total available length in inventory (sum across all standard lengths). Returns basic availability info (this is pre-optimization).

[Backend] Implement Status Update endpoint (/api/orders/{orderId}/status PUT) with validation logic for state transitions.

[Backend] Implement History endpoint (/api/orders/{orderId}/history GET) - potentially add history entries on key status changes/updates.

[Frontend] Create Order List page (/dashboard/orders) with <OrderTable>, filters, search.

[Frontend] Create Order Detail page (/dashboard/orders/[orderId]) with tabs: Overview, Items, Materials/Cuts (display output of required-cuts endpoint initially, later replaced/augmented by Cutting Plan summary), History (<OrderHistoryFeed>).

[Frontend] Implement <MeasurementConfirmationForm> (modal or dedicated page) to input final W/H/Qty and call the confirm endpoint.

[Frontend] Implement basic stock check display/trigger.

[Frontend] Implement order status updates UI (<OrderStatusStepper>).

Module 9: Manufacturing Management (REVISED)

Goal: Optimize profile cutting based on standard lengths, visualize plans, track production, and update inventory accurately. HIGH COMPLEXITY MODULE.

Tasks:

[Backend] (R&D/CORE) Research, select, adapt, or implement a suitable 1D Bin Packing (Cutting Stock) algorithm that handles multiple stock "bin" sizes (standard pipe lengths) and aims to minimize scrap or number of pipes. This is the most critical and complex task. Create this as a reusable service/library.

[Backend] Create CuttingPlan Mongoose schema (separate collection recommended). Store detailed plan per material, including pipes used, cuts on each pipe, scrap per pipe, and summary totals.

[Backend] Implement optimize-cuts endpoint (/api/manufacturing/optimize-cuts POST):

Takes orderId.

Calls /api/orders/{orderId}/required-cuts to get needed cuts.

Fetches available stockByLength for each required material from Inventory.

Calls the Cutting Optimization service for each material.

Handles potential errors (e.g., insufficient stock, cut too long).

Formats and saves the result into a new CuttingPlan document.

Updates Order.cuttingPlanId and sets Order.cuttingPlanStatus to 'Generated', Order.status to 'Optimization Complete'.

[Backend] Implement get cutting-plan endpoint (/api/manufacturing/orders/{orderId}/cutting-plan GET) - retrieves the CuttingPlan document.

[Backend] Implement get svg endpoint (/api/manufacturing/orders/{orderId}/cutting-plan/svg GET) - generates an SVG representation of the materialPlans.pipesUsed data. Requires an SVG generation utility/library.

[Backend] Implement get pipe-order-summary endpoint (/api/manufacturing/orders/{orderId}/pipe-order-summary GET) - Reads the CuttingPlan and formats the summary section (total pipes per length, scrap, weight).

[Backend] Implement commit-cuts endpoint (/api/manufacturing/orders/{orderId}/commit-cuts POST):

Verify CuttingPlan.status is 'Generated'.

Iterate through CuttingPlan.materialPlans.pipesUsed.

For each pipe entry, create a StockTransaction record: type: 'Outward-OrderCut', correct materialId, length (standard length used), lengthUnit, quantityChange: -1, link relatedDocumentId to Order/CuttingPlan.

Update Material.stockByLength for each consumed pipe. Ensure atomicity/error handling.

Update CuttingPlan.status to 'Committed'.

Update Order.cuttingPlanStatus to 'Committed'.

Update Order.status (e.g., to 'Cutting' or 'In Production').

Log scrap information (details TBD - potentially create 'Scrap' stock transactions if scrap is tracked).

[Backend] Implement Stage Update endpoint (/api/manufacturing/orders/{orderId}/stage PUT) - updates Order.status for subsequent stages (Assembly, QC, Packed).

[Frontend] Create Manufacturing Queue page (/dashboard/manufacturing) showing orders ready for optimization or in production (<ProductionQueueTable>).

[Frontend] Enhance Order Detail page (/dashboard/orders/[orderId] or create /dashboard/manufacturing/orders/[orderId]) to display manufacturing info:

Button to trigger optimize-cuts.

Display optimization status (Order.cuttingPlanStatus).

Display <CuttingPlanVisualizer> component (renders SVG from endpoint).

Display <PipeOrderSummaryTable> component (renders data from summary endpoint).

Button to trigger commit-cuts.

[Frontend] Implement UI for updating subsequent manufacturing stages (<StageTracker> component?).

Module 10: Accounting & Invoicing

Goal: Generate invoices from final order data and track payments.

Tasks:

[Backend] Create Invoice Mongoose schema (with payments subdoc, pre-save hook for balanceDue/status).

[Backend] Implement logic for generating unique, sequential invoiceIdDisplay.

[Backend] Implement Create-from-Order endpoint (/api/invoices/from-order/{orderId} POST): Verify order status, snapshot final order data (finalGrandTotal etc.), set initial invoice status.

[Backend] Implement Invoice GET/List endpoints (/api/invoices, .../{invoiceId}).

[Backend] Implement PDF Generation endpoint (/api/invoices/{invoiceId}/pdf) - Create invoice PDF template.

[Backend] Implement Record Payment endpoint (/api/invoices/{invoiceId}/payments POST): Validate amount, add payment to subdocument array, update amountPaid, recalculate balanceDue and status.

[Backend] Implement Sales Ledger endpoint (/api/accounting/sales-ledger GET) - Aggregate invoice/payment data.

[Backend] Implement Simple P&L endpoint (/api/accounting/pnl-simple GET) - Define calculation (e.g., Invoice Totals - Order Costs). Requires order cost calculation, potentially using CuttingPlan cost snapshots if implemented.

[Frontend] Create Invoice List page (/dashboard/invoices) with <InvoiceTable>, filters.

[Frontend] Create Invoice Detail page (/dashboard/invoices/[invoiceId]) with <InvoiceDetailView> and <PaymentHistory>.

[Frontend] Implement <PaymentForm> (modal) to record payments.

[Frontend] Implement PDF preview/download for invoices.

[Frontend] Create Sales Ledger page (/dashboard/accounting/sales-ledger).

[Frontend] Create P&L page (/dashboard/accounting/pnl).

Module 11: Subscription & Billing

Goal: Manage subscription plans and integrate with Razorpay for payments and status updates.

Tasks:

[Backend] Create SubscriptionPlan Mongoose schema (if plans are dynamic).

[Backend] Add subscription-related fields to Company schema (subscriptionPlan, subscriptionStatus, razorpayCustomerId, razorpaySubscriptionId, trialEndsAt, currentPeriodEndsAt).

[Backend] Implement List Plans endpoint (/api/subscriptions/plans GET).

[Backend] Implement Razorpay Checkout endpoint (/api/subscriptions/checkout POST) - Creates Razorpay order/subscription, returns details needed for frontend checkout.

[Backend] Implement Get Status endpoint (/api/subscriptions/status GET) - returns current company's subscription info.

[Backend] Implement secure Razorpay Webhook handler (/api/subscriptions/webhooks/razorpay POST):

Verify Razorpay signature. CRITICAL SECURITY.

Handle events like subscription.activated, subscription.charged, subscription.halted, payment.failed, etc.

Update Company.subscriptionStatus, currentPeriodEndsAt, etc., reliably based on events.

[Backend] Implement Manage Subscription endpoint (/api/subscriptions/manage POST) - redirect to Razorpay customer portal if available/applicable.

[Backend] Implement Feature Gating middleware/logic to restrict access to certain features/modules based on Company.subscriptionPlan and subscriptionStatus.

[Frontend] Create Billing page (/dashboard/settings/billing) displaying <BillingInfo> (current plan, status, next billing date) and <PlanSelector> (for upgrades/changes).

[Frontend] Create Subscribe page (/subscribe or similar) for initial plan selection with <PlanSelectionCard> components.

[Frontend] Integrate Razorpay Checkout component/library using details from the backend checkout endpoint.

[Frontend] Handle checkout success/failure callbacks.

[Frontend] Adapt UI/hide features based on subscription status/plan fetched from context/backend.

Module 12: Reporting (REVISED)

Goal: Provide aggregated insights across various modules, including revised inventory and manufacturing data.

Tasks:

[Backend] Define clear metrics for each report.

[Backend] Implement Client Report endpoint (/api/reports/clients GET) using aggregation pipelines.

[Backend] Implement Quotation Report endpoint (/api/reports/quotations GET) using aggregation pipelines (e.g., conversion rates, value by status).

[Backend] Implement Sales Order Report endpoint (/api/reports/sales-orders GET) using aggregation pipelines (e.g., value over time, top products).

[Backend] Implement revised Inventory Report endpoint (/api/reports/inventory GET):

Aggregate stockByLength across materials.

Calculate total stock value (using unitRate per length).

Report low stock items based on thresholds per length.

[Backend] Implement revised Manufacturing Report endpoint (/api/reports/manufacturing GET):

Analyze aggregated CuttingPlan data.

Calculate average scrap percentage per material.

Track number of pipes used (by standard length).

(Optional) Analyze time spent in different production stages.

[Backend] Ensure all reporting endpoints implement date range filters and respect multi-tenant isolation (companyId).

[Backend] Optimize aggregation queries and ensure necessary indexes exist on underlying collections.

[Frontend] Create Reporting Dashboard (/dashboard/reports) linking to specific reports.

[Frontend] Create individual report pages (/dashboard/reports/clients, .../quotations, etc.).

[Frontend] Integrate a charting library (e.g., Recharts, Chart.js) and implement reusable chart components (<BarChart>, <PieChart>, etc.).

[Frontend] Use data tables (<DataTable>) with sorting, filtering (via API), and potentially export options for displaying report data.

[Frontend] Implement date range pickers and other relevant filters for reports.

[Frontend] Update Inventory and Manufacturing report views to reflect the revised data structures and metrics.

This breakdown provides a structured task list for each logical part of the application, aligning with the revised PRD v2.0. Remember to prioritize based on the phasing plan and allocate sufficient resources, especially for the high-risk Manufacturing/Optimization module.