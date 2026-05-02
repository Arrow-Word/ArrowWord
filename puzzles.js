// puzzles.js — shared puzzle registry
// Puzzles published "to web" are stored in localStorage under 'arrowword_published'.
// Each entry: { id, title, publishedAt, data, thumbnail }
// This file is loaded by all three pages.

const REGISTRY_KEY = 'arrowword_published';

function getRegistry() {
  try { return JSON.parse(localStorage.getItem(REGISTRY_KEY) || '[]'); }
  catch(e) { return []; }
}

function setRegistry(list) {
  localStorage.setItem(REGISTRY_KEY, JSON.stringify(list));
}

function publishToRegistry(title, data) {
  const list = getRegistry();
  const id = 'puzzle_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);
  const existing = list.findIndex(p => p.title === title);
  const entry = {
    id: existing >= 0 ? list[existing].id : id,
    title,
    publishedAt: new Date().toLocaleDateString('en-ZA'),
    publishedAtFull: new Date().toISOString(),
    data
  };
  if (existing >= 0) {
    list[existing] = entry;
  } else {
    list.unshift(entry); // newest first
  }
  setRegistry(list);
  return entry.id;
}

function removeFromRegistry(id) {
  const list = getRegistry().filter(p => p.id !== id);
  setRegistry(list);
}

function getFromRegistry(id) {
  return getRegistry().find(p => p.id === id) || null;
}
