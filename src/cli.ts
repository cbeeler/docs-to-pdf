#!/usr/bin/env node

import * as command from './command';

const program = command.makeProgram();

export default (args: string[]) => {
  try {
    program.parse(args);
  } catch (err) {
    if (err instanceof Error) {
      if (program.opts().debug) {
        console.log(`${err.stack}`);
      }
    } else {
      throw err;
    }
    // Recommended practice for node is set exitcode not force exit
    process.exitCode = 1;
  }
};
