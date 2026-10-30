import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
  Badge,
  Inline,
} from "../../components/ui";

export function TryOnExplanation() {
  return (
    <section className="try-on-explanation" aria-labelledby="try-on-title">
      <Inline>
        <h2 id="try-on-title">Your photo. Two possible looks.</h2>
        <Badge variant="outline">YouCam · not connected</Badge>
      </Inline>
      <p>
        This is where you’ll preview both dresses on yourself. For now, the
        images above show sample models.
      </p>
      <Accordion type="single" collapsible>
        <AccordionItem value="personal-try-on">
          <AccordionTrigger>How personal try-on will work</AccordionTrigger>
          <AccordionContent>
            <ol className="preview-flow">
              <li>
                <strong>Start with your photo</strong>
                <p>You choose a photo and agree to share it for the preview.</p>
              </li>
              <li>
                <strong>YouCam creates two looks</strong>
                <p>The same photo is paired with each dress you selected.</p>
              </li>
              <li>
                <strong>Compare, then ask the shop</strong>
                <p>Choose the look and cash total that suit you. Confirm fit in person.</p>
              </li>
            </ol>
            <p className="preview-status">
              Planned feature. Photo uploads and personal previews are not available
              in this demo. An AI preview will not confirm size, physical fit or availability.
            </p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </section>
  );
}
