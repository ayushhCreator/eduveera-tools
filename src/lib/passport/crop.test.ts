import { describe, expect, it } from "vitest";
import { resolveCropDrawPlan } from "./crop";
import { PASSPORT_PHOTO_DIMENSIONS } from "./config";

describe("resolveCropDrawPlan", () => {
  it("maps the reported crop area to the passport photo output size by default", () => {
    const plan = resolveCropDrawPlan({ x: 10, y: 20, width: 300, height: 400 });

    expect(plan.source).toEqual({ x: 10, y: 20, width: 300, height: 400 });
    expect(plan.destination).toEqual({
      width: PASSPORT_PHOTO_DIMENSIONS.widthPx,
      height: PASSPORT_PHOTO_DIMENSIONS.heightPx,
    });
  });

  it("accepts an override output size (the seam a future A4 sheet layout would use)", () => {
    const plan = resolveCropDrawPlan({ x: 0, y: 0, width: 100, height: 100 }, { widthPx: 800, heightPx: 600 });

    expect(plan.destination).toEqual({ width: 800, height: 600 });
  });
});
