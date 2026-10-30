import { DressImage } from ".";
import { Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  Badge,
  Button,
  Stack,
} from "../../components/ui";
import {
  budgetMessage,
  dateMessage,
  evaluateDress,
  money,
  type Dress,
  type Occasion,
} from "../../domain/rental";
export function DressCard({
  dress,
  occasion,
  selected,
  full,
  onToggle,
}: {
  dress: Dress;
  occasion: Occasion;
  selected: boolean;
  full: boolean;
  onToggle: () => void;
}) {
  const quote = evaluateDress(dress, occasion);
  return (
    <article
      className={cn("dress-card", selected && "selected")}
      aria-label={dress.name}
    >
      <div
        className="dress-photo"
        style={{ viewTransitionName: selected ? `dress-${dress.id}` : undefined }}
      >
        <DressImage
          dress={dress}
          alt={`Illustrative AI-created model wearing ${dress.name.toLowerCase()}`}
          loading="lazy"
        />
        <span className="image-label">Illustrative image</span>
        {selected && (
          <span className="photo-selection">
            <Check aria-hidden="true" /> Selected
          </span>
        )}
      </div>
      <div className="dress-info">
        <Stack>
          <div>
            <h2>{dress.name}</h2>
            <p className="muted">
              {dress.reference} · {dress.description}
            </p>
          </div>
          <div>
            <p>
              Rent <strong>{money(dress.rent)}</strong>
            </p>
            <p className="cash-total">
              {quote.total === null
                ? `${money(quote.knownSubtotal)} known subtotal`
                : `${money(quote.total)} total cash`}
            </p>
          </div>
          <Badge
            variant={quote.budgetStatus === "within" ? "secondary" : "outline"}
            data-status={quote.budgetStatus}
          >
            {budgetMessage(quote.budgetStatus)}
          </Badge>
          <p
            className={cn(
              "date-status",
              quote.dateStatus === "conflict" && "conflict",
            )}
          >
            {dateMessage(quote.dateStatus)}
          </p>
          <Accordion type="single" collapsible>
            <AccordionItem value="terms">
              <AccordionTrigger>Costs & sample terms</AccordionTrigger>
              <AccordionContent>
                <dl className="compact-costs">
                  <div>
                    <dt>Mandatory fee</dt>
                    <dd>{dress.fee === null ? "Unconfirmed" : money(dress.fee)}</dd>
                  </div>
                  <div>
                    <dt>Security</dt>
                    <dd>
                      {dress.security === null
                        ? "Unconfirmed"
                        : money(dress.security)}
                    </dd>
                  </div>
                  <div>
                    <dt>At reservation</dt>
                    <dd>{money(quote.reservation)}</dd>
                  </div>
                  <div>
                    <dt>Remaining by collection</dt>
                    <dd>
                      {quote.remaining === null
                        ? "Unconfirmed"
                        : money(quote.remaining)}
                    </dd>
                  </div>
                </dl>
                <p>
                  Reservation is credited toward rent. Cleaning included. Security
                  return is conditional on inspection and deductions; refund timing
                  is unconfirmed.
                </p>
                {dress.blocks?.length ? (
                  <p>Sample conflict: Nov 8–10, 2026 (inclusive).</p>
                ) : null}
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          <Button
            type="button"
            variant={selected ? "selected" : "outline"}
            aria-pressed={selected}
            disabled={!quote.selectable || (!selected && full)}
            onClick={onToggle}
          >
            {selected ? (
              <Check data-icon="inline-start" />
            ) : (
              <Plus data-icon="inline-start" />
            )}
            {selected
              ? "Remove from comparison"
              : quote.dateStatus === "conflict"
                ? "Unavailable for these dates"
                : full
                  ? "Two selected — remove one first"
                  : `Select ${dress.name}`}
          </Button>
        </Stack>
      </div>
    </article>
  );
}
