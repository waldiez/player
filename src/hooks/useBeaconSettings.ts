import {
    type BeaconSettings,
    type BeaconTarget,
    readBeaconSettings,
    writeBeaconSettings,
} from "@/lib/beaconSettings";
import { nextWid } from "@/lib/wid";
import type { StreamProtocol } from "@/types/player";

import { useState } from "react";

export type AddForm = {
    name: string;
    protocol: StreamProtocol;
    url: string;
    subTopic: string;
    pubTopic: string;
};

export const emptyForm = (): AddForm => ({
    name: "",
    protocol: "wss",
    url: "",
    subTopic: "",
    pubTopic: "",
});

export function useBeaconSettings() {
    const [settings, setSettings] = useState<BeaconSettings>(readBeaconSettings);
    const [showAddForm, setShowAddForm] = useState(false);
    const [form, setForm] = useState<AddForm>(emptyForm);
    const [formError, setFormError] = useState<string | null>(null);

    function save(next: BeaconSettings) {
        writeBeaconSettings(next);
        setSettings(next);
    }

    function selectTarget(id: string) {
        save({ ...settings, activeTargetId: id });
    }

    function deleteCustom(id: string) {
        save({
            ...settings,
            customTargets: settings.customTargets.filter(t => t.id !== id),
            activeTargetId: settings.activeTargetId === id ? "default-wss" : settings.activeTargetId,
        });
    }

    function handleAddSubmit() {
        if (!form.name.trim()) {
            setFormError("Name is required.");
            return;
        }
        if (!form.url.trim()) {
            setFormError("URL is required.");
            return;
        }
        const target: BeaconTarget = {
            id: nextWid(),
            name: form.name.trim(),
            protocol: form.protocol,
            isCustom: true,
            url: form.url.trim(),
            ...(form.subTopic && { subTopic: form.subTopic.trim() }),
            ...(form.pubTopic && { pubTopic: form.pubTopic.trim() }),
        };
        save({
            ...settings,
            customTargets: [...settings.customTargets, target],
            activeTargetId: target.id,
        });
        setShowAddForm(false);
        setForm(emptyForm());
        setFormError(null);
    }

    return {
        settings,
        showAddForm,
        setShowAddForm,
        form,
        setForm,
        formError,
        setFormError,
        selectTarget,
        deleteCustom,
        handleAddSubmit,
    };
}
