import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './ProjectDropdown.module.css';

function timeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ProjectDropdown({
  activeProject,
  projects,
  activeProjectId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}) {
  const [open, setOpen] = useState(false);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const renameRef = useRef(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setRenamingId(null);
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        if (renamingId) {
          setRenamingId(null);
        } else {
          setOpen(false);
        }
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, renamingId]);

  useEffect(() => {
    if (renamingId && renameRef.current) {
      renameRef.current.focus();
      renameRef.current.select();
    }
  }, [renamingId]);

  const startRename = useCallback((e, project) => {
    e.stopPropagation();
    setRenamingId(project.id);
    setRenameValue(project.name);
  }, []);

  const commitRename = useCallback(() => {
    const trimmed = renameValue.trim();
    if (trimmed && renamingId) {
      onRename(renamingId, trimmed);
    }
    setRenamingId(null);
  }, [renamingId, renameValue, onRename]);

  const handleRenameKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      commitRename();
    } else if (e.key === 'Escape') {
      setRenamingId(null);
    }
  }, [commitRename]);

  const handleDelete = useCallback((e, projectId) => {
    e.stopPropagation();
    onDelete(projectId);
  }, [onDelete]);

  const handleSelect = useCallback((projectId) => {
    onSelect(projectId);
    setOpen(false);
  }, [onSelect]);

  const handleCreate = useCallback(() => {
    onCreate();
    setOpen(false);
  }, [onCreate]);

  const pencilIcon = (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" />
    </svg>
  );

  const trashIcon = (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M2 4h12M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1M6.5 7v5M9.5 7v5M3.5 4l.5 9a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1l.5-9" />
    </svg>
  );

  return (
    <div className={styles.selector} ref={ref}>
      <button
        className={styles.selectorBtn}
        onClick={() => setOpen((v) => !v)}
        type="button"
      >
        {activeProject?.name || 'Untitled'}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M2.5 4L5 6.5L7.5 4" />
        </svg>
      </button>
      {open && (
        <div className={styles.dropdown}>
          <div className={styles.header}>
            <span className={styles.headerLabel}>Projects</span>
            <button
              className={styles.addBtn}
              onClick={handleCreate}
              title="New project"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M6 1v10M1 6h10" />
              </svg>
            </button>
          </div>
          <div className={styles.list}>
            {projects.map((project) => {
              const isActive = project.id === activeProjectId;
              return (
                <div
                  key={project.id}
                  className={`${styles.item} ${isActive ? styles.itemActive : ''}`}
                  onClick={() => handleSelect(project.id)}
                >
                  {renamingId === project.id ? (
                    <input
                      ref={renameRef}
                      className={styles.renameInput}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={handleRenameKeyDown}
                      onBlur={commitRename}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <>
                      <div className={styles.itemInfo}>
                        <div className={styles.itemName}>{project.name}</div>
                        <div className={styles.itemMeta}>Updated {timeAgo(project.updatedAt)}</div>
                      </div>
                      <div className={styles.itemActions}>
                        <button
                          className={styles.iconBtn}
                          onClick={(e) => startRename(e, project)}
                          title="Rename"
                        >
                          {pencilIcon}
                        </button>
                        <button
                          className={`${styles.iconBtn} ${styles.iconBtnDanger}`}
                          onClick={(e) => handleDelete(e, project.id)}
                          title="Delete"
                        >
                          {trashIcon}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
