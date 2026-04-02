export interface IConfiguration {
  get<T>(key: string, defaultValue: T): T;
}
