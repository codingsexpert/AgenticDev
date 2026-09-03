import React, { useMemo, useEffect } from 'react';
import { ReactFlow, Background, Controls, useNodesState, useEdgesState, MarkerType } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { X, Activity } from 'lucide-react';

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 180;
const nodeHeight = 50;

const initialNodes = [
  { id: 'pmAgent', data: { label: 'PM Agent' } },
  { id: 'humanInput', data: { label: 'Human Input' } },
  { id: 'architectStep1', data: { label: 'Architect (Entities)' } },
  { id: 'architectStep2', data: { label: 'Architect (DB Schema)' } },
  { id: 'architectStep3', data: { label: 'Architect (API)' } },
  { id: 'architectStep4', data: { label: 'Architect (UI Layout)' } },
  { id: 'architectStep5', data: { label: 'Architect (Folders)' } },
  { id: 'blueprintValidator', data: { label: 'Blueprint Validator' } },
  { id: 'plannerAgent', data: { label: 'Planner Agent' } },
  { id: 'setupSandbox', data: { label: 'Setup Sandbox' } },
  { id: 'sandboxHealthCheck', data: { label: 'Sandbox Health' } },
  { id: 'selectNextTask', data: { label: 'Select Next Task' } },
  { id: 'contextBuilder', data: { label: 'Context Builder' } },
  { id: 'coderAgent', data: { label: 'Coder Agent' } },
  { id: 'updateRegistry', data: { label: 'Update Registry' } },
  { id: 'reviewerAgent', data: { label: 'Reviewer Agent' } },
  { id: 'executorAgent', data: { label: 'Executor Agent' } },
  { id: 'snapshotManager', data: { label: 'Snapshot Manager' } },
  { id: 'debuggerAgent', data: { label: 'Debugger Agent' } },
  { id: 'simplifyTask', data: { label: 'Simplify Task' } },
  { id: 'humanEscalation', data: { label: 'Escalation' } },
  { id: 'phaseVerification', data: { label: 'Phase Verify' } },
  { id: 'patternExtractor', data: { label: 'Pattern Extractor' } },
  { id: 'stateCompactor', data: { label: 'State Compactor' } },
  { id: 'deploymentVerifier', data: { label: 'Deploy Verifier' } },
  { id: 'presentToUser', data: { label: 'Present To User' } }
].map(n => ({ ...n, position: { x: 0, y: 0 }, style: { borderRadius: '8px', padding: '10px', fontSize: '12px', fontWeight: 'bold', textAlign: 'center', width: nodeWidth, border: '2px solid #e2e8f0', backgroundColor: '#f8fafc', color: '#64748b', transition: 'all 0.3s ease' } }));

const initialEdges = [
  { id: 'e1', source: 'pmAgent', target: 'architectStep1' },
  { id: 'e2', source: 'pmAgent', target: 'setupSandbox' },
  { id: 'e3', source: 'architectStep1', target: 'architectStep2' },
  { id: 'e4', source: 'architectStep2', target: 'architectStep3' },
  { id: 'e5', source: 'architectStep3', target: 'architectStep4' },
  { id: 'e6', source: 'architectStep4', target: 'architectStep5' },
  { id: 'e7', source: 'architectStep5', target: 'blueprintValidator' },
  { id: 'e8', source: 'blueprintValidator', target: 'plannerAgent' },
  { id: 'e9', source: 'plannerAgent', target: 'setupSandbox' },
  { id: 'e10', source: 'setupSandbox', target: 'sandboxHealthCheck' },
  { id: 'e11', source: 'sandboxHealthCheck', target: 'selectNextTask' },
  { id: 'e12', source: 'selectNextTask', target: 'contextBuilder' },
  { id: 'e13', source: 'selectNextTask', target: 'phaseVerification' },
  { id: 'e14', source: 'selectNextTask', target: 'deploymentVerifier' },
  { id: 'e15', source: 'contextBuilder', target: 'coderAgent' },
  { id: 'e16', source: 'coderAgent', target: 'updateRegistry' },
  { id: 'e17', source: 'updateRegistry', target: 'reviewerAgent' },
  { id: 'e18', source: 'reviewerAgent', target: 'executorAgent' },
  { id: 'e19', source: 'reviewerAgent', target: 'coderAgent' },
  { id: 'e20', source: 'executorAgent', target: 'snapshotManager' },
  { id: 'e21', source: 'executorAgent', target: 'debuggerAgent' },
  { id: 'e22', source: 'snapshotManager', target: 'selectNextTask' },
  { id: 'e23', source: 'debuggerAgent', target: 'coderAgent' },
  { id: 'e24', source: 'debuggerAgent', target: 'humanEscalation' },
  { id: 'e25', source: 'phaseVerification', target: 'patternExtractor' },
  { id: 'e26', source: 'patternExtractor', target: 'stateCompactor' },
  { id: 'e27', source: 'stateCompactor', target: 'selectNextTask' },
  { id: 'e28', source: 'deploymentVerifier', target: 'presentToUser' }
].map(e => ({ ...e, animated: false, style: { stroke: '#cbd5e1', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#cbd5e1' } }));

const getLayoutedElements = (nodes, edges, direction = 'TB') => {
  dagreGraph.setGraph({ rankdir: direction, nodesep: 60, ranksep: 60 });
  nodes.forEach((node) => { dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight }); });
  edges.forEach((edge) => { dagreGraph.setEdge(edge.source, edge.target); });
  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = 'top';
    node.sourcePosition = 'bottom';
    node.position = { x: nodeWithPosition.x - nodeWidth / 2, y: nodeWithPosition.y - nodeHeight / 2 };
    return node;
  });
  return { nodes, edges };
};

export default function GraphCanvas({ nodeHistory, onClose }) {
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => getLayoutedElements(initialNodes, initialEdges), []);
  
  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  useEffect(() => {
    if (!nodeHistory || nodeHistory.length === 0) return;

    // The last node in history is the most recently executed one
    const latestNodeId = nodeHistory[nodeHistory.length - 1]?.node;
    const completedNodeIds = nodeHistory.map(h => h.node);

    setNodes((nds) => 
      nds.map((n) => {
        if (n.id === latestNodeId) {
          // Active Node
          return { ...n, style: { ...n.style, backgroundColor: '#eff6ff', borderColor: '#3b82f6', color: '#1d4ed8', boxShadow: '0 0 15px rgba(59, 130, 246, 0.4)' } };
        } else if (completedNodeIds.includes(n.id)) {
          // Completed Node
          return { ...n, style: { ...n.style, backgroundColor: '#f0fdf4', borderColor: '#22c55e', color: '#15803d', boxShadow: 'none' } };
        }
        // Default / Pending
        return { ...n, style: { ...n.style, backgroundColor: '#f8fafc', borderColor: '#e2e8f0', color: '#64748b', boxShadow: 'none' } };
      })
    );

    setEdges((eds) =>
      eds.map((e) => {
        // Animate edge if it connects to the active node
        if (e.target === latestNodeId) {
          return { ...e, animated: true, style: { stroke: '#3b82f6', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' } };
        }
        return { ...e, animated: false, style: { stroke: '#cbd5e1', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#cbd5e1' } };
      })
    );
  }, [nodeHistory, setNodes, setEdges]);

  return (
    <div className="w-[500px] max-w-full bg-white border-l border-slate-200 shadow-2xl flex flex-col z-40 animate-slide-left relative h-full">
      <div className="h-14 border-b border-slate-200/90 px-4 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center space-x-2">
          <Activity className="w-4 h-4 text-indigo-600" />
          <span className="font-semibold text-sm text-slate-800">Agent State Graph</span>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 w-full h-full relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          attributionPosition="bottom-right"
        >
          <Background color="#cbd5e1" gap={16} />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
