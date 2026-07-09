import { useMemo } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Handle,
  Position,
  type Edge,
  type Node,
  type NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";
import { useNavigate } from "react-router-dom";
import { Network, Router, Share2, RadioTower } from "lucide-react";
import type { Device } from "../api/client";

const STATUS_COLOR: Record<string, string> = {
  online: "#34D399",
  offline: "#F87171",
  degraded: "#FBBF24",
  unknown: "#64748B",
};

const DEVICE_ICONS: Record<string, typeof Router> = {
  router: Router,
  switch: Share2,
  access_point: RadioTower,
};

function HubNode() {
  return (
    <div
      className="rounded-full bg-signal/15 border-2 border-signal w-20 h-20 flex flex-col items-center justify-center"
      style={{ boxShadow: "0 0 24px rgba(34, 211, 238, 0.25)" }}
    >
      <Network size={20} className="text-signal mb-0.5" strokeWidth={2} />
      <span className="text-[9px] font-mono uppercase tracking-wider text-signal font-semibold">
        Network
      </span>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

function DeviceNode({ data }: NodeProps<{ label: string; ip: string; status: string; type: string }>) {
  const color = STATUS_COLOR[data.status] ?? STATUS_COLOR.unknown;
  const Icon = DEVICE_ICONS[data.type] ?? Router;
  const isOnline = data.status === "online";
  return (
    <div
      className="bg-surface border rounded-xl px-4 py-3 min-w-[170px] cursor-pointer hover:bg-surface-hover transition-colors"
      style={{
        borderColor: color + "60",
        boxShadow: isOnline ? `0 0 16px ${color}20` : "none",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div className="flex items-center gap-2 mb-1.5">
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: color + "20" }}
        >
          <Icon size={12} style={{ color }} strokeWidth={2} />
        </div>
        <p className="text-sm font-medium truncate">{data.label}</p>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted font-mono">{data.ip}</p>
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isOnline ? "status-dot-online" : ""}`}
          style={{ backgroundColor: color }}
        />
      </div>
    </div>
  );
}

const nodeTypes = { hub: HubNode, device: DeviceNode };

export function NetworkTopology({ devices }: { devices: Device[] }) {
  const navigate = useNavigate();

  const { nodes, edges } = useMemo(() => {
    const radius = 220;
    const centerX = 400;
    const centerY = 260;

    const hubNode: Node = {
      id: "hub",
      type: "hub",
      position: { x: centerX - 40, y: centerY - 40 },
      data: {},
      draggable: false,
    };

    const deviceNodes: Node[] = devices.map((device, i) => {
      const angle = (2 * Math.PI * i) / Math.max(devices.length, 1) - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle) - 85;
      const y = centerY + radius * Math.sin(angle) - 34;
      return {
        id: device.id,
        type: "device",
        position: { x, y },
        data: {
          label: device.name,
          ip: device.ip_address,
          status: device.status,
          type: device.device_type,
        },
      };
    });

    const deviceEdges: Edge[] = devices.map((device) => ({
      id: `edge-${device.id}`,
      source: "hub",
      target: device.id,
      animated: device.status === "online",
      style: {
        stroke: STATUS_COLOR[device.status] ?? STATUS_COLOR.unknown,
        strokeWidth: 1.5,
        opacity: 0.6,
      },
    }));

    return { nodes: [hubNode, ...deviceNodes], edges: deviceEdges };
  }, [devices]);

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden" style={{ height: 560 }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => {
          if (node.id !== "hub") navigate(`/devices/${node.id}`);
        }}
        fitView
        proOptions={{ hideAttribution: true }}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#232938" />
      </ReactFlow>
    </div>
  );
}
