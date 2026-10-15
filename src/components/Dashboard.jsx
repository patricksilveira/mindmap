import { useState, useEffect, useCallback } from 'react';
import { Plus, Search, FileUp, Trash2, Copy, Moon, Sun, Network, Clock, FileText, X } from 'lucide-react';
import { getAllMaps, saveMap, deleteMap, duplicateMap, createNewMapData } from '../utils/db';
import { parseMarkdownToMindMap } from '../utils/markdownImport';

function Dashboard({ onOpenMap, theme, toggleTheme }) {
  const [maps, setMaps] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showMarkdownModal, setShowMarkdownModal] = useState(false);
  const [pastedMarkdown, setPastedMarkdown] = useState('');

  // Reusable reload (event-driven: after delete / duplicate / import).
  const loadMaps = useCallback(async () => {
    try {
      const data = await getAllMaps();
      setMaps(data);
    } catch (error) {
      console.error('Failed to load mind maps:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load maps on mount. setState happens after the async resolves (guarded
  // against unmount), so nothing sets state synchronously in the effect body.
  useEffect(() => {
    let active = true;
    getAllMaps()
      .then((data) => { if (active) setMaps(data); })
      .catch((error) => console.error('Failed to load mind maps:', error))
      .finally(() => { if (active) setIsLoading(false); });
    return () => { active = false; };
  }, []);

  const handleCreateNew = async () => {
    try {
      const newMap = createNewMapData();
      await saveMap(newMap);
      onOpenMap(newMap.id);
    } catch (error) {
      console.error('Failed to create new map:', error);
    }
  };

  const handleDelete = async (e, id, name) => {
    e.stopPropagation(); // Avoid triggering open card click event
    if (window.confirm(`Are you sure you want to delete "${name}"?`)) {
      try {
        await deleteMap(id);
        loadMaps();
      } catch (error) {
        console.error('Failed to delete map:', error);
      }
    }
  };

  const handleDuplicate = async (e, id) => {
    e.stopPropagation(); // Avoid triggering open card click event
    try {
      await duplicateMap(id);
      loadMaps();
    } catch (error) {
      console.error('Failed to duplicate map:', error);
    }
  };

  const handleImport = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const isMarkdown = file.name.endsWith('.md') || file.name.endsWith('.markdown') || file.name.endsWith('.txt');

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target.result;
      try {
        let importedMap = null;

        if (isMarkdown) {
          const fallbackName = file.name.replace(/\.[^/.]+$/, '');
          importedMap = parseMarkdownToMindMap(content, fallbackName);
        } else {
          try {
            const mapData = JSON.parse(content);
            if (mapData && mapData.nodes && mapData.nodes.root) {
              const newId = `map-${Date.now()}`;
              importedMap = {
                ...mapData,
                id: newId,
                name: mapData.name ? `${mapData.name} (Imported)` : 'Imported Mind Map',
                lastUpdated: new Date().toISOString()
              };
            }
          } catch {
            // Fallback to Markdown parser
            const fallbackName = file.name.replace(/\.[^/.]+$/, '');
            importedMap = parseMarkdownToMindMap(content, fallbackName);
          }
        }

        if (!importedMap) {
          alert('Could not parse mind map. Make sure it is valid JSON or Markdown.');
          return;
        }

        await saveMap(importedMap);
        await loadMaps();
        onOpenMap(importedMap.id);
      } catch (error) {
        console.error('Import error:', error);
        alert(`Failed to import: ${error.message || 'Invalid format'}`);
      }
    };
    reader.readAsText(file);
    e.target.value = null;
  };

  const handleCreateFromMarkdown = async () => {
    if (!pastedMarkdown.trim()) return;
    try {
      const newMap = parseMarkdownToMindMap(pastedMarkdown);
      await saveMap(newMap);
      setShowMarkdownModal(false);
      setPastedMarkdown('');
      await loadMaps();
      onOpenMap(newMap.id);
    } catch (error) {
      alert(`Invalid Markdown: ${error.message}`);
    }
  };

  // Helper to format timestamps relative to current time
  const formatTimeAgo = (isoString) => {
    if (!isoString) return 'Unknown';
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay === 1) return 'Yesterday';
    if (diffDay < 7) return `${diffDay}d ago`;
    
    return date.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  // Filter maps based on search
  const filteredMaps = maps.filter(map => 
    map.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="dashboard-view">
      <header className="dashboard-header">
        <div className="dashboard-title-area">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '6px' }}>
            <img 
              src="/app-icon.png" 
              alt="MindMap Local" 
              style={{ width: '44px', height: '44px', borderRadius: '10px', boxShadow: '0 4px 14px rgba(236, 72, 153, 0.35)' }} 
            />
            <h1 style={{ margin: 0 }}>MindMap Local</h1>
          </div>
          <p>Create, organize, and export your thoughts locally.</p>
        </div>
        <div className="dashboard-actions">
          <button className="btn" onClick={toggleTheme} title="Toggle Dark/Light Mode">
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
          </button>
          
          <label className="btn btn-secondary" style={{ display: 'inline-flex', cursor: 'pointer' }} title="Import .mindmap, .json, or .md file">
            <FileUp size={18} />
            <span>Import</span>
            <input 
              type="file" 
              accept=".json,.mindmap,.md,.markdown,.txt" 
              onChange={handleImport} 
              style={{ display: 'none' }} 
            />
          </label>

          <button className="btn btn-secondary" onClick={() => setShowMarkdownModal(true)} title="Create map by pasting Markdown text">
            <FileText size={18} />
            <span>Paste Markdown</span>
          </button>

          <button className="btn btn-primary" onClick={handleCreateNew}>
            <Plus size={18} />
            <span>New Mind Map</span>
          </button>
        </div>
      </header>

      <div className="dashboard-search-section" style={{ marginBottom: '32px' }}>
        <div className="search-bar">
          <Search size={18} />
          <input 
            type="text" 
            placeholder="Search mind maps..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-secondary)' }}>
          <p>Loading your mind maps...</p>
        </div>
      ) : filteredMaps.length > 0 ? (
        <div className="maps-grid">
          {filteredMaps.map((map) => (
            <div 
              key={map.id} 
              className="map-card glass-panel" 
              onClick={() => onOpenMap(map.id)}
            >
              <div className="map-card-header">
                <div>
                  <h3>{map.name}</h3>
                  <div className="map-card-info">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Clock size={12} />
                      {formatTimeAgo(map.lastUpdated)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="map-card-footer">
                <span className="node-count-badge">
                  <Network size={12} />
                  {map.nodeCount || 0} nodes
                </span>
                
                <div className="map-card-actions">
                  <button 
                    className="card-icon-btn duplicate" 
                    onClick={(e) => handleDuplicate(e, map.id)}
                    title="Duplicate Mind Map"
                  >
                    <Copy size={16} />
                  </button>
                  <button 
                    className="card-icon-btn" 
                    onClick={(e) => handleDelete(e, map.id, map.name)}
                    title="Delete Mind Map"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state glass-panel">
          <div className="empty-state-icon">
            <Network size={40} />
          </div>
          <h2>{searchQuery ? 'No matching maps found' : 'Create your first mind map'}</h2>
          <p>
            {searchQuery 
              ? `We couldn't find any mind maps matching "${searchQuery}". Try searching for something else.`
              : 'Express your creativity, organize project documentation, or take meeting notes in a beautiful hierarchical map layout.'}
          </p>
          {!searchQuery && (
            <button className="btn btn-primary" onClick={handleCreateNew}>
              <Plus size={18} />
              <span>Get Started</span>
            </button>
          )}
        </div>
      )}

      {/* Markdown Paste Modal */}
      {showMarkdownModal && (
        <div className="modal-overlay" onClick={() => setShowMarkdownModal(false)}>
          <div className="modal-content glass-panel" style={{ width: '560px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Import from Markdown</h3>
              <button className="card-icon-btn" onClick={() => setShowMarkdownModal(false)}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '-8px' }}>
              Paste your Markdown outline with headings (<code>#</code>, <code>##</code>) or indented bullet lists (<code>-</code>, <code>*</code>):
            </p>
            <textarea
              className="notes-textarea"
              style={{ minHeight: '220px', fontFamily: 'monospace', fontSize: '0.85rem', lineHeight: '1.4' }}
              placeholder={`# My Project\n- 🚀 Phase 1\n  - Task A\n  - Task B *(Note: Urgent)*\n- 🎯 Phase 2\n  - Launch MVP`}
              value={pastedMarkdown}
              onChange={(e) => setPastedMarkdown(e.target.value)}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
              <button className="btn btn-secondary" onClick={() => setShowMarkdownModal(false)}>
                Cancel
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleCreateFromMarkdown}
                disabled={!pastedMarkdown.trim()}
              >
                Create Mind Map
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
