import { describe, it, expect } from 'vitest';
import { parseMarkdownToMindMap } from './markdownImport';
import { exportToMarkdown } from './export';

describe('parseMarkdownToMindMap', () => {
  it('parses standard bulleted lists with a root heading', () => {
    const md = `# Project Roadmap

- 🚀 Phase 1
  - Task A
  - Task B *(Note: Urgent)*
- 🎯 Phase 2
  - Task C
`;
    const map = parseMarkdownToMindMap(md);
    expect(map.name).toBe('Project Roadmap');
    expect(map.nodes.root.text).toBe('Project Roadmap');
    expect(map.nodes.root.children).toHaveLength(2);

    const phase1Id = map.nodes.root.children[0];
    const phase1 = map.nodes[phase1Id];
    expect(phase1.text).toBe('Phase 1');
    expect(phase1.emoji).toBe('🚀');
    expect(phase1.children).toHaveLength(2);

    const taskBId = phase1.children[1];
    const taskB = map.nodes[taskBId];
    expect(taskB.text).toBe('Task B');
    expect(taskB.notes).toBe('Urgent');
  });

  it('parses pure markdown headings hierarchy', () => {
    const md = `# Architecture
## Backend
### Database
### API
## Frontend
### React
`;
    const map = parseMarkdownToMindMap(md);
    expect(map.name).toBe('Architecture');
    expect(map.nodes.root.children).toHaveLength(2);

    const backendId = map.nodes.root.children[0];
    expect(map.nodes[backendId].text).toBe('Backend');
    expect(map.nodes[backendId].children).toHaveLength(2);

    const dbId = map.nodes[backendId].children[0];
    expect(map.nodes[dbId].text).toBe('Database');
  });

  it('parses bullet lists without a heading by using first item as root', () => {
    const md = `- Root Concept
  - Child 1
    - Grandchild 1
  - Child 2
`;
    const map = parseMarkdownToMindMap(md);
    expect(map.name).toBe('Root Concept');
    expect(map.nodes.root.children).toHaveLength(2);

    const child1Id = map.nodes.root.children[0];
    expect(map.nodes[child1Id].children).toHaveLength(1);
  });

  it('assigns branch colors to top-level children and inherits downwards', () => {
    const md = `# Multi-Branch
- Branch Alpha
  - Sub Alpha
- Branch Beta
  - Sub Beta
`;
    const map = parseMarkdownToMindMap(md);
    const alphaId = map.nodes.root.children[0];
    const betaId = map.nodes.root.children[1];
    expect(map.nodes[alphaId].color).not.toBe(map.nodes[betaId].color);

    const subAlphaId = map.nodes[alphaId].children[0];
    expect(map.nodes[subAlphaId].color).toBe(map.nodes[alphaId].color);
  });

  it('roundtrips cleanly with exportToMarkdown', () => {
    const original = `# Main Idea

- Subtopic 1
  - Detail 1
- Subtopic 2
`;
    const map = parseMarkdownToMindMap(original);
    const exported = exportToMarkdown(map);
    const reimported = parseMarkdownToMindMap(exported);

    expect(reimported.name).toBe('Main Idea');
    expect(reimported.nodes.root.children).toHaveLength(2);
  });

  it('unescapes backslash-escaped markdown formatting (user reported issue)', () => {
    const md = `# Inovação
- Implementar tecnologias e soluções novas \\(ex: IA\\) para resolver desafios, sem entender como elas vão ser incorporadas no processo\\.
`;
    const map = parseMarkdownToMindMap(md);
    const childId = map.nodes.root.children[0];
    const childNode = map.nodes[childId];

    expect(childNode.text).toBe(
      'Implementar tecnologias e soluções novas (ex: IA) para resolver desafios, sem entender como elas vão ser incorporadas no processo.'
    );
    expect(childNode.text).not.toContain('\\');
  });

  it('handles escaped bullets, escaped headings, and markdown formatting tags', () => {
    const md = `\\# Escaped Heading
\\- **Bold Title** com vírgula\\, e ponto\\.
  \\* *Italic Subtitle*
  1\\. Numbered step
`;
    const map = parseMarkdownToMindMap(md);
    expect(map.name).toBe('Escaped Heading');
    expect(map.nodes.root.children).toHaveLength(1);

    const firstChildId = map.nodes.root.children[0];
    const firstChild = map.nodes[firstChildId];
    expect(firstChild.text).toBe('Bold Title com vírgula, e ponto.');
    expect(firstChild.children).toHaveLength(2);

    const subId1 = firstChild.children[0];
    expect(map.nodes[subId1].text).toBe('Italic Subtitle');

    const subId2 = firstChild.children[1];
    expect(map.nodes[subId2].text).toBe('Numbered step');
  });

  it('converts markdown task checkboxes to emojis', () => {
    const md = `# Tasks
- [ ] Task Incomplete
- [x] Task Finished
`;
    const map = parseMarkdownToMindMap(md);
    const task1 = map.nodes[map.nodes.root.children[0]];
    const task2 = map.nodes[map.nodes.root.children[1]];

    expect(task1.text).toBe('Task Incomplete');
    expect(task1.emoji).toBe('⬜');

    expect(task2.text).toBe('Task Finished');
    expect(task2.emoji).toBe('✅');
  });

  it('extracts standalone markdown links cleanly', () => {
    const md = `# Resources
- [OpenAI Docs](https://platform.openai.com)
`;
    const map = parseMarkdownToMindMap(md);
    const node = map.nodes[map.nodes.root.children[0]];
    expect(node.text).toBe('OpenAI Docs');
    expect(node.notes).toBe('https://platform.openai.com');
  });
});
