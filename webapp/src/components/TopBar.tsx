import { Search } from "lucide-react";

export function TopBar() {
  return (
    <header className="h-14 border-b border-border flex items-center justify-between px-5 bg-panel/40">
      <button
        className="flex items-center gap-2 text-xs text-muted border border-border rounded-lg px-3 py-1.5 hover:border-accent transition-colors"
        onClick={() => window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }))}
      >
        <Search size={13} />
        Search
        <kbd className="ml-2 text-[10px] border border-border rounded px-1">Ctrl K</kbd>
      </button>
      <div className="flex items-center gap-2 text-xs text-muted">
        <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
        Local only
      </div>
    </header>
  );
}
