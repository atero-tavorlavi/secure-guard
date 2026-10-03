const ENTITIES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }

export const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (c) => ENTITIES[c]!)
