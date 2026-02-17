import { useRef } from 'react';
import styles from './PageTabs.module.css';

const TAB_COLORS = [
  { key: 'coral', hex: '#e07a5f' },
  { key: 'amber', hex: '#e0a05f' },
  { key: 'sage', hex: '#6b9e7a' },
  { key: 'sky', hex: '#5f8fc9' },
  { key: 'lavender', hex: '#9a7ec8' },
];

export const TAB_KEYS = TAB_COLORS.map((t) => t.key);

export const EMPTY_PAGES = Object.fromEntries(TAB_KEYS.map((k) => [k, '']));

export default function PageTabs({ activeTab, onTabChange, pages }) {
  const touchStartX = useRef(null);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e) => {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;

    if (Math.abs(deltaX) < 50) return;

    const currentIndex = TAB_KEYS.indexOf(activeTab);
    if (deltaX < 0 && currentIndex < TAB_KEYS.length - 1) {
      onTabChange(TAB_KEYS[currentIndex + 1]);
    } else if (deltaX > 0 && currentIndex > 0) {
      onTabChange(TAB_KEYS[currentIndex - 1]);
    }
  };

  return (
    <div
      className={styles.tabs}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {TAB_COLORS.map(({ key, hex }) => {
        const isActive = key === activeTab;
        const hasContent = !!(pages[key] && pages[key].trim());
        const className = [
          styles.tab,
          isActive ? styles.tabActive : '',
          !isActive && !hasContent ? styles.tabEmpty : '',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <button
            key={key}
            className={className}
            style={{ backgroundColor: hex }}
            onClick={() => onTabChange(key)}
            aria-label={`${key} tab${isActive ? ' (active)' : ''}${hasContent ? '' : ' (empty)'}`}
          />
        );
      })}
    </div>
  );
}
