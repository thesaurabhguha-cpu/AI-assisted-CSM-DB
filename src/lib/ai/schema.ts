// Output contract for the co-pilot. Gemini is constrained to this JSON schema;
// the deterministic fallback produces the same shape.

export interface Claim {
  text: string;
  metricIds: string[];
}

export interface Recommendation {
  action: string;
  owner: "CSM" | "Customer" | "Joint";
  timeframe: string;
  rationale: Claim;
}

export interface Draft {
  qbr: {
    headline: string;
    executiveSummary: Claim[];
    valueDelivered: Claim[];
    adoption: Claim[];
    risks: Claim[];
    recommendations: Recommendation[];
    asks: Claim[];
    unknowns: { metric: string; why: string }[];
  };
  email: {
    subject: string;
    paragraphs: Claim[];
  };
}

const claim = {
  type: "OBJECT",
  properties: {
    text: { type: "STRING" },
    metricIds: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["text", "metricIds"],
  propertyOrdering: ["text", "metricIds"],
};
const claims = (min: number, max: number) => ({ type: "ARRAY", items: claim, minItems: min, maxItems: max });

export const GEMINI_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    qbr: {
      type: "OBJECT",
      properties: {
        headline: { type: "STRING" },
        executiveSummary: claims(2, 3),
        valueDelivered: claims(1, 3),
        adoption: claims(1, 3),
        risks: claims(1, 4),
        recommendations: {
          type: "ARRAY",
          minItems: 2,
          maxItems: 4,
          items: {
            type: "OBJECT",
            properties: {
              action: { type: "STRING" },
              owner: { type: "STRING", enum: ["CSM", "Customer", "Joint"] },
              timeframe: { type: "STRING" },
              rationale: claim,
            },
            required: ["action", "owner", "timeframe", "rationale"],
            propertyOrdering: ["action", "owner", "timeframe", "rationale"],
          },
        },
        asks: claims(1, 3),
        unknowns: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: { metric: { type: "STRING" }, why: { type: "STRING" } },
            required: ["metric", "why"],
            propertyOrdering: ["metric", "why"],
          },
        },
      },
      required: ["headline", "executiveSummary", "valueDelivered", "adoption", "risks", "recommendations", "asks", "unknowns"],
      propertyOrdering: ["headline", "executiveSummary", "valueDelivered", "adoption", "risks", "recommendations", "asks", "unknowns"],
    },
    email: {
      type: "OBJECT",
      properties: {
        subject: { type: "STRING" },
        paragraphs: claims(2, 4),
      },
      required: ["subject", "paragraphs"],
      propertyOrdering: ["subject", "paragraphs"],
    },
  },
  required: ["qbr", "email"],
  propertyOrdering: ["qbr", "email"],
};

// Minimal structural validation of model output.
export function isDraft(x: unknown): x is Draft {
  const o = x as Draft;
  const isClaim = (c: unknown) => {
    const cc = c as Claim;
    return !!cc && typeof cc.text === "string" && Array.isArray(cc.metricIds) && cc.metricIds.every((m) => typeof m === "string");
  };
  const isClaims = (arr: unknown) => Array.isArray(arr) && arr.every(isClaim);
  return (
    !!o && !!o.qbr && !!o.email &&
    typeof o.qbr.headline === "string" &&
    isClaims(o.qbr.executiveSummary) && isClaims(o.qbr.valueDelivered) && isClaims(o.qbr.adoption) &&
    isClaims(o.qbr.risks) && isClaims(o.qbr.asks) &&
    Array.isArray(o.qbr.recommendations) &&
    o.qbr.recommendations.every((r) => typeof r.action === "string" && typeof r.timeframe === "string" && isClaim(r.rationale)) &&
    Array.isArray(o.qbr.unknowns) &&
    typeof o.email.subject === "string" && isClaims(o.email.paragraphs)
  );
}
