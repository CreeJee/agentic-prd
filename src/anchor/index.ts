export type { Capture, OverlayInfoMap } from "./capture";
export { buildCapture } from "./capture";
export { COMMENT_ROOT, OVERLAY_SEL } from "./constants";
export { reactPathOf } from "./fiber";
export {
  findOpenOverlay,
  overlayKeyOf,
  triggerForOverlay,
} from "./overlays";
export {
  clusterIdOf,
  normalizeAnchor,
  type Point,
  resolvePoint,
} from "./resolve";
export {
  cssPathWithin,
  isOccluded,
  safeQuery,
  stableSelfSelector,
} from "./selectors";
