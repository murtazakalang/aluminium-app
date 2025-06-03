## Project Overview

This is a monorepo project using Turborepo to manage a Next.js frontend and Express.js backend for an aluminium window quotation and manufacturing management application.

## Monorepo Layout

```text
aluminium-app/
├── .DS_Store
├── .gitignore
├── .npmrc
├── docker-compose.yml
├── turbo.json
├── package.json
├── package-lock.json
├── README.md
├── progress.md
├── DevelopmentTask.md
├── PRD.md
├── rules.rtf
├── apps/
│   ├── frontend/
│   └── backend/
├── packages/
│   └── types/
├── node_modules/       # 3rd party dependencies
├── .turbo/             # Turborepo cache
└── .github/            # CI workflows
```

## Frontend App Structure (apps/frontend)

```text
frontend/
├── .gitignore
├── components.json
├── Dockerfile
├── eslint.config.mjs
├── next.config.js
├── next.config.ts
├── next-env.d.ts
├── package.json
├── postcss.config.mjs
├── README.md
├── tsconfig.json
├── public/
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
└── src/
    ├── app/
    │   ├── (auth)/
    │   │   ├── layout.tsx
    │   │   ├── login/
    │   │   │   └── page.tsx
    │   │   ├── register/
    │   │   │   └── page.tsx
    │   │   ├── forgot-password/
    │   │   │   └── page.tsx
    │   │   └── reset-password/
    │   │       ├── layout.tsx
    │   │       └── page.tsx
    │   ├── (dashboard)/
    │   │   ├── layout.tsx
    │   │   └── dashboard/
    │   │       ├── page.tsx
    │   │       ├── changelog/
    │   │       │   ├── layout.tsx
    │   │       │   └── page.tsx
    │   │       ├── help/
    │   │       │   ├── layout.tsx
    │   │       │   └── page.tsx
    │   │       ├── products/
    │   │       │   ├── page.tsx
    │   │       │   ├── new/
    │   │       │   │   └── page.tsx
    │   │       │   └── [productId]/
    │   │       │       └── edit/
    │   │       │           └── page.tsx
    │   │       ├── inventory/
    │   │       │   ├── page.tsx
    │   │       │   ├── new/
    │   │       │   │   └── page.tsx
    │   │       │   ├── [materialId]/
    │   │       │   │   └── edit/
    │   │       │   │       └── page.tsx
    │   │       │   ├── history/ 
    │   │       │   │   └── [materialId]/ // Assuming dynamic route for history
    │   │       │   │       └── page.tsx
    │   │       │   └── stock-adjustment/
    │   │       │       └── page.tsx
    │   │       └── settings/
    │   │           ├── layout.tsx
    │   │           ├── charges/
    │   │           │   └── page.tsx
    │   │           ├── company/
    │   │           │   └── page.tsx
    │   │           ├── general/
    │   │           │   └── page.tsx
    │   │           ├── notifications/
    │   │           │   └── page.tsx
    │   │           └── staff/
    │   │               ├── invite/
    │   │               │   └── page.tsx
    │   │               ├── new/
    │   │               │   └── page.tsx
    │   │               ├── page.tsx
    │   │               └── [userId]/
    │   │                   └── edit/
    │   │                       └── page.tsx
    │   ├── globals.css
    │   ├── favicon.ico
    │   ├── layout.tsx
    │   └── page.tsx
    ├── components/
    │   ├── auth/
    │   │   ├── ForgotPasswordForm.tsx
    │   │   ├── LoginForm.tsx
    │   │   ├── RegisterForm.tsx
    │   │   └── ResetPasswordForm.tsx
    │   ├── common/
    │   │   ├── ProtectedRoute.tsx
    │   │   └── Sidebar.tsx
    │   ├── settings/
    │   │   ├── ChargeForm.tsx
    │   │   ├── ChargesPage.tsx
    │   │   ├── ChargesTable.tsx
    │   │   ├── CompanyForm.tsx
    │   │   ├── GstSettingsForm.tsx
    │   │   ├── InviteForm.tsx
    │   │   ├── NotificationsSettings.tsx
    │   │   ├── RoleSelector.tsx
    │   │   ├── StaffForm.tsx
    │   │   ├── StaffTable.tsx
    │   │   ├── TermsEditor.tsx
    │   │   └── UnitSettingsForm.tsx
    │   ├── products/
    │   │   ├── MaterialFormulaInput.tsx
    │   │   ├── ProductForm.tsx
    │   │   └── ProductTable.tsx
    │   ├── inventory/
    │   │   ├── InventoryTable.tsx
    │   │   ├── MaterialForm.tsx
    │   │   ├── ProfileStockInwardForm.jsx 
    │   │   ├── StockAdjustmentForm.tsx
    │   │   └── StockHistoryTable.tsx
    │   └── ui/
    │       ├── Button.tsx
    │       ├── FormInput.tsx
    │       ├── Input.tsx
    │       ├── label.tsx
    │       ├── LoadingButton.tsx
    │       ├── RichTextEditor.tsx
    │       └── Table.tsx
    ├── lib/
    │   ├── api.ts
    │   ├── config.ts
    │   ├── types.ts
    │   ├── utils.ts
    │   └── store/
    │       └── auth-store.ts
    └── contexts/
        └── SettingsContext.tsx
```

## Backend App Structure (apps/backend)

```text
backend/
├── .env
├── .env.example
├── Dockerfile
├── package.json
├── server.js.old
└── src/
    ├── server.js
    ├── config/
    │   ├── index.js
    │   └── nodemailer.js
    ├── controllers/
    │   ├── authController.js
    │   ├── clientController.js
    │   ├── companyController.js
    │   ├── productController.js
    │   ├── inventoryController.js
    │   ├── roleController.js
    │   ├── settingsController.js
    │   └── staffController.js
    ├── middleware/
    │   ├── rbac.js
    │   └── validators.js
    ├── models/
    │   ├── Client.js
    │   ├── Company.js
    │   ├── ProductType.js
    │   ├── Material.js
    │   ├── StockTransaction.js
    │   ├── Setting.js
    │   └── User.js
    ├── routes/
    │   ├── authRoutes.js
    │   ├── clientRoutes.js
    │   ├── companyRoutes.js
    │   ├── productRoutes.js
    │   ├── inventoryRoutes.js
    │   ├── roleRoutes.js
    │   ├── settingsRoutes.js
    │   └── staffRoutes.js
    ├── services/
    │   ├── productService.js
    │   └── inventoryService.js
    └── utils/
        ├── appError.js
        ├── catchAsync.js
        ├── emailSender.js
        ├── emailUtils.js
        ├── formulaEvaluator.js
        ├── profileCuttingUtil.js
        ├── unitConverter.js
        └── weightUtils.js
```

## Shared Packages (packages/types)

```text
types/
├── package.json
└── index.ts
```

### Server Setup (`apps/backend/src/server.js`)

The Express server handles API routes, middleware configuration, database connection, and error handling.

### Configuration (`apps/backend/src/config`)

* **index.js** – centralises environment variables such as `MONGO_URI`, `jwtSecret`, mail credentials, ports, etc.
* **nodemailer.js** – reusable Nodemailer transporter for transactional email (invitations, password-reset).

---

### Authentication & Authorisation Stack

1. **JWT Generation** – `authController.signToken()` signs `{ id, companyId }` with `process.env.JWT_SECRET` and expiry `JWT_EXPIRES_IN`.
2. **Token Delivery** – `createSendToken()` sends the JWT both in JSON response (`token`) and as an `httpOnly` cookie (`jwt`).
3. **Route Protection** – `exports.protect` (in `authController.js`) verifies the token (in `Authorization: Bearer` header or cookie) with `jwt.verify`, attaches `req.user` & `req.companyId`, and blocks access if:
   * token missing / invalid / expired
   * user not found or inactive.
4. **RBAC** – `middleware/rbac.js` is a higher-order middleware: `rbac(['Admin', 'Manager'])` → checks `req.user.role` ∈ allowedRoles and returns HTTP 403 otherwise.
5. **Validation** – `middleware/validators.js` houses Express-Validator chains for auth endpoints (register, login, forgot/reset password) + a generic `handleValidationErrors` aggregator.

---

### API Route → Controller → Middleware Matrix

| Route File | Base Path | Key Endpoints | Middleware |
|------------|-----------|--------------|------------|
| `authRoutes.js` | `/api/auth` | `POST /register`, `POST /login`, `POST /logout`, `POST /forgot-password`, `POST /reset-password`, `GET /me` | `validators.*`, none/protect (for `/me`) |
| `clientRoutes.js` | `/api/clients` | CRUD + `/:id/notes`, `/:id/history`, `/:id/status` | `protect`, `rbac(['Admin','Manager','Staff'])` |
| `companyRoutes.js` | `/api/companies` | `GET /my`, `PUT /my` | `protect` |
| `productRoutes.js` | `/api/products` | CRUD, `/validate-formula`, `/calculate-cost` | `protect` |
| `inventoryRoutes.js` | `/api/inventory` | CRUD materials, `/categories`, `/stock/inward-profile`, `/stock/adjust`, `/stock/history/:materialId` | `protect`, `rbac` (various roles) |
| `roleRoutes.js` | `/api/roles` | `GET /` | `protect` |
| `settingsRoutes.js` | `/api/settings` | `GET/PUT /` (general), `charges`, `help`, `changelog` | `protect` |

(Additional modules—Quotation, Order, Manufacturing, etc.—are planned per PRD but not yet present in code.)

---

### Database Models Implemented

* `Company` – tenant definition & subscription fields.
* `User` – staff accounts; includes `comparePassword()` bcrypt helper.
* `Client` – CRM entity with notes & follow-up status.
* `Setting` – company-level configuration (units, GST, charges, notifications).
* `ProductType` – defines product structures, materials, and formulas.
* `Material` – tracks inventory items, including profiles with standard lengths/gauges and other material types.
* `StockTransaction` – logs all inventory movements.

> Upcoming schemas listed in the PRD (Order, CuttingPlan, etc.) are placeholders for future sprints.

---

### Backend → PRD Alignment

| PRD Module | Current Implementation | Gap / Next Step |
|------------|-----------------------|-----------------|
| Tenant & Auth Management | ✅ Company & User models, JWT auth, staff endpoints, RBAC | Add invitation token flow & role assignment UI integration |
| Settings Management | ✅ Settings model, `/api/settings/*` routes | Complete notification toggles, GST logic |
| Client Management | ✅ CRUD, notes, history | Add follow-up reminders & filters |
| Product & Formula Management | ✅ ProductType model, controller logic, formula evaluation, cost calculation | UI refinements, advanced formula features if any. |
| Inventory Management | ✅ Material & StockTransaction models, profile inward, stock adjustments, history. Comprehensive category-driven logic. | Low stock alert mechanism (notifications). |
| Manufacturing / Quotation / Order | ⚙️ Not yet in repo | Implement per PRD phases 3-5 |

---

## Frontend Detailed Architecture

### Routing with Next.js App Router

* `(auth)` group – unauthenticated pages share minimalist layout.
  * `/login`, `/register`, `/forgot-password`, `/reset-password`
* `(dashboard)` group – authenticated section; wrapped with sidebar layout.
  * `/dashboard` (home)
  * `/dashboard/settings/*` (company, general, charges, notifications, staff sub-routes)
  * `/dashboard/help`, `/dashboard/changelog`

### State & API Layer

* **Zustand Store** `lib/store/auth-store.ts` – maintains `token`, `user`, `isAuthenticated`; persists in localStorage and injects Auth header via `fetch` wrapper in `lib/api.ts`.
* **ProtectedRoute.tsx** – higher-order component redirects to `/login` when `!isAuthenticated`.

### Component Libraries

* Tailwind CSS + shadcn/ui primitives (Button, Input, Table… under `components/ui`).
* Rich form components for Settings reside in `components/settings` (e.g., `CompanyForm`, `StaffTable`).

---

## Security & Best-Practice Notes

1. **CORS** is configured in `src/server.js` to allow credentials from `${FRONTEND_URL}`.
2. **Password Hashing** uses `bcryptjs` with 12 salting rounds in the `User` pre-save hook.
3. **Email Workflows** utilise `utils/emailUtils.js` and `config/nodemailer.js` for password reset & invitations.
4. **Soft Deletes** – Not yet implemented; recommend adding `isActive` flags (already on `User`, `Client`).
5. **Pagination & Filters** – To be added with query parameters on list endpoints, using Mongoose pagination plugin or manual `.limit()/.skip()`.

---

## Roadmap Snapshot

* **Phase 0 (Completed):** Auth + Settings groundwork.
* **Phase 1 (Completed):** Inventory revamp (standard lengths, gauges) – implemented `Material` & `StockTransaction` schemas, profile inward, adjustments.
* **Phase 2 (Completed):** Product formulas & Estimation engine – implemented `ProductType` schema, formula evaluation, and cost calculation.
* **Phase 3:** Quotation workflow -> PDF.
* **Phase 4:** Cutting optimisation & Manufacturing pipeline.
* **Phase 5:** Invoicing & Billing.

Refer to `PRD.md` for the exhaustive sprint plan and data contracts.
