import React, { useState, useMemo, useEffect } from 'react';
import { ReactFlow, Background, Controls, useNodesState, useEdgesState, MarkerType } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { X, Activity, CheckCircle2, Cpu, Bot, ShieldCheck, Terminal, Code, Info, ChevronRight } from 'lucide-react';

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 180;
const nodeHeight = 50;

const nodeMeta = {
  pmAgent: { title: 'PM Agent', desc: 'Analyzing requirements & specification' },
  humanInput: { title: 'Human Input', desc: 'User input & clarifications' },
  architectStep1: { title: 'Architect: Entities', desc: 'Designing data entities & terms' },
  architectStep2: { title: 'Architect: DB Schema', desc: 'Designing SQL / Supabase schema' },
  architectStep3: { title: 'Architect: REST API', desc: 'Designing API routes & endpoints' },
  architectStep4: { title: 'Architect: UI Layout', desc: 'Designing frontend page hierarchy' },
  architectStep5: { title: 'Architect: Folder Tree', desc: 'Structuring folder hierarchy' },
  blueprintValidator: { title: 'Blueprint Validator', desc: 'Validating architecture consistency' },
  plannerAgent: { title: 'Planner Agent', desc: 'Creating step-by-step dev tasks' },
  setupSandbox: { title: 'Setup Sandbox', desc: 'Provisioning isolated environment' },
  sandboxHealthCheck: { title: 'Sandbox Health', desc: 'Verifying environment readiness' },
  selectNextTask: { title: 'Select Next Task', desc: 'Scheduling highest priority task' },
  contextBuilder: { title: 'Context Builder', desc: 'Gathering relevant code context' },
  coderAgent: { title: 'Coder Agent', desc: 'Generating production code' },
  updateRegistry: { title: 'Update Registry', desc: 'Updating file tree registry' },
  reviewerAgent: { title: 'Reviewer Agent', desc: 'Performing code & security review' },
  executorAgent: { title: 'Executor Agent', desc: 'Executing syntax & build checks' },
  snapshotManager: { title: 'Snapshot Manager', desc: 'Saving version control snapshot' },
  debuggerAgent: { title: 'Debugger Agent', desc: 'Analyzing errors & self-repairing' },
  simplifyTask: { title: 'Simplify Task', desc: 'Simplifying complex task bounds' },
  humanEscalation: { title: 'Escalation', desc: 'Escalating to human supervisor' },
  phaseVerification: { title: 'Phase Verify', desc: 'Verifying phase milestones' },
  patternExtractor: { title: 'Pattern Extractor', desc: 'Extracting reusable code patterns' },
  stateCompactor: { title: 'State Compactor', desc: 'Compressing memory state' },
  deploymentVerifier: { title: 'Deploy Verifier', desc: 'Verifying Vercel deployment' },
  presentToUser: { title: 'Present To User', desc: 'Delivering final project deliverables' }
};

const initialNodes = Object.keys(nodeMeta).map(id => ({
  id,
  data: { label: nodeMeta[id].title },
  position: { x: 0, y: 0 },
  style: {
    borderRadius: '12px',
    padding: '10px 12px',
    fontSize: '11px',
    fontWeight: '600',
    textAlign: 'center',
    width: nodeWidth,
    border: '1.5px solid #e2e8f0',
    backgroundColor: '#ffffff',
    color: '#475569',
    boxShadow: '0 2px 5px rgba(0,0,0,0.03)',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
  }
}));

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

export default function GraphCanvas({ nodeHistory = [], onClose }) {
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => getLayoutedElements(initialNodes, initialEdges), []);
  
  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  const completedNodeIds = useMemo(() => {
    return Array.isArray(nodeHistory) ? nodeHistory.map(h => h.node) : [];
  }, [nodeHistory]);

  const latestNodeId = useMemo(() => {
    return completedNodeIds.length > 0 ? completedNodeIds[completedNodeIds.length - 1] : null;
  }, [completedNodeIds]);

  const progressPercent = useMemo(() => {
    const total = initialNodes.length;
    const completedCount = new Set(completedNodeIds).size;
    return Math.min(100, Math.round((completedCount / total) * 100));
  }, [completedNodeIds]);

  useEffect(() => {
    setNodes((nds) => 
      nds.map((n) => {
        const isSelected = n.id === selectedNodeId;
        if (n.id === latestNodeId) {
          // Active Node
          return {
            ...n,
            style: {
              ...n.style,
              backgroundColor: '#eff6ff',
              borderColor: '#3b82f6',
              color: '#1d4ed8',
              boxShadow: isSelected ? '0 0 0 3px rgba(59, 130, 246, 0.5)' : '0 0 15px rgba(59, 130, 246, 0.4)'
            }
          };
        } else if (completedNodeIds.includes(n.id)) {
          // Completed Node
          return {
            ...n,
            style: {
              ...n.style,
              backgroundColor: '#f0fdf4',
              borderColor: '#22c55e',
              color: '#15803d',
              boxShadow: isSelected ? '0 0 0 3px rgba(34, 197, 94, 0.5)' : 'none'
            }
          };
        }
        // Default / Pending Node
        return {
          ...n,
          style: {
            ...n.style,
            backgroundColor: '#ffffff',
            borderColor: isSelected ? '#6366f1' : '#e2e8f0',
            color: '#64748b',
            boxShadow: isSelected ? '0 0 0 3px rgba(99, 102, 241, 0.4)' : 'none'
          }
        };
      })
    );

    setEdges((eds) =>
      eds.map((e) => {
        if (e.target === latestNodeId) {
          return { ...e, animated: true, style: { stroke: '#3b82f6', strokeWidth: 2.5 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' } };
        }
        if (completedNodeIds.includes(e.source) && completedNodeIds.includes(e.target)) {
          return { ...e, animated: false, style: { stroke: '#22c55e', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#22c55e' } };
        }
        return { ...e, animated: false, style: { stroke: '#cbd5e1', strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: '#cbd5e1' } };
      })
    );
  }, [nodeHistory, latestNodeId, completedNodeIds, selectedNodeId, setNodes, setEdges]);

  const selectedMeta = selectedNodeId ? (nodeMeta[selectedNodeId] || { title: selectedNodeId, desc: 'Graph execution node' }) : null;
  const selectedHistory = useMemo(() => {
    if (!selectedNodeId || !Array.isArray(nodeHistory)) return null;
    return nodeHistory.slice().reverse().find(h => h.node === selectedNodeId);
  }, [selectedNodeId, nodeHistory]);

  const selectedStatus = useMemo(() => {
    if (!selectedNodeId) return null;
    if (selectedNodeId === latestNodeId) return 'RUNNING';
    if (completedNodeIds.includes(selectedNodeId)) return 'COMPLETED';
    return 'PENDING';
  }, [selectedNodeId, latestNodeId, completedNodeIds]);

  return (
    <div className="fixed inset-0 sm:relative sm:inset-auto w-full sm:w-[500px] max-w-full bg-white border-l border-slate-200 shadow-2xl flex flex-col z-40 animate-slide-left h-full select-none">
      {/* Top Header */}
      <div className="p-3.5 border-b border-slate-200/90 bg-white shrink-0 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-xs text-slate-900 leading-tight">LangGraph State Inspector</h2>
              <span className="text-[10px] text-slate-400 font-medium">27-Node Multi-Agent Architecture</span>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Bar & Node Counter */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] font-semibold">
            <span className="text-slate-600">
              Execution Progress: <span className="text-indigo-600">{new Set(completedNodeIds).size} / 27</span> Steps
            </span>
            <span className="text-slate-500 font-mono text-[10px]">{progressPercent}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-emerald-500 transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* ReactFlow Execution Canvas */}
      <div className="flex-1 w-full h-full relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={(_, node) => setSelectedNodeId(node.id)}
          fitView
          attributionPosition="bottom-right"
        >
          <Background color="#cbd5e1" gap={16} />
          <Controls />
        </ReactFlow>

        {/* Interactive Node Details Inspector Drawer */}
        {selectedNodeId && selectedMeta && (
          <div className="absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-xl p-3.5 animate-slide-up z-50 text-xs space-y-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <div className="flex items-center space-x-2">
                <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                <h3 className="font-bold text-slate-900">{selectedMeta.title}</h3>
                <span className={`text-[9.5px] font-bold font-mono px-2 py-0.5 rounded-full border ${
                  selectedStatus === 'RUNNING'
                    ? 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse'
                    : selectedStatus === 'COMPLETED'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-100 text-slate-600 border-slate-200'
                }`}>
                  {selectedStatus}
                </span>
              </div>
              <button
                onClick={() => setSelectedNodeId(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <p className="text-[11px] text-slate-600 leading-snug">{selectedMeta.desc}</p>

            {selectedHistory && selectedHistory.state_delta && (
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200/70 font-mono text-[10.5px] space-y-1 text-slate-700">
                {selectedHistory.state_delta.currentTask && (
                  <div>
                    <span className="text-slate-400 uppercase text-[9px]">Task:</span>{' '}
                    <span className="text-slate-900 font-semibold">{String(selectedHistory.state_delta.currentTask)}</span>
                  </div>
                )}
                {selectedHistory.state_delta.reviewResult && (
                  <div>
                    <span className="text-slate-400 uppercase text-[9px]">Review:</span>{' '}
                    <span className="text-emerald-700">{String(selectedHistory.state_delta.reviewResult)}</span>
                  </div>
                )}
                {selectedHistory.state_delta.sandboxId && (
                  <div>
                    <span className="text-slate-400 uppercase text-[9px]">Sandbox:</span>{' '}
                    <span className="text-indigo-600">{String(selectedHistory.state_delta.sandboxId)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
