import { reportDiagnostic } from "@/lib/diagnostics";
import {
    exportEditorProjectJson,
    openEditorProject,
    reportEditorPersistenceError,
    saveEditorProject,
    saveEditorProjectAs,
} from "@/lib/editorPersistence";
import { useEditorStore, usePlayerStore } from "@/stores";

import { useState } from "react";

export function useEditorFileOps() {
    const setPlayerMode = usePlayerStore(s => s.setPlayerMode);
    const currentProject = useEditorStore(s => s.currentProject);
    const setCurrentProject = useEditorStore(s => s.setCurrentProject);
    const markSaved = useEditorStore(s => s.markSaved);

    const [saving, setSaving] = useState(false);
    const [opening, setOpening] = useState(false);
    const [exporting, setExporting] = useState(false);

    async function handleOpen() {
        setOpening(true);
        try {
            const project = await openEditorProject();
            setCurrentProject(project);
            setPlayerMode("editor");
        } catch (error) {
            reportEditorPersistenceError("open", error);
        } finally {
            setOpening(false);
        }
    }

    async function handleSave(forceDialog = false) {
        if (!currentProject) return;
        setSaving(true);
        try {
            const savedPath = forceDialog
                ? await saveEditorProjectAs(currentProject)
                : await saveEditorProject(currentProject);
            markSaved(savedPath);
            reportDiagnostic({
                level: "info",
                area: "editor",
                message: `Editor project saved to ${savedPath}.`,
            });
        } catch (error) {
            reportEditorPersistenceError(forceDialog ? "save as" : "save", error);
        } finally {
            setSaving(false);
        }
    }

    async function handleExportJson() {
        if (!currentProject) return;
        setExporting(true);
        try {
            const destination = exportEditorProjectJson(currentProject);
            reportDiagnostic({
                level: "info",
                area: "editor",
                message: `Exported editor project JSON to ${destination}.`,
            });
        } catch (error) {
            reportEditorPersistenceError("export", error);
        } finally {
            setExporting(false);
        }
    }

    return { saving, opening, exporting, handleOpen, handleSave, handleExportJson };
}
