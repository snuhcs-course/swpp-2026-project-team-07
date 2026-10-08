let result = { canceled: true, assets: null };
export function select(next) { result = next; }
export async function getDocumentAsync() { return result; }
