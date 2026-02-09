# Interview Prep: Products

**Feature:** Product catalog, tags, related products, reviews, CRUD, image upload  
**Base path:** `/api/products`

---

## APIs

| Method | Path | Auth | Roles | Purpose |
|--------|------|------|-------|---------|
| GET | `/api/products` | No | — | List products (paginated; search, platform, genre, tag, price range, sort, fields) |
| GET | `/api/products/tags` | No | — | All distinct tags (sorted) |
| GET | `/api/products/:id` | No | — | Get product by ID (includes reviewSummary) |
| GET | `/api/products/:id/related` | No | — | Related products by shared tags (limit 1–20) |
| GET | `/api/products/:id/reviews` | No | — | Paginated reviews + summary |
| GET | `/api/products/:id/reviews/me` | Yes | — | Current user’s review for this product |
| POST | `/api/products/:id/reviews` | Yes | — | Create or update my review (rating 1–5, optional comment) |
| DELETE | `/api/products/:id/reviews` | Yes | — | Delete my review |
| POST | `/api/products` | Yes | admin, manager | Create product |
| PATCH | `/api/products/:id` | Yes | admin, manager | Update product |
| DELETE | `/api/products/:id` | Yes | admin, manager | Delete product |
| POST | `/api/products/:id/image` | Yes | admin, manager | Upload cover image (multipart, field `image`) |

---

## Implementation

**Key files:**

- **Routes:** `src/routes/product.routes.js` — public: list, tags, get, related, reviews list; auth: reviews me/create/update/delete; auth + requireRole(admin, manager): CRUD + image (productImageUpload before controller).
- **Product controller:** `src/controllers/product.controller.js` — getProduct enriches with `reviewSummary` from `utils/reviewSummary.js` (Steam-style label from reviewCount/positiveCount). getRelatedProducts uses query limit (default 6, cap 1–20). uploadProductImage: req.file → uploadService.productImageKey, uploadToS3, productService.updateProductCoverImage.
- **Product service:** `src/services/product.service.js` — getAllProducts: filter isActive, platform, genre, price range, tags (tag or tags comma-separated), search (search/q in title, description, shortDescription, genre, tags with regex). Sort, fields, skip/limit. getAllTags and getRelatedProducts delegate to `aggregations/product.aggregations.js`. createProduct/updateProduct/deleteProduct/updateProductCoverImage use Product model.
- **Aggregations:** `src/aggregations/product.aggregations.js` — getAllDistinctTags: match products with tags, $unwind, $group by tag, sort, project. getRelatedByTags: find product’s tags, aggregate products with $in tags, $addFields matchCount ($setIntersection size), sort by matchCount desc, limit.
- **Review controller:** `src/controllers/review.controller.js` — getReviews: ensure product exists, paginate (page, limit max 50), sort; returns summary (from product’s reviewCount/positiveCount), reviews (populated user name/profilePicture), meta (total, page, limit, totalPages). createOrUpdateReview/deleteMyReview/getMyReview use reviewService with req.user.id.
- **Review service:** `src/services/review.service.js` — createOrUpdateReview: findOneAndUpdate with upsert on { user, product }; then updateProductReviewStats (aggregate review count, avg rating, positive count, update Product). deleteReview: findOneAndDelete then updateProductReviewStats. getReviewsForProduct: find + populate user, sort, skip, limit; countDocuments for total. Positive = rating ≥ 4.
- **Utils:** `src/utils/reviewSummary.js` — getReviewSummary(reviewCount, positiveCount): if total < 5 return “No reviews yet” or “Need more reviews”; else percentPositive and label (Overwhelmingly Positive down to Overwhelmingly Negative by thresholds).
- **Validators:** `src/validators/product.schema.js` — createProductSchema (title, description, shortDescription, price, platform enum, genre, stock, isOnSale, discountedPrice < price, youtubeLinks max 3, tags max 20 normalized); updateProductSchema same fields optional. `src/validators/review.schema.js` — rating 1–5, comment max 2000.

**Flow:** List only returns isActive products. Single product: rating/reviewCount/positiveCount come from Product; reviewSummary computed for response. Reviews: one per user per product (upsert); on create/update/delete we recompute product stats via aggregation and update Product.

---

## Interview Q&A

**How does “related products” work?**  
We use a MongoDB aggregation. Load the current product’s tags; match other active products that have at least one tag in common, add a field for number of matching tags ($setIntersection), sort by that count descending then _id, limit to 6 (or query limit 1–20). Implemented in product.aggregations.getRelatedByTags.

**How is the Steam-style review summary computed?**  
We store reviewCount and positiveCount (rating ≥ 4) on the Product. When reviews are added/updated/deleted we run an aggregation over reviews for that product to get count, average rating, and positive count, then update the product. The API uses getReviewSummary(reviewCount, positiveCount) to return a label (e.g. “Very Positive”) and percentPositive; if total reviews < 5 we return “No reviews yet” or “Need more reviews”.

**Why one review per user per product?**  
We use findOneAndUpdate with upsert on { user, product }, so the same user can only have one review per product; submitting again replaces it. This keeps the model simple and matches “my review” UX.

**How is search implemented?**  
Query params `search` or `q` are used to build a case-insensitive regex against title, description, shortDescription, genre, and tags. We escape regex special characters so the term is treated literally. Combined with other filters (platform, genre, tags, price) in the same find.

**How do tags work for filtering and autocomplete?**  
Tags are stored on each product as an array of strings (normalized lowercase, max 20, each max 50 chars). List products accepts `tag` or `tags` (comma-separated). GET /products/tags returns all distinct tags across products via aggregation (for admin autocomplete when creating/editing products).

**What happens when we delete a product?**  
findByIdAndDelete removes the document. Orders and invoices keep snapshot data; cart and reviews may still reference the ID—depending on app logic we might filter inactive products in cart or leave referential integrity to application layer.

---

## Key takeaways

- Only active products (isActive: true) appear in list; admin can soft-hide with isActive.
- Sale: isOnSale + discountedPrice; cart/checkout use discountedPrice when set; validated discountedPrice < price.
- Tags: normalized (trim, lowercase), max 20 per product; used for filtering and related-products aggregation.
- Reviews: one per user per product (upsert); product stores reviewCount, positiveCount, rating; summary label from utils/reviewSummary.
- Related products: aggregation by shared tags, ranked by number of matching tags.
- Product image: Multer (field `image`) → S3 key products/:id/cover-*.jpg → product.coverImage URL.
- CRUD and image upload require admin or manager role.
