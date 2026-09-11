import { describe, expect, it } from "vitest";
import {
  buildExpressionReport,
  countNeutralOrBelow,
  isNeutralOrBelow,
  type ExpressionSample,
} from "./expressions";

function sample(expression: string, timestamp = 0): ExpressionSample {
  return { expression, confidence: 0.9, timestamp };
}

describe("isNeutralOrBelow", () => {
  it("treats neutral as at the threshold", () => {
    expect(isNeutralOrBelow("neutral")).toBe(true);
  });

  it("includes expressions ranked below neutral", () => {
    expect(isNeutralOrBelow("sad")).toBe(true);
    expect(isNeutralOrBelow("fearful")).toBe(true);
    expect(isNeutralOrBelow("angry")).toBe(true);
    expect(isNeutralOrBelow("disgusted")).toBe(true);
  });

  it("excludes expressions ranked above neutral", () => {
    expect(isNeutralOrBelow("happy")).toBe(false);
    expect(isNeutralOrBelow("surprised")).toBe(false);
  });

  it("ignores unknown expressions", () => {
    expect(isNeutralOrBelow("unknown")).toBe(false);
    expect(isNeutralOrBelow("")).toBe(false);
  });
});

describe("countNeutralOrBelow", () => {
  it("returns 0 for an empty session", () => {
    expect(countNeutralOrBelow([])).toBe(0);
  });

  it("counts only samples at or below neutral", () => {
    const history = [
      sample("happy"),
      sample("neutral"),
      sample("surprised"),
      sample("sad"),
      sample("angry"),
      sample("disgusted"),
      sample("fearful"),
    ];

    expect(countNeutralOrBelow(history)).toBe(5);
  });

  it("does not count unknown labels", () => {
    expect(countNeutralOrBelow([sample("neutral"), sample("???")])).toBe(1);
  });
});

describe("buildExpressionReport", () => {
  it("summarizes session samples for reporting", () => {
    const report = buildExpressionReport([
      sample("happy"),
      sample("neutral"),
      sample("sad"),
    ]);

    expect(report).toEqual({
      totalSamples: 3,
      neutralOrBelowCount: 2,
    });
  });
});
