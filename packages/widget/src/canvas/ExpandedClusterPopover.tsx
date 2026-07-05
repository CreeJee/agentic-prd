/**
 * 펼친 클러스터(cluster 모드)의 겹친 스레드 목록 팝오버.
 */
import { ClusterPopover } from "../components";
import type { ClusterGroup, SetCanvas } from "./types";

export function ExpandedClusterPopover({
  group,
  setCanvas,
}: {
  group: ClusterGroup | null;
  setCanvas: SetCanvas;
}) {
  if (!group) return null;

  return (
    <ClusterPopover
      point={group.point}
      threads={group.threads}
      onSelect={(id) =>
        setCanvas({
          kind: "thread",
          id,
          fromClusterId: group.clusterId,
        })
      }
      onClose={() => setCanvas({ kind: "idle" })}
    />
  );
}
