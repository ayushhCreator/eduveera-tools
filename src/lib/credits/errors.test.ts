import { describe, expect, it } from "vitest";
import { mapPostgresError } from "./errors";

describe("mapPostgresError", () => {
  it("maps every custom exception raised by the credit functions", () => {
    expect(mapPostgresError({ message: "insufficient_credits" }).code).toBe("INSUFFICIENT_CREDITS");
    expect(mapPostgresError({ message: "insufficient_balance" }).code).toBe("INSUFFICIENT_CREDITS");
    expect(mapPostgresError({ message: "payment_not_pending" }).code).toBe("CONFLICT");
    expect(mapPostgresError({ message: "zero_amount" }).code).toBe("VALIDATION");
    expect(mapPostgresError({ message: "reason_required" }).code).toBe("VALIDATION");
    expect(mapPostgresError({ message: "unknown_tool" }).code).toBe("VALIDATION");
    expect(mapPostgresError({ message: "user_not_found" }).code).toBe("NOT_FOUND");
  });

  it("falls back to INTERNAL for anything unrecognized, never a guess", () => {
    expect(mapPostgresError({ message: "some unexpected pg error" }).code).toBe("INTERNAL");
  });
});
