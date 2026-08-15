import React, { createContext, useContext, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Lets a tab's child page render its toolbar (search, Add) into the right-hand
 * side of the tab row, instead of repeating a second header block below it.
 */
const TabActionsContext = createContext<HTMLDivElement | null>(null);

export function TabActionsSlot({ children }: { children: React.ReactNode }) {
  const node = useContext(TabActionsContext);
  if (!node) return <>{children}</>; // rendered standalone (not inside a tabbed page)
  return createPortal(children, node);
}

/** True when the component is rendered inside a TabbedModulePage. */
export function useIsEmbedded() {
  return useContext(TabActionsContext) !== null;
}

export interface ModuleTab {
  /** Stable key, also used as the ?tab= value so a tab can be linked to. */
  key: string;
  label: string;
  icon: React.ReactNode;
  /** Tab is hidden unless the user holds at least one of these. */
  anyPermissions: string[];
  render: () => React.ReactNode;
}

interface TabbedModulePageProps {
  title: string;
  subtitle?: string;
  tabs: ModuleTab[];
}

/**
 * Groups related screens that are configured rarely (pharmacy master data,
 * stock control) behind one sidebar entry with tabs, instead of one sidebar
 * row each. Tabs the user has no permission for are not rendered at all.
 */
export function TabbedModulePage({ title, subtitle, tabs }: TabbedModulePageProps) {
  const { hasPermission } = useAuth();

  const visibleTabs = useMemo(
    () => tabs.filter((tab) => tab.anyPermissions.some((permission) => hasPermission(permission))),
    [tabs, hasPermission]
  );

  // Callback ref so the portal target re-renders children once it exists.
  const [actionsNode, setActionsNode] = useState<HTMLDivElement | null>(null);

  const [activeKey, setActiveKey] = useState<string>(() => {
    const requested = new URLSearchParams(window.location.search).get('tab');
    return requested && tabs.some((t) => t.key === requested) ? requested : '';
  });

  const activeTab = visibleTabs.find((t) => t.key === activeKey) || visibleTabs[0];

  if (visibleTabs.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-gray-500 dark:text-gray-400">
        You do not have permission to view any section of {title}.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div>
        <h1 className="text-lg font-bold text-gray-900 dark:text-white">{title}</h1>
        {subtitle && <p className="text-xs text-gray-600 dark:text-gray-400">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3 border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex gap-4 min-w-max overflow-x-auto" aria-label={`${title} sections`}>
          {visibleTabs.map((tab) => {
            const isActive = activeTab?.key === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveKey(tab.key)}
                aria-current={isActive ? 'page' : undefined}
                className={`group inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-1 py-2.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300'
                }`}
              >
                <span className={isActive ? 'text-blue-500' : 'text-gray-400 group-hover:text-gray-500'}>
                  {tab.icon}
                </span>
                {tab.label}
              </button>
            );
          })}
        </nav>
        {/* Child pages portal their search/Add controls in here. */}
        <div ref={setActionsNode} className="ml-auto flex items-center gap-2 pb-1.5" />
      </div>

      <TabActionsContext.Provider value={actionsNode}>
        <div key={activeTab?.key}>{activeTab?.render()}</div>
      </TabActionsContext.Provider>
    </div>
  );
}
