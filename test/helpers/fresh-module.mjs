let counter = 0;

export async function importFresh(moduleUrl) {
  counter += 1;
  return import(`${moduleUrl}?fresh=${counter}`);
}

export async function loadFreshRl(rlUrl) {
  const module = await importFresh(rlUrl);
  return module.rl;
}
