// Node size configurations
export const NODE_WIDTH = 180;
export const NODE_HEIGHT = 44;
export const ROOT_WIDTH = 200;
export const ROOT_HEIGHT = 56;

const HORIZONTAL_GAP = 80;
const VERTICAL_GAP = 20;

/**
 * Computes coordinate positions (x, y) for all nodes in the mind map.
 * Returns an object mapping node ID to { x, y, width, height, side }.
 * 
 * @param {Object} nodes - The flat nodes dictionary { [id]: node }
 * @param {string} [layoutMode] - 'split' (symmetrical) or 'right' (all right)
 * @returns {Object} { [id]: { x, y, width, height, side } }
 */
export function calculateLayout(nodes, layoutMode = 'split') {
  if (!nodes || !nodes.root) return {};

  const layout = {};
  const rootNode = nodes.root;

  // Initialize layout metadata for nodes
  const nodeMeta = {};
  
  // Helper to calculate subtree heights
  function calculateSubtreeHeight(nodeId) {
    const node = nodes[nodeId];
    if (!node) return 0;

    const isRoot = nodeId === 'root';
    
    // Estimate width dynamically based on text length
    const text = node.text || '';
    const emojiPadding = node.emoji ? 24 : 0;
    const notesPadding = node.notes ? 16 : 0;
    
    const estimatedWidth = isRoot 
      ? Math.max(ROOT_WIDTH, Math.min(320, text.length * 8 + 48 + emojiPadding))
      : Math.max(120, Math.min(300, text.length * 8 + 32 + emojiPadding + notesPadding));

    const width = estimatedWidth;
    const height = isRoot ? ROOT_HEIGHT : NODE_HEIGHT;
    
    nodeMeta[nodeId] = {
      id: nodeId,
      width,
      height,
      children: node.children || [],
      isCollapsed: !!node.isCollapsed,
    };

    if (!isRoot && (node.isCollapsed || !node.children || node.children.length === 0)) {
      nodeMeta[nodeId].subtreeHeight = height;
      return height;
    }

    // Root node requires separate layout calculations for left and right
    if (isRoot) {
      // Split root children
      const children = node.children.filter(id => nodes[id]);
      let leftChildren = [];
      let rightChildren = [];

      if (layoutMode === 'right') {
        rightChildren = children;
      } else {
        // split symmetrically
        children.forEach((childId, index) => {
          if (index % 2 === 0) {
            rightChildren.push(childId);
          } else {
            leftChildren.push(childId);
          }
        });
      }

      nodeMeta[nodeId].leftChildren = leftChildren;
      nodeMeta[nodeId].rightChildren = rightChildren;

      // Calculate subtree heights of children
      leftChildren.forEach(childId => calculateSubtreeHeight(childId));
      rightChildren.forEach(childId => calculateSubtreeHeight(childId));

      const leftSubtreeHeight = leftChildren.reduce((sum, childId) => sum + nodeMeta[childId].subtreeHeight, 0) + 
                               Math.max(0, leftChildren.length - 1) * VERTICAL_GAP;
      const rightSubtreeHeight = rightChildren.reduce((sum, childId) => sum + nodeMeta[childId].subtreeHeight, 0) + 
                                Math.max(0, rightChildren.length - 1) * VERTICAL_GAP;

      nodeMeta[nodeId].leftSubtreeHeight = leftSubtreeHeight;
      nodeMeta[nodeId].rightSubtreeHeight = rightSubtreeHeight;
      nodeMeta[nodeId].subtreeHeight = Math.max(height, leftSubtreeHeight, rightSubtreeHeight);
      return nodeMeta[nodeId].subtreeHeight;
    } else {
      // Non-root nodes layout children in a single direction
      let childrenHeight = 0;
      const activeChildren = node.children.filter(id => nodes[id]);
      
      activeChildren.forEach(childId => {
        childrenHeight += calculateSubtreeHeight(childId);
      });

      if (activeChildren.length > 0) {
        childrenHeight += (activeChildren.length - 1) * VERTICAL_GAP;
      }

      nodeMeta[nodeId].subtreeHeight = Math.max(height, childrenHeight);
      return nodeMeta[nodeId].subtreeHeight;
    }
  }

  // Pass 1: compute all subtree heights
  calculateSubtreeHeight('root');

  const rootMeta = nodeMeta.root;
  const rootWidth = rootMeta ? rootMeta.width : ROOT_WIDTH;

  // Position root at (0, 0)
  layout.root = {
    x: 0,
    y: 0,
    width: rootWidth,
    height: ROOT_HEIGHT,
    side: 'root'
  };

  // Helper to position a list of child subtrees in a given direction
  function positionChildren(children, parentX, parentY, side) {
    if (children.length === 0) return;

    // Sum subtree heights
    const totalSubtreeHeight = children.reduce((sum, childId) => sum + nodeMeta[childId].subtreeHeight, 0) +
                               (children.length - 1) * VERTICAL_GAP;

    const direction = side === 'right' ? 1 : -1;
    let currentY = parentY - totalSubtreeHeight / 2;

    const parentId = nodes[children[0]]?.parentId;
    const parentWidth = (parentId && nodeMeta[parentId]) ? nodeMeta[parentId].width : ROOT_WIDTH;

    children.forEach(childId => {
      const meta = nodeMeta[childId];
      if (!meta) return;

      const childY = currentY + meta.subtreeHeight / 2;

      layout[childId] = {
        x: direction === 1 
          ? parentX + parentWidth / 2 + HORIZONTAL_GAP + meta.width / 2
          : parentX - parentWidth / 2 - HORIZONTAL_GAP - meta.width / 2,
        y: childY,
        width: meta.width,
        height: meta.height,
        side
      };

      // Recursively lay out grandchildren in the same side direction
      if (!meta.isCollapsed && meta.children.length > 0) {
        const activeGrandchildren = meta.children.filter(id => nodes[id]);
        positionChildren(activeGrandchildren, layout[childId].x, childY, side);
      }

      currentY += meta.subtreeHeight + VERTICAL_GAP;
    });
  }

  // Pass 2: Position all subtrees
  if (rootMeta) {
    if (layoutMode === 'right') {
      positionChildren(rootMeta.rightChildren, 0, 0, 'right');
    } else {
      positionChildren(rootMeta.rightChildren, 0, 0, 'right');
      positionChildren(rootMeta.leftChildren, 0, 0, 'left');
    }
  }

  return layout;
}
