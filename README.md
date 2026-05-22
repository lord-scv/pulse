Project Description
This project is a full-stack e-commerce web application built for small to mid-sized online retailers who need a clean, functional storefront without the bloat of platforms like Shopify or WooCommerce. It is architected from the ground up with a Django (Python) backend and a vanilla HTML/CSS/JavaScript frontend, giving complete control over every layer of the stack.
The application covers the entire customer journey — from browsing a product catalog and viewing detailed product pages, to adding items to a cart, registering or logging in, and completing an order. On the backend, a relational database manages products, users, orders, and inventory in a normalized, scalable schema.
This is not a toy project. It is designed with production-grade concerns in mind: session security, input validation, clean URL routing, proper HTTP status codes, database migrations, and a maintainable codebase that a team could extend. It demonstrates mastery of full-stack development, RESTful design, authentication flows, and database modeling — making it a strong portfolio centerpiece.

Product Requirements Document (PRD)
Project Name: ShopCore — Simple E-Commerce Store
Type: Full-Stack Web Application
Stack: Django (Python) + HTML/CSS/JavaScript
Database: PostgreSQL (production) / SQLite (development)
Timeline: 2–3 weeks (solo developer)
Version: 1.0

1. Objectives

Deliver a fully functional storefront where users can browse, search, and purchase products.
Implement secure user authentication with registration, login, and session management.
Build a persistent shopping cart that survives page navigation.
Process orders and store them with full detail in the database.
Produce clean, maintainable, well-documented code suitable for a professional portfolio.


2. Target Users
User TypeDescriptionShopper (Guest)Browses products and views details without logging inShopper (Registered)Logs in, adds to cart, places orders, views order historyAdminManages products, views all orders via Django Admin panel

3. Functional Requirements

3.1 User Authentication
Registration

Fields: Full name, email address, password, confirm password.
Email must be unique in the database.
Password must be minimum 8 characters with at least one number.
Passwords are hashed using Django's built-in PBKDF2 algorithm — never stored in plain text.
On success: user is auto-logged in and redirected to the homepage.
On failure: inline form errors shown without page reload.

Login

Fields: Email, password.
Incorrect credentials show a generic error ("Invalid email or password") to prevent user enumeration.
Successful login redirects user to the page they were trying to access (next URL parameter).
Session cookie is set with HttpOnly and SameSite=Lax flags.

Logout

Clears server-side session.
Redirects to homepage.

Access Control

Cart and checkout pages require login; guests are redirected to login with a next parameter.
Order history is user-scoped — users cannot view other users' orders.


3.2 Product Catalog (Homepage / Listing Page)
Display

Products shown in a responsive grid (4 columns desktop, 2 tablet, 1 mobile).
Each product card shows: product image, name, short description, price, and an "Add to Cart" button.
Out-of-stock products are visually marked and the add-to-cart button is disabled.

Search

A search bar at the top filters products by name and description.
Search is triggered on input (debounced 300ms) using JavaScript fetch against a backend search endpoint.
Results update without full page reload.

Category Filtering

Sidebar or top navigation shows product categories.
Clicking a category filters the product grid.
Active category is visually highlighted.
Filters and search can be combined.

Sorting

Dropdown to sort by: Price (Low to High), Price (High to Low), Newest, Most Popular.

Pagination

12 products per page.
URL-based pagination (?page=2) so pages are shareable and bookmarkable.


3.3 Product Detail Page
URL Structure: /products/<slug>/
Content Displayed:

Large product image (with thumbnail gallery if multiple images exist).
Product name, full description, price.
Stock availability ("In Stock", "Only 3 left", "Out of Stock").
Category tag (clickable, returns to catalog filtered by that category).
Quantity selector (1 to available stock, capped at 10).
"Add to Cart" button.
"Continue Shopping" link back to catalog.

Behavior:

Adding to cart from this page updates the cart icon count in the navbar instantly via JavaScript.
If the item is already in the cart, quantity is incremented (not duplicated).


3.4 Shopping Cart
Storage: Cart is stored server-side in the database tied to the user's session/account. Guest carts are session-based and merged into the user's account on login.
Cart Page (/cart/):

Lists all cart items: image, name, unit price, quantity input, line total.
Quantity can be updated inline; totals recalculate instantly via JavaScript.
Each item has a "Remove" button.
Order summary panel: subtotal, estimated tax (10%), total.
"Proceed to Checkout" CTA button.
"Continue Shopping" link.
Empty cart state with a prompt to browse products.

Cart Icon in Navbar:

Shows item count badge at all times.
Updates without page reload whenever cart is modified.


3.5 Checkout & Order Processing
Checkout Page (/checkout/): Requires login.
Form Fields:

Shipping address: Full name, address line 1, address line 2 (optional), city, state/province, postal code, country.
Order notes (optional free text field).
Order summary (read-only): items, quantities, prices, tax, total.

Payment:

For v1.0: Payment is simulated. A "Place Order" button submits the order directly.
A placeholder Stripe integration section is included in the codebase but inactive, ready for v1.1.

Order Processing Logic (Backend):

Validate all form fields server-side.
Re-verify stock availability for each cart item.
Create an Order record with status PENDING.
Create OrderItem records for each cart line.
Decrement stock quantity for each product.
Clear the user's cart.
Send an order confirmation email (Django email backend, configurable SMTP).
Redirect to Order Confirmation page.

Order Confirmation Page:

Shows order ID, items ordered, shipping address, and total.
Clear message: "Your order has been placed successfully."
Link to view full order history.


3.6 Order History
Page (/orders/): Requires login.

Lists all past orders for the logged-in user.
Each row: Order ID, date placed, item count, total, status badge (Pending / Processing / Shipped / Delivered).
Clicking an order opens the Order Detail page.

Order Detail Page (/orders/<order-id>/):

Full breakdown: all items, quantities, prices.
Shipping address used.
Order status with timestamp.
Total paid.


3.7 Admin Panel
Django's built-in admin (/admin/) is configured for:
Products:

Create, edit, delete products.
Upload multiple images per product.
Set price, stock quantity, category, description, slug.
Toggle active/inactive (inactive products don't appear on the storefront).

Orders:

View all orders with filter by status and date.
Update order status (Pending → Processing → Shipped → Delivered).
View full order details and customer info.

Users:

View registered users.
Deactivate accounts if needed.

Categories:

Create and manage product categories.


4. Database Schema
Table: users
ColumnTypeNotesidUUID / AutoIntPrimary keyfull_nameVARCHAR(100)emailVARCHAR(255)Uniquepassword_hashVARCHAR(255)PBKDF2 hashedis_activeBOOLEANDefault truedate_joinedDATETIMEAuto-set

Table: categories
ColumnTypeNotesidAutoIntPrimary keynameVARCHAR(100)slugVARCHAR(100)URL-safe, unique

Table: products
ColumnTypeNotesidAutoIntPrimary keynameVARCHAR(255)slugVARCHAR(255)Unique, URL-safedescriptionTEXTFull descriptionshort_descriptionVARCHAR(300)For cardspriceDECIMAL(10,2)stock_quantityINTcategory_idFK → categoriesis_activeBOOLEANcreated_atDATETIME

Table: product_images
ColumnTypeNotesidAutoIntPrimary keyproduct_idFK → productsimageImageFieldStored in /media/is_primaryBOOLEAN

Table: carts
ColumnTypeNotesidAutoIntPrimary keyuser_idFK → usersNullable (guest)session_keyVARCHARFor guest cartscreated_atDATETIME

Table: cart_items
ColumnTypeNotesidAutoIntPrimary keycart_idFK → cartsproduct_idFK → productsquantityINT

Table: orders
ColumnTypeNotesidUUIDPrimary key, shown to useruser_idFK → usersstatusENUMPENDING / PROCESSING / SHIPPED / DELIVEREDsubtotalDECIMAL(10,2)taxDECIMAL(10,2)totalDECIMAL(10,2)notesTEXTOptionalcreated_atDATETIME

Table: order_shipping
ColumnTypeNotesidAutoIntPrimary keyorder_idFK → ordersOne-to-onefull_nameVARCHAR(100)address_line_1VARCHAR(255)address_line_2VARCHAR(255)cityVARCHAR(100)stateVARCHAR(100)postal_codeVARCHAR(20)countryVARCHAR(100)

Table: order_items
ColumnTypeNotesidAutoIntPrimary keyorder_idFK → ordersproduct_idFK → productsproduct_nameVARCHAR(255)Snapshot at time of orderunit_priceDECIMAL(10,2)Snapshot at time of orderquantityINT

5. URL Structure
URLViewAuth Required/Product listing / homepageNo/products/<slug>/Product detail pageNo/cart/Shopping cartYes/checkout/Checkout formYes/orders/Order historyYes/orders/<uuid>/Order detailYes/auth/register/Registration pageNo/auth/login/Login pageNo/auth/logout/Logout (POST)Yes/admin/Django admin panelAdmin only/api/search/Search endpoint (JSON)No/api/cart/add/Add to cart (POST, JSON)Yes/api/cart/update/Update quantity (POST, JSON)Yes/api/cart/remove/Remove item (POST, JSON)Yes

6. Non-Functional Requirements
RequirementStandardSecurityCSRF protection on all POST forms, password hashing, no raw SQL, HttpOnly cookiesPerformanceDatabase queries use select_related and prefetch_related to avoid N+1 problemsResponsivenessFully usable on mobile (375px) through desktop (1440px)ValidationAll inputs validated both client-side (JS) and server-side (Django forms/serializers)Error HandlingCustom 404 and 500 pages; all exceptions caught and loggedCode QualityPEP8 compliant Python; modular Django app structure; no logic in templatesEnvironment ConfigAll secrets in .env via django-environ; never committed to version control

7. Project File Structure
shopcore/
├── manage.py
├── .env
├── requirements.txt
├── shopcore/               ← Django project settings
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
├── products/               ← Product catalog app
│   ├── models.py
│   ├── views.py
│   ├── urls.py
│   └── templates/
├── cart/                   ← Cart app
│   ├── models.py
│   ├── views.py
│   └── context_processors.py
├── orders/                 ← Orders app
│   ├── models.py
│   ├── views.py
│   └── templates/
├── users/                  ← Auth app
│   ├── models.py
│   ├── views.py
│   └── templates/
├── static/
│   ├── css/
│   ├── js/
│   └── images/
└── templates/
    ├── base.html
    └── components/

8. Deliverables

Full Django project source code, version-controlled with Git.
Database migrations for all models.
Seeded sample data (10+ products across 3+ categories) via Django fixtures.
requirements.txt with pinned dependency versions.
README.md with setup instructions, environment variable reference, and how to run locally.
.env.example template file.


9. Out of Scope for v1.0

Real payment gateway integration (Stripe/PayPal) — placeholder only.
Product reviews and ratings.
Discount codes and coupons.
Wishlist functionality.
Email marketing or newsletters.
Multi-vendor / seller accounts.
Mobile app (iOS/Android).
Deployment configuration (Docker, CI/CD) — documented separately if needed.
You said: give a small description for my githubgive a small description for my github2:45 PMClaude responded: GitHub DescriptionGitHub Description
ShopCore — A full-stack e-commerce web application built with Django & vanilla JavaScript. Features product listings, shopping cart, user authentication, order processing, and an admin dashboard. Stack: Python · Django · PostgreSQL · HTML/CSS/JS.You said: Social Media Platform Create a mini social media app.Social Media Platform Create a mini social media app. Features to implement: ● User profiles ● Posts & comments ● Like/follow system Frontend: HTML, CSS, JavaScript Backend: Django or Express.js Database for users, posts, comments, followersi want a actual professional app which should be not like ai generated but actual made my a group of professional devs so make a description and prd as if it is made as intagram or similar froffesional socaial media app2:50 PMClaude responded: Pulse — Social Media PlatformPulse — Social Media Platform
Product Description & PRD

About Pulse
Pulse is a modern social networking platform built for creators, communities, and conversations. It gives people a space to share moments, follow the people and topics they care about, and engage through rich, real-time interactions — without the noise of algorithmic manipulation or data exploitation that defines today's big platforms.
Built by a cross-functional team of engineers, designers, and product thinkers, Pulse is engineered from the ground up with the same architectural discipline you'd find at a scaled consumer tech company. The backend is built on Django with a clean REST API layer, a normalized PostgreSQL database designed for real query loads, and a frontend that feels native — fast transitions, optimistic UI updates, real-time notifications — not a page-reload website dressed up as an app.
This is not a tutorial project. Every product decision is intentional. Every data model is thought through. Every user flow is designed around how people actually use social products, not how textbooks describe them.

The Problem We're Solving
Existing platforms are either too large and overwhelming (Instagram, Twitter/X), too niche, or too privacy-invasive. New creators and tight communities need a platform that centers genuine connection — where your feed shows you people you follow, your posts reach your actual audience, and the product doesn't fight you for your attention.
Pulse fills that gap: a focused, fast, well-designed social platform with the core features people actually use daily.

Who It's For
Creators who want to share visual and written content with a real audience without fighting an opaque algorithm.
Communities built around shared interests — photography, writing, design, tech — who want a dedicated space to connect.
Developers & students studying how a real social platform is architected and built at a professional level.

What Makes It Different
No algorithm. Your feed is chronological. You see posts from people you follow, in order, every time.
Performance-first. Every interaction — liking a post, following someone, posting a comment — happens instantly via optimistic UI updates. The network catches up silently.
Privacy by design. No third-party trackers. No ad targeting. No selling user data. Users control who sees their content through profile visibility settings.
Clean, intentional design. The UI is designed with a real design system — consistent spacing, typography, color tokens, component library — not thrown together with Bootstrap defaults.


Product Requirements Document (PRD)
Product Name: Pulse
Type: Full-Stack Social Media Web Application
Stack: Django · Django REST Framework · PostgreSQL · HTML · CSS · JavaScript
Version: 1.0
Team: Full-stack engineers, 1 product designer, 1 QA
Timeline: 6–8 weeks

1. Product Goals

Ship a complete, working social platform with the core interaction loop: post → discover → follow → engage.
Build a codebase that is modular, testable, and extensible — not a monolith that collapses under its own weight at v1.1.
Deliver a UI that feels like a real product: consistent design language, smooth interactions, accessible markup.
Demonstrate professional-grade backend architecture: clean API design, proper auth, normalized schema, no N+1 queries.


2. Core User Journeys
New User Journey
Sign up → Set up profile (photo, bio, username) → Discover people to follow → See personalized feed → Create first post → Get first like/comment → Follow back
Returning User Journey
Log in → Check notification bell → Scroll feed → Like and comment on posts → View a profile → Follow someone new → Create a post → Log out
Creator Journey
Post content → See engagement (likes, comments) → Gain followers → View follower/following lists → Edit or delete own posts

3. Feature Specifications

3.1 Authentication & Onboarding
Sign Up

Fields: Username (unique, 3–20 chars, alphanumeric + underscores only), Email (unique), Password, Confirm Password.
Real-time username availability check as user types (debounced API call).
Password strength indicator (weak / medium / strong) rendered client-side.
On success: account created, user auto-logged in, redirected to profile setup step.
Email verification: verification link sent via email. Unverified users can browse but cannot post until verified. Verification status shown in a dismissible banner.

Profile Setup (Post-Registration Onboarding)

Step 1: Upload profile photo (optional, default avatar assigned if skipped).
Step 2: Add bio (160 character limit with live counter), display name, website URL (optional).
Step 3: "Suggested People to Follow" — 6 curated accounts (seeded in DB) shown with follow buttons. User can follow any, all, or skip entirely.
Completing onboarding redirects to the home feed.

Login

Fields: Username or email + password.
"Remember me" checkbox extends session to 30 days; default session is 24 hours.
Rate limiting: 5 failed attempts locks the account for 15 minutes. User is informed of the lockout duration, not the exact reason.
Forgot password: sends a time-limited reset link (expires in 1 hour) to registered email.

Security

All passwords hashed with PBKDF2-SHA256 + per-user salt (Django default).
CSRF tokens on every state-changing request.
Session cookies: HttpOnly, Secure, SameSite=Lax.
JWT option available for API clients (future mobile app readiness).


3.2 User Profiles
Profile Page (/@<username>/)
Header section:

Profile photo (circular, 120px).
Display name (bold, larger type) + username (muted, smaller).
Bio text (rendered with line breaks preserved).
Website link (opens in new tab, rel="noopener noreferrer").
Three stats in a row: Posts count, Followers count, Following count. Each stat is a clickable link opening a modal with the respective user list.
If viewing own profile: "Edit Profile" button.
If viewing another user: "Follow" / "Following" / "Unfollow" toggle button + "Message" button (placeholder for v1.1).
If the profile is private and you don't follow them: posts grid is replaced with a "This account is private" lock message.

Posts Grid:

3-column grid of post thumbnail images (square crop).
Hovering a thumbnail shows a dark overlay with like count and comment count.
Clicking a thumbnail opens the post in a modal overlay (not a new page), preserving scroll position.
Infinite scroll: loads 12 posts at a time, fetches more on scroll.

Edit Profile (/settings/profile/)

Fields: Display name, username (with uniqueness check), bio, website, email (requires password confirmation to change), profile photo upload.
Account visibility toggle: Public / Private.
"Change Password" in a separate section: current password + new password + confirm.
"Danger Zone" section at bottom: Delete Account (requires typing username to confirm, irreversible).


3.3 Posts
Creating a Post

Triggered by a "+" button fixed in the navbar (always accessible).
Opens a full-screen creation modal with two steps.
Step 1 — Media: Drag-and-drop or click-to-upload image. Accepted formats: JPG, PNG, WebP. Max size: 10MB. Image is previewed immediately. User can re-upload to replace.
Step 2 — Caption: Textarea with 2,200 character limit and live counter. Supports #hashtags (auto-highlighted in blue as typed) and @mentions (triggers a username autocomplete dropdown). Optional: disable comments toggle.
"Share" button submits the post. Optimistic UI: post appears at top of feed immediately while the API call completes in the background. If the call fails, post is removed and an error toast is shown.

Post Display (Feed Card)

Profile photo + username + relative timestamp ("2 hours ago") in the header. Timestamp is a <time> element with absolute datetime in the title attribute (accessible on hover).
Post image (16:9 or square aspect ratio, respects original).
Action row: Like button (heart icon), Comment button (speech bubble), Share button (paper plane — copies link to clipboard).
Like count ("142 likes") — clicking the count opens a modal list of users who liked the post.
Caption text with "more" truncation at 3 lines.
"View all X comments" link — expands inline comments without navigating away.
Inline comment input (for logged-in users) at the bottom of the card.

Post Detail Modal

Side-by-side layout on desktop: image on left (60% width), interactions on right (40% width).
Right panel: post author header, full caption, full comment thread with infinite scroll, comment input pinned to bottom.
Mobile: stacked layout (image top, interactions below).
ESC key closes the modal. Clicking backdrop closes the modal. Browser back button also closes (history state managed with pushState).

Post Options (own posts)

Three-dot menu on post cards and detail view.
Options: Edit Caption, Delete Post (confirmation dialog required).
Deleting a post removes it from all feeds and decrements the user's post count immediately (optimistic).


3.4 Feed
Home Feed (/)

Shows posts from all accounts the logged-in user follows, sorted strictly chronologically (newest first).
No algorithmic reordering. No promoted posts. No ads.
"You're all caught up" message shown when user has scrolled through all recent posts (posts from the past 48 hours).
Empty state (new user with no follows): "Your feed is empty. Discover people to follow →" with a link to the Explore page.
Infinite scroll: 10 posts per page, loads more on scroll, with a loading skeleton shown while fetching.
New posts indicator: if new posts arrive while user is scrolled down, a pill notification appears at the top ("↑ 3 new posts") — clicking it scrolls to top and loads the new posts.

Explore Page (/explore/)

Grid of posts from all public accounts (not just followed), ranked by recent engagement (likes + comments in the last 24 hours).
Search bar at the top: searches users and hashtags simultaneously.
User results: avatar, display name, username, follower count, follow button.
Hashtag results: hashtag name, post count, top 3 thumbnail previews.
Clicking a hashtag goes to /explore/tags/<hashtag>/ — a feed of all posts using that tag.


3.5 Comments
Comment Thread

Threaded at one level: top-level comments and replies to comments (no deeper nesting).
Each comment shows: profile photo, username, comment text, relative timestamp, like button with count.
Replying to a comment pre-fills the input with @username and nests the reply visually under the parent comment.
Comment input supports @mentions with autocomplete (same as post caption).

Comment Management

Users can delete their own comments (via a three-dot menu on hover).
Post owners can delete any comment on their posts.
Deleted comments are replaced with "[Comment removed]" placeholder if they have existing replies, to preserve thread context. If no replies, the comment is fully removed from the DOM.

Comment Ordering

Top-level comments sorted oldest first (threaded conversation flow).
Replies sorted oldest first within their parent.


3.6 Like System
Post Likes

Heart icon below each post.
Clicking toggles liked/unliked state instantly (optimistic update).
Icon animates on like: scale bounce + fill transition (CSS keyframe animation).
Like count updates immediately.
API call fires in the background; on failure, state reverts and an error toast is shown.
Liked posts are accessible from profile's "Saved" tab (v1.1) — model is in place.

Comment Likes

Smaller heart icon on each comment.
Same optimistic toggle behavior.
Count shown inline next to the icon.

Like List Modal

Clicking the like count on any post opens a modal.
List of users who liked the post: avatar, display name, username, follow button.
Infinite scroll within the modal if more than 20 likers.


3.7 Follow System
Following / Followers

Follow button on profile pages and in search results.
If the target account is public: follow is immediate. Follower/following counts update instantly.
If the target account is private: a follow request is sent. Button changes to "Requested". Target user sees a notification and can Accept or Decline.
Accepted request: requester is added to followers, their feed now includes the private account's posts.
Unfollowing: immediate, no confirmation required. User is removed from followers list.

Follow Requests (Private Accounts)

Notification bell shows pending follow requests separately.
Dedicated section in notifications: "Follow Requests (3)".
Accept / Decline buttons per request.
Accepting sends a notification back to the requester.

Suggested Users

Shown on the right sidebar of the home feed (desktop) and on the Explore page.
Algorithm: users followed by people you follow (friends-of-friends), excluding users you already follow.
Limited to 5 suggestions, with a "See All" link to a full suggestions page.


3.8 Notifications
Notification Center (/notifications/)

Accessible via bell icon in navbar.
Bell shows an unread count badge (capped at 99+).
Notification types:

TypeTextLike on post@username liked your photo.Comment on post@username commented: "Great shot!"New follower (public)@username started following you.Follow request@username requested to follow you.Follow request accepted@username accepted your follow request.Reply to comment@username replied to your comment.Like on comment@username liked your comment.Mention in post@username mentioned you in a post.Mention in comment@username mentioned you in a comment.

Each notification links directly to the relevant post/profile.
Post thumbnail shown on post-related notifications.
"Mark all as read" button.
Notifications persist for 90 days then are automatically pruned.

Real-Time Updates

Notification count in the navbar updates in real-time using polling (every 30 seconds for v1.0; WebSocket upgrade in v1.1).
New notifications appear at top of the list without full page reload.


4. Database Schema
users
ColumnTypeNotesidUUIDPrimary keyusernameVARCHAR(20)Unique, indexedemailVARCHAR(255)Unique, indexedpassword_hashVARCHAR(255)PBKDF2-SHA256display_nameVARCHAR(60)bioVARCHAR(160)websiteVARCHAR(200)profile_photoVARCHARPath to /media/is_privateBOOLEANDefault falseis_verified_emailBOOLEANDefault falseis_activeBOOLEANDefault truedate_joinedTIMESTAMPTZAutolast_activeTIMESTAMPTZUpdated on login

follows
ColumnTypeNotesidAutoIntPrimary keyfollower_idFK → usersfollowing_idFK → usersstatusENUMACTIVE / PENDINGcreated_atTIMESTAMPTZ
Unique constraint on (follower_id, following_id).

posts
ColumnTypeNotesidUUIDPrimary keyauthor_idFK → usersimageVARCHARPath to /media/captionTEXTMax 2200 charscomments_disabledBOOLEANDefault falselike_countINTDenormalized countercomment_countINTDenormalized countercreated_atTIMESTAMPTZupdated_atTIMESTAMPTZ

hashtags
ColumnTypeNotesidAutoIntPrimary keytagVARCHAR(100)Unique, lowercasepost_countINTDenormalized

post_hashtags (junction)
ColumnTypepost_idFK → postshashtag_idFK → hashtags

post_mentions
ColumnTypeNotesidAutoIntpost_idFK → postsmentioned_user_idFK → users

post_likes
ColumnTypeNotesidAutoIntPrimary keyuser_idFK → userspost_idFK → postscreated_atTIMESTAMPTZ
Unique constraint on (user_id, post_id).

comments
ColumnTypeNotesidUUIDPrimary keypost_idFK → postsauthor_idFK → usersparent_comment_idFK → commentsNull = top-levelbodyTEXTMax 500 charslike_countINTDenormalizedis_deletedBOOLEANSoft deletecreated_atTIMESTAMPTZ

comment_likes
ColumnTypeNotesidAutoIntPrimary keyuser_idFK → userscomment_idFK → commentscreated_atTIMESTAMPTZ
Unique constraint on (user_id, comment_id).

notifications
ColumnTypeNotesidUUIDPrimary keyrecipient_idFK → usersactor_idFK → usersWho triggered ittypeENUMLIKE_POST, COMMENT, FOLLOW, etc.post_idFK → postsNullablecomment_idFK → commentsNullableis_readBOOLEANDefault falsecreated_atTIMESTAMPTZ

follow_requests
ColumnTypeNotesidAutoIntPrimary keyrequester_idFK → userstarget_idFK → usersstatusENUMPENDING / ACCEPTED / DECLINEDcreated_atTIMESTAMPTZ

5. API Design
All API endpoints are prefixed /api/v1/.
Auth
MethodEndpointDescriptionPOST/auth/register/Create accountPOST/auth/login/Get session tokenPOST/auth/logout/Invalidate sessionPOST/auth/password/reset/Request password resetPOST/auth/password/reset/confirm/Confirm reset with tokenGET/auth/verify-email/<token>/Verify email address
Users
MethodEndpointDescriptionGET/users/<username>/Get profile dataPATCH/users/me/Update own profileDELETE/users/me/Delete accountGET/users/<username>/posts/Paginated post gridGET/users/<username>/followers/Follower listGET/users/<username>/following/Following listPOST/users/<username>/follow/Follow userDELETE/users/<username>/follow/Unfollow userGET/users/suggested/Suggested accountsGET/users/search/?q=Search users
Posts
MethodEndpointDescriptionGET/feed/Home feed (paginated)GET/explore/Explore feedPOST/posts/Create postGET/posts/<id>/Post detailPATCH/posts/<id>/Edit captionDELETE/posts/<id>/Delete postPOST/posts/<id>/like/Like postDELETE/posts/<id>/like/Unlike postGET/posts/<id>/likes/List of likers
Comments
MethodEndpointDescriptionGET/posts/<id>/comments/Comment threadPOST/posts/<id>/comments/Add commentDELETE/comments/<id>/Delete commentPOST/comments/<id>/like/Like commentDELETE/comments/<id>/like/Unlike comment
Notifications
MethodEndpointDescriptionGET/notifications/All notificationsPOST/notifications/read/Mark all as readPATCH/notifications/<id>/Mark one as read

6. Frontend Architecture
No framework. Vanilla JavaScript organized into ES modules.
static/
├── css/
│   ├── tokens.css         ← Design tokens (colors, spacing, type scale)
│   ├── reset.css          ← Normalize
│   ├── components/        ← Button, Card, Modal, Input, Avatar, Toast
│   └── layouts/           ← Feed, Profile, Explore, Auth
├── js/
│   ├── api.js             ← Fetch wrapper, auth headers, error handling
│   ├── state.js           ← Lightweight in-memory store
│   ├── router.js          ← Client-side SPA routing via History API
│   ├── components/
│   │   ├── PostCard.js
│   │   ├── PostModal.js
│   │   ├── CommentThread.js
│   │   ├── ProfileHeader.js
│   │   ├── NotificationItem.js
│   │   └── Toast.js
│   └── pages/
│       ├── Feed.js
│       ├── Profile.js
│       ├── Explore.js
│       ├── PostCreate.js
│       └── Auth.js
└── assets/
    ├── icons/             ← SVG icon set
    └── default-avatar.png
Design Tokens (tokens.css)
All visual values are CSS custom properties:

Color palette: neutral grays, brand accent, semantic colors (error, success, warning).
Spacing scale: 4px base unit (4, 8, 12, 16, 24, 32, 48, 64px).
Type scale: 12, 14, 16, 18, 24, 32px.
Border radius: 4px, 8px, 16px, 9999px (pill).
Shadow tokens: elevation-1 through elevation-3.


7. Non-Functional Requirements
RequirementStandardAPI Response Timep95 under 200ms for feed, profile, and post endpointsImage UploadsCompressed and served via /media/; WebP conversion on uploadQuery OptimizationNo N+1 queries; all list endpoints use select_related + prefetch_relatedPaginationCursor-based pagination on feed (not offset, to avoid duplicate/missing items on insert)Rate Limiting100 requests/minute per authenticated user on write endpointsSecurityOWASP Top 10 addressed; no raw SQL; parameterized queries onlyAccessibilityWCAG 2.1 AA: keyboard navigation, ARIA labels, sufficient color contrastMobileFully responsive, 375px to 1440px; touch-friendly tap targets (min 44px)TestingUnit tests for all models and API views; integration tests for auth and post flowsError HandlingAll API errors return consistent JSON: {error: {code, message, field?}}

8. Project Structure
pulse/
├── manage.py
├── .env
├── requirements.txt
├── pulse/                  ← Project settings
├── apps/
│   ├── users/              ← Auth, profiles, follows
│   ├── posts/              ← Posts, hashtags, mentions
│   ├── comments/           ← Comments, comment likes
│   ├── likes/              ← Post likes
│   ├── notifications/      ← Notification engine
│   └── feed/               ← Feed assembly logic
├── api/
│   └── v1/                 ← DRF routers and serializers
├── static/
├── templates/
├── media/
└── tests/

9. Out of Scope for v1.0

Direct messaging (DMs) — data model stubbed, UI in v1.1.
Stories / disappearing content.
Video uploads.
Live streaming.
Push notifications (browser or mobile).
Native mobile app.
Content moderation / reporting system.
Analytics dashboard for creators.
Third-party OAuth (Google, Apple sign-in)
