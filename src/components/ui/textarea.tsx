import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const controlVariants = cva(
  "flex field-sizing-content min-h-96 leading-relaxed w-full rounded-xl border border-input bg-field px-5 py-4 text-base transition-[border-color,box-shadow,background-color] duration-(--motion-quick) outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:duration-0 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-base dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
  {
    variants: {
      variant: {
        default: "",
        group:
          "flex-1 resize-none rounded-none border-0 bg-transparent py-2 shadow-none ring-0 focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0 dark:bg-transparent dark:disabled:bg-transparent",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Textarea({
  className,
  variant,
  ...props
}: React.ComponentProps<"textarea"> & VariantProps<typeof controlVariants>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(controlVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Textarea };
