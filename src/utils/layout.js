// Node size configurations
export const NODE_WIDTH = 180;
export const NODE_HEIGHT = 44;
export const ROOT_WIDTH = 200;
export const ROOT_HEIGHT = 56;
export const MAX_NODE_WIDTH = 300;
export const LINE_HEIGHT = 20;

const HORIZONTAL_GAP = 80;
const VERTICAL_GAP = 20;

const ORG_HORIZONTAL_GAP = 36;
const ORG_VERTICAL_GAP = 56;

/**
 * Calculates dynamic width and height based on text lines and wrapping.
 * 
 * @param {string} text - The node's text content
 * @param {boolean} isRoot - Whether this is the root node
 * @param {boolean} hasEmoji - Whether node has an emoji badge
 * @param {boolean} hasNotes - Whether node has description notes
 * @returns {{ width: number, height: number, lines: number }}
 */
export function calculateNodeDimensions(text, isRoot = false, hasEmoji = false, hasNotes = false) {
  const content = (text || '').trim();
  const rawLines = content.split('\n');
  const emojiPadding = hasEmoji ? 24 : 0;
  const notesPadding = hasNotes ? 16 : 0;
  const baseHorizontalPadding = isRoot ? 48 : 32;

  // Maximum characters per line before soft-wrapping kicks in
  const maxCharsPerLine = isRoot ? 26 : 28;
  const charWidth = 7.5;

  let totalVisualLines = 0;
  let maxLineLength = 0;

  for (const line of rawLines) {
    const len = line.length;
    if (len === 0) {
      totalVisualLines += 1;
    } else {
      const wrapped = Math.ceil(len / maxCharsPerLine);
      totalVisualLines += Math.max(1, wrapped);
    }
    if (len > maxLineLength) {
      maxLineLength = len;
    }
  }

  totalVisualLines = Math.max(1, totalVisualLines);

  // Clamped width based on longest line
  const textWidth = Math.min(maxLineLength, maxCharsPerLine) * charWidth;
  const minWidth = isRoot ? ROOT_WIDTH : 120;
  const estimatedWidth = Math.round(
    Math.min(
      MAX_NODE_WIDTH,
      Math.max(minWidth, textWidth + baseHorizontalPadding + emojiPadding + notesPadding)
    )
  );

  // Height adapts to the number of visual lines
  const baseHeight = isRoot ? ROOT_HEIGHT : NODE_HEIGHT;
  const estimatedHeight = baseHeight + (totalVisualLines - 1) * LINE_HEIGHT;

  return {
    width: estimatedWidth,
    height: estimatedHeight,
    lines: totalVisualLines,
  };
}

/**
 * Computes coordinate positions (x, y) for all nodes in the mind map.
 * Returns an object mapping node ID to { x, y, width, height, side }.
 * 
 * Supported layout modes:
 * - 'split': Symmetrical radial horizontal mind map
 * - 'right': Horizontal tree to the right
 * - 'left': Horizontal tree to the left
 * - 'org': Top-down vertical organograma / org-chart
 * 
 * @param {Object} nodes - The flat nodes dictionary { [id]: node }
 * @param {string} [layoutMode] - 'split', 'right', 'left', or 'org'
 * @returns {Object} { [id]: { x, y, width, height, side } }
 */
export function calculateLayout(nodes, layoutMode = 'split') {
  if (!nodes || !nodes.root) return {};

  const layout = {};
  const nodeMeta = {};

  // ==========================================
  // Layout Engine: Organograma (Top-Down Tree)
  // ==========================================
  if (layoutMode === 'org') {
    function calculateOrgSubtree(nodeId) {
      const node = nodes[nodeId];
      if (!node) return { width: 0, height: 0, subtreeWidth: 0, subtreeHeight: 0 };

      const isRoot = nodeId === 'root';
      const dims = calculateNodeDimensions(node.text, isRoot, !!node.emoji, !!node.notes);
      const activeChildren = (node.children || []).filter(id => nodes[id]);

      nodeMeta[nodeId] = {
        id: nodeId,
        width: dims.width,
        height: dims.height,
        children: activeChildren,
        isCollapsed: !!node.isCollapsed,
      };

      if (node.isCollapsed || activeChildren.length === 0) {
        nodeMeta[nodeId].subtreeWidth = dims.width;
        nodeMeta[nodeId].subtreeHeight = dims.height;
        return nodeMeta[nodeId];
      }

      // Recursively calculate children subtrees
      activeChildren.forEach(childId => calculateOrgSubtree(childId));

      const childrenTotalWidth = activeChildren.reduce(
        (sum, childId) => sum + nodeMeta[childId].subtreeWidth,
        0
      ) + (activeChildren.length - 1) * ORG_HORIZONTAL_GAP;

      const maxChildHeight = Math.max(
        ...activeChildren.map(childId => nodeMeta[childId].subtreeHeight)
      );

      nodeMeta[nodeId].subtreeWidth = Math.max(dims.width, childrenTotalWidth);
      nodeMeta[nodeId].subtreeHeight = dims.height + ORG_VERTICAL_GAP + maxChildHeight;

      return nodeMeta[nodeId];
    }

    calculateOrgSubtree('root');

    const rootMeta = nodeMeta.root;
    layout.root = {
      x: 0,
      y: 0,
      width: rootMeta ? rootMeta.width : ROOT_WIDTH,
      height: rootMeta ? rootMeta.height : ROOT_HEIGHT,
      side: 'root',
    };

    function positionOrgChildren(children, parentX, parentY, parentHeight) {
      if (!children || children.length === 0) return;

      const childrenTotalWidth = children.reduce(
        (sum, childId) => sum + nodeMeta[childId].subtreeWidth,
        0
      ) + (children.length - 1) * ORG_HORIZONTAL_GAP;

      let currentX = parentX - childrenTotalWidth / 2;

      children.forEach(childId => {
        const meta = nodeMeta[childId];
        if (!meta) return;

        const childX = currentX + meta.subtreeWidth / 2;
        const childY = parentY + parentHeight / 2 + ORG_VERTICAL_GAP + meta.height / 2;

        layout[childId] = {
          x: childX,
          y: childY,
          width: meta.width,
          height: meta.height,
          side: 'bottom',
        };

        if (!meta.isCollapsed && meta.children.length > 0) {
          positionOrgChildren(meta.children, childX, childY, meta.height);
        }

        currentX += meta.subtreeWidth + ORG_HORIZONTAL_GAP;
      });
    }

    if (rootMeta && !rootMeta.isCollapsed) {
      positionOrgChildren(rootMeta.children, 0, 0, rootMeta.height);
    }

    return layout;
  }

  // ==========================================
  // Layout Engine: Horizontal (Split, Right, Left)
  // ==========================================
  function calculateHorizontalSubtree(nodeId) {
    const node = nodes[nodeId];
    if (!node) return 0;

    const isRoot = nodeId === 'root';
    const dims = calculateNodeDimensions(node.text, isRoot, !!node.emoji, !!node.notes);

    nodeMeta[nodeId] = {
      id: nodeId,
      width: dims.width,
      height: dims.height,
      children: node.children || [],
      isCollapsed: !!node.isCollapsed,
    };

    if (!isRoot && (node.isCollapsed || !node.children || node.children.length === 0)) {
      nodeMeta[nodeId].subtreeHeight = dims.height;
      return dims.height;
    }

    if (isRoot) {
      const children = (node.children || []).filter(id => nodes[id]);
      let leftChildren = [];
      let rightChildren = [];

      if (layoutMode === 'right') {
        rightChildren = children;
      } else if (layoutMode === 'left') {
        leftChildren = children;
      } else {
        // 'split': alternate even/odd
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

      leftChildren.forEach(childId => calculateHorizontalSubtree(childId));
      rightChildren.forEach(childId => calculateHorizontalSubtree(childId));

      const leftSubtreeHeight = leftChildren.reduce((sum, childId) => sum + nodeMeta[childId].subtreeHeight, 0) + 
                               Math.max(0, leftChildren.length - 1) * VERTICAL_GAP;
      const rightSubtreeHeight = rightChildren.reduce((sum, childId) => sum + nodeMeta[childId].subtreeHeight, 0) + 
                                Math.max(0, rightChildren.length - 1) * VERTICAL_GAP;

      nodeMeta[nodeId].leftSubtreeHeight = leftSubtreeHeight;
      nodeMeta[nodeId].rightSubtreeHeight = rightSubtreeHeight;
      nodeMeta[nodeId].subtreeHeight = Math.max(dims.height, leftSubtreeHeight, rightSubtreeHeight);
      return nodeMeta[nodeId].subtreeHeight;
    } else {
      let childrenHeight = 0;
      const activeChildren = (node.children || []).filter(id => nodes[id]);
      
      activeChildren.forEach(childId => {
        childrenHeight += calculateHorizontalSubtree(childId);
      });

      if (activeChildren.length > 0) {
        childrenHeight += (activeChildren.length - 1) * VERTICAL_GAP;
      }

      nodeMeta[nodeId].subtreeHeight = Math.max(dims.height, childrenHeight);
      return nodeMeta[nodeId].subtreeHeight;
    }
  }

  // Pass 1: compute all subtree heights
  calculateHorizontalSubtree('root');

  const rootMeta = nodeMeta.root;
  const rootWidth = rootMeta ? rootMeta.width : ROOT_WIDTH;
  const rootHeight = rootMeta ? rootMeta.height : ROOT_HEIGHT;

  layout.root = {
    x: 0,
    y: 0,
    width: rootWidth,
    height: rootHeight,
    side: 'root',
  };

  function positionHorizontalChildren(children, parentX, parentY, side) {
    if (!children || children.length === 0) return;

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
        side,
      };

      if (!meta.isCollapsed && meta.children.length > 0) {
        const activeGrandchildren = meta.children.filter(id => nodes[id]);
        positionHorizontalChildren(activeGrandchildren, layout[childId].x, childY, side);
      }

      currentY += meta.subtreeHeight + VERTICAL_GAP;
    });
  }

  if (rootMeta) {
    if (layoutMode === 'right') {
      positionHorizontalChildren(rootMeta.rightChildren, 0, 0, 'right');
    } else if (layoutMode === 'left') {
      positionHorizontalChildren(rootMeta.leftChildren, 0, 0, 'left');
    } else {
      positionHorizontalChildren(rootMeta.rightChildren, 0, 0, 'right');
      positionHorizontalChildren(rootMeta.leftChildren, 0, 0, 'left');
    }
  }

  return layout;
}
