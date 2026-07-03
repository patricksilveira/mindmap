import React, { useState, useEffect } from 'react';
import { Plus, Search, FileUp, Trash2, Copy, Moon, Sun, Network, Clock } from 'lucide-react';
import { getAllMaps, saveMap, deleteMap, duplicateMap, createNewMapData } from '../utils/db';

function Dashboard({ onOpenMap, theme, toggleTheme }) {
  const [maps, setMaps] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Load maps on component mount
  useEffect(() => {
    loadMaps();
  }, []);

  const loadMaps = async () => {
    try {
      setIsLoading(true);
      const data = await getAllMaps();
      setMaps(data);
    } catch (error) {
      console.error('Failed to load mind maps:', error);
    } finally {
      setIsLoading(false);
    }
  };

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

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const mapData = JSON.parse(event.target.result);
        
        // Basic validation of mindmap structure
        if (!mapData || !mapData.nodes || !mapData.nodes.root) {
          alert('Invalid mind map file structure. Missing root node.');
          return;
        }

        // Generate a new ID and current timestamps to prevent overwrites
        const newId = `map-${Date.now()}`;
        const importedMap = {
          ...mapData,
          id: newId,
          name: mapData.name ? `${mapData.name} (Imported)` : 'Imported Mind Map',
          lastUpdated: new Date().toISOString()
        };

        await saveMap(importedMap);
        loadMaps();
        alert('Mind map imported successfully!');
      } catch (error) {
        console.error('Failed to parse JSON file:', error);
        alert('Failed to import. Ensure the file is a valid .mindmap or JSON file.');
      }
    };
    reader.readAsText(file);
    // Reset file input value so same file can be selected again
    e.target.value = null;
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
          <h1>MindMap Local</h1>
          <p>Create, organize, and export your thoughts locally.</p>
        </div>
        <div className="dashboard-actions">
          <button className="btn" onClick={toggleTheme} title="Toggle Dark/Light Mode">
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
          </button>
          
          <label className="btn btn-secondary" style={{ display: 'inline-flex', cursor: 'pointer' }}>
            <FileUp size={18} />
            <span>Import</span>
            <input 
              type="file" 
              accept=".json,.mindmap" 
              onChange={handleImport} 
              style={{ display: 'none' }} 
            />
          </label>

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
    </div>
  );
}

export default Dashboard;
