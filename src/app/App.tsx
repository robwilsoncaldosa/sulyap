import { useRef, useState } from "react";
import { brand } from "../brand";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Container,
  Grid,
  Inline,
  Stack,
} from "../components/ui";
import { catalog } from "../data/catalog";
import {
  createInquiry,
  formatDate,
  money,
  parseBudget,
  reconcileSelection,
  sampleOccasion,
  validateOccasion,
  type Occasion,
} from "../domain/rental";
import { useJourneyNavigation } from "./useJourneyNavigation";
import {
  Comparison,
  DressCard,
  DressImage,
  Inquiry,
  OccasionForm,
} from "./components";
const steps = ["Occasion", "Shortlist", "Compare", "Inquiry"];
export default function App() {
  const [occasion, setOccasion] = useState<Occasion>({ ...sampleOccasion });
  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [preferred, setPreferred] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [notice, setNotice] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const valid = !Object.keys(validateOccasion(occasion)).length;
  const selectedDresses = selected.map((id) =>
    catalog.find((dress) => dress.id === id)!,
  );
  const preferredDress = selectedDresses.find(
    (dress) => dress.id === preferred,
  );
  const transitionTo = useJourneyNavigation(heading);
  const navigate = (next: number, pointer = false) => {
    transitionTo(() => {
      setStep(next);
      setFurthest((current) => Math.max(current, next));
    }, pointer, step === 1 && next === 2);
  };
  const changeOccasion = (next: Occasion) => {
    const kept = reconcileSelection(selected, catalog, next);
    if (kept.length !== selected.length)
      setNotice(
        "A selected dress now conflicts with your dates and was removed. Choose a replacement before comparing.",
      );
    setSelected(kept);
    if (preferred && !kept.includes(preferred)) setPreferred(null);
    setOccasion(next);
  };
  const toggle = (id: string) => {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id].slice(0, 2),
    );
    if (preferred === id) setPreferred(null);
    setNotice("");
  };
  const title = [
    "Start with your occasion",
    "Find your two",
    "Compare your looks",
    "Ready to ask the shop",
  ][step];
  return (
    <div className={cn((step === 1 || step === 2) && "with-next-action")}>
      <Container>
        <header className="site-header">
          <a
            className="wordmark"
            href="./"
            aria-label={`${brand.name}, restart sample`}
          >
            <img
              src="/brand/sulyap-horizontal.svg"
              alt=""
              aria-hidden="true"
              width={115}
              height={38}
            />
          </a>
          <Badge variant="outline">Sample collection</Badge>
        </header>
        <div className="demo-disclosure">
          <strong>Sample dresses. Real decisions.</strong>
          <span>
            Fictional collection · Personal try-on not connected.
          </span>
        </div>
        <nav aria-label="Rental journey">
          <ol className="stepper">
            {steps.map((label, index) => (
              <li key={label}>
                <Button
                  variant="journey"
                  type="button"
                  aria-current={step === index ? "step" : undefined}
                  disabled={
                    index > furthest ||
                    (index > 0 && !valid) ||
                    (index > 1 && selected.length !== 2) ||
                    (index > 2 && !preferredDress)
                  }
                  onClick={(event) => navigate(index, event.detail > 0)}
                >
                  <span className="step-content">
                    <span className="step-number">{index + 1}</span>
                    <span className="step-label">{label}</span>
                  </span>
                  <span className="step-line" aria-hidden="true" />
                </Button>
              </li>
            ))}
          </ol>
        </nav>
        <main>
          <div className="page-content" key={step}>
            <Stack>
              {step > 0 && (
                <Button
                  variant="back"
                  type="button"
                  onClick={(event) => navigate(step - 1, event.detail > 0)}
                >
                  <ArrowLeft data-icon="inline-start" /> Back to{" "}
                  {steps[step - 1].toLowerCase()}
                </Button>
              )}
              {step > 0 && (
                <div className="page-heading">
                  <h1 ref={heading} tabIndex={-1}>
                    {title}
                  </h1>
                </div>
              )}
              {step > 0 && (
                <div className="occasion-summary">
                  <Inline>
                    <p>
                      <strong>
                        {formatDate(occasion.collection)} –{" "}
                        {formatDate(occasion.returnDate)}
                      </strong>
                      <br />
                      Event {formatDate(occasion.event)} · Asia/Manila
                    </p>
                    <p className="summary-budget">
                      {money(parseBudget(occasion.budget) ?? 0)} total cash
                      available by collection
                    </p>
                    <Button
                      type="button"
                      variant="link"
                      onClick={(event) => navigate(0, event.detail > 0)}
                    >
                      Edit occasion
                    </Button>
                  </Inline>
                </div>
              )}
              {notice && (
                <Alert role="status">
                  <AlertDescription>{notice}</AlertDescription>
                </Alert>
              )}
              {step === 0 && (
                <div className="occasion-layout">
                  <Grid>
                    <OccasionForm
                      headingRef={heading}
                      occasion={occasion}
                      onChange={changeOccasion}
                      attempted={attempted}
                      onContinue={() => {
                        setAttempted(true);
                        if (valid) navigate(1);
                        else
                          requestAnimationFrame(() =>
                            document
                              .querySelector<HTMLInputElement>(
                                '[aria-invalid="true"]',
                              )
                              ?.focus(),
                          );
                      }}
                    />
                    <figure className="occasion-visual">
                      <div className="dress-photo">
                        <DressImage
                          dress={catalog[0]}
                          sizes="(max-width: 760px) calc(100vw - 40px), 50vw"
                          alt="Illustrative AI-created model wearing a sage wrap dress"
                        />
                      </div>
                      <figcaption>
                        <span>Illustrative image · Sage wrap</span>
                        <em>A soft spot for sage.</em>
                      </figcaption>
                    </figure>
                  </Grid>
                </div>
              )}
              {step === 1 && (
                <>
                  <p className="catalog-intro">
                    Choose two dresses from <strong>Amihan Occasion Studio</strong>,
                    our fictional shop. Your inquiry keeps the dates and cost warnings.
                  </p>
                  <div className="catalog-grid">
                    <Grid>
                      {catalog.map((dress) => (
                        <DressCard
                          key={dress.id}
                          dress={dress}
                          occasion={occasion}
                          selected={selected.includes(dress.id)}
                          full={selected.length === 2}
                          onToggle={() => toggle(dress.id)}
                        />
                      ))}
                    </Grid>
                  </div>
                  <div className="next-action">
                    <div className="selection-summary">
                      <p aria-live="polite">
                        <span className="selection-count">
                          {selected.length} of 2 selected
                        </span>
                        {selected.length === 2 && " · Ready to compare"}
                      </p>
                      {selectedDresses.length > 0 && (
                        <div className="selection-controls">
                          <Inline>
                            {selectedDresses.map((dress) => (
                              <Button
                                key={dress.id}
                                variant="link"
                                type="button"
                                onClick={() => toggle(dress.id)}
                              >
                                <DressImage
                                  className="selection-thumbnail"
                                  dress={dress}
                                  sizes="24px"
                                  alt=""
                                  width={24}
                                  height={32}
                                />
                                <X data-icon="inline-start" /> Remove{" "}
                                {dress.name}
                              </Button>
                            ))}
                          </Inline>
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      disabled={selected.length !== 2 || !valid}
                      onClick={(event) => navigate(2, event.detail > 0)}
                    >
                      Compare these two <ArrowRight data-icon="inline-end" />
                    </Button>
                  </div>
                </>
              )}
              {step === 2 && selectedDresses.length === 2 && (
                <>
                  <Comparison
                    dresses={selectedDresses}
                    occasion={occasion}
                    preferred={preferred}
                    onPrefer={setPreferred}
                  />
                  <div className="next-action">
                    <p>
                      {preferredDress
                        ? `Preferred: ${preferredDress.name}`
                        : "Choose your preferred dress above."}
                    </p>
                    <Button
                      type="button"
                      disabled={!preferredDress}
                      onClick={(event) => navigate(3, event.detail > 0)}
                    >
                      Prepare inquiry <ArrowRight data-icon="inline-end" />
                    </Button>
                  </div>
                </>
              )}
              {step === 3 && preferredDress && (
                <Inquiry
                  key={createInquiry(preferredDress, occasion)}
                  dress={preferredDress}
                  occasion={occasion}
                  text={createInquiry(preferredDress, occasion)}
                />
              )}
            </Stack>
          </div>
        </main>
        <footer>
          <p>{brand.name} · Your occasion, thoughtfully dressed.</p>
          <p>
            Demo collection. Confirm fit, dates and charges with the shop.
            No booking or payment.
          </p>
        </footer>
      </Container>
    </div>
  );
}
