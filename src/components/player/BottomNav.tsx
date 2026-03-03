/**
 * BottomNav — sticky bottom navigation for mobile screens.
 * Renders only on small screens (< 768px).
 */
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { usePlayerStore } from "@/stores";

import { ListMusic, Orbit, Play, Search, Settings } from "lucide-react";

interface BottomNavProps {
    onSearchOpen: () => void;
    onSettingsOpen: () => void;
    onMoodsOpen: () => void;
}

const NAV_ITEMS = [
    { id: "nowplaying", label: "Playing", Icon: Play },
    { id: "queue", label: "Queue", Icon: ListMusic },
    { id: "search", label: "Search", Icon: Search },
    { id: "moods", label: "Moods", Icon: Orbit },
    { id: "settings", label: "Settings", Icon: Settings },
] as const;

type NavId = (typeof NAV_ITEMS)[number]["id"];

export function BottomNav({ onSearchOpen, onSettingsOpen, onMoodsOpen }: BottomNavProps) {
    const isMobile = useMediaQuery("(max-width: 767px)");
    const { togglePlaylistPanel } = usePlayerStore();

    if (!isMobile) return null;

    function handleTap(id: NavId) {
        switch (id) {
            case "nowplaying":
                break;
            case "queue":
                togglePlaylistPanel();
                break;
            case "search":
                onSearchOpen();
                break;
            case "moods":
                onMoodsOpen();
                break;
            case "settings":
                onSettingsOpen();
                break;
        }
    }

    return (
        <nav
            className={cn(
                "fixed bottom-0 left-0 right-0 z-30",
                "border-t border-player-border bg-player-surface/95 backdrop-blur-md",
            )}
            style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
            <div className="flex items-center justify-around px-2 py-1">
                {NAV_ITEMS.map(({ id, label, Icon }) => (
                    <button
                        key={id}
                        onClick={() => handleTap(id)}
                        className="flex flex-col items-center gap-0.5 px-3 py-2 text-player-text-muted transition-colors hover:text-player-text"
                        aria-label={label}
                    >
                        <Icon className="h-5 w-5" />
                        <span className="text-[10px]">{label}</span>
                    </button>
                ))}
            </div>
        </nav>
    );
}
