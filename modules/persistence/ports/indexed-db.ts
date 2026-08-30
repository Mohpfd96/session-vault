export type IdbKey = string | number | [string, string, string, string];

export type IdbStoreName = 'cookies' | 'webStorage' | 'events' | 'snapshots' | 'kv';

export type IndexedDbPort = {
  get<T>(store: IdbStoreName, key: IdbKey): Promise<T | undefined>;
  put<T>(store: IdbStoreName, value: T, key?: IdbKey): Promise<IdbKey>;
  delete(store: IdbStoreName, key: IdbKey): Promise<void>;
  getAll<T>(store: IdbStoreName): Promise<T[]>;
  clear(store: IdbStoreName): Promise<void>;
};
