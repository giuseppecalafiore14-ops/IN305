interface Tab<T extends string> {
  key: T;
  label: string;
  count?: number;
}

interface TabsProps<T extends string> {
  tabs: Tab<T>[];
  active: T;
  onChange: (key: T) => void;
  className?: string;
}

export function Tabs<T extends string>({ tabs, active, onChange, className = '' }: TabsProps<T>) {
  return (
    <div className={`flex gap-2 overflow-x-auto no-scrollbar ${className}`} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          role="tab"
          aria-selected={active === tab.key}
          onClick={() => onChange(tab.key)}
          className={`tab-pill flex items-center gap-1.5 ${active === tab.key ? 'tab-pill-active' : 'tab-pill-inactive'}`}
        >
          {tab.label}
          {typeof tab.count === 'number' && (
            <span className={`text-2xs font-bold ${active === tab.key ? 'text-cream-200' : 'text-ink-400'}`}>{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
