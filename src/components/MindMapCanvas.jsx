import React, { useRef, useState, useEffect } from 'react';
import Node from './Node';
import { calculateLayout, ROOT_WIDTH, ROOT_HEIGHT, NODE_WIDTH, NODE_HEIGHT } from '../utils/layout';

function MindMapCanvas({
  nodes,
  layoutMode,
  selectedNodeId,
  onSelectNode,
  editingNodeId,
  onStartEdit,
  onEndEdit,
  onUpdateNodeText,
  onAddChild,
  onAddSibling,
  onDeleteNode,
  onToggleCollapse,
  onReparentNode
}) {
  const containerRef = useRef(null);
  
  // Viewport zoom & pan states are self-contained here
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  
  // Drag & drop node state for reparenting
  const [draggedNodeId, setDraggedNodeId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [hoveredParentId, setHoveredParentId] = useState(null);

  // Compute positions
  const layout = calculateLayout(nodes, layoutMode);

  // Center the root node in the middle of the viewport on initial load
  useEffect(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPanX(rect.width / 2);
      setPanY(rect.height / 2);
    }
  }, []);

  // Window-level mouse listeners when panning to make the drag experience robust and smooth
  useEffect(() => {
    if (!isPanning) return;

    const handleWindowMouseMove = (e) => {
      setPanX(e.clientX - panStart.x);
      setPanY(e.clientY - panStart.y);
    };

    const handleWindowMouseUp = () => {
      setIsPanning(false);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, [isPanning, panStart]);

  // Zooming via mouse wheel
  const handleWheel = (e) => {
    e.preventDefault();
    let newZoom = zoom - e.deltaY * 0.001;
    newZoom = Math.max(0.4, Math.min(2.5, newZoom)); // constraints
    setZoom(newZoom);
  };

  // Panning start trigger
  const handleMouseDown = (e) => {
    // Only pan if we aren't clicking on interactive controls (like buttons, panels, or node cards)
    if (
      e.target.closest('.node-card') || 
      e.target.closest('.node-toggle-btn') || 
      e.target.closest('.inspector-panel') || 
      e.target.closest('.zoom-controls') ||
      e.button !== 0
    ) {
      return;
    }
    setIsPanning(true);
    setPanStart({ x: e.clientX - panX, y: e.clientY - panY });
  };

  // Dragging node trigger (panning is handled via window-level effect)
  const handleMouseMove = (e) => {
    if (draggedNodeId) {
      // Delta in screen pixels
      const deltaX = e.clientX - panStart.x;
      const deltaY = e.clientY - panStart.y;
      
      // Convert to canvas units
      const canvasDeltaX = deltaX / zoom;
      const canvasDeltaY = deltaY / zoom;
      
      setDragOffset({ x: canvasDeltaX, y: canvasDeltaY });

      // Find closest node to dragged node position (for reparenting highlight)
      const currentPos = layout[draggedNodeId];
      if (!currentPos) return;

      const dragX = currentPos.x + canvasDeltaX;
      const dragY = currentPos.y + canvasDeltaY;

      let closestId = null;
      let minDistance = 120; // threshold to activate hover drop-zone

      Object.keys(layout).forEach(id => {
        if (id === draggedNodeId) return; // itself
        // Can't reparent to one of its own descendants
        if (isDescendant(id, draggedNodeId)) return;

        const pos = layout[id];
        const dist = Math.hypot(pos.x - dragX, pos.y - dragY);
        if (dist < minDistance) {
          minDistance = dist;
          closestId = id;
        }
      });

      setHoveredParentId(closestId);
    }
  };

  // Helper to determine if nodeA is a descendant of nodeB
  const isDescendant = (nodeAId, nodeBId) => {
    let current = nodes[nodeAId];
    while (current && current.parentId) {
      if (current.parentId === nodeBId) return true;
      current = nodes[current.parentId];
    }
    return false;
  };

  // Mouse release for node dragging (panning mouse up is handled via window listener)
  const handleMouseUp = () => {
    if (draggedNodeId) {
      if (hoveredParentId) {
        onReparentNode(draggedNodeId, hoveredParentId);
      }
      setDraggedNodeId(null);
      setDragOffset({ x: 0, y: 0 });
      setHoveredParentId(null);
    }
  };

  // Node Drag Handlers
  const handleNodeDragStart = (nodeId, clientX, clientY) => {
    if (nodeId === 'root') return; // root node cannot be dragged / reparented
    setDraggedNodeId(nodeId);
    setPanStart({ x: clientX, y: clientY });
    setDragOffset({ x: 0, y: 0 });
    onSelectNode(nodeId);
  };

  // Recenter & Fit whole board logic
  const handleRecenter = () => {
    if (!containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const nodeIds = Object.keys(layout);
    
    if (nodeIds.length === 0) {
      setPanX(rect.width / 2);
      setPanY(rect.height / 2);
      setZoom(1);
      return;
    }
    
    // Calculate bounding box of all nodes
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    
    nodeIds.forEach(id => {
      const pos = layout[id];
      const left = pos.x - pos.width / 2;
      const right = pos.x + pos.width / 2;
      const top = pos.y - pos.height / 2;
      const bottom = pos.y + pos.height / 2;
      
      if (left < minX) minX = left;
      if (right > maxX) maxX = right;
      if (top < minY) minY = top;
      if (bottom > maxY) maxY = bottom;
    });
    
    const boardCenterX = (minX + maxX) / 2;
    const boardCenterY = (minY + maxY) / 2;
    
    const boardWidth = maxX - minX;
    const boardHeight = maxY - minY;
    
    // Fit viewport with 120px padding margin
    const padding = 120;
    const scaleX = (rect.width - padding) / boardWidth;
    const scaleY = (rect.height - padding) / boardHeight;
    
    // Clamp zoom value between 0.5 and 1.2
    let newZoom = Math.min(1.2, Math.max(0.5, Math.min(scaleX, scaleY)));
    
    setZoom(newZoom);
    setPanX(rect.width / 2 - boardCenterX * newZoom);
    setPanY(rect.height / 2 - boardCenterY * newZoom);
  };

  return (
    <div
      ref={containerRef}
      className={`canvas-viewport ${isPanning ? 'panning' : ''}`}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
    >
      {/* Interactive Background Grid */}
      <div className="canvas-grid-bg" />

      {/* Main Zoom/Pan content container */}
      <div
        className="canvas-content"
        style={{
          transform: `translate(${panX}px, ${panY}px) scale(${zoom})`,
          transition: isPanning || draggedNodeId ? 'none' : 'transform 0.2s cubic-bezier(0.1, 0.9, 0.2, 1)'
        }}
      >
        {/* SVG connection lines layer */}
        <svg className="connections-layer">
          {Object.keys(layout).map((id) => {
            if (id === 'root') return null;
            const node = nodes[id];
            if (!node || !node.parentId) return null;

            const parentPos = layout[node.parentId];
            const childPos = layout[id];
            if (!parentPos || !childPos) return null;

            const side = childPos.side;
            const parentWidth = parentPos.width;
            const childWidth = childPos.width;

            let startX = parentPos.x + (side === 'right' ? parentWidth / 2 : -parentWidth / 2);
            let startY = parentPos.y;
            
            // Adjust coordinates if dragged
            let endX = childPos.x - (side === 'right' ? childWidth / 2 : -childWidth / 2);
            let endY = childPos.y;

            if (id === draggedNodeId) {
              endX += dragOffset.x;
              endY += dragOffset.y;
            }

            const controlOffset = Math.min(80, Math.abs(endX - startX) * 0.5);
            const cp1X = startX + (side === 'right' ? controlOffset : -controlOffset);
            const cp1Y = startY;
            const cp2X = endX - (side === 'right' ? controlOffset : -controlOffset);
            const cp2Y = endY;

            const strokeColor = node.color || parentPos.color || 'var(--border-color)';
            
            return (
              <path
                key={`line-${id}`}
                d={`M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`}
                stroke={strokeColor}
                strokeWidth="2.5"
                fill="none"
                style={{
                  opacity: id === draggedNodeId ? 0.3 : 0.6,
                  transition: draggedNodeId ? 'none' : 'd 0.2s'
                }}
              />
            );
          })}
        </svg>

        {/* Nodes Layer */}
        <div className="nodes-layer">
          {Object.keys(layout).map((id) => {
            const node = nodes[id];
            if (!node) return null;

            let layoutNode = { ...layout[id] };
            
            // Apply drag offset dynamically
            if (id === draggedNodeId) {
              layoutNode.x += dragOffset.x;
              layoutNode.y += dragOffset.y;
            }

            const isSelected = selectedNodeId === id;
            const isEditing = editingNodeId === id;
            const isHoverTarget = hoveredParentId === id;

            return (
              <div 
                key={`node-wrapper-${id}`}
                style={{
                  position: 'absolute',
                  pointerEvents: 'none',
                  left: 0,
                  top: 0,
                  width: '100%',
                  height: '100%'
                }}
                onMouseDown={(e) => {
                  // Initiate card drag
                  if (e.button === 0 && (e.target.classList.contains('node-card') || e.target.closest('.node-card'))) {
                    // Exclude drag initiation if currently editing input
                    if (e.target.classList.contains('node-input')) return;
                    handleNodeDragStart(id, e.clientX, e.clientY);
                  }
                }}
              >
                <Node
                  node={node}
                  layoutNode={layoutNode}
                  isSelected={isSelected}
                  isEditing={isEditing}
                  onStartEdit={onStartEdit}
                  onEndEdit={onEndEdit}
                  onSelect={onSelectNode}
                  onUpdateText={onUpdateNodeText}
                  onAddChild={onAddChild}
                  onAddSibling={onAddSibling}
                  onDelete={onDeleteNode}
                  onToggleCollapse={onToggleCollapse}
                />
                
                {/* Visual parent drop target indicator */}
                {isHoverTarget && (
                  <div
                    style={{
                      position: 'absolute',
                      left: `${layoutNode.x - layoutNode.width / 2 - 4}px`,
                      top: `${layoutNode.y - layoutNode.height / 2 - 4}px`,
                      width: `${layoutNode.width + 8}px`,
                      height: `${layoutNode.height + 8}px`,
                      border: '2px dashed var(--accent-primary)',
                      borderRadius: id === 'root' ? '16px' : '12px',
                      pointerEvents: 'none',
                      animation: 'pulse 1.5s infinite',
                      zIndex: 99
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Viewport Zoom Overlay widgets */}
      <div className="zoom-controls" onMouseDown={e => e.stopPropagation()}>
        <button className="zoom-btn" onClick={() => setZoom(prev => Math.min(2.5, prev + 0.1))} title="Zoom In">+</button>
        <div className="zoom-level">{Math.round(zoom * 100)}%</div>
        <button className="zoom-btn" onClick={() => setZoom(prev => Math.max(0.4, prev - 0.1))} title="Zoom Out">-</button>
        <button 
          className="zoom-btn" 
          style={{ fontSize: '0.75rem', fontWeight: 'normal' }}
          onClick={handleRecenter}
          title="Recenter and Fit Map"
        >
          Center
        </button>
      </div>
    </div>
  );
}

export default MindMapCanvas;
