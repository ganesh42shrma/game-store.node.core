/**
 * End-to-end test: full flow from login → address → cart → order → payment → invoice.
 * Run with: node src/scripts/test-full-flow.js
 * Requires: server running (npm run dev), at least one product (npm run seed:games).
 *
 * Env:
 *   BASE_URL          - API base (default http://localhost:5000)
 *   TEST_USER_EMAIL   - If set, run flow as this user (e.g. ganesh@gamestore.com)
 *   TEST_USER_PASSWORD - Password for TEST_USER_EMAIL (e.g. ganu1234)
 *   TEST_USER_NAME    - Name for register if user does not exist (default "Test User")
 * If TEST_USER_* are not set, uses admin (admin@gamestore.com / admin123). Admin flow includes GET /api/admin/invoices.
 *
 * Example (user flow): TEST_USER_EMAIL=ganesh@gamestore.com TEST_USER_PASSWORD=ganu1234 node src/scripts/test-full-flow.js
 */

const BASE = process.env.BASE_URL || "http://localhost:5000";
const USER_EMAIL = process.env.TEST_USER_EMAIL;
const USER_PASSWORD = process.env.TEST_USER_PASSWORD;
const USER_NAME = process.env.TEST_USER_NAME || "Test User";
const USE_USER = Boolean(USER_EMAIL && USER_PASSWORD);
const ADMIN_EMAIL = "admin@gamestore.com";
const ADMIN_PASSWORD = "admin123";

function log(step, message, detail = "") {
    console.log(`\n[${step}] ${message}`);
    if (detail) console.log(detail);
}

async function request(method, path, body = null, token = null) {
    const url = `${BASE}${path}`;
    const opts = {
        method,
        headers: { "Content-Type": "application/json" },
    };
    if (token) opts.headers["Authorization"] = `Bearer ${token}`;
    if (body != null) opts.body = JSON.stringify(body);
    const res = await fetch(url, opts);
    const text = await res.text();
    let data = null;
    try {
        data = text ? JSON.parse(text) : null;
    } catch (_) {
        data = { _raw: text };
    }
    return { status: res.status, data };
}

function assertSuccess(res, step) {
    if (res.status >= 200 && res.status < 300) return;
    throw new Error(
        `${step}: expected 2xx, got ${res.status} – ${JSON.stringify(res.data)}`
    );
}

function getId(data, field = "_id") {
    const id = data?.data?.[field] ?? data?.data?.id ?? data?.[field];
    if (id) return typeof id === "string" ? id : String(id);
    return null;
}

async function main() {
    console.log("=== Full flow test ===");
    console.log("Base URL:", BASE);
    console.log("Mode:", USE_USER ? `User (${USER_EMAIL})` : "Admin");

    let token = null;
    let productId = null;
    let addressId = null;
    let orderId = null;
    let paymentId = null;
    let invoiceId = null;

    // 1. Health
    log("1", "GET /health");
    const health = await request("GET", "/health");
    assertSuccess(health, "Health");
    log("1", "OK", health.data?.status);

    // 2. Login (user or admin)
    const loginEmail = USE_USER ? USER_EMAIL : ADMIN_EMAIL;
    const loginPassword = USE_USER ? USER_PASSWORD : ADMIN_PASSWORD;
    log("2", "POST /api/auth/login", loginEmail);
    let login = await request("POST", "/api/auth/login", {
        email: loginEmail,
        password: loginPassword,
    });
    if (USE_USER && login.status === 401) {
        log("2", "Login failed, registering user then retrying login");
        const reg = await request("POST", "/api/auth/register", {
            email: USER_EMAIL,
            password: USER_PASSWORD,
            name: USER_NAME,
        });
        assertSuccess(reg, "Register");
        login = await request("POST", "/api/auth/login", {
            email: loginEmail,
            password: loginPassword,
        });
    }
    assertSuccess(login, "Login");
    token = login.data?.data?.token || login.data?.token;
    if (!token) throw new Error("Login: no token in response");
    log("2", "OK", "Token received");

    // 3. Get first product (admin can create if none)
    log("3", "GET /api/products?limit=1");
    const products = await request("GET", "/api/products?limit=1", null, token);
    assertSuccess(products, "Products list");
    const list = products.data?.data ?? products.data ?? [];
    if (Array.isArray(list) && list.length > 0) {
        productId = list[0]._id || list[0].id;
    }
    if (!productId && !USE_USER) {
        log("3", "No products, creating one (admin)");
        const create = await request(
            "POST",
            "/api/products",
            {
                title: "Flow Test Game",
                description: "For e2e test",
                price: 29.99,
                platform: "PC",
                genre: "RPG",
                stock: 10,
            },
            token
        );
        assertSuccess(create, "Create product");
        productId = getId(create.data);
    }
    if (!productId) throw new Error("No productId – ensure at least one product exists (e.g. npm run seed:games)");
    log("3", "OK", "productId: " + productId);

    // 4. Ensure we have an address for checkout (user may have none yet – create one)
    log("4", "POST /api/addresses (create address for current user so order has billing address)");
    const addr = await request(
        "POST",
        "/api/addresses",
        {
            line1: "123 Test St",
            city: "Mumbai",
            state: "Maharashtra",
            pincode: "400001",
            country: "India",
            isDefault: true,
        },
        token
    );
    assertSuccess(addr, "Create address – user must have at least one address for checkout");
    addressId = getId(addr.data);
    if (!addressId) throw new Error("Create address did not return addressId");
    log("4", "OK", "addressId: " + addressId);

    // 5. Add to cart
    log("5", "POST /api/cart/items");
    const cartAdd = await request(
        "POST",
        "/api/cart/items",
        { productId, quantity: 2 },
        token
    );
    assertSuccess(cartAdd, "Add to cart");
    log("5", "OK");

    // 6. Create order (checkout with address)
    log("6", "POST /api/orders (with addressId)");
    const order = await request(
        "POST",
        "/api/orders",
        { addressId },
        token
    );
    assertSuccess(order, "Create order");
    const orderData = order.data?.data ?? order.data;
    orderId = orderData?._id ?? orderData?.id;
    if (!orderId) orderId = getId(order.data);
    if (!orderId) throw new Error("No orderId");
    log("6", "OK", "orderId: " + orderId);
    const total = orderData?.totalAmount ?? order.data?.data?.totalAmount;
    if (total != null) log("6", "Order totalAmount: " + total);

    // 7. Create payment
    log("7", "POST /api/payments");
    const pay = await request(
        "POST",
        "/api/payments",
        { orderId, method: "mock_upi" },
        token
    );
    assertSuccess(pay, "Create payment");
    const payData = pay.data?.data ?? pay.data;
    paymentId = payData?.payment?._id ?? payData?.payment?.id ?? payData?._id ?? payData?.id;
    if (!paymentId) paymentId = getId(pay.data?.data?.payment || pay.data);
    if (!paymentId) throw new Error("No paymentId");
    const mockUrl = payData?.mockPaymentUrl ?? pay.data?.data?.mockPaymentUrl;
    log("7", "OK", "paymentId: " + paymentId + (mockUrl ? ", mockPaymentUrl: " + mockUrl : ""));

    // 8. Confirm payment
    log("8", "POST /api/payments/:id/confirm");
    const confirm = await request(
        "POST",
        `/api/payments/${paymentId}/confirm`,
        null,
        token
    );
    assertSuccess(confirm, "Confirm payment");
    log("8", "OK", "Payment captured, order marked paid");

    // 9. Get invoice by order
    log("9", "GET /api/orders/:orderId/invoice");
    const invByOrder = await request(
        "GET",
        `/api/orders/${orderId}/invoice`,
        null,
        token
    );
    assertSuccess(invByOrder, "Get invoice by order");
    const invData = invByOrder.data?.data ?? invByOrder.data;
    invoiceId = invData?._id ?? invData?.id;
    if (!invoiceId) invoiceId = getId(invByOrder.data);
    const invNumber = invData?.invoiceNumber;
    log("9", "OK", "invoiceId: " + invoiceId + (invNumber ? ", invoiceNumber: " + invNumber : ""));

    // 10. Get invoice by id
    log("10", "GET /api/invoices/:id");
    const invById = await request(
        "GET",
        `/api/invoices/${invoiceId}`,
        null,
        token
    );
    assertSuccess(invById, "Get invoice by id");
    log("10", "OK", "Invoice retrieved");

    // 11. Admin: list invoices (admin only; 403 is OK when running as user)
    log("11", "GET /api/admin/invoices (admin only)");
    const adminList = await request(
        "GET",
        "/api/admin/invoices?limit=5",
        null,
        token
    );
    if (adminList.status === 403) {
        log("11", "Skipped (requires admin role)");
    } else {
        assertSuccess(adminList, "Admin list invoices");
        const invoices = adminList.data?.data ?? adminList.data ?? [];
        const totalInvoices = adminList.data?.meta?.total ?? (Array.isArray(invoices) ? invoices.length : 0);
        log("11", "OK", "Invoices count: " + totalInvoices);
    }

    console.log("\n=== All steps passed ===\n");
}

main().catch((err) => {
    console.error("\nFAILED:", err.message);
    process.exit(1);
});
