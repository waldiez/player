import { importReaderDocumentFromFile, isReaderFileName } from "@/lib/readerImport";
import { nextWid } from "@/lib/wid";
import { usePlayerStore, useReaderStore } from "@/stores";

import { useCallback } from "react";

export function useMediaHandlers() {
    const setCurrentDocument = useReaderStore(s => s.setCurrentDocument);
    const setPlayerMode = usePlayerStore(s => s.setPlayerMode);

    const addMedia = useCallback((file: File) => {
        const store = usePlayerStore.getState();
        const url = URL.createObjectURL(file);
        const entry = {
            id: nextWid(),
            name: file.name,
            path: url,
            type: (file.type.startsWith("video/") ? "video" : "audio") as "video" | "audio",
            duration: 0,
            size: file.size,
            createdAt: new Date(),
        };
        store.addToLibrary(entry);
        store.setCurrentMedia(entry);
        store.setPlayback({ currentTime: 0, duration: 0, isPlaying: true });
    }, []);

    const openReaderDocument = useCallback(
        async (file: File) => {
            const document = await importReaderDocumentFromFile(file);
            setCurrentDocument(document);
            setPlayerMode("reader");
        },
        [setCurrentDocument, setPlayerMode],
    );

    const handleFileDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            const files = Array.from(e.dataTransfer.files);
            void Promise.all(
                files.map(async file => {
                    if (isReaderFileName(file.name)) {
                        await openReaderDocument(file);
                        return;
                    }
                    if (file.type.startsWith("video/") || file.type.startsWith("audio/")) {
                        addMedia(file);
                    }
                }),
            );
        },
        [addMedia, openReaderDocument],
    );

    const handleFileSelect = useCallback(() => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "video/*,audio/*,.txt,.md,.markdown,.pdf,.html,.htm,.wid,.waldiez,.json,.yaml,.yml";
        input.multiple = true;
        input.onchange = e => {
            const files = Array.from((e.target as HTMLInputElement).files ?? []);
            void Promise.all(
                files.map(async file => {
                    if (isReaderFileName(file.name)) {
                        await openReaderDocument(file);
                        return;
                    }
                    addMedia(file);
                }),
            );
        };
        input.click();
    }, [addMedia, openReaderDocument]);

    return { addMedia, handleFileDrop, handleFileSelect };
}
