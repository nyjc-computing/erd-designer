import './App.css';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactFlow, { 
  addEdge, Background, Controls, applyEdgeChanges, applyNodeChanges,
  Handle, Position, EdgeLabelRenderer, BaseEdge, ReactFlowProvider, useReactFlow
} from 'reactflow';
import 'reactflow/dist/style.css';
import { toPng } from 'html-to-image';

// --- CUSTOM NODE ---
const EntityNode = ({ id, data, selected }) => {
  const hStyle = { 
    width: 8, height: 8, background: '#444', border: '1px solid #fff', zIndex: 10,
    visibility: data.hideHandles ? 'hidden' : 'visible' 
  };
  return (
    <div className="entity-node" style={{ border: `2px solid ${selected ? '#3b82f6' : '#1a192b'}` }}>
      <Handle type="target" position={Position.Top} id="top" style={{ ...hStyle, left: '50%' }} />
      <Handle type="source" position={Position.Bottom} id="bottom" style={{ ...hStyle, left: '50%' }} />
      <Handle type="target" position={Position.Left} id="left" style={{ ...hStyle, top: '50%' }} />
      <Handle type="source" position={Position.Right} id="right" style={{ ...hStyle, top: '50%' }} />
      <input
        className="nodrag" 
        value={data.label}
        onChange={(e) => data.onChange(id, e.target.value)}
        style={{ border: 'none', background: 'transparent', textAlign: 'center', fontWeight: 'bold', width: '100%', outline: 'none' }}
      />
    </div>
  );
};

// --- CUSTOM CROW'S FOOT EDGE ---
const CrowEdge = ({ id, sourceX, sourceY, targetX, targetY, data, selected, sourceHandleId, targetHandleId }) => {
  const edgePath = `M ${sourceX},${sourceY} L ${targetX},${targetY}`;
  const labelX = (sourceX + targetX) / 2;
  const labelY = (sourceY + targetY) / 2;

  const getTridentPath = (sX, sY, tX, tY, handleId) => {
    const forkDepth = 18; const spread = 15; const borderOffset = 4; 
    const dx = tX - sX; const dy = tY - sY;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const ux = dx / dist; const uy = dy / dist;
    const adjTX = tX + (ux * borderOffset); const adjTY = tY + (uy * borderOffset);
    const forkOriginX = adjTX - ux * forkDepth; const forkOriginY = adjTY - uy * forkDepth;
    const isVerticalFace = handleId === 'top' || handleId === 'bottom';
    let p1x, p1y, p2x, p2y;
    if (isVerticalFace) { p1x = adjTX - spread; p1y = adjTY; p2x = adjTX + spread; p2y = adjTY; }
    else { p1x = adjTX; p1y = adjTY - spread; p2x = adjTX; p2y = adjTY + spread; }
    return `M ${p1x},${p1y} L ${p2x},${p2y} M ${p1x},${p1y} L ${forkOriginX},${forkOriginY} M ${p2x},${p2y} L ${forkOriginX},${forkOriginY} M ${adjTX},${adjTY} L ${forkOriginX},${forkOriginY}`;
  };

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={{ strokeWidth: 2, stroke: selected ? '#3b82f6' : '#333' }} />
      {(data?.cardinality === '1:M' || data?.cardinality === 'M:M') && (
        <path d={getTridentPath(sourceX, sourceY, targetX, targetY, targetHandleId)} fill="none" stroke={selected ? '#3b82f6' : '#333'} strokeWidth={2} />
      )}
      {(data?.cardinality === 'M:1' || data?.cardinality === 'M:M') && (
        <path d={getTridentPath(targetX, targetY, sourceX, sourceY, sourceHandleId)} fill="none" stroke={selected ? '#3b82f6' : '#333'} strokeWidth={2} />
      )}
      <EdgeLabelRenderer>
        <div style={{ 
          position: 'absolute', transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          background: '#ffffff', color: '#000000', padding: '2px 6px', borderRadius: '4px', border: '1.5px solid #1a192b',
          fontSize: '11px', fontWeight: 'bold', zIndex: 1000, pointerEvents: 'all' 
        }}>
          {data?.cardinality || '1:1'}
        </div>
      </EdgeLabelRenderer>
    </>
  );
};

const nodeTypes = { entity: EntityNode };
const edgeTypes = { crow: CrowEdge };

function ERDDesigner() {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [businessContext, setBusinessContext] = useState("");
  const [notes, setNotes] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [theme, setTheme] = useState('light');
  const [currentFileName, setCurrentFileName] = useState("my-diagram");
  
  const fileInputRef = useRef(null);
  const { fitView, screenToFlowPosition } = useReactFlow();

  const onNodeLabelChange = useCallback((id, newLabel) => {
    setNodes((nds) => nds.map((node) => node.id === id ? { ...node, data: { ...node.data, label: newLabel } } : node));
  }, []);

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        if (selectedId) {
          const nodeToCopy = nodes.find(n => n.id === selectedId);
          if (nodeToCopy) {
            const newId = `n${Date.now()}`;
            const newNode = { 
              ...nodeToCopy, 
              id: newId, 
              selected: true, 
              position: { x: nodeToCopy.position.x + 30, y: nodeToCopy.position.y + 30 }, 
              data: { ...nodeToCopy.data, onChange: onNodeLabelChange } 
            };
            setNodes((nds) => nds.map(n => ({ ...n, selected: false })).concat(newNode));
            setSelectedId(newId);
          }
        }
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        setNodes((nds) => nds.filter((n) => n.id !== selectedId));
        setEdges((eds) => eds.filter((ed) => ed.id !== selectedId && ed.source !== selectedId && ed.target !== selectedId));
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, nodes, onNodeLabelChange]);

  const onConnect = useCallback((p) => setEdges((eds) => addEdge({ ...p, id: `e${Date.now()}`, type: 'crow', data: { cardinality: '1:1' } }, eds)), []);

  const addEntityAtCenter = () => {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const position = screenToFlowPosition({ x: centerX, y: centerY });

    const newNode = {
      id: `n${Date.now()}`,
      type: 'entity',
      data: { label: 'New Entity', onChange: onNodeLabelChange },
      position: { x: position.x - 50, y: position.y - 20 }
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const saveProject = () => {
    const name = window.prompt("Project Name:", currentFileName);
    if (!name) return;
    setCurrentFileName(name);
    const blob = new Blob([JSON.stringify({ nodes, edges, businessContext, notes })], { type: 'application/json' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${name}.erd`; link.click();
  };

  const openProject = (e) => {
    const file = e.target.files[0]; if (!file) return;
    setCurrentFileName(file.name.replace(/\.[^/.]+$/, ""));
    const reader = new FileReader();
    reader.onload = (ev) => {
      const d = JSON.parse(ev.target.result);
      setNodes(d.nodes.map(n => ({ ...n, data: { ...n.data, onChange: onNodeLabelChange, hideHandles: false }})));
      setEdges(d.edges || []); setBusinessContext(d.businessContext || ""); setNotes(d.notes || "");
    };
    reader.readAsText(file); e.target.value = null;
  };

  const exportImage = () => {
    const fn = window.prompt("Enter PNG filename:", currentFileName); if (!fn) return;
    setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, hideHandles: true }})));
    setTimeout(() => {
      toPng(document.querySelector('.react-flow__viewport'), { backgroundColor: '#ffffff', quality: 1 }).then((url) => {
        const a = document.createElement('a'); a.download = `${fn}.png`; a.href = url; a.click();
        setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, hideHandles: false }})));
      });
    }, 150);
  };

  const clearCanvasOnly = () => { if (window.confirm("Clear only drawing?")) { setNodes([]); setEdges([]); } };
  const clearAll = () => { if (window.confirm("Clear EVERYTHING?")) { setNodes([]); setEdges([]); setBusinessContext(""); setNotes(""); setCurrentFileName("my-diagram"); } };

  const runAiAudit = () => {
    if (!businessContext.trim()) return alert("Enter business context!");
    const p = `ROLE: Senior Database Architect\nCONTEXT: ${businessContext}\nDIAGRAM:\n${JSON.stringify({ entities: nodes.map(n => n.data.label), relationships: edges.map(e => ({ from: nodes.find(n => n.id === e.source)?.data.label, to: nodes.find(n => n.id === e.target)?.data.label, type: e.data.cardinality })) }, null, 2)}\nTASK: Verify if diagram matches Context. STRICT CONSTRAINTS: 1. No new entities. 2. No attributes/fields. 3. Only evaluate relationships. 4. Concise bullet points (under 150 words).`;
    setGeneratedPrompt(p); setIsModalOpen(true);
  };

  const currentEdge = edges.find(e => e.id === selectedId);

  return (
    <div className="app-container">
      <div className="sidebar">
        <div className="sidebar-header">
          <h3>ERD Designer</h3>
          <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="theme-toggle">
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
        </div>
        <button className="btn btn-primary" onClick={addEntityAtCenter}>+ Add Entity</button>
        <div className="btn-grid">
          <button className="btn btn-secondary" onClick={saveProject}>Save Project</button>
          <button className="btn btn-secondary" onClick={() => fileInputRef.current.click()}>Open Project</button>
        </div>
        <input type="file" ref={fileInputRef} onChange={openProject} style={{ display: 'none' }} accept=".erd" />
        <button className="btn btn-info" onClick={() => { navigator.clipboard.writeText(JSON.stringify({ nodes, edges }, null, 2)); alert("Copied!"); }}>Copy Schema</button>
        <button className="btn btn-success" onClick={exportImage}>Export PNG</button>
        <button className="btn btn-purple" onClick={() => fitView({ padding: 0.2, duration: 800 })}>Zoom to Fit</button>
        <div className="btn-grid">
          <button className="btn btn-danger" onClick={clearCanvasOnly}>Clear Canvas</button>
          <button className="btn btn-danger btn-clear-all" onClick={clearAll}>Clear All</button>
        </div>
        <hr />
        <label>Business Context</label>
        <textarea value={businessContext} onChange={(e) => setBusinessContext(e.target.value)} placeholder="System rules..." style={{height: '80px'}} />
        <button className="btn btn-ai" onClick={runAiAudit}>✨ AI Audit</button>
        <div className="notes-area">
          <label>Design Notes</label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Store AI feedback here..." />
        </div>
        {currentEdge && (
          <div style={{marginTop: '10px'}}>
            <label>Cardinality</label>
            <select value={currentEdge.data?.cardinality || '1:1'} onChange={(e) => setEdges(eds => eds.map(ed => ed.id === selectedId ? { ...ed, data: { ...ed.data, cardinality: e.target.value } } : ed))}>
              <option value="1:1">1:1</option><option value="1:M">1:M</option><option value="M:1">M:1</option><option value="M:M">M:M</option>
            </select>
          </div>
        )}
      </div>
      <div className="canvas-container">
        <ReactFlow nodes={nodes} edges={edges} onNodesChange={nds => setNodes(applyNodeChanges(nds, nodes))} onEdgesChange={eds => setEdges(applyEdgeChanges(eds, edges))} onConnect={onConnect} onSelectionChange={({ nodes, edges }) => setSelectedId(edges[0]?.id || nodes[0]?.id || null)} nodeTypes={nodeTypes} edgeTypes={edgeTypes} snapToGrid snapGrid={[20, 20]} fitView>
          <Background color={theme === 'dark' ? '#334155' : '#cbd5e1'} variant="dots" />
          <Controls />
        </ReactFlow>
        {isModalOpen && (
          <div className="modal-overlay">
            <div className="modal-content">
              <h3>Master Audit Prompt</h3>
              <div className="prompt-preview">{generatedPrompt}</div>
              <div className="btn-grid">
                <button className="btn btn-primary" onClick={() => { navigator.clipboard.writeText(generatedPrompt); alert("Copied!"); }}>Copy Prompt</button>
                <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() { return <ReactFlowProvider><ERDDesigner /></ReactFlowProvider>; }