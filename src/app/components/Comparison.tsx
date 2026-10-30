import { DressImage, TryOnExplanation } from ".";
import { cn } from "@/lib/utils";
import { Badge, FieldSet, FieldLegend, Grid, Stack } from "../../components/ui";
import {
  budgetMessage,
  dateMessage,
  evaluateDress,
  money,
  type Dress,
  type Occasion,
} from "../../domain/rental";
export function Comparison({
  dresses,
  occasion,
  preferred,
  onPrefer,
}: {
  dresses: Dress[];
  occasion: Occasion;
  preferred: string | null;
  onPrefer: (id: string) => void;
}) {
  const quotes = dresses.map((dress) => evaluateDress(dress, occasion));
  const rows: { label: string; values: string[]; strong?: boolean }[] = [
    {
      label: "Rental charge",
      values: dresses.map((dress) => money(dress.rent)),
    },
    {
      label: "Mandatory fee",
      values: dresses.map((dress) =>
        dress.fee === null ? "Unconfirmed" : money(dress.fee),
      ),
    },
    {
      label: "Security deposit",
      values: dresses.map((dress) =>
        dress.security === null ? "Unconfirmed" : money(dress.security),
      ),
    },
    {
      label: "At reservation",
      values: quotes.map((quote) => money(quote.reservation)),
    },
    {
      label: "Remaining by collection",
      values: quotes.map((quote) =>
        quote.remaining === null
          ? "Needs confirmation"
          : money(quote.remaining),
      ),
    },
    {
      label: "Total cash through collection",
      values: quotes.map((quote) =>
        quote.total === null
          ? `${money(quote.knownSubtotal)} known subtotal`
          : money(quote.total),
      ),
      strong: true,
    },
  ];
  return (
    <div className="comparison">
      <Stack>
        <FieldSet>
          <FieldLegend className="sr-only">
            Choose your preferred dress
          </FieldLegend>
          <div className="comparison-looks">
            <Grid>
              {dresses.map((dress, index) => (
                <div
                  key={dress.id}
                  className={cn(
                    "compare-look",
                    preferred === dress.id && "preferred",
                  )}
                >
                  <label className="preferred-label">
                    <input
                      type="radio"
                      name="preferred"
                      value={dress.id}
                      checked={preferred === dress.id}
                      onChange={() => onPrefer(dress.id)}
                    />
                    <span>
                      {index === 0 ? "A" : "B"} · {dress.name}
                    </span>
                  </label>
                  <div
                    className="dress-photo"
                    style={{ viewTransitionName: `dress-${dress.id}` }}
                  >
                    <DressImage
                      dress={dress}
                      sizes="(max-width: 760px) calc(50vw - 30px), 48vw"
                      alt={`Illustrative AI-created model wearing ${dress.name.toLowerCase()}`}
                    />
                    <span className="image-label">Illustrative image</span>
                  </div>
                  <div className="compare-info">
                    <p className="muted">Reference {dress.reference}</p>
                    <Badge
                      variant="outline"
                      data-status={quotes[index].budgetStatus}
                    >
                      {budgetMessage(quotes[index].budgetStatus)}
                    </Badge>
                    <p className="date-status">
                      {dateMessage(quotes[index].dateStatus)}
                    </p>
                    <a href={dress.image} target="_blank" rel="noreferrer">
                      View full-size sample
                      <span className="sr-only">
                        {" "}
                        of {dress.name} (opens a new tab)
                      </span>
                    </a>
                  </div>
                </div>
              ))}
            </Grid>
          </div>
        </FieldSet>
        <TryOnExplanation />
        <div className="table-wrap">
          <table>
            <caption>Compare payments · PHP</caption>
            <thead>
              <tr>
                <th scope="col">Payment detail</th>
                {dresses.map((dress, index) => (
                  <th scope="col" key={dress.id}>
                    {index === 0 ? "A" : "B"} · {dress.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className={row.strong ? "total-row" : ""}>
                  <th scope="row">{row.label}</th>
                  {row.values.map((value, index) => (
                    <td key={dresses[index].id}>{value}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted">
          The 50% rent reservation payment is credited toward rent. Remaining
          rent, mandatory fees and security are due by collection. Unknown
          charges mean the total still needs confirmation.
        </p>
        <div className="policy-note">
          <h2>Before you reserve</h2>
          <p>
            Local pickup. Cleaning included. Physically return the dress by 6 PM
            on your return date. Security is refundable after inspection,
            subject to deductions; refund timing is unconfirmed.
          </p>
          <p>
            These images show fictional models, not you. Physical fit and
            availability need shop confirmation.
          </p>
        </div>
      </Stack>
    </div>
  );
}
