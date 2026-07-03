import React, { useState, useEffect, useRef } from 'react';
import { FileText } from 'lucide-react';

function Node({ 
  node, 
  layoutNode, 
  isSelected, 
  isEditing,
  onStartEdit,
  onEndEdit,
  onSelect, 
  onUpdateText, 
  onAddChild, 
  onAddSibling, 
  onDelete, 
  onToggleCollapse 
}) {
  const [editValue, setEditValue] = useState(node.text);
  const inputRef = useRef(null);

  // Sync state with node text if updated elsewhere
  useEffect(() => {
    setEditValue(node.text);
  }, [node.text]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  if (!layoutNode) return null;

  const { x, y, width, height, side } = layoutNode;
  const isRoot = node.id === 'root';

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    onStartEdit(node.id);
  };

  const handleBlur = () => {
    onEndEdit();
    if (editValue.trim() !== '' && editValue !== node.text) {
      onUpdateText(node.id, editValue.trim());
    } else {
      setEditValue(node.text); // reset to original
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      inputRef.current.blur(); // Triggers blur/save logic
    } else if (e.key === 'Escape') {
      setEditValue(node.text); // cancel change
      onEndEdit();
      e.stopPropagation();
    }
  };

  const handleClick = (e) => {
    e.stopPropagation();
    onSelect(node.id);
  };

  // Border styling
  const borderStyle = {
    borderColor: node.color || (isRoot ? 'var(--accent-primary)' : 'var(--border-color)'),
  };

  // Style properties for layout placement (using dynamic width)
  const style = {
    left: `${x - width / 2}px`,
    top: `${y - height / 2}px`,
    width: `${width}px`,
    height: `${height}px`,
    zIndex: isSelected ? 100 : 10,
    ...borderStyle
  };

  // Node collapse trigger positioning
  const hasChildren = node.children && node.children.length > 0;
  const showCollapseToggle = hasChildren && !isRoot;

  return (
    <div 
      className={`node-card ${isRoot ? 'root' : ''} ${isSelected ? 'selected' : ''}`}
      style={style}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {/* Node Accent Left/Right strip (tells which direction layout flows) */}
      {!isRoot && (
        <div 
          className={`node-side-bar ${side}`}
          style={{ backgroundColor: node.color || 'var(--border-color)' }}
        />
      )}

      <div className="node-card-content">
        {node.emoji && (
          <span style={{ fontSize: '1.1rem', marginRight: '2px', flexShrink: 0 }}>
            {node.emoji}
          </span>
        )}

        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            className="node-input"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="node-text">{node.text || 'New Node'}</span>
        )}

        {/* Small indicator if notes are present */}
        {node.notes && !isEditing && (
          <span className="node-indicator" title={node.notes}>
            <FileText size={12} />
          </span>
        )}
      </div>

      {/* Collapse/Expand Toggle Button */}
      {showCollapseToggle && (
        <button 
          className={`node-toggle-btn ${side}`}
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse(node.id);
          }}
          title={node.isCollapsed ? 'Expand branches' : 'Collapse branches'}
        >
          {node.isCollapsed ? '+' : '-'}
        </button>
      )}
    </div>
  );
}

export default Node;
