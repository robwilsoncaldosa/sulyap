import { DressImage } from ".";
import { useRef, useState } from "react";
import { brand } from "../../brand";
import { Copy, Download, Printer } from "lucide-react";
import {
  evaluateDress,
  formatDate,
  money,
  type Dress,
  type Occasion,
} from "../../domain/rental";
import {
  Alert,
  AlertDescription,
  Button,
  Field,
  FieldGroup,
  FieldLabel,
  Inline,
  Stack,
  Textarea,
} from "../../components/ui";
import type { Look } from "../tryOn/useTryOn";
export function Inquiry({
  text,
  dress,
  occasion,
  look,
  onPreviewError,
}: {
  text: string;
  dress: Dress;
  occasion: Occasion;
  look?: Look;
  onPreviewError?: () => void;
}) {
  const quote = evaluateDress(dress, occasion);
  const [status, setStatus] = useState("");
  const textarea = useRef<HTMLTextAreaElement>(null);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setStatus(
        "Copied. Paste this text into your own message when you’re ready. Nothing was sent.",
      );
    } catch {
      setStatus(
        "Clipboard unavailable. The inquiry text is selected below; copy it manually.",
      );
      textarea.current?.focus();
      textarea.current?.select();
    }
  };
  const save = () => {
    const url = URL.createObjectURL(
      new Blob([text], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = brand.inquiryFilename;
    link.click();
    URL.revokeObjectURL(url);
    setStatus("Text inquiry downloaded. This does not create a reservation.");
  };
  return (
    <div className="inquiry-layout">
      <aside className="inquiry-recap">
        <div className="dress-photo">
          {look?.status === "success" ? (
            <>
              <img
                className="look-preview"
                src={look.imageUrl}
                alt={`YouCam AI preview of you wearing the ${dress.name.toLowerCase()} dress`}
                onError={onPreviewError}
              />
              <span className="image-label">Your YouCam look</span>
            </>
          ) : (
            <DressImage
              dress={dress}
              sizes="(max-width: 760px) 110px, 320px"
              alt={`Model wearing the ${dress.name.toLowerCase()} dress`}
            />
          )}
        </div>
        <h2>{dress.name}</h2>
        <p>{dress.reference} · Your preferred dress</p>
        <dl className="compact-costs">
          <div>
            <dt>Collection</dt>
            <dd>{formatDate(occasion.collection)}</dd>
          </div>
          <div>
            <dt>Return by 6 PM</dt>
            <dd>{formatDate(occasion.returnDate)}</dd>
          </div>
          <div>
            <dt>Total cash</dt>
            <dd>
              {quote.total === null ? "Needs confirmation" : money(quote.total)}
            </dd>
          </div>
        </dl>
      </aside>
      <div className="inquiry">
        <Stack>
          <p className="policy-note">
            Review the current dates, costs and questions below. Copying or
            saving keeps a text-only inquiry. Nothing is sent and no dress is
            held.
          </p>
          <div className="inquiry-actions">
            <Inline>
              <Button type="button" onClick={copy}>
                <Copy data-icon="inline-start" /> Copy inquiry
              </Button>
              <Button variant="outline" type="button" onClick={save}>
                <Download data-icon="inline-start" /> Save text
              </Button>
              <Button
                variant="outline"
                type="button"
                onClick={() => window.print()}
              >
                <Printer data-icon="inline-start" /> Print summary
              </Button>
            </Inline>
          </div>
          {status && (
            <Alert role="status">
              <AlertDescription>{status}</AlertDescription>
            </Alert>
          )}
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="inquiry-text">Your inquiry</FieldLabel>
              <Textarea
                ref={textarea}
                id="inquiry-text"
                readOnly
                value={text}
                rows={27}
              />
            </Field>
          </FieldGroup>
          <pre className="print-summary">{text}</pre>
        </Stack>
      </div>
    </div>
  );
}
