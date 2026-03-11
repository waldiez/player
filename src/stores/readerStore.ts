import type { ReaderDocument } from "@/types/reader";

import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface ReaderStore {
    currentDocument: ReaderDocument | null;
    setCurrentDocument: (document: ReaderDocument | null) => void;
    clearCurrentDocument: () => void;
}

export const useReaderStore = create<ReaderStore>()(
    devtools(
        set => ({
            currentDocument: null,
            setCurrentDocument: currentDocument => set({ currentDocument }),
            clearCurrentDocument: () => set({ currentDocument: null }),
        }),
        { name: "waldiez-reader-store" },
    ),
);
