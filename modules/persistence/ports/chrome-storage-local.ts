export type ChromeStorageLocalPort = {
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  getMany<T extends Record<string, unknown>>(
    keys: readonly string[],
  ): Promise<Partial<T>>;
};
