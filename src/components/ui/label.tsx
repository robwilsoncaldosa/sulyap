import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Label as LabelPrimitive } from "radix-ui";

const labelVariants = cva(
  "flex items-center text-sm leading-snug font-medium select-none transition-colors duration-(--motion-quick)",
  {
    variants: {
      variant: {
        default: "gap-2",
        field:
          "group/field-label peer/field-label flex w-fit gap-2 leading-snug group-data-[disabled=true]/field:opacity-50 has-data-checked:border-primary/30 has-data-checked:bg-primary/5 has-[>[data-slot=field]]:rounded-lg has-[>[data-slot=field]]:border has-[>[data-slot=field]]:not-has-[:disabled,[data-disabled]]:hover:bg-muted/50 has-[>[data-slot=field]]:has-[:focus-visible]:border-ring has-[>[data-slot=field]]:has-[:focus-visible]:ring-3 has-[>[data-slot=field]]:has-[:focus-visible]:ring-ring/50 *:data-[slot=field]:p-2.5 dark:has-data-checked:border-primary/20 dark:has-data-checked:bg-primary/10",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Label({
  className,
  variant,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root> &
  VariantProps<typeof labelVariants>) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(labelVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Label };
