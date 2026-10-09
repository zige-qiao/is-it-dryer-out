// Browser APIs are supplied per controller, never installed on Node's globals.
exports.environment = overrides => Object.create(globalThis, Object.getOwnPropertyDescriptors(overrides));
exports.callbacks = (target, names) => Object.fromEntries(names.map(name => [name, (...args) => target[name](...args)]));

exports.memoryStorage = () => {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
  };
};

exports.element = () => {
  const classes = new Set(), attributes = new Map(), listeners = new Map();
  return {
    hidden: false, disabled: false, open: false, textContent: '', innerHTML: '', value: '',
    dataset: {}, style: { setProperty() {}, removeProperty() {} }, children: [],
    classList: {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      contains: name => classes.has(name),
      toggle(name, force = !classes.has(name)) { if (force) classes.add(name); else classes.delete(name); return force; },
    },
    setAttribute: (name, value) => attributes.set(name, String(value)),
    getAttribute: name => attributes.get(name),
    removeAttribute: name => attributes.delete(name),
    addEventListener(name, fn) { if (!listeners.has(name)) listeners.set(name, []); listeners.get(name).push(fn); },
    removeEventListener(name, fn) { listeners.set(name, (listeners.get(name) || []).filter(listener => listener !== fn)); },
    emit(name, event = {}) { for (const fn of listeners.get(name) || []) fn(event); },
    append(...children) { this.children.push(...children); },
    insertBefore(child, reference) {
      if (child.parentNode) child.parentNode.children = child.parentNode.children.filter(value => value !== child);
      const index = reference ? this.children.indexOf(reference) : this.children.length;
      this.children.splice(index < 0 ? this.children.length : index, 0, child);
      child.parentNode = this;
      return child;
    },
    replaceChildren(...children) { this.children = children; },
    focus() {}, select() {}, showModal() { this.open = true; }, close() { this.open = false; this.emit('close'); },
    querySelectorAll: () => [],
  };
};
