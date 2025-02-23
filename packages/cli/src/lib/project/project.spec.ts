jest.mock('@coveord/platform-client');
jest.mock('fs');
jest.mock('archiver');
jest.mock('@oclif/errors');
jest.mock('fs-extra');
jest.mock('extract-zip');
import {mocked} from 'ts-jest/utils';
import {
  existsSync,
  createWriteStream,
  WriteStream,
  unlinkSync,
  writeFileSync,
  readdirSync,
} from 'fs';
import {
  writeJSONSync,
  readJsonSync,
  pathExistsSync,
  ensureDirSync,
} from 'fs-extra';
import {Project} from './project';
import {join, resolve} from 'path';
import archiver, {Archiver} from 'archiver';
import extract from 'extract-zip';
import {Writable} from 'stream';
import {error} from '@oclif/errors';
import {getDirectory, getFile} from '../../__test__/fsUtils';

const mockedExistSync = mocked(existsSync);
const mockedReadDirSync = mocked(readdirSync);
const mockedUnlinkSync = mocked(unlinkSync);
const mockedCreateWriteStream = mocked(createWriteStream);
const mockedArchiver = mocked(archiver);
const mockedExtract = mocked(extract);
const mockedPipe = jest.fn();
const mockedPassDirectory = jest.fn();
const mockedFinalize = jest.fn();
const mockedError = mocked(error);
const mockedCreateFileSync = mocked(ensureDirSync);
const mockedWriteJSONSync = mocked(writeJSONSync);
const mockedReadJSONSync = mocked(readJsonSync);
const mockedPathExistsSync = mocked(pathExistsSync);

mockedArchiver.mockImplementation(
  () =>
    ({
      on: () => {},
      pipe: mockedPipe,
      directory: mockedPassDirectory,
      finalize: mockedFinalize,
    } as unknown as Archiver)
);

mockedExtract.mockImplementation(() => Promise.resolve());
mockedReadDirSync.mockImplementation(() => []);
const doMockValidProject = () => {
  mockedExistSync.mockReturnValue(true);
};

const doMockFileDoesNotExists = (missing: string) => {
  mockedExistSync.mockImplementationOnce((p) => {
    if (p.toString().indexOf(missing) !== -1) {
      return false;
    }
    return true;
  });
};

const doMockCreateWriteStream = () => {
  mockedCreateWriteStream.mockImplementation(() => {
    const writableStream = new Writable();
    writableStream._write = (_chunk, _encoding, next) => next();
    process.nextTick(() => writableStream.emit('close'));
    return writableStream as unknown as WriteStream;
  });
};

describe('Project', () => {
  const projectCreator = () => new Project(resolve('dummy/path'));

  beforeAll(() => {
    doMockCreateWriteStream();
  });

  describe('if the project is invalid', () => {
    it('should ensure resources folder exists', async () => {
      doMockFileDoesNotExists('resources');
      const project = projectCreator();
      await project.compressResources();

      expect(mockedExistSync).toHaveBeenNthCalledWith(
        2,
        resolve('dummy/path', 'resources')
      );
      expect(mockedError).toHaveBeenCalledWith(
        new Error(
          `${resolve(
            'dummy/path'
          )} is not a valid project: Does not contain any resources folder`
        )
      );
    });

    it('should ensure .coveo hidden folder exists', async () => {
      doMockFileDoesNotExists('_');
      const project = projectCreator();
      doMockFileDoesNotExists('.coveo');

      await project.compressResources();

      expect(mockedExistSync).toHaveBeenNthCalledWith(
        3,
        resolve('dummy/path', '.coveo')
      );
      expect(mockedError).toHaveBeenCalledWith(
        new Error(
          `${resolve(
            'dummy/path'
          )} is not a valid project: Does not contain any .coveo folder`
        )
      );
    });
  });

  it('should create .coveo project if absent', () => {
    doMockFileDoesNotExists('.coveo');
    mockedPathExistsSync.mockReturnValueOnce(false);
    projectCreator();
    expect(mockedCreateFileSync).toHaveBeenCalledWith(
      expect.stringContaining('.coveo')
    );
    expect(mockedWriteJSONSync).toHaveBeenCalledWith(
      expect.stringContaining(join('.coveo/config.json')),
      expect.objectContaining({version: 1})
    );
  });

  describe('if the project is valid', () => {
    let pathToResources: string;
    let pathToZip: string;
    let project: Project;

    beforeEach(async () => {
      doMockValidProject();
      pathToResources = resolve('dummy', 'path', 'resources');
      pathToZip = resolve('dummy', 'path', 'snapshot.zip');
      project = projectCreator();
      await project.compressResources();
    });

    it('#compressResources should create a write stream the appropriate path to the zip file', () => {
      expect(mockedCreateWriteStream).toHaveBeenCalledWith(pathToZip);
    });

    it('#compressResources should append files from the resource directory', () => {
      const putTheContentAtTheRootOfTheArchive = false;
      expect(mockedPassDirectory).toHaveBeenCalledWith(
        pathToResources,
        putTheContentAtTheRootOfTheArchive
      );
    });

    it('#compressResources should finalize when there are no more resources to zip', () => {
      expect(mockedFinalize).toHaveBeenCalledTimes(1);
    });

    it('#deleteTemporaryZipFile should delete the temporary a zip file', () => {
      project.deleteTemporaryZipFile();
      expect(mockedUnlinkSync).toHaveBeenCalledWith(pathToZip);
    });

    it.todo(
      '#compressResources should reject if the archiver returns an error'
    );

    describe('#refresh', () => {
      const mockedWriteFileSync = mocked(writeFileSync);

      const Blob = jest.fn().mockImplementation(() => ({
        arrayBuffer: () => new ArrayBuffer(0),
      }));
      const mockedDataView = jest.fn().mockImplementation(() => ({}));
      let trueDataView: DataViewConstructor;
      beforeAll(() => {
        trueDataView = DataView;
        global.DataView = mockedDataView;
      });

      afterAll(() => {
        global.DataView = trueDataView;
      });

      it('should write the zip on disk', async () => {
        const project = projectCreator();
        const fakeBlob = new Blob();
        await project.refresh(fakeBlob);

        expect(mockedDataView).toHaveBeenCalled();

        expect(mockedWriteFileSync).toHaveBeenCalledWith(
          resolve('dummy/path', 'snapshot.zip'),
          mockedDataView.mock.instances[0]
        );
      });

      it('should extract the zip in the resource folder', async () => {
        const project = projectCreator();
        const fakeBlob = new Blob();
        await project.refresh(fakeBlob);

        expect(mockedExtract).toHaveBeenCalledWith(
          resolve('dummy/path', 'snapshot.zip'),
          {dir: resolve('dummy/path', 'resources')}
        );
      });

      it('should format every JSON files in the resource folder', async () => {
        const project = projectCreator();
        const fakeBlob = new Blob();
        mockedReadJSONSync
          .mockReturnValueOnce({call: 1})
          .mockReturnValueOnce({call: 2});
        mockedReadDirSync
          .mockImplementationOnce(() => [
            getFile('somefile.json'),
            getFile('somefile.notJson'),
            getDirectory('someDirectory'),
          ])
          .mockImplementationOnce(() => [getFile('someFileInASubDir.json')]);

        await project.refresh(fakeBlob);

        expect(mockedReadDirSync).toHaveBeenNthCalledWith(
          1,
          resolve('dummy/path', 'resources'),
          {withFileTypes: true}
        );
        expect(mockedReadDirSync).toHaveBeenNthCalledWith(
          2,
          resolve('dummy/path', 'resources', 'someDirectory'),
          {withFileTypes: true}
        );
        expect(mockedReadJSONSync).toHaveBeenCalledTimes(2);
        expect(mockedReadJSONSync).toHaveBeenCalledWith(
          resolve('dummy/path', 'resources', 'somefile.json')
        );
        expect(mockedReadJSONSync).toHaveBeenCalledWith(
          resolve(
            'dummy/path',
            'resources',
            'someDirectory',
            'someFileInASubDir.json'
          )
        );
        expect(mockedWriteJSONSync).toHaveBeenCalledTimes(2);
        expect(mockedWriteJSONSync).toHaveBeenCalledWith(
          resolve('dummy/path', 'resources', 'somefile.json'),
          {call: 1},
          {spaces: '\t'}
        );
        expect(mockedWriteJSONSync).toHaveBeenCalledWith(
          resolve(
            'dummy/path',
            'resources',
            'someDirectory',
            'someFileInASubDir.json'
          ),
          {call: 2},
          {spaces: '\t'}
        );
      });
    });
  });
});
