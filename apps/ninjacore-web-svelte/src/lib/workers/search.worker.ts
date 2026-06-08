// Web Worker for off-main-thread search
// Receives client data and search queries
// Returns filtered results instantly

interface ClientData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

let clients: ClientData[] = [];

self.onmessage = (event: MessageEvent) => {
  const { type, payload } = event.data;

  if (type === 'LOAD_CLIENTS') {
    clients = payload;
  } else if (type === 'SEARCH') {
    const { query } = payload;
    const results = performSearch(query);
    self.postMessage({ type: 'SEARCH_RESULTS', payload: results });
  }
};

function performSearch(query: string): ClientData[] {
  if (!query.trim()) return clients;

  const q = query.toLowerCase();
  return clients.filter(client => {
    const hay = `${client.firstName} ${client.lastName} ${client.email} ${client.phone}`.toLowerCase();
    return hay.includes(q);
  });
}

export {};
