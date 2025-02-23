import {
  pathExistsSync,
  createFileSync,
  writeJSONSync,
  readJSONSync,
} from 'fs-extra';
import {join} from 'path';
import {PlatformEnvironment, PlatformRegion} from '../platform/environment';

export interface Configuration {
  region: PlatformRegion;
  environment: PlatformEnvironment;
  organization: string;
  [k: string]: unknown;
  analyticsEnabled: boolean | undefined;
  accessToken: string | undefined;
  anonymous?: boolean | undefined;
}

export const DefaultConfig: Configuration = {
  environment: 'prod',
  region: 'us-east-1',
  organization: '',
  analyticsEnabled: undefined,
  accessToken: undefined,
  anonymous: undefined,
};

export class Config {
  public constructor(
    private configDir: string,
    private error = console.error
  ) {}

  public get(): Configuration {
    this.ensureExists();
    try {
      const content = readJSONSync(this.configPath);
      if (content instanceof Error) {
        throw content;
      }
      return content;
    } catch (e) {
      this.error(`Error while reading configuration at ${this.configPath}`);
      this.replace(DefaultConfig);
      this.error(
        `Configuration has been reset to default value: ${JSON.stringify(
          DefaultConfig
        )}`
      );
      return DefaultConfig;
    }
  }

  public replace(config: Configuration) {
    this.ensureExists();
    return writeJSONSync(this.configPath, config);
  }

  public set<K extends keyof Configuration, V extends Configuration[K]>(
    key: K,
    value: V
  ) {
    this.ensureExists();
    const config = this.get();
    config[key] = value;
    this.replace(config);
  }

  public setAny(key: string, value: unknown) {
    this.ensureExists();
    const config = this.get();
    config[key] = value;
    this.replace(config);
  }

  public delete<K extends keyof Configuration>(key: K) {
    this.ensureExists();
    const config = this.get();
    delete config[key];
    this.replace(config);
  }

  public deleteAny(key: string) {
    this.ensureExists();
    const config = this.get();
    delete config[key];
    this.replace(config);
  }

  private get configPath() {
    return join(this.configDir, 'config.json');
  }

  private ensureExists() {
    const exists = pathExistsSync(this.configPath);
    if (!exists) {
      createFileSync(this.configPath);
      writeJSONSync(this.configPath, DefaultConfig);
    }
  }
}
