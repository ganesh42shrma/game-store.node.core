const request = require("supertest");
const app = require("../../src/app");

describe("404 handling", () => {
  it("GET unknown route returns 404 with message", async () => {
    const res = await request(app).get("/api/unknown-resource");

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty("success", false);
    expect(res.body).toHaveProperty("message");
    expect(res.body.message).toMatch(/not found|Route not found/i);
  });
});
