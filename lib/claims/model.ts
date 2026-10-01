/**
 * CLAIM MANAGEMENT — the example claim package behind the demonstrations
 * (hero scene, Tools preview, tool page). Synthetic data: an interim payment
 * application for a simplified road contract, split over twelve documents
 * in three formats.
 *
 * The idea in code:
 *   shared fields   one value (claim no., submission date…) used by many documents;
 *                   change it once and every document that uses it follows
 *   checks          unit prices, line amounts and totals compared across documents
 *
 * No React here: plain data in, plain data out.
 */

export type Format = "DOCX" | "XLSX" | "PDF";
export type FieldId = "claimNo" | "submitted" | "periodEnd" | "contract";
export type DocKind = "letter" | "summary" | "boq" | "measure" | "register" | "report" | "schedule" | "form" | "invoice" | "photos";

export const FORMAT_COLORS: Record<Format, string> = {
  DOCX: "#7aa8e6",
  XLSX: "#6fc9c9",
  PDF: "#b59ce6",
};
export const ISSUE_COLOR = "#ff5a5f";

export const FIELDS: Record<FieldId, { label: string; short: string; type: "date" | "text" }> = {
  claimNo: { label: "Claim no.", short: "Claim", type: "text" },
  submitted: { label: "Submission date", short: "Submitted", type: "date" },
  periodEnd: { label: "Period ending", short: "Period", type: "date" },
  contract: { label: "Contract no.", short: "Contract", type: "text" },
};
export const FIELD_ORDER: FieldId[] = ["submitted", "claimNo", "periodEnd", "contract"];

export type Doc = {
  id: string;
  name: string;
  file: string;
  format: Format;
  kind: DocKind;
  /** shared fields this document carries */
  fields: FieldId[];
  /** carries the claim total (calculated from the bill of quantities) */
  total?: boolean;
};

export const DOCS: Doc[] = [
  { id: "CL-01", name: "Cover letter", file: "IPA07_Cover_Letter.docx", format: "DOCX", kind: "letter", fields: ["claimNo", "submitted", "periodEnd", "contract"], total: true },
  { id: "CL-02", name: "Payment summary", file: "IPA07_Summary.xlsx", format: "XLSX", kind: "summary", fields: ["claimNo", "submitted", "periodEnd", "contract"], total: true },
  { id: "CL-03", name: "Bill of quantities", file: "IPA07_BOQ_Measured.xlsx", format: "XLSX", kind: "boq", fields: ["claimNo", "periodEnd"] },
  { id: "CL-04", name: "Measurement sheets", file: "IPA07_Measurement.xlsx", format: "XLSX", kind: "measure", fields: ["claimNo", "periodEnd"] },
  { id: "CL-05", name: "Variation register", file: "IPA07_Variations.xlsx", format: "XLSX", kind: "register", fields: ["claimNo", "periodEnd", "contract"] },
  { id: "CL-06", name: "Progress report", file: "IPA07_Progress_Report.docx", format: "DOCX", kind: "report", fields: ["claimNo", "submitted", "periodEnd"] },
  { id: "CL-07", name: "Materials on site", file: "IPA07_Materials.xlsx", format: "XLSX", kind: "schedule", fields: ["claimNo", "periodEnd"] },
  { id: "CL-08", name: "Daywork sheets", file: "IPA07_Dayworks.pdf", format: "PDF", kind: "photos", fields: ["periodEnd"] },
  { id: "CL-09", name: "Invoice", file: "IPA07_Invoice.docx", format: "DOCX", kind: "invoice", fields: ["claimNo", "submitted", "contract"] },
  { id: "CL-10", name: "Consultant approval form", file: "IPA07_Approval_Form.pdf", format: "PDF", kind: "form", fields: ["claimNo", "submitted", "contract"] },
  { id: "CL-11", name: "Transmittal", file: "IPA07_Transmittal.docx", format: "DOCX", kind: "letter", fields: ["claimNo", "submitted"] },
  { id: "CL-12", name: "Site photo record", file: "IPA07_Photos.pdf", format: "PDF", kind: "photos", fields: ["submitted", "periodEnd"] },
];
export const doc = (id: string) => DOCS.find((d) => d.id === id) ?? DOCS[0];

/** The measured work this period: one line per item. */
export const ITEMS = [
  { code: "2.01", label: "Excavation in common material", unit: "m³", qty: 1250, rate: 18.5 },
  { code: "3.02", label: "Granular subbase", unit: "m³", qty: 640, rate: 42 },
  { code: "4.01", label: "Asphalt base course", unit: "t", qty: 410, rate: 145 },
  { code: "4.03", label: "Asphalt wearing course", unit: "t", qty: 285, rate: 162 },
  { code: "5.04", label: "Precast concrete kerbs", unit: "m", qty: 860, rate: 38 },
  { code: "6.10", label: "Storm pipe DN600", unit: "m", qty: 210, rate: 255 },
] as const;

export type State = {
  values: Record<FieldId, string>;
  /** the unit price each line uses on the measurement sheets */
  sheetRates: number[];
  /** the amount typed on each measurement sheet line */
  sheetAmounts: number[];
  /** the total typed on the invoice */
  invoiceTotal: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The package as it arrives: three things in it do not agree. */
export function initialState(): State {
  const sheetRates: number[] = ITEMS.map((it) => it.rate);
  sheetRates[2] = 154; // 145.00 typed as 154.00
  const sheetAmounts = ITEMS.map((it, i) => round2(it.qty * sheetRates[i]));
  sheetAmounts[4] = 32860; // 860 × 38.00 = 32,680.00, typed as 32,860.00
  return {
    values: { claimNo: "IPA-07", submitted: "2026-10-05", periodEnd: "2026-09-30", contract: "RC-2214" },
    sheetRates,
    sheetAmounts,
    invoiceTotal: 241585, // the summary says 241,855.00
  };
}

/** The claim total, from the bill of quantities. */
export const claimTotal = () => round2(ITEMS.reduce((s, it) => s + it.qty * it.rate, 0));

/** Every document that uses a field. */
export const docsWith = (f: FieldId) => DOCS.filter((d) => d.fields.includes(f));

/** Change one shared field everywhere it is used. */
export function setField(s: State, f: FieldId, value: string): State {
  return { ...s, values: { ...s.values, [f]: value } };
}

/* ---------------- checks ---------------- */

export type IssueKind = "rate" | "amount" | "total";
export type Issue = {
  id: string;
  kind: IssueKind;
  /** the document that is wrong */
  doc: string;
  /** the document it disagrees with */
  against?: string;
  /** the measured item (for rate and amount) */
  item?: number;
  title: string;
  found: string;
  expected: string;
  fix: string;
};

export function check(s: State): Issue[] {
  const out: Issue[] = [];
  ITEMS.forEach((it, i) => {
    if (s.sheetRates[i] !== it.rate)
      out.push({
        id: `rate-${i}`,
        kind: "rate",
        doc: "CL-04",
        against: "CL-03",
        item: i,
        title: `Unit price differs: ${it.label}`,
        found: `${money(s.sheetRates[i])} / ${it.unit} on the measurement sheet`,
        expected: `${money(it.rate)} / ${it.unit} in the bill of quantities`,
        fix: "Use the BOQ rate",
      });
  });
  ITEMS.forEach((it, i) => {
    const right = round2(it.qty * s.sheetRates[i]);
    if (Math.abs(s.sheetAmounts[i] - right) > 0.005)
      out.push({
        id: `amount-${i}`,
        kind: "amount",
        doc: "CL-04",
        item: i,
        title: `Amount ≠ quantity × rate: ${it.label}`,
        found: `${money(s.sheetAmounts[i])} entered`,
        expected: `${num(it.qty)} × ${money(s.sheetRates[i])} = ${money(right)}`,
        fix: "Recalculate the amount",
      });
  });
  const total = claimTotal();
  if (Math.abs(s.invoiceTotal - total) > 0.005)
    out.push({
      id: "total",
      kind: "total",
      doc: "CL-09",
      against: "CL-02",
      title: "Invoice total differs from the payment summary",
      found: `${money(s.invoiceTotal)} on the invoice`,
      expected: `${money(total)} in the payment summary`,
      fix: "Use the summary total",
    });
  return out;
}

/** Apply the suggested correction for one issue. */
export function fixIssue(s: State, issue: Issue): State {
  const i = issue.item ?? 0;
  if (issue.kind === "rate") {
    const sheetRates = s.sheetRates.slice();
    sheetRates[i] = ITEMS[i].rate;
    const sheetAmounts = s.sheetAmounts.slice();
    // a line whose amount was right for its old rate follows the new one
    if (Math.abs(s.sheetAmounts[i] - round2(ITEMS[i].qty * s.sheetRates[i])) < 0.005) sheetAmounts[i] = round2(ITEMS[i].qty * ITEMS[i].rate);
    return { ...s, sheetRates, sheetAmounts };
  }
  if (issue.kind === "amount") {
    const sheetAmounts = s.sheetAmounts.slice();
    sheetAmounts[i] = round2(ITEMS[i].qty * s.sheetRates[i]);
    return { ...s, sheetAmounts };
  }
  return { ...s, invoiceTotal: claimTotal() };
}

/* ---------------- formatting ---------------- */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** "2026-10-05" → "05 Oct 2026" */
export function fmtDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${String(d).padStart(2, "0")} ${MONTHS[m - 1]} ${y}`;
}
/** Add days to an ISO date. */
export function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}
export const show = (f: FieldId, v: string) => (FIELDS[f].type === "date" ? fmtDate(v) : v);
export const money = (n: number) => n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const num = (n: number) => n.toLocaleString("en-GB");
