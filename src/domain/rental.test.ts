import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { catalog } from "../data/catalog";
import { Comparison, DressCard } from "../app/components";
import type { TryOn } from "../app/tryOn/useTryOn";
import {
  calendarDay,
  createInquiry,
  evaluateDress,
  parseBudget,
  reconcileSelection,
  sampleOccasion,
  validateOccasion,
} from "./rental";
const sage = catalog[0],
  midnight = catalog[1];
const tryOn: TryOn = {
  config: null,
  available: false,
  consent: false,
  setConsent() {},
  photo: null,
  photoError: "",
  preparing: false,
  async choosePhoto() {},
  removePhoto() {},
  createLooks() {},
  previewFailed() {},
  lookFor: () => undefined,
};
describe("rental rules across displayed and saved consumers", () => {
  it("credits reservation once, includes fees and security, and distinguishes cash eligibility", () => {
    expect(evaluateDress(sage, sampleOccasion)).toMatchObject({
      rentalCost: 90000,
      reservation: 40000,
      remaining: 200000,
      total: 240000,
      budgetStatus: "over",
    });
    expect(evaluateDress(midnight, sampleOccasion)).toMatchObject({
      rentalCost: 100000,
      reservation: 47500,
      remaining: 102500,
      total: 150000,
      budgetStatus: "within",
    });
    for (const dress of catalog) {
      const quote = evaluateDress(dress, sampleOccasion);
      if (quote.total !== null)
        expect(quote.reservation + quote.remaining!).toBe(quote.total);
    }
  });
  it("renders the same current amount and warnings in real card, comparison and inquiry consumers", () => {
    const card = renderToStaticMarkup(
      createElement(DressCard, {
        dress: sage,
        occasion: sampleOccasion,
        selected: true,
        full: true,
        onToggle() {},
      }),
    );
    const comparison = renderToStaticMarkup(
      createElement(Comparison, {
        dresses: [sage, midnight],
        occasion: sampleOccasion,
        preferred: "midnight",
        onPrefer() {},
        tryOn,
      }),
    );
    expect(card).toContain("₱2,400");
    expect(comparison).toContain("₱2,400");
    expect(comparison).toContain("₱1,025");
    expect(createInquiry(sage, sampleOccasion)).toContain(
      "Total cash through collection: ₱2,400",
    );
    const changed = { ...sampleOccasion, budget: "1000" };
    expect(
      renderToStaticMarkup(
        createElement(Comparison, {
          dresses: [sage, midnight],
          occasion: changed,
          preferred: "midnight",
          onPrefer() {},
          tryOn,
        }),
      ).match(/Over your cash limit/g),
    ).toHaveLength(2);
    expect(createInquiry(midnight, changed)).toContain(
      "Budget status: Over your cash limit.",
    );
  });
  it("does not turn unknown charges into an affordable total or omit them from inquiry", () => {
    const champagne = catalog[4],
      quote = evaluateDress(champagne, sampleOccasion);
    expect(quote).toMatchObject({
      total: null,
      remaining: null,
      knownSubtotal: 140000,
      budgetStatus: "unknown",
    });
    const inquiry = createInquiry(champagne, sampleOccasion);
    expect(inquiry).toContain("Mandatory fee: unknown");
    expect(inquiry).toContain("known subtotal ₱1,400");
    expect(inquiry).toContain("Unknown charges: mandatory fee");
    expect(evaluateDress(catalog[3], sampleOccasion).dateStatus).toBe(
      "unknown",
    );
  });
  it("uses inclusive overlaps and removes conflicting selections without duplicating IDs", () => {
    expect(evaluateDress(catalog[2], sampleOccasion)).toMatchObject({
      dateStatus: "conflict",
      selectable: false,
    });
    const earlier = {
      ...sampleOccasion,
      collection: "2026-11-05",
      event: "2026-11-06",
      returnDate: "2026-11-07",
    };
    expect(evaluateDress(catalog[2], earlier).dateStatus).toBe("clear");
    expect(
      reconcileSelection(["rose", "midnight"], catalog, sampleOccasion),
    ).toEqual(["midnight"]);
    expect(
      reconcileSelection(["sage", "sage"], catalog, sampleOccasion),
    ).toEqual(["sage"]);
    const boundary = {
      ...sampleOccasion,
      collection: "2026-11-10",
      event: "2026-11-10",
      returnDate: "2026-11-10",
    };
    expect(evaluateDress(catalog[2], boundary).dateStatus).toBe("conflict");
  });
  it("validates calendar dates, three inclusive days, event inclusion and centavo precision", () => {
    expect(calendarDay("2026-02-30")).toBeNull();
    expect(calendarDay("2028-02-29")).not.toBeNull();
    expect(validateOccasion(sampleOccasion)).toEqual({});
    expect(
      validateOccasion({ ...sampleOccasion, returnDate: "2026-11-10" }),
    ).toHaveProperty("returnDate");
    expect(
      validateOccasion({ ...sampleOccasion, returnDate: "2026-11-06" }),
    ).toHaveProperty("returnDate");
    expect(
      validateOccasion({ ...sampleOccasion, event: "2026-11-10" }),
    ).toHaveProperty("event");
    expect(parseBudget("2000.01")).toBe(200001);
    for (const invalid of [
      "-1",
      "0",
      "1.001",
      "Infinity",
      "",
      "9e9",
      "99999999999999999",
    ])
      expect(parseBudget(invalid)).toBeNull();
  });
  it("preserves confirmation, fit, return, refund and sample context in saved text", () => {
    const text = createInquiry(midnight, sampleOccasion);
    for (const part of [
      "AMI-02",
      "Nov 7, 2026",
      "Nov 8, 2026",
      "Nov 9, 2026",
      "Asia/Manila",
      "physical fitting",
      "by 6 PM",
      "local shop pickup",
      "refund timing",
      "not a booking",
      "YouCam is not connected",
    ])
      expect(text).toContain(part);
    expect(text).not.toContain("<img");
  });
});
describe("personal previews change pictures, not money", () => {
  it("shows a YouCam result beside the original reference with identical cash rows", () => {
    const render = (lookFor: TryOn["lookFor"]) =>
      renderToStaticMarkup(
        createElement(Comparison, {
          dresses: [sage, midnight],
          occasion: sampleOccasion,
          preferred: null,
          onPrefer() {},
          tryOn: { ...tryOn, available: true, lookFor },
        }),
      );
    const plain = render(() => undefined);
    const previewed = render((id) =>
      id === "sage"
        ? { status: "success", taskId: "task-123456", imageUrl: "https://example.test/look.jpg", refreshed: false }
        : { status: "running", taskId: "task-654321" },
    );
    const table = (html: string) => html.slice(html.indexOf("<table"), html.indexOf("</table>"));
    expect(table(previewed)).toBe(table(plain));
    expect(previewed).toContain('src="https://example.test/look.jpg"');
    expect(previewed).toContain("YouCam AI preview");
    expect(previewed).toContain("Original sage wrap reference");
    expect(previewed).toContain("Creating your look");
    expect(previewed.match(/Illustrative image/g)?.length).toBeGreaterThanOrEqual(1);
  });
});
