import type { FormEvent, RefObject } from "react";
import { OccasionDateField } from "./";
import { ArrowRight } from "lucide-react";
import {
  Button,
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "../../components/ui";
import {
  sampleOccasion,
  validateOccasion,
  type Occasion,
} from "../../domain/rental";
export function OccasionForm({
  occasion,
  onChange,
  onContinue,
  attempted,
  headingRef,
}: {
  occasion: Occasion;
  onChange: (next: Occasion) => void;
  onContinue: () => void;
  attempted: boolean;
  headingRef: RefObject<HTMLHeadingElement | null>;
}) {
  const errors = validateOccasion(occasion);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onContinue();
  };
  const dates = [
    { key: "collection", label: "Collection date" },
    { key: "event", label: "Event date" },
    { key: "returnDate", label: "Return date" },
  ] as const;
  return (
    <form onSubmit={submit} noValidate className="occasion-form">
      <div className="form-heading">
        <h1 ref={headingRef} tabIndex={-1}>
          Start with <em>your occasion</em>
        </h1>
        <p>
          Choose two dresses, compare the full cost, and ask the shop.
          Start with your dates and budget.
        </p>
      </div>
      <FieldGroup>
        <div className="date-fields">
          <FieldGroup>
            {dates.map(({ key, label }) => (
              <OccasionDateField
                key={key}
                id={key}
                label={label}
                value={occasion[key]}
                error={attempted ? errors[key] : undefined}
                onChange={(value) => onChange({ ...occasion, [key]: value })}
              />
            ))}
          </FieldGroup>
        </div>
        <Field data-invalid={attempted && !!errors.budget}>
          <Field appearance="inset" data-invalid={attempted && !!errors.budget}>
            <FieldLabel htmlFor="budget">
              Total cash available by collection
            </FieldLabel>
            <InputGroup variant="inset">
              <InputGroupInput
                variant="inset"
                id="budget"
                inputMode="decimal"
                value={occasion.budget}
                aria-invalid={attempted && !!errors.budget}
                aria-describedby={`budget-help${attempted && errors.budget ? " budget-error" : ""}`}
                onChange={(event) =>
                  onChange({ ...occasion, budget: event.target.value })
                }
              />
              <InputGroupAddon aria-hidden="true">₱</InputGroupAddon>
            </InputGroup>
          </Field>
          <FieldDescription id="budget-help">
            In Philippine pesos (PHP). Your limit includes rent, mandatory fees
            and security—even if security may be returned later.
          </FieldDescription>
          {attempted && errors.budget && (
            <p id="budget-error" className="field-error">
              {errors.budget}
            </p>
          )}
        </Field>
      </FieldGroup>
      <Button type="submit" size="lg">
        Find dresses <ArrowRight data-icon="inline-end" />
      </Button>
      <div className="sample-dates">
        <p>
          Try the sample occasion: collection Nov 7, event Nov 8, return Nov 9,
          2026. All dates use Asia/Manila.
        </p>
        <Button
          type="button"
          variant="link"
          onClick={() => onChange({ ...sampleOccasion })}
        >
          Use sample dates and ₱2,000 limit
        </Button>
      </div>
      <p className="package-note">
        One flat package, up to 3 inclusive calendar days. Local pickup; return
        to the shop by 6 PM.
      </p>
    </form>
  );
}
