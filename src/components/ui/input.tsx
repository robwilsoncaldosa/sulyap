import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const controlVariants = cva(
  "min-h-12 h-auto w-full min-w-0 rounded-lg border border-input bg-field px-3 py-3 text-base transition-[border-color,box-shadow,background-color] duration-(--motion-quick) outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:duration-0 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-base dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
  {
    variants: {
      variant: {
        default: "",
        inset: "flex-1 min-h-11 rounded-none border-0 bg-transparent p-0 text-lg tabular-nums focus-visible:outline-none! focus-visible:ring-0 aria-invalid:ring-0 md:text-lg dark:bg-transparent",
        group:
          "flex-1 rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 disabled:bg-transparent aria-invalid:ring-0 dark:bg-transparent dark:disabled:bg-transparent",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Input({
  className,
  variant,
  type,
  ...props
}: React.ComponentProps<"input"> & VariantProps<typeof controlVariants>) {
  return (
    <input
      type={type}
      data-slot="input"
      data-variant={variant}
      className={cn(controlVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Input };
