import { describe, expect, it } from "vitest";
import { loadFaceApi } from "./face-api-client";

describe("face-api client loader", () => {
  it("stays off the node bundle and rejects without a browser window", async () => {
    await expect(loadFaceApi()).rejects.toThrow(/browser only/);
  });
});
