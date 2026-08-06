# Page Inventory (UI Identification Pass)

Founder-directed worksheet for the upcoming page-by-page visual redesign. Produced by a
"light UI identification pass" (no new features, no layout changes) across every page in
`apps/web`: seller dashboard, admin, auth, and the two storefront-adjacent status pages.
Every row now has, at minimum, a page name + one-line plain-language purpose. Dashboard
pages use the Module 10 UI kit (`PageHeader`, `Card`); admin pages remain intentionally
bare (raw HTML) per the existing "no design pass yet" precedent, now with a purpose line
added under each heading.

Out of scope (tracked separately): the platform's own marketing site (`/`, `/pricing` -
Module 19) and the theme-rendered buyer storefront pages (home, product, collection,
search, cart, checkout - tenant-themed, founder's own redesign territory, never
retrofitted per the Module 15.5 precedent).

## Seller dashboard (`/stores/[storeId]/...`)

| Route | Page name | Purpose | Key actions |
|---|---|---|---|
| `/stores/[storeId]` | Dashboard / Welcome to your store | At-a-glance store activity, or a first-product prompt for brand-new stores. | Add first product; jump to Products/Orders/etc. via cards |
| `/stores/[storeId]/products` | Products | Everything you sell, in one place. | Add product; edit/open a product |
| `/stores/[storeId]/products/new` | Add product | Give it a title to get started - you can fill in the rest anytime. | Create product |
| `/stores/[storeId]/products/[productId]` | Edit product (product title) | Edit this product's details, pricing, and visibility on your storefront. | Save changes; back to products |
| `/stores/[storeId]/collections` | Collections | Group products together for your storefront's navigation and merchandising. | Create collection; open a collection |
| `/stores/[storeId]/collections/[collectionId]` | Collection (collection title) | A curated group of products, shown together on your storefront. | Add product to collection; remove product; back to collections |
| `/stores/[storeId]/orders` | Orders | Every order placed on your store, regardless of payment status. | Filter by status; open an order |
| `/stores/[storeId]/orders/[orderId]` | Order from (buyer email) | View and manage a single order's items, status, and fulfillment. | Update fulfillment/status; back to orders |
| `/stores/[storeId]/customers` | Customers | Everyone who has bought from your store, by email. | Search; open a customer |
| `/stores/[storeId]/customers/[customerId]` | Customer (name or email) | A single customer's profile and order history. | Back to customers |
| `/stores/[storeId]/reviews` | Reviews | Approve or hide reviews before they count toward a product's rating. | Approve; hide |
| `/stores/[storeId]/discounts` | Discount codes | Codes buyers can enter at checkout for a percentage or fixed-amount discount. | Create code; deactivate code |
| `/stores/[storeId]/shipping-tax` | Shipping & tax | Applied to every order at checkout. | Edit shipping rates; edit tax rate |
| `/stores/[storeId]/suppliers` | Suppliers | Local suppliers whose products you can list and sell from your store. | Link supplier; unlink supplier |
| `/stores/[storeId]/navigation` | Navigation | The header and footer menus shown on your storefront. | Add/reorder/remove menu items; save |
| `/stores/[storeId]/customizer` | Customize (store name) | Pick a theme, adjust colors and sections, and preview changes before saving. | Choose theme; edit sections; save |
| `/stores/[storeId]/domains` | Domains | Every store gets a free uzeyn.com subdomain automatically - attaching your own domain here is optional. | Add custom domain; verify DNS |
| `/stores/[storeId]/marketing` | Marketing | Connect your store to marketing tools like the Social Media SaaS to promote your catalog. | Connect Social Media SaaS |
| `/stores/[storeId]/data` | Import & export | Bring products in from another platform, or take your own data out. | Import CSV; export CSV |
| `/stores/[storeId]/billing` | Plans & Billing | Your plan, upgrade options, and teams. | Upgrade plan; manage team seats |
| `/stores/[storeId]/settings` | Store settings | Branding, checkout, and other store-wide preferences. | Upload logo; save settings; edit dashboard theme |

## Admin (`/admin/...`) - bare, no design pass yet (Module 17)

| Route | Page name | Purpose | Key actions |
|---|---|---|---|
| `/admin/login` | Admin login | Sign in with your platform admin credentials. | Log in; verify MFA code |
| `/admin/plans` | Plans - groups & tiers | Define the pricing tiers sellers, teams, and suppliers can subscribe to, and retire old ones. | Create tier; retire tier |
| `/admin/sellers` | Sellers - lifecycle control | Review sellers by trust-and-safety status, approve held activations, and move a seller along the enforcement ladder. | Approve activation; set lifecycle status |
| `/admin/trust-safety` | Trust & Safety | Review flagged sellers, decide on held payment instruments, and publish new Seller Agreement versions. | Approve/reject payment instrument; publish agreement version |
| `/admin/external-api-clients` | External API Clients | Register, enable/disable, and rotate secrets for the Template Store and Social Media SaaS hooks. | Register client; enable/disable; regenerate secret |
| `/admin/settings` | Settings Registry | Read-only list of every platform setting: its type, allowed scopes, and default value. | (read-only) |

## Auth (`/login`, `/signup`, `/reset-password`, `/verify-email`)

| Route | Page name | Purpose | Key actions |
|---|---|---|---|
| `/login` | Log in / Two-factor authentication | Sign in to manage your store; confirm identity with a one-time code when required. | Log in; verify code; forgot password link |
| `/signup` | Sign up | Create a seller account to start selling on uzeyn.com. | Create account (requires accepting Seller Agreement) |
| `/reset-password` | Forgot password / Set a new password | Get a reset link by email, then choose a new password from that link. | Send reset link; reset password |
| `/verify-email` | Email verification | Confirming the email address you signed up with. | (automatic; link to login) |

## Storefront-adjacent (buyer-facing, theme-rendered, informational)

| Route | Page name | Purpose | Key actions |
|---|---|---|---|
| `/order-status/[token]` | Order status | Check your order's payment status, items, and shipping progress any time using this link. | Download invoice; leave a review |
| `/order-confirmation/[token]` | Thank you for your order! | Confirms an order was placed and is awaiting payment (never claims "paid"/"confirmed"). | Download invoice; link to order status page |

## Out of scope for this pass

| Route | Reason |
|---|---|
| `/` , `/pricing` | Platform's own marketing site - deferred to Module 19 (premium pass, blocked on branding assets) |
| `/storefront` (home), `/storefront/products/[productId]`, `/storefront/collections/[collectionId]`, `/storefront/search`, `/storefront/cart`, `/storefront/checkout` | Tenant-themed buyer storefront - founder's own page-by-page redesign territory, never retrofitted (Module 15.5 precedent) |
