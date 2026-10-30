import * as React from "react";
import { Accordion as AccordionPrimitive } from "radix-ui";
import { ChevronDownIcon } from "lucide-react";
import { LazyMotion, domAnimation, type Transition } from "motion/react";
import * as m from "motion/react-m";
import { cn } from "@/lib/utils";

const AccordionContext = React.createContext({
  value: "" as string | string[],
  instant: false,
});
const ItemContext = React.createContext(false);

function Accordion(props: React.ComponentProps<typeof AccordionPrimitive.Root>) {
  const [value, setValue] = React.useState<string | string[]>(
    props.defaultValue ?? (props.type === "multiple" ? [] : ""),
  );
  const [keyboard, setKeyboard] = React.useState(false);
  const [reducedMotion, setReducedMotion] = React.useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  React.useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, []);
  const shared = {
    "data-slot": "accordion",
    "data-instant": keyboard || !!reducedMotion,
    className: cn("flex w-full flex-col", props.className),
    onKeyDownCapture: (event: React.KeyboardEvent<HTMLDivElement>) => {
      setKeyboard(true);
      props.onKeyDownCapture?.(event);
    },
    onPointerDownCapture: (event: React.PointerEvent<HTMLDivElement>) => {
      setKeyboard(false);
      props.onPointerDownCapture?.(event);
    },
  };

  return (
    <LazyMotion features={domAnimation} strict>
      <AccordionContext.Provider
        value={{ value: props.value ?? value, instant: keyboard || !!reducedMotion }}
      >
        {props.type === "multiple" ? (
          <AccordionPrimitive.Root
            {...props}
            {...shared}
            onValueChange={(next: string[]) => {
              setValue(next);
              props.onValueChange?.(next);
            }}
          />
        ) : (
          <AccordionPrimitive.Root
            {...props}
            {...shared}
            onValueChange={(next: string) => {
              setValue(next);
              props.onValueChange?.(next);
            }}
          />
        )}
      </AccordionContext.Provider>
    </LazyMotion>
  );
}

function AccordionItem({ className, value, ...props }: React.ComponentProps<typeof AccordionPrimitive.Item>) {
  const { value: active } = React.useContext(AccordionContext);
  const open = Array.isArray(active) ? active.includes(value) : active === value;
  return (
    <ItemContext.Provider value={open}>
      <AccordionPrimitive.Item
        data-slot="accordion-item"
        value={value}
        className={cn("border-t border-border", className)}
        {...props}
      />
    </ItemContext.Provider>
  );
}

function AccordionTrigger({ className, children, ...props }: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
  return (
    <AccordionPrimitive.Header className="m-0 flex">
      <AccordionPrimitive.Trigger
        data-slot="accordion-trigger"
        className={cn(
          "group/accordion-trigger flex min-h-11 flex-1 items-center justify-between gap-3 rounded-sm py-3 text-left text-sm leading-snug font-medium text-primary outline-none transition-colors duration-(--motion-quick) hover:text-primary-hover focus-visible:ring-2 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 [&>svg]:size-4 [&>svg]:shrink-0 [&>svg]:text-muted-foreground [&>svg]:transition-transform [&>svg]:duration-(--motion-journey) [&>svg]:ease-(--ease-out) data-[state=open]:[&>svg]:rotate-180 in-data-[instant=true]:[&>svg]:transition-none",
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDownIcon aria-hidden="true" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  );
}

function AccordionContent({ className, children, ...props }: React.ComponentProps<typeof AccordionPrimitive.Content>) {
  const open = React.useContext(ItemContext);
  const { instant } = React.useContext(AccordionContext);
  const content = React.useRef<HTMLDivElement>(null);
  const [height, setHeight] = React.useState(0);
  const [transition, setTransition] = React.useState<Transition>({ duration: 0 });

  React.useLayoutEffect(() => {
    const node = content.current;
    if (!node) return;
    const styles = getComputedStyle(node);
    const ease = styles.getPropertyValue("--ease-out").match(/[\d.]+/g)?.map(Number);
    const duration = styles.getPropertyValue("--motion-journey").trim();
    setTransition({
      duration: parseFloat(duration) / (duration.endsWith("ms") ? 1000 : 1),
      ease: ease as [number, number, number, number],
    });
    const measure = () => setHeight(node.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <AccordionPrimitive.Content {...props} forceMount asChild>
      <m.div
        data-slot="accordion-content"
        aria-hidden={!open}
        inert={!open}
        className="overflow-hidden text-sm"
        initial={false}
        animate={{ height: open ? height : 0, opacity: open ? 1 : 0 }}
        transition={instant ? { duration: 0 } : transition}
      >
        <div
          ref={content}
          className={cn("flow-root pb-4 text-muted-foreground [&>p]:mt-3 [&_a]:underline [&_a]:underline-offset-4", className)}
        >
          {children}
        </div>
      </m.div>
    </AccordionPrimitive.Content>
  );
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
