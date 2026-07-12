/** widget 이 저장하는 anchor 형태. widget 의 store.ts 와 shape 일치. */
export interface WidgetAnchor {
  scopeChain?: unknown[];
  selector: string;
  relX: number;
  relY: number;
  reactPath?: string[];
  reactSource?: {
    componentName: string;
    key?: string;
    ownerName?: string;
    fileName: string;
    lineNumber?: number;
    columnNumber?: number;
  };
}

export type LocationKind = "reactSource" | "testid" | "id-attr" | "reactPath";

export interface LocationCandidate {
  file: string;
  line: number;
  evidence: string;
  kind: LocationKind;
  confidence: number;
}
