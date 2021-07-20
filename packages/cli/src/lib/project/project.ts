import {createWriteStream, existsSync, unlinkSync, writeFileSync} from 'fs';
import {join} from 'path';
import {cli} from 'cli-ux';
import archiver from 'archiver';
import {InvalidProjectError} from '../errors';
import extract from 'extract-zip';

export class Project {
  public constructor(private _pathToProject: string) {}

  public async refresh(projectContent: Blob) {
    const buffer = await projectContent.arrayBuffer();
    const view = new DataView(buffer);
    writeFileSync(this.temporaryZipPath, view);
    await extract(this.temporaryZipPath, {dir: this.resourcePath});
    this.deleteTemporaryZipFile();
  }

  public deleteTemporaryZipFile() {
    unlinkSync(this.temporaryZipPath);
  }

  private ensureProjectCompliance() {
    /*
     * TODO: CDX-354: add checks to ensure the project is indeed a valid project
     * e.g. * Check if path to resources is a folder
     *      * Check if the root has a valid config file
     */

    if (!existsSync(this.resourcePath)) {
      throw new InvalidProjectError();
    }
  }

  public async compressResources() {
    try {
      this.ensureProjectCompliance();
      await new Promise<void>((resolve, reject) => {
        const outputStream = createWriteStream(this.temporaryZipPath);
        const archive = archiver('zip');

        outputStream.on('close', () => resolve());
        archive.on('error', (err) => reject(err));

        archive.pipe(outputStream);
        archive.directory(this.resourcePath, false);
        archive.finalize();
      });
      return this.temporaryZipPath;
    } catch (error) {
      cli.error(error);
    }
  }

  public get pathToProject() {
    return this._pathToProject;
  }

  public get temporaryZipPath() {
    return join(this.pathToProject, 'snapshot.zip');
  }

  public get resourcePath() {
    return join(this.pathToProject, 'resources');
  }
}
