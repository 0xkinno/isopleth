export type EvidenceClass = "MEASURED" | "REPLAYED" | "SYNTHETIC" | "UNKNOWN";
export type ReferenceState = "OPEN_LIVE" | "MARKET_CLOSED_FROZEN" | "REOPENING" | "STALE" | "UNKNOWN";

export interface Tier {
  startUsd: number;
  rate: number;
}

export interface CollateralAsset {
  coin: string;
  qty: number;
  referenceUsd: number | null;
  referenceState: ReferenceState;
  tiers: Tier[];
  rulesetVersion: string;
  evidence: EvidenceClass;
  sourceRefs: string[];
}

export interface PositionTier {
  symbol: string;
  minNotional: number;
  maxNotional: number;
  maintenanceMarginRate: number;
  takerFee: number;
  sourceRef: string;
}

export interface Position {
  symbol: string;
  side: "LONG" | "SHORT";
  qty: number;
  markUsd: number;
  kind: "crypto" | "stock";
  tiers: PositionTier[];
}

export interface Book {
  collateral: CollateralAsset[];
  positions: Position[];
  cashUsd: number;
  liabilitiesUsd: number;
  unrealisedPnlUsd: number;
  partialLiqFeeUsd: number;
}

export interface MarginResult {
  adjEquityUsd: number;
  maintenanceMarginUsd: number;
  crossMarginRate: number;
  tierSelections: Record<string, string>;
  referenceStates: Record<string, ReferenceState>;
  rulesetVersions: string[];
  evidence: EvidenceClass;
}

export type Refusal = { ok: false; reason: string; field: string };
export type Computed<T> = { ok: true; value: T };
export type Outcome<T> = Computed<T> | Refusal;
