import React, { useState, useEffect, useCallback, useRef, useReducer } from 'react';
import {
  ArrowLeft, Network, Save, Download,
  Trash2, Plus, CornerDownRight, Keyboard, LayoutGrid, X,
  Undo2, Redo2
} from 'lucide-react';
import { getMap, saveMap } from '../utils/db';
import { historyReducer, initialHistory } from '../utils/history';
import { calculateLayout } from '../utils/layout';
import { 
  exportToMarkdown, exportToText, exportToJSON, exportToSVG, downloadFile 
} from '../utils/export';
import MindMapCanvas from './MindMapCanvas';

const NODE_COLORS = [
  '#6366f1', // Indigo
  '#f43f5e', // Coral Rose
  '#f97316', // Orange
  '#eab308', // Amber Sunset
  '#10b981', // Emerald
  '#14b8a6', // Teal
  '#0ea5e9', // Sky Blue
  '#8b5cf6', // Violet
  '#d946ef', // Fuchsia
  '#64748b'  // Slate
];

const QUICK_EMOJIS = ['💡', '🚀', '📅', '🎯', '✅', '❌', '⭐', '📝', '❓', '🔥', '💻', '🎨'];

function Editor({ mapId, onBack, theme, toggleTheme }) {
  const [history, dispatch] = useReducer(historyReducer, initialHistory);
  const mapData = history.present;
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  // setMapData-compatible shim so the existing mutation handlers stay unchanged.
  // Accepts an updater fn (or value) plus an optional coalesceKey used to merge
  // consecutive same-source edits (title/notes typing) into one undo entry.
  const setMapData = useCallback((updater, coalesceKey) => {
    dispatch({ type: 'SET', updater, coalesceKey });
  }, []);

  const handleUndo = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const handleRedo = useCallback(() => dispatch({ type: 'REDO' }), []);

  const [selectedNodeId, setSelectedNodeId] = useState('root');
  const [editingNodeId, setEditingNodeId] = useState(null);
  // When editing is triggered by typing a character, this seeds the input.
  const [pendingEditChar, setPendingEditChar] = useState(null);
  // Bumped to ask the canvas to recenter on root (Escape key).
  const [recenterSignal, setRecenterSignal] = useState(0);
  const [layoutMode, setLayoutMode] = useState('split'); // 'split' or 'right'
  const [saveStatus, setSaveStatus] = useState('All changes saved'); // 'Saved', 'Saving...', 'Error'
  
  // Overlay states
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showExport, setShowExport] = useState(false);

  // Skip the auto-save that would otherwise fire from the initial load, so
  // merely opening a map doesn't bump its lastUpdated timestamp.
  const skipNextSaveRef = useRef(true);

  // Load mind map from IndexedDB
  useEffect(() => {
    const fetchMap = async () => {
      try {
        const data = await getMap(mapId);
        if (data) {
          skipNextSaveRef.current = true;
          dispatch({ type: 'RESET', present: data });
          // Set layout mode if saved on map, default to split
          if (data.layoutMode) {
            setLayoutMode(data.layoutMode);
          }
        }
      } catch (error) {
        console.error('Failed to fetch mind map:', error);
      }
    };
    fetchMap();
  }, [mapId]);

  // Debounced auto-save to IndexedDB
  useEffect(() => {
    if (!mapData) return;

    // The load path sets this so the state update it triggers isn't treated
    // as a user edit. Consume it and skip exactly one save cycle.
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    setSaveStatus('Saving...');
    const timer = setTimeout(async () => {
      try {
        await saveMap({
          ...mapData,
          layoutMode
        });
        setSaveStatus('All changes saved');
      } catch (error) {
        console.error('Auto-save failed:', error);
        setSaveStatus('Error saving changes');
      }
    }, 800); // 800ms debounce

    return () => clearTimeout(timer);
  }, [mapData, layoutMode]);

  // Core modification functions
  const handleUpdateNodeText = useCallback((nodeId, text) => {
    setMapData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        nodes: {
          ...prev.nodes,
          [nodeId]: {
            ...prev.nodes[nodeId],
            text
          }
        }
      };
    });
  }, [setMapData]);

  const handleUpdateNodeStyle = useCallback((nodeId, updates, coalesceKey) => {
    setMapData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        nodes: {
          ...prev.nodes,
          [nodeId]: {
            ...prev.nodes[nodeId],
            ...updates
          }
        }
      };
    }, coalesceKey);
  }, [setMapData]);

  const handleAddChild = useCallback((parentId) => {
    const newId = `node-${Date.now()}`;
    setMapData(prev => {
      if (!prev) return null;
      const parentNode = prev.nodes[parentId];
      if (!parentNode) return null;

      // Inherit parent node's color, or default Indigo
      const defaultColor = parentId === 'root' 
        ? NODE_COLORS[parentNode.children.length % NODE_COLORS.length] 
        : parentNode.color;

      const newNode = {
        id: newId,
        text: 'New Topic',
        parentId,
        color: defaultColor || '#6366f1',
        children: [],
        emoji: '',
        notes: ''
      };

      // Add child to parent
      const updatedParent = {
        ...parentNode,
        children: [...parentNode.children, newId],
        isCollapsed: false // auto expand on adding
      };

      return {
        ...prev,
        nodes: {
          ...prev.nodes,
          [parentId]: updatedParent,
          [newId]: newNode
        }
      };
    });
    setSelectedNodeId(newId);
    setEditingNodeId(newId); // start editing immediately
  }, [setMapData]);

  const handleAddSibling = useCallback((nodeId) => {
    if (nodeId === 'root') return; // root cannot have siblings
    const newId = `node-${Date.now()}`;

    setMapData(prev => {
      if (!prev) return null;
      const currentNode = prev.nodes[nodeId];
      if (!currentNode || !currentNode.parentId) return null;

      const parentId = currentNode.parentId;
      const parentNode = prev.nodes[parentId];
      if (!parentNode) return null;

      const newNode = {
        id: newId,
        text: 'New Topic',
        parentId,
        color: currentNode.color || '#6366f1',
        children: [],
        emoji: '',
        notes: ''
      };

      // Insert sibling right after the current node in parent's children list
      const currentIndex = parentNode.children.indexOf(nodeId);
      const updatedChildren = [...parentNode.children];
      updatedChildren.splice(currentIndex + 1, 0, newId);

      const updatedParent = {
        ...parentNode,
        children: updatedChildren
      };

      return {
        ...prev,
        nodes: {
          ...prev.nodes,
          [parentId]: updatedParent,
          [newId]: newNode
        }
      };
    });
    setSelectedNodeId(newId);
    setEditingNodeId(newId); // start editing immediately
  }, [setMapData]);

  const handleDeleteNode = useCallback((nodeId) => {
    if (nodeId === 'root') return; // root cannot be deleted

    // No confirm dialog: deletion is undoable via Cmd/Ctrl+Z.
    setMapData(prev => {
        if (!prev) return null;

        const updatedNodes = { ...prev.nodes };
        const nodeToDelete = updatedNodes[nodeId];
        if (!nodeToDelete) return prev;

        const parentId = nodeToDelete.parentId;
        const parentNode = updatedNodes[parentId];

        // 1. Recursive helper to collect all descendant IDs
        const getDescendants = (id) => {
          let list = [id];
          const n = updatedNodes[id];
          if (n && n.children) {
            n.children.forEach(childId => {
              list = [...list, ...getDescendants(childId)];
            });
          }
          return list;
        };

        const idsToDelete = getDescendants(nodeId);

        // 2. Delete all collected IDs
        idsToDelete.forEach(id => {
          delete updatedNodes[id];
        });

        // 3. Remove child from parent
        if (parentNode) {
          updatedNodes[parentId] = {
            ...parentNode,
            children: parentNode.children.filter(id => id !== nodeId)
          };
        }

        // Reset selection to parent
        setSelectedNodeId(parentId || 'root');

        return {
          ...prev,
          nodes: updatedNodes
        };
    });
  }, [setMapData]);

  const handleToggleCollapse = useCallback((nodeId) => {
    setMapData(prev => {
      if (!prev) return null;
      return {
        ...prev,
        nodes: {
          ...prev.nodes,
          [nodeId]: {
            ...prev.nodes[nodeId],
            isCollapsed: !prev.nodes[nodeId].isCollapsed
          }
        }
      };
    });
  }, [setMapData]);

  const handleReparentNode = useCallback((nodeId, newParentId) => {
    setMapData(prev => {
      if (!prev) return null;
      const node = prev.nodes[nodeId];
      if (!node) return prev;

      const oldParentId = node.parentId;
      if (!oldParentId || oldParentId === newParentId) return prev;

      const updatedNodes = { ...prev.nodes };

      // 1. Remove from old parent children list
      const oldParent = updatedNodes[oldParentId];
      if (oldParent) {
        updatedNodes[oldParentId] = {
          ...oldParent,
          children: oldParent.children.filter(id => id !== nodeId)
        };
      }

      // 2. Add to new parent children list
      const newParent = updatedNodes[newParentId];
      if (newParent) {
        updatedNodes[newParentId] = {
          ...newParent,
          children: [...newParent.children, nodeId],
          isCollapsed: false // force expand new parent
        };
      }

      // 3. Update parent link on dragged node
      updatedNodes[nodeId] = {
        ...node,
        parentId: newParentId,
        // Inherit parent node color dynamically
        color: newParentId === 'root' ? node.color : newParent.color || node.color
      };

      return {
        ...prev,
        nodes: updatedNodes
      };
    });
  }, [setMapData]);

  // Keyboard navigation logic between nodes
  const navigateNode = useCallback((direction) => {
    if (!mapData || !selectedNodeId) return;

    const layout = calculateLayout(mapData.nodes, layoutMode);
    const selectedLayout = layout[selectedNodeId];
    if (!selectedLayout) return;

    const nodesList = mapData.nodes;
    const currentNode = nodesList[selectedNodeId];

    if (direction === 'up' || direction === 'down') {
      // Navigate to previous/next sibling
      if (selectedNodeId === 'root') return;

      const parentNode = nodesList[currentNode.parentId];
      if (!parentNode) return;

      const siblings = parentNode.children.filter(id => layout[id]);
      const index = siblings.indexOf(selectedNodeId);

      if (direction === 'up' && index > 0) {
        setSelectedNodeId(siblings[index - 1]);
      } else if (direction === 'down' && index < siblings.length - 1) {
        setSelectedNodeId(siblings[index + 1]);
      }
    } else if (direction === 'left' || direction === 'right') {
      const isSideRight = selectedLayout.side === 'right';
      const isSideLeft = selectedLayout.side === 'left';
      const isRoot = selectedNodeId === 'root';

      if (isRoot) {
        const sideChildren = Object.keys(layout).filter(id => {
          const l = layout[id];
          return l.side === (direction === 'left' ? 'left' : 'right') && nodesList[id].parentId === 'root';
        });
        
        if (sideChildren.length > 0) {
          setSelectedNodeId(sideChildren[0]); // select first child on that side
        }
      } else {
        // Non-root navigation logic
        if ((direction === 'left' && isSideRight) || (direction === 'right' && isSideLeft)) {
          // Go inwards (towards parent)
          setSelectedNodeId(currentNode.parentId);
        } else {
          // Go outwards (towards child)
          const activeChildren = (currentNode.children || []).filter(id => layout[id]);
          if (activeChildren.length > 0) {
            setSelectedNodeId(activeChildren[0]); // select first child
          }
        }
      }
    }
  }, [mapData, selectedNodeId, layoutMode]);

  // Global Keyboard Shortcuts Hook
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Exclude shortcut execution if user is editing inputs/textarea
      if (
        document.activeElement.tagName === 'INPUT' || 
        document.activeElement.tagName === 'TEXTAREA' ||
        document.activeElement.isContentEditable
      ) {
        return;
      }

      // Undo / redo. Cmd/Ctrl+Z undoes, Cmd/Ctrl+Shift+Z (or Ctrl+Y) redoes.
      if ((e.metaKey || e.ctrlKey) && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      if (e.ctrlKey && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (!selectedNodeId) return;

      if (e.key === 'Tab') {
        e.preventDefault();
        handleAddChild(selectedNodeId);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleAddSibling(selectedNodeId);
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        handleDeleteNode(selectedNodeId);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        navigateNode('up');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        navigateNode('down');
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateNode('left');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigateNode('right');
      } else if (e.key === 'F2') {
        e.preventDefault();
        setPendingEditChar(null);
        setEditingNodeId(selectedNodeId);
      } else if (e.key === 'Escape') {
        setSelectedNodeId('root'); // reset focus
        setRecenterSignal((s) => s + 1); // recenter viewport on root
      } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // Type-to-edit: begin editing the selected node seeded with this key.
        e.preventDefault();
        setPendingEditChar(e.key);
        setEditingNodeId(selectedNodeId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId, handleAddChild, handleAddSibling, handleDeleteNode, navigateNode, handleUndo, handleRedo]);

  // Export handlers
  const handleExport = (type) => {
    if (!mapData) return;
    
    const safeName = mapData.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    
    if (type === 'markdown') {
      const content = exportToMarkdown(mapData);
      downloadFile(`${safeName}.md`, content, 'text/markdown');
    } else if (type === 'text') {
      const content = exportToText(mapData);
      downloadFile(`${safeName}.txt`, content, 'text/plain');
    } else if (type === 'json') {
      const content = exportToJSON(mapData);
      downloadFile(`${safeName}.mindmap`, content, 'application/json');
    } else if (type === 'svg') {
      const content = exportToSVG(mapData, layoutMode, theme === 'dark');
      downloadFile(`${safeName}.svg`, content, 'image/svg+xml');
    }
    
    setShowExport(false);
  };

  const selectedNode = mapData?.nodes[selectedNodeId];

  return (
    <div className="editor-view">
      {/* Top Navigation & Toolbar */}
      <header className="top-toolbar glass-panel">
        <div className="toolbar-left">
          <button className="card-icon-btn" onClick={onBack} title="Back to Dashboard" style={{ color: 'var(--text-primary)' }}>
            <ArrowLeft size={20} />
          </button>
          
          <div className="map-title-wrapper">
            {mapData && (
              <input
                type="text"
                className="map-title-input"
                value={mapData.name}
                onChange={(e) => setMapData(prev => ({ ...prev, name: e.target.value }), 'name')}
                title="Rename Mind Map"
              />
            )}
            <div className="sync-status">
              <Save size={12} style={{ color: saveStatus === 'Saving...' ? 'var(--accent-warning)' : 'var(--accent-success)' }} />
              <span>{saveStatus}</span>
            </div>
          </div>
        </div>

        <div className="toolbar-right">
          {/* Quick Node Actions */}
          <div style={{ display: 'flex', gap: '6px', borderRight: '1px solid var(--border-color)', paddingRight: '12px' }}>
            <button 
              className="btn btn-secondary" 
              onClick={() => handleAddChild(selectedNodeId)}
              title="Add child node (Tab)"
              style={{ padding: '8px 12px', fontSize: '0.85rem' }}
            >
              <Plus size={14} />
              <span>Sub-topic</span>
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={() => handleAddSibling(selectedNodeId)}
              disabled={selectedNodeId === 'root'}
              title="Add sibling node (Enter)"
              style={{ padding: '8px 12px', fontSize: '0.85rem' }}
            >
              <CornerDownRight size={14} />
              <span>Sibling</span>
            </button>
            <button 
              className="btn btn-secondary" 
              onClick={() => handleDeleteNode(selectedNodeId)}
              disabled={selectedNodeId === 'root'}
              title="Delete node (Delete)"
              style={{ padding: '8px 12px', fontSize: '0.85rem' }}
            >
              <Trash2 size={14} style={{ color: 'var(--accent-danger)' }} />
            </button>
          </div>

          {/* Undo / redo */}
          <div style={{ display: 'flex', gap: '6px', borderRight: '1px solid var(--border-color)', paddingRight: '12px' }}>
            <button
              className="card-icon-btn"
              onClick={handleUndo}
              disabled={!canUndo}
              title="Undo (Cmd/Ctrl+Z)"
            >
              <Undo2 size={20} />
            </button>
            <button
              className="card-icon-btn"
              onClick={handleRedo}
              disabled={!canRedo}
              title="Redo (Cmd/Ctrl+Shift+Z)"
            >
              <Redo2 size={20} />
            </button>
          </div>

          {/* Map layout modes */}
          <button
            className="card-icon-btn"
            onClick={() => setLayoutMode(prev => prev === 'split' ? 'right' : 'split')}
            title={`Layout: ${layoutMode === 'split' ? 'Symmetrical Split' : 'Right Tree'}`}
          >
            <LayoutGrid size={20} style={{ color: layoutMode === 'right' ? 'var(--accent-primary)' : 'var(--text-primary)' }} />
          </button>

          <button className="card-icon-btn" onClick={() => setShowShortcuts(true)} title="Keyboard Shortcuts">
            <Keyboard size={20} />
          </button>

          <button className="btn btn-primary" onClick={() => setShowExport(true)}>
            <Download size={16} />
            <span>Export</span>
          </button>
        </div>
      </header>

      {/* Main Interactive Canvas */}
      {mapData ? (
        <MindMapCanvas
          nodes={mapData.nodes}
          layoutMode={layoutMode}
          selectedNodeId={selectedNodeId}
          onSelectNode={setSelectedNodeId}
          editingNodeId={editingNodeId}
          recenterSignal={recenterSignal}
          pendingEditChar={pendingEditChar}
          onStartEdit={(id) => { setPendingEditChar(null); setEditingNodeId(id); }}
          onEndEdit={() => { setEditingNodeId(null); setPendingEditChar(null); }}
          onUpdateNodeText={handleUpdateNodeText}
          onAddChild={handleAddChild}
          onAddSibling={handleAddSibling}
          onDeleteNode={handleDeleteNode}
          onToggleCollapse={handleToggleCollapse}
          onReparentNode={handleReparentNode}
        />
      ) : (
        <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
          <p>Loading editor...</p>
        </div>
      )}

      {/* Right Customizer Sidebar Inspector Panel */}
      {selectedNode && (
        <aside className="inspector-panel glass-panel">
          <div className="inspector-header">
            <h3 style={{ fontSize: '1.1rem' }}>Customize Node</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {selectedNodeId}</span>
          </div>

          {/* Color palette */}
          <div className="inspector-section">
            <h4>Node Theme Color</h4>
            <div className="color-picker-grid">
              {NODE_COLORS.map(color => (
                <div 
                  key={color}
                  className={`color-option ${selectedNode.color === color ? 'selected' : ''}`}
                  style={{ backgroundColor: color }}
                  onClick={() => handleUpdateNodeStyle(selectedNodeId, { color })}
                />
              ))}
            </div>
          </div>

          {/* Emoji Badge selector */}
          <div className="inspector-section">
            <h4>Emoji Icon Badge</h4>
            <div className="emoji-picker-grid">
              <button 
                className={`emoji-option ${!selectedNode.emoji ? 'selected' : ''}`}
                onClick={() => handleUpdateNodeStyle(selectedNodeId, { emoji: '' })}
                title="Remove Emoji"
              >
                Ø
              </button>
              {QUICK_EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  className={`emoji-option ${selectedNode.emoji === emoji ? 'selected' : ''}`}
                  onClick={() => handleUpdateNodeStyle(selectedNodeId, { emoji })}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Notes description textarea */}
          <div className="inspector-section">
            <h4>Description Notes</h4>
            <textarea
              className="notes-textarea"
              placeholder="Add description notes or references about this topic..."
              value={selectedNode.notes || ''}
              onChange={(e) => handleUpdateNodeStyle(selectedNodeId, { notes: e.target.value }, `notes:${selectedNodeId}`)}
            />
          </div>

          {/* Instructions banner */}
          <div className="alert-banner">
            <span>💡 Click background to deselect or press Esc to focus center. Drag cards to change hierarchy branches.</span>
          </div>
        </aside>
      )}

      {/* Shortcuts overlay modal */}
      {showShortcuts && (
        <div className="modal-overlay" onClick={() => setShowShortcuts(false)}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Keyboard Shortcuts</h3>
              <button className="card-icon-btn" onClick={() => setShowShortcuts(false)}>
                <X size={18} />
              </button>
            </div>
            
            <div className="shortcuts-dialog">
              <div className="shortcut-row">
                <span>Add child branch</span>
                <kbd>Tab</kbd>
              </div>
              <div className="shortcut-row">
                <span>Add sibling branch</span>
                <kbd>Enter</kbd>
              </div>
              <div className="shortcut-row">
                <span>Edit text</span>
                <kbd>Double Click</kbd>
              </div>
              <div className="shortcut-row">
                <span>Delete branch (confirm)</span>
                <kbd>Delete</kbd>
              </div>
              <div className="shortcut-row">
                <span>Navigate between nodes</span>
                <div className="shortcut-keys">
                  <kbd>▲</kbd>
                  <kbd>▼</kbd>
                  <kbd>◀</kbd>
                  <kbd>▶</kbd>
                </div>
              </div>
              <div className="shortcut-row">
                <span>Center focus to root</span>
                <kbd>Esc</kbd>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Export Options modal overlay */}
      {showExport && (
        <div className="modal-overlay" onClick={() => setShowExport(false)}>
          <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Export Mind Map</h3>
              <button className="card-icon-btn" onClick={() => setShowExport(false)}>
                <X size={18} />
              </button>
            </div>
            
            <div className="export-options-list">
              <div className="export-item" onClick={() => handleExport('markdown')}>
                <div className="export-item-info">
                  <div className="export-item-icon">
                    <Save size={20} />
                  </div>
                  <div className="export-item-text">
                    <h5>Markdown (.md)</h5>
                    <p>Hierarchical bulleted list outline format</p>
                  </div>
                </div>
              </div>

              <div className="export-item" onClick={() => handleExport('text')}>
                <div className="export-item-info">
                  <div className="export-item-icon">
                    <Save size={20} />
                  </div>
                  <div className="export-item-text">
                    <h5>Plain Text (.txt)</h5>
                    <p>Tab-indented outlines layout</p>
                  </div>
                </div>
              </div>

              <div className="export-item" onClick={() => handleExport('svg')}>
                <div className="export-item-info">
                  <div className="export-item-icon">
                    <Network size={20} />
                  </div>
                  <div className="export-item-text">
                    <h5>Vector Graphic (.svg)</h5>
                    <p>Scalable high-resolution diagram image</p>
                  </div>
                </div>
              </div>

              <div className="export-item" onClick={() => handleExport('json')}>
                <div className="export-item-info">
                  <div className="export-item-icon">
                    <Network size={20} style={{ color: 'var(--accent-success)' }} />
                  </div>
                  <div className="export-item-text">
                    <h5>JSON Backup (.mindmap)</h5>
                    <p>Full database state backup to import later</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Editor;
