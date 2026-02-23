import './App.css';
import React, { useState, useCallback, useEffect, useRef } from 'react';
import ReactFlow, { 
  addEdge, Background, Controls, applyEdgeChanges, applyNodeChanges,
  Handle, Position, EdgeLabelRenderer, BaseEdge, ReactFlowProvider, useReactFlow
} from 'reactflow';
import 'reactflow/dist/style.css';
import { toPng } from 'html-to-image';

// --- CUSTOM ENTITY NODE ---
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
  const { setEdges } = useReactFlow();
  const edgePath = `M ${sourceX},${sourceY} L ${targetX},${targetY}`;
  const labelX = (sourceX + targetX) / 2;
  const labelY = (sourceY + targetY) / 2;

  const onLabelClick = (e) => {
    e.stopPropagation();
    const types = ['1:1', '1:M', 'M:1', 'M:M'];
    const current = data?.cardinality || '1:1';
    const next = types[(types.indexOf(current) + 1) % types.length];
    setEdges((eds) => eds.map((edge) => edge.id === id ? { ...edge, data: { ...edge.data, cardinality: next } } : edge));
  };

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
        <div onClick={onLabelClick} className="edge-label-interactive nodrag nopan"
          style={{ position: 'absolute', left: labelX, top: labelY, transform: `translate(-50%, -50%)`, pointerEvents: 'all' }}>
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
  const [history, setHistory] = useState([]);
  const [businessContext, setBusinessContext] = useState("");
  const [notes, setNotes] = useState("");
  const [theme, setTheme] = useState('light');
  const [currentFileName, setCurrentFileName] = useState("my-diagram");
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [fileHandle, setFileHandle] = useState(null);
  
  const fileInputRef = useRef(null);
  const { fitView, screenToFlowPosition } = useReactFlow();

  const takeSnapshot = useCallback(() => {
    setHistory(prev => [...prev.slice(-29), { 
      nodes, edges, businessContext, notes, fileHandle, currentFileName 
    }]);
  }, [nodes, edges, businessContext, notes, fileHandle, currentFileName]);

  const onNodeLabelChange = useCallback((id, newLabel) => {
    setNodes((nds) => nds.map((node) => node.id === id ? { ...node, data: { ...node.data, label: newLabel } } : node));
  }, []);

  const undo = useCallback(() => {
    if (history.length === 0) return;
    const lastState = history[history.length - 1];
    setHistory(prev => prev.slice(0, -1));
    setNodes(lastState.nodes);
    setEdges(lastState.edges);
    setBusinessContext(lastState.businessContext);
    setNotes(lastState.notes);
    setFileHandle(lastState.fileHandle || null);
    setCurrentFileName(lastState.currentFileName || "my-diagram");
  }, [history]);

  useEffect(() => { document.documentElement.setAttribute('data-theme', theme); }, [theme]);

  const duplicateNode = useCallback(() => {
    if (!selectedId) return;
    const nodeToCopy = nodes.find(n => n.id === selectedId);
    if (!nodeToCopy) return;
    takeSnapshot();
    const newId = `n${Date.now()}`;
    const newNode = {
      ...nodeToCopy,
      id: newId,
      position: { x: nodeToCopy.position.x + 40, y: nodeToCopy.position.y + 40 },
      selected: true,
      data: { ...nodeToCopy.data, onChange: onNodeLabelChange }
    };
    setNodes((nds) => nds.map(n => ({ ...n, selected: false })).concat(newNode));
    setSelectedId(newId);
  }, [selectedId, nodes, takeSnapshot, onNodeLabelChange]);

  const deleteSelected = useCallback(() => {
    if (!selectedId) return;
    takeSnapshot();
    setNodes((nds) => nds.filter((n) => n.id !== selectedId));
    setEdges((eds) => eds.filter((ed) => ed.id !== selectedId && ed.source !== selectedId && ed.target !== selectedId));
    setSelectedId(null);
  }, [selectedId, takeSnapshot]);

  const saveProject = useCallback(async () => {
    const projectData = JSON.stringify({ nodes, edges, businessContext, notes }, null, 2);
    if (fileHandle) {
      const confirmSave = window.confirm(`Overwrite existing file "${currentFileName}.erd"?`);
      if (confirmSave) {
        try {
          const writable = await fileHandle.createWritable();
          await writable.write(projectData);
          await writable.close();
          return;
        } catch (err) { console.error("Write permission denied."); }
      }
    }
    const name = window.prompt("Project Name:", currentFileName);
    if (!name) return;
    setCurrentFileName(name);
    const blob = new Blob([projectData], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${name}.erd`;
    link.click();
  }, [nodes, edges, businessContext, notes, fileHandle, currentFileName]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveProject(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') { e.preventDefault(); duplicateNode(); }
      if (e.key === 'Delete' || e.key === 'Backspace') { deleteSelected(); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, duplicateNode, deleteSelected, saveProject]);

  const loadProjectIntoState = (d) => {
    setHistory([]);
    setNodes(d.nodes.map(n => ({ ...n, data: { ...n.data, onChange: onNodeLabelChange }})));
    setEdges(d.edges || []);
    setBusinessContext(d.businessContext || "");
    setNotes(d.notes || "");
    setTimeout(() => fitView({ padding: 0.2, duration: 800 }), 100);
  };

  const openProject = async () => {
    if (window.showOpenFilePicker) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [{ description: 'ERD Project', accept: { 'application/json': ['.erd'] } }],
        });
        const file = await handle.getFile();
        const content = await file.text();
        setFileHandle(handle);
        setCurrentFileName(file.name.replace(/\.[^/.]+$/, ""));
        loadProjectIntoState(JSON.parse(content));
      } catch (err) { console.log("Picker cancelled"); }
    } else {
      fileInputRef.current.click();
    }
  };

  const exportImage = () => {
    const fn = window.prompt("Enter PNG filename:", currentFileName); 
    if (!fn) return;
    setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, hideHandles: true }})));
    setTimeout(() => {
      toPng(document.querySelector('.react-flow__viewport'), { backgroundColor: '#ffffff', quality: 1 }).then((url) => {
        const a = document.createElement('a'); a.download = `${fn}.png`; a.href = url; a.click();
        setNodes(nds => nds.map(n => ({ ...n, data: { ...n.data, hideHandles: false }})));
      });
    }, 150);
  };

  const addEntityAtCenter = useCallback(() => {
    takeSnapshot();
    const position = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const newNode = {
      id: `n${Date.now()}`,
      type: 'entity',
      position: { x: position.x - 60, y: position.y - 20 },
      data: { label: 'New Entity', onChange: onNodeLabelChange },
    };
    setNodes((nds) => nds.concat(newNode));
  }, [screenToFlowPosition, takeSnapshot, onNodeLabelChange]);

  const onConnect = useCallback((p) => {
    takeSnapshot();
    setEdges((eds) => addEdge({ ...p, id: `e${Date.now()}`, type: 'crow', data: { cardinality: '1:1' } }, eds));
  }, [takeSnapshot]);

  return (
    <div className="app-container">
      <div className={`sidebar ${sidebarVisible ? '' : 'collapsed'}`}>
        <div className="sidebar-header">
          <h3>ERD Designer</h3>
          <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="theme-toggle">{theme === 'light' ? '🌙' : '☀️'}</button>
        </div>
        <div className="sidebar-scroll">
          <button className="btn btn-primary" onClick={addEntityAtCenter}>+ Add Entity</button>
          <div className="btn-grid">
            <button className="btn btn-secondary" onClick={saveProject}>Save Project</button>
            <button className="btn btn-secondary" onClick={openProject}>Open Project</button>
          </div>
          <input type="file" ref={fileInputRef} style={{ display: 'none' }} accept=".erd" onChange={(e) => {
            const file = e.target.files[0];
            if (file) {
              const reader = new FileReader();
              reader.onload = (ev) => {
                setCurrentFileName(file.name.replace(/\.[^/.]+$/, ""));
                loadProjectIntoState(JSON.parse(ev.target.result));
              };
              reader.readAsText(file);
            }
          }} />
          
          <button className="btn btn-info" onClick={() => {
             const schema = { entities: nodes.map(n => n.data.label), relationships: edges.map(e => ({ from: nodes.find(n => n.id === e.source)?.data.label, to: nodes.find(n => n.id === e.target)?.data.label, type: e.data?.cardinality || '1:1' })) };
             navigator.clipboard.writeText(JSON.stringify(schema, null, 2)); alert("Schema Copied!");
          }}>Copy Schema</button>
          
          <button className="btn btn-success" onClick={exportImage}>Export PNG</button>
          <button className="btn btn-purple" onClick={() => fitView({ padding: 0.2, duration: 600 })}>Zoom to Fit</button>
          <button className="btn btn-undo" onClick={undo} disabled={history.length === 0}>↩ Undo (Ctrl+Z)</button>
          
          <div className="btn-grid">
            <button className="btn btn-danger" onClick={() => { takeSnapshot(); setNodes([]); setEdges([]); }}>Clear Canvas</button>
            <button className="btn btn-danger btn-clear-all" onClick={() => { if(window.confirm("Clear all?")) { takeSnapshot(); setNodes([]); setEdges([]); setBusinessContext(""); setNotes(""); setFileHandle(null); }}}>Clear All</button>
          </div>
          
          <label>Business Context</label>
          <textarea value={businessContext} onChange={(e) => setBusinessContext(e.target.value)} placeholder="System rules..." />
          <button className="btn btn-ai" onClick={() => {
            const schema = { entities: nodes.map(n => n.data.label), relationships: edges.map(e => ({ from: nodes.find(n => n.id === e.source)?.data.label, to: nodes.find(n => n.id === e.target)?.data.label, type: e.data?.cardinality || '1:1' })) };
            setGeneratedPrompt(`ROLE: Senior Database Architect\nCONTEXT: ${businessContext}\nDIAGRAM:\n${JSON.stringify(schema, null, 2)}\nTASK: Verify if diagram matches Context. STRICT CONSTRAINTS: 1. No new entities. 2. No attributes/fields. 3. Only evaluate relationships. 4. Concise bullet points (under 150 words).`);
            setIsModalOpen(true);
          }}>✨ AI Audit</button>
          <div className="notes-area">
            <label>Design Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Design notes here..." />
          </div>
        </div>
      </div>
      
      <button className="sidebar-toggle-btn" onClick={() => setSidebarVisible(!sidebarVisible)}>{sidebarVisible ? '◀' : '▶'}</button>

      <div className="canvas-container" tabIndex="0">
        <ReactFlow 
          nodes={nodes} edges={edges} 
          onNodesChange={nds => setNodes(applyNodeChanges(nds, nodes))} 
          onEdgesChange={eds => setEdges(applyEdgeChanges(eds, edges))} 
          onConnect={onConnect} 
          nodeTypes={nodeTypes} 
          edgeTypes={edgeTypes} 
          snapToGrid 
          snapGrid={[20, 20]} 
          onSelectionChange={({ nodes }) => setSelectedId(nodes[0]?.id || null)}
          onNodeClick={(_, node) => setSelectedId(node.id)}
          onPaneClick={() => setSelectedId(null)}
        >
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