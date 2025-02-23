import {Command} from '@oclif/command';

export const getFakeCommand = (): Command => {
  const fakeCommand = {
    id: 'foo',
    warn: jest.fn(),
    log: jest.fn(),
  };

  return fakeCommand as unknown as Command;
};
