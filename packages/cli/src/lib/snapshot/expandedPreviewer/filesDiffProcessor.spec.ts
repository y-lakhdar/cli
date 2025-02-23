jest.mock('fs');
jest.mock('fs-extra');

import {mocked} from 'ts-jest/utils';

import {readdirSync, rmSync} from 'fs';
import {readJSONSync, writeJSONSync} from 'fs-extra';
import {getDirectory, getFile} from '../../../__test__/fsUtils';
import {recursiveDirectoryDiff} from './filesDiffProcessor';
import {join} from 'path';

const mockedReadDir = mocked(readdirSync);
const mockedRm = mocked(rmSync);
const mockedReadJson = mocked(readJSONSync);
const mockedWriteJSON = mocked(writeJSONSync);

const resourceA = {
  resources: {
    EXTENSION: [
      {
        resourceName: 'resourceA',
        someProp: 'someValue',
      },
    ],
  },
};
const resourceAModified = {
  resources: {
    EXTENSION: [
      {
        resourceName: 'resourceA',
        someProp: 'otherValue',
      },
    ],
  },
};
const resourcesAB = {
  resources: {
    EXTENSION: [
      {
        resourceName: 'resourceA',
        someProp: 'someValue',
      },
      {
        resourceName: 'resourceB',
      },
    ],
  },
};

describe('#recursiveDirectoryDiff', () => {
  beforeEach(() => {
    mockedReadDir.mockReturnValue([]);
  });
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('when deleteMissingFile is true', () => {
    it('should delete files present in the currentDir but not in the nextDir', () => {
      mockedReadDir.mockReturnValueOnce([getFile('someFile.json')]);
      mockedReadDir.mockReturnValueOnce([]);

      recursiveDirectoryDiff('currentDir', 'nextDir', true);

      expect(mockedRm).toHaveBeenCalledWith(
        join('currentDir', 'someFile.json')
      );
    });

    it('should delete resources present in the currentDir but not in the nextDir', () => {
      mockedReadDir.mockReturnValueOnce([getFile('someFile.json')]);
      mockedReadDir.mockReturnValueOnce([getFile('someFile.json')]);
      mockedReadJson.mockReturnValueOnce(resourceA);
      mockedReadJson.mockReturnValueOnce(resourcesAB);

      recursiveDirectoryDiff('currentDir', 'nextDir', true);

      expect(mockedWriteJSON).toHaveBeenCalledWith(
        join('currentDir', 'someFile.json'),
        resourceA,
        {spaces: '\t'}
      );
    });
  });

  describe('when deleteMissingFile is false', () => {
    it('should preserve files present in the currentDir but not in the nextDir', () => {
      mockedReadDir.mockReturnValueOnce([getFile('someFile.json')]);
      mockedReadDir.mockReturnValueOnce([]);

      recursiveDirectoryDiff('currentDir', 'nextDir', false);

      expect(mockedRm).not.toHaveBeenCalled();
    });

    it('should preserve keys present in the currentDir but not in the nextDir', () => {
      mockedReadDir.mockReturnValueOnce([getFile('someFile.json')]);
      mockedReadDir.mockReturnValueOnce([getFile('someFile.json')]);
      mockedReadJson.mockReturnValueOnce(resourceA);
      mockedReadJson.mockReturnValueOnce(resourcesAB);

      recursiveDirectoryDiff('currentDir', 'nextDir', false);

      expect(mockedWriteJSON).toHaveBeenCalledWith(
        join('currentDir', 'someFile.json'),
        resourcesAB,
        {spaces: '\t'}
      );
    });
  });

  it('should check files in sub-directories', () => {
    mockedReadDir.mockReturnValue([]);
    mockedReadDir.mockReturnValueOnce([getDirectory('someDir')]);

    recursiveDirectoryDiff('currentDir', 'nextDir', false);

    expect(mockedReadDir).toHaveBeenNthCalledWith(
      2,
      join('currentDir', 'someDir'),
      expect.anything()
    );
  });

  it('should create files present in the nextDir but not in the currentDir', () => {
    mockedReadDir.mockReturnValueOnce([]);
    mockedReadDir.mockReturnValueOnce([getFile('someFile.json')]);
    mockedReadJson.mockReturnValueOnce(resourceA);

    recursiveDirectoryDiff('currentDir', 'nextDir', false);

    expect(mockedWriteJSON).toHaveBeenCalledWith(
      join('currentDir', 'someFile.json'),
      resourceA,
      {spaces: '\t'}
    );
  });

  it('should create keys present in the nextDir but not in the currentDir', () => {
    mockedReadDir.mockReturnValueOnce([]);
    mockedReadDir.mockReturnValueOnce([getFile('someFile.json')]);
    mockedReadJson.mockReturnValueOnce(resourcesAB);
    mockedReadJson.mockReturnValueOnce(resourceA);

    recursiveDirectoryDiff('currentDir', 'nextDir', false);

    expect(mockedWriteJSON).toHaveBeenCalledWith(
      join('currentDir', 'someFile.json'),
      resourcesAB,
      {spaces: '\t'}
    );
  });

  it('should replace the value of keys present in the nextDir and in the currentDir', () => {
    mockedReadDir.mockReturnValueOnce([]);
    mockedReadDir.mockReturnValueOnce([getFile('someFile.json')]);
    mockedReadJson.mockReturnValueOnce(resourceAModified);
    mockedReadJson.mockReturnValueOnce(resourceA);

    recursiveDirectoryDiff('currentDir', 'nextDir', false);

    expect(mockedWriteJSON).toHaveBeenCalledWith(
      join('currentDir', 'someFile.json'),
      resourceAModified,
      {spaces: '\t'}
    );
  });
});
