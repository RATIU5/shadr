import type { GraphNode } from "@shadr/graph-core";
import { makeNodeId } from "@shadr/shared";
import { For, onCleanup, onMount } from "solid-js";

import ParamEditor from "~/components/ParamEditor";
import type { NodeCatalogEntry } from "~/editor/node-catalog";
import { createDefaultParams } from "~/editor/node-catalog";

export type NodeParamSize = Readonly<{ width: number; height: number }>;

/* eslint-disable no-unused-vars -- prop function types keep named args for clarity */
type ParamMeasureItemProps = Readonly<{
  entry: NodeCatalogEntry;
  contentWidth: number;
  onSizeChange: (nodeType: string, size: NodeParamSize) => void;
}>;

type NodeParamMeasureProps = Readonly<{
  entries: ReadonlyArray<NodeCatalogEntry>;
  contentWidth: number;
  onSizeChange: (nodeType: string, size: NodeParamSize) => void;
}>;
/* eslint-enable no-unused-vars */

const buildMeasureNode = (entry: NodeCatalogEntry): GraphNode => ({
  id: makeNodeId(`measure-${entry.type}`),
  type: entry.type,
  position: { x: 0, y: 0 },
  params: createDefaultParams(entry.paramSchema),
  inputs: [],
  outputs: [],
});

const ParamMeasureItem = (props: ParamMeasureItemProps) => {
  let container: HTMLDivElement | undefined;
  const node = buildMeasureNode(props.entry);

  onMount(() => {
    if (!container) {
      return;
    }
    const updateSize = (): void => {
      if (!container) {
        return;
      }
      const rect = container.getBoundingClientRect();
      props.onSizeChange(props.entry.type, {
        width: Math.ceil(rect.width),
        height: Math.ceil(rect.height),
      });
    };
    const observer = new ResizeObserver(() => {
      updateSize();
    });
    observer.observe(container);
    updateSize();
    onCleanup(() => observer.disconnect());
  });

  return (
    <div
      ref={container}
      style={{ width: `${props.contentWidth}px` }}
      class="inline-block"
    >
      <ParamEditor
        node={node}
        schema={props.entry.paramSchema!}
        onParamChange={() => {}}
      />
    </div>
  );
};

export default function NodeParamMeasure(props: NodeParamMeasureProps) {
  return (
    <div
      class="pointer-events-none absolute -left-[9999px] -top-[9999px] opacity-0"
      aria-hidden="true"
    >
      <For each={props.entries}>
        {(entry) =>
          entry.paramSchema ? (
            <ParamMeasureItem
              entry={entry}
              contentWidth={props.contentWidth}
              onSizeChange={props.onSizeChange}
            />
          ) : null
        }
      </For>
    </div>
  );
}
