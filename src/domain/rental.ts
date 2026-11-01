import { brand } from "../brand";
export type Occasion = {
  collection: string;
  event: string;
  returnDate: string;
  budget: string;
};
export type Dress = {
  id: string;
  name: string;
  reference: string;
  description: string;
  image: string;
  rent: number;
  fee: number | null;
  security: number | null;
  blocks: { start: string; end: string }[] | null;
};
export const sampleOccasion: Occasion = {
  collection: "2026-11-07",
  event: "2026-11-08",
  returnDate: "2026-11-09",
  budget: "2000",
};
export const money = (centavos: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: centavos % 100 ? 2 : 0,
  }).format(centavos / 100);
export function calendarDay(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
    ? date.getTime() / 86400000
    : null;
}
export function parseBudget(value: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const [pesos, cents = ""] = value.split(".");
  const amount = Number(pesos) * 100 + Number(cents.padEnd(2, "0"));
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}
export function validateOccasion(
  occasion: Occasion,
): Partial<Record<keyof Occasion, string>> {
  const errors: Partial<Record<keyof Occasion, string>> = {};
  const start = calendarDay(occasion.collection),
    event = calendarDay(occasion.event),
    end = calendarDay(occasion.returnDate);
  if (start === null) errors.collection = "Choose a valid collection date.";
  if (event === null) errors.event = "Choose a valid event date.";
  if (end === null) errors.returnDate = "Choose a valid return date.";
  if (start !== null && end !== null) {
    if (end < start)
      errors.returnDate = "Return must be on or after collection.";
    else if (end - start > 2)
      errors.returnDate =
        "Rentals cover up to 3 inclusive calendar days. Choose a shorter range.";
    if (event !== null && (event < start || event > end))
      errors.event = "The event must fall between collection and return.";
  }
  if (parseBudget(occasion.budget) === null)
    errors.budget = "Enter a positive PHP amount with up to 2 decimal places.";
  return errors;
}
export function evaluateDress(dress: Dress, occasion: Occasion) {
  const start = calendarDay(occasion.collection),
    end = calendarDay(occasion.returnDate);
  const valid = Object.keys(validateOccasion(occasion)).length === 0;
  const dateStatus =
    !valid || start === null || end === null
      ? "invalid"
      : dress.blocks === null
        ? "unknown"
        : dress.blocks.some(
              (block) =>
                start <= calendarDay(block.end)! &&
                end >= calendarDay(block.start)!,
            )
          ? "conflict"
          : "clear";
  const reservation = Math.round(dress.rent / 2);
  const rentalCost = dress.fee === null ? null : dress.rent + dress.fee;
  const knownSubtotal = dress.rent + (dress.fee ?? 0) + (dress.security ?? 0);
  const total =
    rentalCost === null || dress.security === null
      ? null
      : rentalCost + dress.security;
  const remaining = total === null ? null : total - reservation;
  const budget = parseBudget(occasion.budget);
  const budgetStatus =
    total === null || budget === null
      ? "unknown"
      : total <= budget
        ? "within"
        : "over";
  return {
    dateStatus,
    reservation,
    rentalCost,
    knownSubtotal,
    total,
    remaining,
    budgetStatus,
    selectable: valid && dateStatus !== "conflict",
  };
}
export type Evaluation = ReturnType<typeof evaluateDress>;
export const dateMessage = (status: Evaluation["dateStatus"]) =>
  ({
    clear: "Calendar clear · confirm with shop",
    conflict: "Date conflict · cannot select",
    unknown: "Dates need confirmation",
    invalid: "Check your occasion details",
  })[status];
export const budgetMessage = (status: Evaluation["budgetStatus"]) =>
  ({
    within: "Within your cash limit",
    over: "Over your cash limit",
    unknown: "Total needs confirmation",
  })[status];
export function formatDate(value: string) {
  return calendarDay(value) === null
    ? value
    : new Intl.DateTimeFormat("en-PH", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "Asia/Manila",
      }).format(new Date(`${value}T00:00:00+08:00`));
}
export function reconcileSelection(
  ids: string[],
  dresses: Dress[],
  occasion: Occasion,
) {
  return ids
    .filter(
      (id, index) =>
        ids.indexOf(id) === index &&
        dresses.some(
          (dress) =>
            dress.id === id &&
            evaluateDress(dress, occasion).dateStatus !== "conflict",
        ),
    )
    .slice(0, 2);
}
export function createInquiry(dress: Dress, occasion: Occasion): string {
  const quote = evaluateDress(dress, occasion);
  const unknowns = [
    dress.fee === null ? "mandatory fee" : "",
    dress.security === null ? "security deposit" : "",
  ].filter(Boolean);
  return [
    `${brand.name} · Rental inquiry`,
    "For Amihan Occasion Studio (demo shop). This is an inquiry, not a booking, inventory hold, payment or sent message.",
    "",
    `Preferred dress: ${dress.name} (${dress.reference})`,
    `Collection: ${formatDate(occasion.collection)} · local shop pickup`,
    `Event: ${formatDate(occasion.event)}`,
    `Return: ${formatDate(occasion.returnDate)} · physically at the shop by 6 PM`,
    "All dates: Asia/Manila.",
    "",
    `My total-cash limit by collection: ${money(parseBudget(occasion.budget) ?? 0)}`,
    `Rental charge: ${money(dress.rent)}`,
    `Mandatory fee: ${dress.fee === null ? "unknown — please confirm" : money(dress.fee)}`,
    `Rental cost (rent + mandatory fee): ${quote.rentalCost === null ? "needs confirmation" : money(quote.rentalCost)}`,
    `Security deposit: ${dress.security === null ? "unknown — please confirm" : money(dress.security)}`,
    `At reservation (50% of rent, credited toward rent): ${money(quote.reservation)}`,
    `Remaining by collection (remaining rent + fees + security): ${quote.remaining === null ? `needs confirmation; known remaining subtotal ${money(quote.knownSubtotal - quote.reservation)}` : money(quote.remaining)}`,
    `Total cash through collection: ${quote.total === null ? `needs confirmation; known subtotal ${money(quote.knownSubtotal)}` : money(quote.total)}`,
    `Budget status: ${budgetMessage(quote.budgetStatus)}.`,
    `Date status: ${dateMessage(quote.dateStatus)}.`,
    ...(unknowns.length
      ? [
          `Unknown charges: ${unknowns.join(", ")}. Please provide a full quote before any payment.`,
        ]
      : []),
    "",
    "Please confirm availability for the full collection–return range; the online calendar is not a hold.",
    "Can I arrange a physical fitting, and can you confirm the size and physical fit before I reserve?",
    "Please confirm local pickup arrangements and physical return by 6 PM. Cleaning is included in the listed terms.",
    "Security is refundable only after inspection, subject to deductions. Please confirm deduction conditions and refund timing; neither a full refund nor its timing is guaranteed.",
    "Catalog photos are illustrative. Any AI try-on preview is not a size or fit check.",
  ].join("\n");
}
