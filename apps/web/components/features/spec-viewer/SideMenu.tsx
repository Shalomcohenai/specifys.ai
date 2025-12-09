'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { apiClient as api } from '@/lib/api/client';

interface SideMenuProps {
  activeTab: string;
  spec: {
    id: string;
    title?: string;
    status?: {
      overview?: string;
      technical?: string;
      market?: string;
      design?: string;
    };
    overviewApproved?: boolean;
    diagrams?: any;
  } | null;
  onTabChange: (tabId: string) => void;
  onSubmenuToggle?: (tabId: string) => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: string;
  enabled: boolean;
  hasSubmenu: boolean;
  hidden?: boolean;
  proOnly?: boolean;
  notificationId?: string;
}

export function SideMenu({ activeTab, spec, onTabChange, onSubmenuToggle }: SideMenuProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSubmenus, setExpandedSubmenus] = useState<Set<string>>(new Set());
  const [isPro, setIsPro] = useState(false);

  // Check PRO access
  useEffect(() => {
    const checkProAccess = async () => {
      if (!user) {
        setIsPro(false);
        return;
      }

      try {
        const result = await api.get<{ success: boolean; entitlements?: { unlimited?: boolean; plan?: string } }>('/api/credits/entitlements');
        if (result.success && result.entitlements) {
          setIsPro(result.entitlements.unlimited === true || result.entitlements.plan === 'pro');
        } else {
          setIsPro(false);
        }
      } catch (error) {
        setIsPro(false);
      }
    };

    checkProAccess();
  }, [user]);

  const menuItems: MenuItem[] = useMemo(() => {
    // Map tab IDs - some tabs use different IDs in the original
    const tabIdMap: Record<string, string> = {
      'ai-chat': 'chat',
      'chat': 'chat'
    };

    return [
      { id: 'overview', label: 'Overview', icon: 'fa-book', enabled: true, hasSubmenu: true },
      { id: 'technical', label: 'Technical', icon: 'fa-cog', enabled: spec?.status?.technical === 'ready', hasSubmenu: true, notificationId: 'technicalNotification' },
      { id: 'mindmap', label: 'Mind Map', icon: 'fa-project-diagram', enabled: spec?.status?.technical === 'ready', hasSubmenu: false, hidden: true, notificationId: 'mindmapNotification' },
      { id: 'market', label: 'Market Research', icon: 'fa-bar-chart', enabled: spec?.status?.market === 'ready', hasSubmenu: true, notificationId: 'marketNotification' },
      { id: 'design', label: 'Design & Branding', icon: 'fa-paint-brush', enabled: spec?.status?.design === 'ready', hasSubmenu: true, notificationId: 'designNotification' },
      { id: 'diagrams', label: 'Diagrams', icon: 'fa-sitemap', enabled: !!spec?.diagrams, hasSubmenu: true, notificationId: 'diagramsNotification' },
      { id: 'prompts', label: 'Prompts', icon: 'fa-terminal', enabled: spec?.status?.technical === 'ready' && spec?.status?.design === 'ready', hasSubmenu: true, notificationId: 'promptsNotification' },
      { id: 'chat', label: 'AI Chat', icon: 'fa-comments', enabled: spec?.overviewApproved === true, hasSubmenu: false, notificationId: 'chatNotification' },
      { id: 'mockup', label: 'Mockup', icon: 'fa-desktop', enabled: spec?.status?.design === 'ready' && isPro, hasSubmenu: false, proOnly: true, notificationId: 'mockupNotification', hidden: !isPro },
      { id: 'export', label: 'Export', icon: 'fa-download', enabled: true, hasSubmenu: false },
      { id: 'raw', label: 'Raw Data', icon: 'fa-code', enabled: true, hasSubmenu: false, hidden: false }
    ];
  }, [spec, isPro]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) {
      return menuItems.filter(item => !item.hidden);
    }

    const query = searchQuery.toLowerCase();
    return menuItems.filter(item => {
      if (item.hidden) return false;
      const labelMatch = item.label.toLowerCase().includes(query);
      // Check submenu items if they exist (will be implemented later)
      return labelMatch;
    });
  }, [menuItems, searchQuery]);

  const handleSubmenuToggle = (tabId: string) => {
    if (onSubmenuToggle) {
      onSubmenuToggle(tabId);
    }
    setExpandedSubmenus(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tabId)) {
        newSet.delete(tabId);
      } else {
        newSet.add(tabId);
      }
      return newSet;
    });
  };

  const handleTabClick = (tabId: string, enabled: boolean) => {
    if (enabled) {
      onTabChange(tabId);
    }
  };

  const displayName = user?.displayName || user?.email?.split('@')[0] || 'User';
  const userInitial = displayName.charAt(0).toUpperCase();

  return (
    <aside className="side-menu" id="sideMenu">
      {/* User Section */}
      <div className="side-menu-user">
        <div className="side-menu-user-avatar" id="side-menu-user-avatar">
          <span id="side-menu-user-initial">{userInitial}</span>
        </div>
        <span className="side-menu-user-name" id="side-menu-user-name">{displayName}</span>
      </div>

      <div className="side-menu-divider"></div>

      {/* Search Box */}
      <div className="side-menu-search">
        <input
          type="text"
          className="side-menu-search-input"
          id="side-menu-search-input"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <i className="fa fa-search side-menu-search-icon"></i>
      </div>

      <div className="side-menu-divider"></div>

      {/* Main Navigation */}
      <nav className="side-menu-nav">
        {filteredItems.map((item) => (
          <div key={item.id} className="side-menu-item" data-tab={item.id}>
            <button
              className={`side-menu-button ${activeTab === item.id ? 'active' : ''} ${item.enabled ? '' : 'disabled'}`}
              onClick={() => handleTabClick(item.id, item.enabled)}
              disabled={!item.enabled}
              id={`${item.id}Tab`}
            >
              <i className={`fa ${item.icon}`}></i>
              {/* Loading indicator for generating status */}
              {item.id === 'technical' && spec?.status?.technical === 'generating' && (
                <i className="fa fa-spinner fa-spin"></i>
              )}
              {item.id === 'market' && spec?.status?.market === 'generating' && (
                <i className="fa fa-spinner fa-spin"></i>
              )}
              {item.id === 'design' && spec?.status?.design === 'generating' && (
                <i className="fa fa-spinner fa-spin"></i>
              )}
              {item.notificationId && (
                <span className="side-menu-notification-dot" id={item.notificationId}></span>
              )}
              <span className="side-menu-text">
                {item.label}
                {item.proOnly && <span className="pro-badge"> (Pro)</span>}
              </span>
              {item.hasSubmenu && (
                <span
                  className="side-menu-expand-sub"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSubmenuToggle(item.id);
                  }}
                  title="Toggle subsections"
                >
                  <i className={`fa fa-chevron-${expandedSubmenus.has(item.id) ? 'up' : 'down'}`}></i>
                </span>
              )}
            </button>
            {item.hasSubmenu && (
              <div
                className={`side-menu-submenu ${expandedSubmenus.has(item.id) ? 'expanded' : ''}`}
                id={`submenu-${item.id}`}
              ></div>
            )}
          </div>
        ))}
      </nav>
    </aside>
  );
}

