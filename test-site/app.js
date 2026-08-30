const cookieOutput = document.querySelector('#cookie-output');
const storageOutput = document.querySelector('#storage-output');
const broadcastOutput = document.querySelector('#broadcast-output');

function show(target, value) {
  if (target instanceof HTMLElement) {
    target.textContent = value;
  }
}

document.querySelector('#set-http-cookie')?.addEventListener('click', async () => {
  const response = await fetch('/api/set-cookie?name=lab&value=alice-secret');
  show(cookieOutput, `HTTP ${response.status}`);
});

document.querySelector('#set-document-cookie')?.addEventListener('click', () => {
  document.cookie = 'lab_doc=alice-secret; path=/';
  show(cookieOutput, document.cookie);
});

document.querySelector('#read-cookies')?.addEventListener('click', () => {
  show(cookieOutput, document.cookie || '(empty)');
});

document.querySelector('#write-local')?.addEventListener('click', () => {
  localStorage.setItem('lab', 'alice-secret');
  show(storageOutput, localStorage.getItem('lab') ?? '');
});

document.querySelector('#read-local')?.addEventListener('click', () => {
  show(storageOutput, localStorage.getItem('lab') ?? '(empty)');
});

document.querySelector('#write-idb')?.addEventListener('click', async () => {
  await new Promise((resolve, reject) => {
    const request = indexedDB.open('lab-db', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('kv');
    };
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put('alice-secret', 'lab');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  });
  show(storageOutput, 'IndexedDB write complete');
});

document.querySelector('#read-idb')?.addEventListener('click', async () => {
  const value = await new Promise((resolve, reject) => {
    const request = indexedDB.open('lab-db', 1);
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('kv', 'readonly');
      const get = tx.objectStore('kv').get('lab');
      get.onsuccess = () => resolve(get.result ?? '(empty)');
      get.onerror = () => reject(get.error);
    };
    request.onerror = () => reject(request.error);
  });
  show(storageOutput, String(value));
});

document.querySelector('#write-cache')?.addEventListener('click', async () => {
  const cache = await caches.open('lab-cache');
  await cache.put('/cache-entry', new Response('alice-secret'));
  show(storageOutput, 'Cache write complete');
});

document.querySelector('#broadcast')?.addEventListener('click', () => {
  const channel = new BroadcastChannel('lab-channel');
  channel.postMessage({ kind: 'ping', at: Date.now() });
  channel.onmessage = (event) => {
    show(broadcastOutput, JSON.stringify(event.data));
    channel.close();
  };
});
