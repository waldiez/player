import { getRuntimeContext } from "@/lib/runtime";

import { invoke } from "@tauri-apps/api/core";

export interface DesktopPdfInfo {
    pageCount: number;
}

export function canUseDesktopPdf(): boolean {
    return getRuntimeContext().isTauri;
}

export async function pdfCheck(): Promise<boolean> {
    if (!canUseDesktopPdf()) return false;
    return invoke<boolean>("pdf_check");
}

export async function pdfGetInfo(path: string): Promise<DesktopPdfInfo> {
    const result = await invoke<{ page_count: number }>("pdf_get_info", { path });
    return { pageCount: result.page_count };
}

export async function pdfExtractText(path: string, page?: number): Promise<string> {
    return invoke<string>("pdf_extract_text", { path, page });
}

export async function pdfRenderPage(path: string, page: number, width?: number): Promise<string> {
    return invoke<string>("pdf_render_page", { path, page, width });
}
