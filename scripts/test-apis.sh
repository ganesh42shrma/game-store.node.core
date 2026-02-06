#!/usr/bin/env bash
# Test all APIs. Run from project root after: 1) node scripts/seed-admin.js  2) npm run dev (in another terminal)
# Usage: ./scripts/test-apis.sh   or   bash scripts/test-apis.sh

BASE="${BASE_URL:-http://localhost:5000}"
echo "Base URL: $BASE"
echo ""

# --- Health ---
echo "=== GET /health ==="
curl -s -w "\nHTTP %{http_code}\n" "$BASE/health" | tail -3
echo ""

# --- Auth: Login (admin from seed) ---
echo "=== POST /api/auth/login ==="
LOGIN=$(curl -s -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@gamestore.com","password":"admin123"}')
echo "$LOGIN" | head -c 200
echo "..."
TOKEN=$(echo "$LOGIN" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).data?.token||'')}catch(e){console.log('')}})")
if [ -z "$TOKEN" ]; then
  echo "Login failed - no token. Is the server running and admin user seeded? (node scripts/seed-admin.js)"
  exit 1
fi
echo "Token received."
echo ""

# --- Products (public) ---
echo "=== GET /api/products ==="
curl -s -w "\nHTTP %{http_code}\n" "$BASE/api/products?limit=2" | tail -5
echo ""

# --- Users (admin) ---
echo "=== GET /api/users ==="
curl -s -w "\nHTTP %{http_code}\n" -H "Authorization: Bearer $TOKEN" "$BASE/api/users?limit=2" | tail -5
echo ""

# --- Cart ---
echo "=== GET /api/cart ==="
curl -s -w "\nHTTP %{http_code}\n" -H "Authorization: Bearer $TOKEN" "$BASE/api/cart" | tail -5
echo ""

# --- Add product first so we can add to cart (if no products, create one as admin) ---
echo "=== POST /api/products (create one for cart test) ==="
PRODUCT_CREATE=$(curl -s -X POST "$BASE/api/products" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"title":"Test Game","description":"A game","price":19.99,"platform":"PC","genre":"RPG","stock":10}')
PRODUCT_ID=$(echo "$PRODUCT_CREATE" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(d).data?._id||'')}catch(e){console.log('')}})")
echo "Created product id: $PRODUCT_ID"

if [ -n "$PRODUCT_ID" ]; then
  echo "=== POST /api/cart/items ==="
  curl -s -w "\nHTTP %{http_code}\n" -X POST "$BASE/api/cart/items" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"productId\":\"$PRODUCT_ID\",\"quantity\":2}" | tail -5
  echo ""

  echo "=== GET /api/cart (after add) ==="
  curl -s -w "\nHTTP %{http_code}\n" -H "Authorization: Bearer $TOKEN" "$BASE/api/cart" | tail -8
  echo ""

  echo "=== POST /api/orders (checkout) ==="
  curl -s -w "\nHTTP %{http_code}\n" -X POST "$BASE/api/orders" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{}' | tail -8
  echo ""
fi

# --- Orders list ---
echo "=== GET /api/orders ==="
curl -s -w "\nHTTP %{http_code}\n" -H "Authorization: Bearer $TOKEN" "$BASE/api/orders?limit=2" | tail -8
echo ""

echo "=== Done ==="
