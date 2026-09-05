class ServiceContainer {
  constructor() {
    this.services = new Map();
    this.factories = new Map();
    this.singletons = new Map();
  }

  register(name, factory, options = {}) {
    const { singleton = true } = options;
    this.factories.set(name, { factory, singleton });
    if (!singleton) {
      this.services.delete(name);
    }
  }

  registerSingleton(name, instance) {
    this.singletons.set(name, instance);
  }

  get(name) {
    if (this.singletons.has(name)) {
      return this.singletons.get(name);
    }

    if (this.services.has(name)) {
      return this.services.get(name);
    }

    const registration = this.factories.get(name);
    if (!registration) {
      throw new Error(`Service '${name}' not registered`);
    }

    const { factory, singleton } = registration;
    const instance = factory(this);

    if (singleton) {
      this.services.set(name, instance);
    }

    return instance;
  }

  has(name) {
    return this.factories.has(name) || this.singletons.has(name) || this.services.has(name);
  }

  clear() {
    this.services.clear();
    this.singletons.clear();
  }

  createScope() {
    const scope = new ServiceContainer();
    scope.factories = new Map(this.factories);
    scope.singletons = new Map(this.singletons);
    return scope;
  }
}

export const container = new ServiceContainer();

export function inject(...serviceNames) {
  return (target, propertyKey, parameterIndex) => {
    const existing = Reflect.getMetadata('inject:services', target) || [];
    existing.push({ parameterIndex, serviceNames });
    Reflect.defineMetadata('inject:services', existing, target);
  };
}

export function resolveDependencies(target, container) {
  const metadata = Reflect.getMetadata('inject:services', target) || [];
  const args = [];

  for (const { parameterIndex, serviceNames } of metadata) {
    for (const name of serviceNames) {
      args[parameterIndex] = container.get(name);
    }
  }

  return args;
}

export default container;