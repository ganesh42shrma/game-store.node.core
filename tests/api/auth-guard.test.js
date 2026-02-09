const request = require("supertest");
const app = require("../../src/app");

describe("Protected routes", () => {
  it("GET /api/users/me without token returns 401", async () => {
    const res = await request(app).get("/api/users/me");

    expect(res.status).toBe(401);
  });

  it("GET /api/addresses without token returns 401", async () => {
    const res = await request(app).get("/api/addresses");

    expect(res.status).toBe(401);
  });
});
