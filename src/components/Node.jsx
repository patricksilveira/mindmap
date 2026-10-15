import { useEffect, useRef } from 'react';
import { FileText } from 'lucide-react';

function Node({
  node,
  layoutNode,
  isSelected,
  isEditing,
  initialEditChar,
  onStartEdit,
  onEndEdit,
  onSelect,
  onUpdateText,
  onToggleCollapse
}) {
  const inputRef = useRef(null);
  // Set when the user cancels with Escape, so the blur handler skips saving.
  const cancelRef = useRef(false);

  // Focus textarea when editing starts. With a type-to-edit seed the textarea is
  // pre-filled (defaultValue) and the cursor sits at the end; otherwise select
  // all so the first keystroke replaces the text.
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (!initialEditChar) {
        inputRef.current.select();
      }
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
    }
  }, [isEditing, initialEditChar]);

  if (!layoutNode) return null;

  const { x, y, width, height, side } = layoutNode;
  const isRoot = node.id === 'root';

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    onStartEdit(node.id);
  };

  const handleBlur = () => {
    if (cancelRef.current) {
      cancelRef.current = false;
      onEndEdit();
      return;
    }
    const value = inputRef.current ? inputRef.current.value.trim() : '';
    onEndEdit();
    if (value !== '' && value !== node.text) {
      onUpdateText(node.id, value);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Shift+Enter creates a new line within the node text
        e.stopPropagation();
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.style.height = 'auto';
            inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
          }
        }, 0);
      } else {
        e.preventDefault();
        // Stop the event reaching the window keydown handler: blur() below
        // changes activeElement synchronously, which would defeat that handler's
        // "editing an input?" guard and spawn a spurious sibling node.
        e.stopPropagation();
        inputRef.current.blur(); // Triggers blur/save logic
      }
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      cancelRef.current = true; // discard changes
      inputRef.current.blur();
    }
  };

  const handleInput = (e) => {
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  const handleClick = (e) => {
    e.stopPropagation();
    onSelect(node.id);
  };

  // Border styling
  const borderStyle = {
    borderColor: node.color || (isRoot ? 'var(--accent-primary)' : 'var(--border-color)'),
  };

  // Style properties for layout placement (using dynamic width and height)
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
      {/* Node Accent strip (tells which direction layout flows) */}
      {!isRoot && (
        <div 
          className={`node-side-bar ${side}`}
          style={{ backgroundColor: node.color || 'var(--border-color)' }}
        />
      )}

      <div className="node-card-content">
        {node.emoji && (
          <span style={{ fontSize: '1.1rem', marginRight: '2px', flexShrink: 0, alignSelf: 'flex-start' }}>
            {node.emoji}
          </span>
        )}

        {isEditing ? (
          <textarea
            ref={inputRef}
            rows={1}
            className="node-input"
            defaultValue={initialEditChar ?? node.text}
            onInput={handleInput}
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
