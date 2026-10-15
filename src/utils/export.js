import { calculateLayout } from './layout';

/**
 * Converts a mind map into a hierarchical Markdown string.
 * @param {Object} map 
 * @returns {string}
 */
export function exportToMarkdown(map) {
  if (!map || !map.nodes || !map.nodes.root) return '';

  const { nodes } = map;

  function traverse(nodeId, depth = 0) {
    const node = nodes[nodeId];
    if (!node) return '';

    const emojiStr = node.emoji ? `${node.emoji} ` : '';
    let result = '';

    if (depth === 0) {
      result += `# ${emojiStr}${node.text}\n\n`;
    } else {
      const indent = '  '.repeat(depth - 1);
      result += `${indent}- ${emojiStr}${node.text}`;
      if (node.notes) {
        result += ` *(Note: ${node.notes})*`;
      }
      result += '\n';
    }

    if (node.children && !node.isCollapsed) {
      node.children.forEach(childId => {
        result += traverse(childId, depth + 1);
      });
    }

    return result;
  }

  return traverse('root');
}

/**
 * Converts a mind map into an indented Plain Text outline.
 * @param {Object} map 
 * @returns {string}
 */
export function exportToText(map) {
  if (!map || !map.nodes || !map.nodes.root) return '';

  const { nodes } = map;

  function traverse(nodeId, depth = 0) {
    const node = nodes[nodeId];
    if (!node) return '';

    const indent = '    '.repeat(depth);
    const emojiStr = node.emoji ? `${node.emoji} ` : '';
    let result = `${indent}${emojiStr}${node.text}`;
    
    if (node.notes) {
      result += ` [Note: ${node.notes}]`;
    }
    result += '\n';

    if (node.children && !node.isCollapsed) {
      node.children.forEach(childId => {
        result += traverse(childId, depth + 1);
      });
    }

    return result;
  }

  return traverse('root');
}

/**
 * Exports a mind map as a JSON file download.
 * @param {Object} map 
 * @returns {string}
 */
export function exportToJSON(map) {
  return JSON.stringify(map, null, 2);
}

/**
 * Converts a mind map layout into a fully-stylized, self-contained SVG image string.
 * @param {Object} map 
 * @param {string} layoutMode 
 * @param {boolean} isDarkMode
 * @returns {string}
 */
export function exportToSVG(map, layoutMode = 'split', isDarkMode = false) {
  if (!map || !map.nodes || !map.nodes.root) return '';

  const { nodes } = map;
  const layout = calculateLayout(nodes, layoutMode);
  const nodeIds = Object.keys(layout);

  if (nodeIds.length === 0) return '';

  // Determine bounding box
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  nodeIds.forEach(id => {
    const { x, y, width, height } = layout[id];
    const left = x - width / 2;
    const right = x + width / 2;
    const top = y - height / 2;
    const bottom = y + height / 2;

    if (left < minX) minX = left;
    if (right > maxX) maxX = right;
    if (top < minY) minY = top;
    if (bottom > maxY) maxY = bottom;
  });

  // Add padding
  const padding = 100;
  minX -= padding;
  maxX += padding;
  minY -= padding;
  maxY += padding;

  const width = maxX - minX;
  const height = maxY - minY;

  // Background and text colors
  const bgColor = isDarkMode ? '#0f172a' : '#f8fafc';
  const textColor = isDarkMode ? '#f8fafc' : '#0f172a';
  const connectionColor = isDarkMode ? '#475569' : '#cbd5e1';

  let svgContent = `<?xml version="1.0" encoding="utf-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}">
  <!-- Background -->
  <rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="${bgColor}" />
  
  <!-- Connections (Lines) -->
  <g stroke-linecap="round" fill="none">
`;

  // Draw connecting Bezier curves
  nodeIds.forEach(id => {
    if (id === 'root') return;
    const node = nodes[id];
    if (!node || !node.parentId) return;

    const parentPos = layout[node.parentId];
    const childPos = layout[id];
    if (!parentPos || !childPos) return;

    // Start coordinates (edge of parent). Use the layout's dynamic widths so
    // lines terminate at the real card edges (matching the on-screen canvas),
    // not the fixed NODE_WIDTH/ROOT_WIDTH defaults.
    const side = childPos.side;
    const parentWidth = parentPos.width;
    const childWidth = childPos.width;

    let startX, startY, endX, endY, cp1X, cp1Y, cp2X, cp2Y;

    if (side === 'bottom') {
      startX = parentPos.x;
      startY = parentPos.y + parentPos.height / 2;
      endX = childPos.x;
      endY = childPos.y - childPos.height / 2;

      const controlOffset = Math.min(60, Math.abs(endY - startY) * 0.5);
      cp1X = startX;
      cp1Y = startY + controlOffset;
      cp2X = endX;
      cp2Y = endY - controlOffset;
    } else {
      startX = parentPos.x + (side === 'right' ? parentWidth / 2 : -parentWidth / 2);
      startY = parentPos.y;
      endX = childPos.x - (side === 'right' ? childWidth / 2 : -childWidth / 2);
      endY = childPos.y;

      const controlOffset = Math.min(80, Math.abs(endX - startX) * 0.5);
      cp1X = startX + (side === 'right' ? controlOffset : -controlOffset);
      cp1Y = startY;
      cp2X = endX - (side === 'right' ? controlOffset : -controlOffset);
      cp2Y = endY;
    }

    // Use parent or node's color with opacity for connections
    const strokeColor = node.color || parentPos.color || connectionColor;

    svgContent += `    <path d="M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}" stroke="${strokeColor}" stroke-width="2.5" opacity="0.6" />\n`;
  });

  svgContent += `  </g>
  
  <!-- Nodes -->
  <g font-family="system-ui, -apple-system, sans-serif">
`;

  // Draw node cards
  nodeIds.forEach(id => {
    const node = nodes[id];
    if (!node) return;

    const { x, y, width: nWidth, height: nHeight } = layout[id];
    const isRoot = id === 'root';
    const rx = isRoot ? 12 : 8;
    
    // Background and stroke colors
    const cardBg = isDarkMode ? '#1e293b' : '#ffffff';
    const accentColor = node.color || '#6366f1';
    const cardShadow = isDarkMode ? 'rgba(0, 0, 0, 0.4)' : 'rgba(100, 116, 139, 0.12)';

    // SVG elements for each node card
    svgContent += `    <!-- Node: ${(node.text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')} -->\n`;
    svgContent += `    <g transform="translate(${x - nWidth / 2}, ${y - nHeight / 2})">\n`;
    
    // Shadow rect
    svgContent += `      <rect x="0" y="3" width="${nWidth}" height="${nHeight}" rx="${rx}" fill="${cardShadow}" filter="blur(2px)" />\n`;
    // Border accent strip or border outline
    svgContent += `      <rect x="0" y="0" width="${nWidth}" height="${nHeight}" rx="${rx}" fill="${cardBg}" stroke="${accentColor}" stroke-width="${isRoot ? 3 : 1.5}" />\n`;
    
    // Colored top/left/right indicator bar for child nodes
    if (!isRoot) {
      const side = layout[id].side;
      if (side === 'bottom') {
        svgContent += `      <path d="M 8 0 L ${nWidth - 8} 0" stroke="${accentColor}" stroke-width="4" stroke-linecap="round" />\n`;
      } else if (side === 'right') {
        svgContent += `      <path d="M 0 4 L 0 ${nHeight - 4}" stroke="${accentColor}" stroke-width="4" stroke-linecap="round" />\n`;
      } else {
        svgContent += `      <path d="M ${nWidth} 4 L ${nWidth} ${nHeight - 4}" stroke="${accentColor}" stroke-width="4" stroke-linecap="round" />\n`;
      }
    }

    // Node content (Emoji + Text)
    const emojiStr = node.emoji || '';
    const emojiPadding = emojiStr ? 24 : 0;
    
    let textX = isRoot ? nWidth / 2 : (layout[id].side === 'right' ? 16 + emojiPadding : 16 + emojiPadding);
    const textAnchor = isRoot ? 'middle' : 'start';
    const fontSize = isRoot ? '15px' : '13px';
    const fontWeight = isRoot ? 'bold' : '500';

    // Emoji icon
    if (emojiStr) {
      const emojiX = isRoot ? nWidth / 2 - 35 : (layout[id].side === 'right' ? 14 : 14);
      svgContent += `      <text x="${emojiX}" y="${nHeight / 2 + 5}" font-size="14px">${emojiStr}</text>\n`;
    }

    // Node text (handling multiline text with tspans)
    const rawLines = (node.text || 'New Node').split('\n');
    const lineHeight = 18;
    const startY = (nHeight - (rawLines.length - 1) * lineHeight) / 2 + 4;

    if (rawLines.length > 1) {
      svgContent += `      <text x="${textX}" y="${startY}" text-anchor="${textAnchor}" fill="${textColor}" font-size="${fontSize}" font-weight="${fontWeight}">\n`;
      rawLines.forEach((line, index) => {
        const safeLine = line
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
        svgContent += `        <tspan x="${textX}" dy="${index === 0 ? 0 : lineHeight}">${safeLine}</tspan>\n`;
      });
      svgContent += `      </text>\n`;
    } else {
      const safeText = (node.text || 'New Node')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
      svgContent += `      <text x="${textX}" y="${nHeight / 2 + 5}" text-anchor="${textAnchor}" fill="${textColor}" font-size="${fontSize}" font-weight="${fontWeight}">${safeText}</text>\n`;
    }
    
    // Collapsed branches indicator
    if (node.isCollapsed && node.children && node.children.length > 0) {
      const side = layout[id].side;
      let indicatorX, indicatorY;
      if (side === 'bottom') {
        indicatorX = nWidth / 2;
        indicatorY = nHeight + 6;
      } else {
        indicatorX = side === 'right' ? nWidth + 6 : -6;
        indicatorY = nHeight / 2;
      }
      svgContent += `      <circle cx="${indicatorX}" cy="${indicatorY}" r="5" fill="${accentColor}" />\n`;
      svgContent += `      <text x="${indicatorX}" y="${indicatorY + 3}" text-anchor="middle" fill="#ffffff" font-size="8px" font-weight="bold">+</text>\n`;
    }

    svgContent += `    </g>\n`;
  });

  svgContent += `  </g>
</svg>`;

  return svgContent;
}

/**
 * Triggers a browser download of a text/data content.
 * @param {string} filename 
 * @param {string} content 
 * @param {string} contentType 
 */
export function downloadFile(filename, content, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
