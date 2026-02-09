const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../../src/app");

const hasMongo = Boolean(process.env.MONGODB_URI);

const describeProducts = hasMongo ? describe : describe.skip;

describeProducts("Products API (CRUD)", () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(process.env.MONGODB_URI);
    }
  });

  afterAll(async () => {
    await mongoose.disconnect().catch(() => {});
  });

  describe("GET /api/products", () => {
    it("returns 200 and list with success and data", async () => {
      const res = await request(app).get("/api/products");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("success", true);
      expect(res.body).toHaveProperty("data");
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("accepts query params (page, limit)", async () => {
      const res = await request(app)
        .get("/api/products")
        .query({ page: 1, limit: 5 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeLessThanOrEqual(5);
    });
  });

  describe("GET /api/products/tags", () => {
    it("returns 200 and tags array", async () => {
      const res = await request(app).get("/api/products/tags");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("success", true);
      expect(res.body).toHaveProperty("data");
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe("GET /api/products/:id", () => {
    it("returns 404 for non-existent product id", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app).get(`/api/products/${fakeId}`);

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty("success", false);
      expect(res.body).toHaveProperty("message", "Product not found");
    });

    it("returns 200 and product when id exists", async () => {
      const listRes = await request(app).get("/api/products").query({ limit: 1 });
      if (listRes.body.data.length === 0) {
        return;
      }
      const id = listRes.body.data[0]._id;
      const res = await request(app).get(`/api/products/${id}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("success", true);
      expect(res.body.data).toHaveProperty("_id", id);
      expect(res.body.data).toHaveProperty("title");
    });
  });
});
