/**
 * 미해결 스레드를 핀(1개) 또는 클러스터 배지(2개+)로 그린다.
 */
import { ClusterBadge, Pin } from "../components";
import { threadAuthor } from "../format";
import type { ClusterGroup, SetCanvas } from "./types";

export function PinClusters({
  groups,
  activeCluster,
  activeThreadId,
  setCanvas,
}: {
  groups: ClusterGroup[];
  activeCluster: string | null;
  activeThreadId: string | null;
  setCanvas: SetCanvas;
}) {
  return groups.map((group) => {
    if (group.threads.length === 1) {
      const thread = group.threads[0];
      if (!thread) return null;
      return (
        <Pin
          key={thread.id}
          point={group.point}
          resolved={thread.resolved}
          author={threadAuthor(thread)}
          active={activeThreadId === thread.id}
          onClick={() =>
            setCanvas((canvas) =>
              canvas.kind === "thread" && canvas.id === thread.id
                ? { kind: "idle" }
                : { kind: "thread", id: thread.id }
            )
          }
        />
      );
    }

    return (
      <ClusterBadge
        key={group.clusterId}
        point={group.point}
        threads={group.threads}
        active={activeCluster === group.clusterId}
        onClick={() =>
          setCanvas((canvas) =>
            canvas.kind === "cluster" && canvas.clusterId === group.clusterId
              ? { kind: "idle" }
              : { kind: "cluster", clusterId: group.clusterId }
          )
        }
      />
    );
  });
}
