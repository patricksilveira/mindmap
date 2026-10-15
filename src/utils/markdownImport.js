const DEFAULT_COLORS = [
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

// Regex for extracting a leading emoji (standard unicode emojis)
const LEADING_EMOJI_REGEX = /^(\p{Extended_Pictographic}|\p{Emoji_Presentation})\s*/u;

// Regex for trailing note patterns: *(Note: text)*, *(Nota: text)*, [Note: text], (Note: text)
// Requires explicit Note: or Nota: (or explicit *parentheses*) so sentences ending in normal parens like "(ex: IA)" aren't captured as notes
const NOTE_REGEX = /(?:\s*(?:\\?\*\((?:(?:Note|Nota):\s*)?([^)]+)\)\\?\*|\\?\[(?:Note|Nota):\s*([^\]]+)\\?\]|\\?\((?:Note|Nota):\s*([^)]+)\\?\)))\s*$/i;

/**
 * Unescapes markdown backslash-escaped characters and cleans common markdown escape artifacts.
 * e.g. \(ex: IA\) -> (ex: IA)
 *      processo\. -> processo.
 *      \[item\] -> [item]
 *      \*bold\* -> bold
 * @param {string} str
 * @returns {string}
 */
export function unescapeMarkdown(str) {
  if (!str) return '';
  let result = str
    // Replace HTML line breaks with newlines
    .replace(/<br\s*\/?>/gi, '\n')
    // Unescape markdown backslash escapes: \( -> (, \) -> ), \. -> ., etc.
    .replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, '$1');

  // Handle double-escaped punctuation if present (e.g. \\( -> \()
  if (result.includes('\\')) {
    result = result.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g, '$1');
  }

  // Strip markdown bold / italic wrappers if wrapped: **text** -> text, *text* -> text
  result = result
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(^|[^*])\*([^*\n]+)\*([^*]|$)/g, '$1$2$3')
    .replace(/(^|[^_])_([^_\n]+)_([^_]|$)/g, '$1$2$3')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1');

  // Clean trailing backslashes at end of line (markdown line break)
  result = result.replace(/\\(?:\r?\n|$)/g, '\n').replace(/\\(?=\s|$)/g, '');

  return result.trim();
}

/**
 * Parses line content to extract text, optional emoji, and optional note.
 * @param {string} rawContent
 * @returns {{ text: string, emoji: string, notes: string }}
 */
function parseLineContent(rawContent) {
  let content = rawContent.trim();
  let emoji = '';
  let notes = '';

  // Extract trailing note if present
  const noteMatch = content.match(NOTE_REGEX);
  if (noteMatch) {
    notes = (noteMatch[1] || noteMatch[2] || noteMatch[3] || '').trim();
    content = content.replace(NOTE_REGEX, '').trim();
  }

  // Extract task checkbox if present: [ ] or [x] or [X]
  const checkboxMatch = content.match(/^\[([ xX])\]\s*/);
  if (checkboxMatch) {
    const isChecked = checkboxMatch[1].toLowerCase() === 'x';
    emoji = isChecked ? '✅' : '⬜';
    content = content.replace(/^\[([ xX])\]\s*/, '').trim();
  }

  // Extract leading emoji if present
  const emojiMatch = content.match(LEADING_EMOJI_REGEX);
  if (emojiMatch) {
    if (!emoji) emoji = emojiMatch[1];
    content = content.replace(LEADING_EMOJI_REGEX, '').trim();
  }

  // Check for standalone markdown link: [Label](url)
  const standaloneLink = content.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
  if (standaloneLink) {
    content = standaloneLink[1];
    if (!notes) {
      notes = standaloneLink[2];
    }
  }

  // Unescape backslash escapes and formatting artifacts
  content = unescapeMarkdown(content);
  notes = unescapeMarkdown(notes);

  // Fallback to "Topic" if empty
  const text = content || 'Topic';

  return { text, emoji, notes };
}

/**
 * Parses hierarchical Markdown string (bullet lists and/or headings)
 * into a mind map data structure.
 * 
 * @param {string} markdown - The markdown content to import
 * @param {string} [fallbackName] - Optional fallback name if no root title is found
 * @returns {Object} Complete mind map object
 */
export function parseMarkdownToMindMap(markdown, fallbackName = 'Imported Mind Map') {
  if (!markdown || typeof markdown !== 'string') {
    throw new Error('Markdown content is empty or invalid.');
  }

  const rawLines = markdown.split(/\r?\n/);
  const parsedItems = [];

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    // Skip empty lines
    if (!rawLine.trim()) continue;

    // 1. Check for heading: e.g. "# Title" or "\# Title"
    const headingMatch = rawLine.match(/^(\s*)\\?(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const headingLevel = headingMatch[2].length;
      const { text, emoji, notes } = parseLineContent(headingMatch[3]);
      parsedItems.push({
        type: 'heading',
        level: headingLevel,
        text,
        emoji,
        notes,
      });
      continue;
    }

    // 2. Check for bullet or numbered list: e.g. "- Item", "  * Subitem", "    1. Step"
    // Also supports escaped bullet prefixes like "\- Item", "\* Item", or "1\. Item"
    const listMatch = rawLine.match(/^(\s*)(?:\\?[-*+]|\d+\\?\.)\s+(.*)$/);
    if (listMatch) {
      const leadingWhitespace = listMatch[1];
      // Calculate indent depth (support tabs or 2/4 spaces)
      const tabCount = (leadingWhitespace.match(/\t/g) || []).length;
      const spaceCount = leadingWhitespace.replace(/\t/g, '').length;
      const indentDepth = tabCount + Math.floor(spaceCount / 2);
      const { text, emoji, notes } = parseLineContent(listMatch[2]);

      parsedItems.push({
        type: 'list',
        depth: indentDepth,
        text,
        emoji,
        notes,
      });
      continue;
    }

    // 3. Blockquote: e.g. "> Quote text"
    const quoteMatch = rawLine.match(/^(\s*)>\s+(.*)$/);
    if (quoteMatch) {
      const leadingWhitespace = quoteMatch[1];
      const tabCount = (leadingWhitespace.match(/\t/g) || []).length;
      const spaceCount = leadingWhitespace.replace(/\t/g, '').length;
      const indentDepth = tabCount + Math.floor(spaceCount / 2);
      const { text, emoji, notes } = parseLineContent(quoteMatch[2]);

      parsedItems.push({
        type: 'list',
        depth: indentDepth,
        text,
        emoji: emoji || '💬',
        notes,
      });
      continue;
    }

    // 4. Plain paragraph text: treat as top-level or child item
    const { text, emoji, notes } = parseLineContent(rawLine);
    parsedItems.push({
      type: 'paragraph',
      depth: 0,
      text,
      emoji,
      notes,
    });
  }

  if (parsedItems.length === 0) {
    throw new Error('No valid topics or items found in Markdown content.');
  }

  const timestamp = Date.now();
  const mapId = `map-${timestamp}`;
  let counter = 1;

  // Determine root node
  let rootIndex = 0;
  let rootItem = parsedItems[0];

  // If first item is a heading level 1, use it as root
  const firstH1 = parsedItems.findIndex(item => item.type === 'heading' && item.level === 1);
  if (firstH1 !== -1) {
    rootIndex = firstH1;
    rootItem = parsedItems[firstH1];
  }

  const mapName = rootItem.text || fallbackName;

  const nodes = {
    root: {
      id: 'root',
      text: mapName,
      emoji: rootItem.emoji || '💡',
      color: DEFAULT_COLORS[0],
      children: [],
      notes: rootItem.notes || '',
      isRoot: true,
    }
  };

  // Stack to track hierarchy: each entry is { virtualLevel, id, color }
  // virtualLevel: integer reflecting tree depth (root is 0)
  const stack = [{ virtualLevel: 0, id: 'root', color: DEFAULT_COLORS[0] }];
  let topBranchCount = 0;

  // Process remaining items into the tree
  for (let i = 0; i < parsedItems.length; i++) {
    if (i === rootIndex) continue; // skip the node chosen as root

    const item = parsedItems[i];
    let virtualLevel;

    if (item.type === 'heading') {
      // Headings have levels relative to root (e.g. H2 -> level 1, H3 -> level 2)
      const baseHeadingLevel = (firstH1 !== -1 ? 1 : Math.min(...parsedItems.filter(p => p.type === 'heading').map(p => p.level)));
      virtualLevel = Math.max(1, item.level - baseHeadingLevel + 1);
    } else {
      // List items: virtual level is depth + 1
      virtualLevel = item.depth + 1;
    }

    // Pop stack until parent has a strictly smaller virtualLevel
    while (stack.length > 1 && stack[stack.length - 1].virtualLevel >= virtualLevel) {
      stack.pop();
    }

    const parent = stack[stack.length - 1];
    const nodeId = `node-${timestamp}-${counter++}`;

    // Color logic: top-level children of root cycle through palette;
    // deeper descendants inherit their branch ancestor's color.
    let nodeColor = parent.color;
    if (parent.id === 'root') {
      nodeColor = DEFAULT_COLORS[topBranchCount % DEFAULT_COLORS.length];
      topBranchCount++;
    }

    nodes[nodeId] = {
      id: nodeId,
      text: item.text,
      emoji: item.emoji,
      color: nodeColor,
      children: [],
      notes: item.notes,
      parentId: parent.id,
    };

    // Link into parent's children
    nodes[parent.id].children.push(nodeId);

    // Push current node to stack
    stack.push({
      virtualLevel,
      id: nodeId,
      color: nodeColor,
    });
  }

  return {
    id: mapId,
    name: mapName,
    lastUpdated: new Date().toISOString(),
    nodeCount: Object.keys(nodes).length,
    layoutMode: 'split',
    nodes,
  };
}
