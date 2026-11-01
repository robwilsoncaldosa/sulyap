import { LoaderCircle, RotateCcw } from "lucide-react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  Badge,
  Button,
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  Inline,
  Input,
} from "../../components/ui";
import type { Dress } from "../../domain/rental";
import type { Look, TryOn } from "../tryOn/useTryOn";

function lookText(look: Look | undefined) {
  if (!look) return "Not created yet.";
  if (look.status === "creating") return "Sending your photo to YouCam…";
  if (look.status === "running") return "YouCam is creating this look…";
  if (look.status === "success") return "Ready. Shown above beside the original dress.";
  return look.message;
}

export function TryOnPanel({ dresses, tryOn }: { dresses: Dress[]; tryOn: TryOn }) {
  const { available, config, consent, photo } = tryOn;
  const looks = dresses.map((dress) => tryOn.lookFor(dress.id));
  const busy = looks.some((look) => look?.status === "creating" || look?.status === "running");
  const ready = looks.every((look) => look?.status === "success");
  const started = looks.some(Boolean);
  const action = busy
    ? "Creating your looks…"
    : ready
      ? "Both looks are ready"
      : started
        ? "Finish my looks"
        : "Create my two looks";
  return (
    <section className="try-on-explanation" aria-labelledby="try-on-title">
      <Inline>
        <h2 id="try-on-title">Your photo. Two possible looks.</h2>
        <Badge variant="outline">
          {available ? "YouCam AI Clothes" : config ? "YouCam · not connected" : "Checking YouCam…"}
        </Badge>
      </Inline>
      <p>
        {available
          ? "Preview both dresses on yourself with YouCam’s AI virtual try-on. The cash table below stays the same."
          : "This is where you’d preview both dresses on yourself. The images above show sample models."}
      </p>
      {available ? (
        <div className="try-on-flow">
          <label className="try-on-consent">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => tryOn.setConsent(event.target.checked)}
            />
            <span>
              I’m 18 or older, this is my photo or I have permission to use it,
              and I agree to send it to YouCam to create these two previews.
            </span>
          </label>
          <div className="try-on-photo">
            {photo && (
              <img
                className="try-on-person"
                src={photo.url}
                alt="Your photo for the try-on"
                width={photo.width}
                height={photo.height}
              />
            )}
            <Field data-disabled={!consent || undefined}>
              <FieldLabel htmlFor="try-on-photo">
                {photo ? "Choose a different photo" : "Your photo"}
              </FieldLabel>
              <Input
                id="try-on-photo"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic"
                disabled={!consent || tryOn.preparing || busy}
                aria-describedby="try-on-photo-tips"
                aria-invalid={tryOn.photoError ? true : undefined}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void tryOn.choosePhoto(file);
                }}
              />
              <FieldDescription id="try-on-photo-tips">
                {consent
                  ? "Full-length, standing and facing the camera, only you in the frame, good light. JPG or PNG."
                  : "Agree above to choose a photo."}
              </FieldDescription>
              {tryOn.photoError && <FieldError>{tryOn.photoError}</FieldError>}
            </Field>
            {photo && (
              <Button type="button" variant="link" onClick={tryOn.removePhoto}>
                Remove my photo
              </Button>
            )}
          </div>
          <div className="try-on-action">
            <Button
              type="button"
              disabled={!photo || !consent || busy || ready || tryOn.preparing}
              onClick={() => tryOn.createLooks(dresses.map((dress) => dress.id))}
            >
              {busy && <LoaderCircle data-icon="inline-start" className="animate-spin" />}
              {action}
            </Button>
            <p className="muted">
              Uses one YouCam preview per dress, only when you press this. It can take a minute.
            </p>
            <ul className="look-status" aria-live="polite">
              {dresses.map((dress, index) => {
                const look = looks[index];
                return (
                  <li key={dress.id} data-status={look?.status ?? "idle"}>
                    <strong>
                      {index === 0 ? "A" : "B"} · {dress.name}
                    </strong>
                    <span>{lookText(look)}</span>
                    {(look?.status === "error" || look?.status === "stalled") && (
                      <Button
                        type="button"
                        variant="link"
                        onClick={() => tryOn.createLooks([dress.id])}
                      >
                        <RotateCcw data-icon="inline-start" />
                        {look.status === "stalled" ? "Check again" : "Try again"}
                        <span className="sr-only"> for {dress.name}</span>
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      ) : (
        config && (
          <p className="preview-status">
            Personal try-on isn’t configured on this server. Add a YouCam API key to enable it.
          </p>
        )
      )}
      <Accordion type="single" collapsible>
        <AccordionItem value="personal-try-on">
          <AccordionTrigger>How personal try-on works</AccordionTrigger>
          <AccordionContent>
            <ol className="preview-flow">
              <li>
                <strong>Start with your photo</strong>
                <p>
                  You agree to share it, then choose a full-length photo. Your browser
                  resizes it and strips location data first.
                </p>
              </li>
              <li>
                <strong>YouCam creates two looks</strong>
                <p>
                  The same photo is paired with each dress you selected using YouCam AI
                  Clothes, one preview per dress.
                </p>
              </li>
              <li>
                <strong>Compare, then ask the shop</strong>
                <p>Choose the look and cash total that suit you. Confirm fit in person.</p>
              </li>
            </ol>
            <p className="preview-status">
              Sulyap doesn’t save your photo or previews; refreshing the page clears them.
              Under YouCam’s API terms, uploaded and generated files are stored in the
              United States and deleted automatically after 30 days. Your inquiry never
              includes your photo. An AI preview will not confirm size, physical fit or
              availability.
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}
