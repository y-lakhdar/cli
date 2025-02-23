jest.mock('../../../lib/decorators/preconditions/npm');
jest.mock('../../../lib/decorators/preconditions/node');
jest.mock('../../../lib/decorators/preconditions/ng');
jest.mock('../../../lib/utils/process');
jest.mock('../../../lib/oauth/oauth');
jest.mock('../../../lib/config/config');
jest.mock('../../../hooks/analytics/analytics');
jest.mock('../../../hooks/prerun/prerun');
jest.mock('../../../lib/platform/authenticatedClient');
jest.mock('../../../lib/utils/misc');
jest.mock('@coveord/platform-client');

import {join} from 'path';
import {mocked} from 'ts-jest/utils';
import {test} from '@oclif/test';
import {spawnProcess} from '../../../lib/utils/process';
import {AuthenticatedClient} from '../../../lib/platform/authenticatedClient';
import PlatformClient from '@coveord/platform-client';
import {Config, Configuration} from '../../../lib/config/config';
import {
  IsNpmVersionInRange,
  IsNodeVersionInRange,
} from '../../../lib/decorators/preconditions/';
import {getPackageVersion} from '../../../lib/utils/misc';
import Command from '@oclif/command';
import {IsNgInstalled} from '../../../lib/decorators/preconditions/ng';

describe('ui:create:angular', () => {
  const mockedConfig = mocked(Config);
  const mockedSpawnProcess = mocked(spawnProcess, true);
  const mockedPlatformClient = mocked(PlatformClient);
  const mockedGetPackageVersion = mocked(getPackageVersion);
  const mockedAuthenticatedClient = mocked(AuthenticatedClient);
  const mockedIsNpmVersionInRange = mocked(IsNpmVersionInRange, true);
  const mockedIsNodeVersionInRange = mocked(IsNodeVersionInRange, true);
  const mockedIsNgInstalled = mocked(IsNgInstalled, true);
  const preconditionStatus = {
    node: true,
    npm: true,
    ng: true,
  };
  const doMockPreconditions = function () {
    const mockNode = function (_target: Command) {
      return new Promise<boolean>((resolve) =>
        resolve(preconditionStatus.node)
      );
    };
    const mockNpm = function (_target: Command) {
      return new Promise<boolean>((resolve) => resolve(preconditionStatus.npm));
    };
    const mockNg = function (_target: Command) {
      return new Promise<boolean>((resolve) => resolve(preconditionStatus.ng));
    };
    mockedIsNodeVersionInRange.mockReturnValue(mockNode);
    mockedIsNpmVersionInRange.mockReturnValue(mockNpm);
    mockedIsNgInstalled.mockReturnValue(mockNg);
  };

  const doMockSpawnProcess = () => {
    mockedSpawnProcess.mockResolvedValue(Promise.resolve(0));
  };

  const doMockedGetPackageVersion = () => {
    mockedGetPackageVersion.mockReturnValue('1.0.0');
  };

  const doMockConfiguration = () => {
    mockedConfig.mockImplementation(
      () =>
        ({
          get: () =>
            ({
              environment: 'dev',
              organization: 'my-org',
              region: 'us-east-1',
              analyticsEnabled: true,
            } as Configuration),
        } as Config)
    );
  };

  const doMockAuthenticatedClient = () => {
    mockedAuthenticatedClient.mockImplementation(
      () =>
        ({
          createImpersonateApiKey: (_name: string) =>
            Promise.resolve({
              value: 'foo',
            }),
          getUserInfo: () =>
            Promise.resolve({
              username: 'bob@coveo.com',
              providerUsername: 'bob@coveo.com',
              displayName: 'bob',
            }),
          getClient: () =>
            Promise.resolve(
              mockedPlatformClient.getMockImplementation()!({
                accessToken: 'foo',
                organizationId: 'my-org',
              })
            ),
          cfg: mockedConfig.getMockImplementation()!('./'),
        } as AuthenticatedClient)
    );
  };

  const doMockPlatformClient = () => {
    mockedPlatformClient.mockImplementation(
      () =>
        ({
          initialize: () => Promise.resolve(),
        } as PlatformClient)
    );
  };

  beforeEach(() => {
    doMockedGetPackageVersion();
    doMockSpawnProcess();
    doMockPlatformClient();
    doMockConfiguration();
    doMockAuthenticatedClient();
    doMockPreconditions();
    preconditionStatus.npm = true;
    preconditionStatus.node = true;
    preconditionStatus.ng = true;
  });

  afterEach(() => {
    mockedIsNodeVersionInRange.mockClear();
    mockedIsNpmVersionInRange.mockClear();
  });

  test
    .do(() => {
      preconditionStatus.npm = false;
    })
    .command(['ui:create:angular', 'myapp'])
    .it(
      'should not execute the command if the preconditions are not respected',
      async () => {
        expect(mockedSpawnProcess).toHaveBeenCalledTimes(0);
      }
    );

  test
    .command(['ui:create:angular'])
    .catch((ctx) => {
      expect(ctx.message).toContain('Missing 1 required arg:');
    })
    .it('requires application name argument', async () => {});

  test
    .command(['ui:create:angular', 'myapp'])
    .it(
      'should start a spawn process with the appropriate arguments',
      async () => {
        expect(mockedSpawnProcess).toHaveBeenCalledTimes(2);
        expect(mockedSpawnProcess).nthCalledWith(
          1,
          expect.stringContaining('ng'),
          ['new', 'myapp', '--style', 'scss', '--routing'],
          expect.objectContaining({})
        );
        expect(mockedSpawnProcess).nthCalledWith(
          2,
          expect.stringContaining('ng'),
          [
            'add',
            '@coveo/angular@1.0.0',
            '--org-id',
            'my-org',
            '--api-key',
            'foo',
            '--platform-url',
            'https://platformdev.cloud.coveo.com',
            '--user',
            'bob@coveo.com',
            '--skip-confirmation',
          ],
          expect.objectContaining({cwd: 'myapp'})
        );
        await Promise.resolve();
      }
    );
});
