const request = require("supertest");
const app = require("../../src/app");

describe("Health API", () => {
  it("GET /health returns 200 and status ok", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "ok");
    expect(res.body).toHaveProperty("uptime");
    expect(res.body).toHaveProperty("timestamp");
  });
});
