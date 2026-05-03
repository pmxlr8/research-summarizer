import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { APIGatewayProxyEvent } from "aws-lambda";

const fixture = readFileSync(join(__dirname, "fixtures/arxiv-transformer.xml"), "utf-8");

function makeEvent(qs: Record<string, string>): APIGatewayProxyEvent {
  return {
    queryStringParameters: qs,
    requestContext: { requestId: "test" } as any,
  } as any;
}

// Stub the global fetch so the handler hits our fixture instead of the network.
function stubFetchOnce(body: string, status = 200) {
  return vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(body, { status }) as unknown as Response
  );
}

describe("search handler", () => {
  it("rejects missing q", async () => {
    const { handler } = await import("../handlers/search");
    const res = await handler(makeEvent({}));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error).toBe("invalid_query");
  });

  it("rejects q too long", async () => {
    const { handler } = await import("../handlers/search");
    const res = await handler(makeEvent({ q: "x".repeat(201) }));
    expect(res.statusCode).toBe(400);
  });

  it("rejects max_results out of range", async () => {
    const { handler } = await import("../handlers/search");
    const res = await handler(makeEvent({ q: "t", max_results: "999" }));
    expect(res.statusCode).toBe(400);
  });

  it("rejects non-integer max_results", async () => {
    const { handler } = await import("../handlers/search");
    const res = await handler(makeEvent({ q: "t", max_results: "abc" }));
    expect(res.statusCode).toBe(400);
  });

  it("happy path returns Paper[]", async () => {
    stubFetchOnce(fixture, 200);
    const { handler } = await import("../handlers/search");
    const res = await handler(makeEvent({ q: "transformer", max_results: "2" }));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    const p = body[0];
    expect(p).toHaveProperty("id");
    expect(p).toHaveProperty("title");
    expect(p).toHaveProperty("authors");
    expect(p).toHaveProperty("year");
    expect(p).toHaveProperty("pdfUrl");
  });

  it("upstream 503 returns 502 after retries exhaust", async () => {
    // Always return 503 so all 3 retry attempts fail.
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("oops", { status: 503 }) as unknown as Response
    );
    const { handler } = await import("../handlers/search");
    const res = await handler(makeEvent({ q: "transformer" }));
    expect(res.statusCode).toBe(502);
    expect(JSON.parse(res.body).error).toBe("upstream_error");
  }, 30_000);
});