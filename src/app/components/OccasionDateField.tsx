import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { TZDate } from "react-day-picker";
import {
  Button,
  Calendar,
  Field,
  FieldLabel,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../../components/ui";
import { calendarDay, formatDate } from "../../domain/rental";

const timeZone = "Asia/Manila";

function calendarDate(value: string): Date | undefined {
  if (calendarDay(value) === null) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  const date = new TZDate(0, timeZone);
  // setFullYear preserves years 0000–0099; noon avoids historical offset edges.
  date.setFullYear(year, month - 1, day);
  date.setHours(12, 0, 0, 0);
  return date;
}

function dateValue(date: Date): string {
  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function OccasionDateField({
  id,
  label,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = calendarDate(value);

  return (
    <Field appearance="inset" data-invalid={!!error}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="date"
            size="date"
            id={id}
            data-empty={!selected}
            aria-invalid={!!error}
            aria-describedby={
              [selected && `${id}-value`, error && `${id}-error`]
                .filter(Boolean)
                .join(" ") || undefined
            }
          >
            <span id={`${id}-value`}>
              {selected ? formatDate(value) : "Choose date"}
            </span>
            <CalendarIcon data-icon="inline-end" aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          variant="calendar"
          align="start"
          collisionPadding={8}
          aria-label={label}
        >
          <Calendar
            key={value}
            mode="single"
            required
            selected={selected}
            defaultMonth={selected}
            today={new TZDate(Date.now(), timeZone)}
            timeZone={timeZone}
            noonSafe
            autoFocus
            onSelect={(date) => {
              onChange(date ? dateValue(date) : "");
              setOpen(false);
            }}
          />
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            Clear date
          </Button>
        </PopoverContent>
      </Popover>
      {error && (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </Field>
  );
}
