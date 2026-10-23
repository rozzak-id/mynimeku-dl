#!/usr/bin/env node

import { setupCommands } from '../src/cli/commands.js';
import { runInteractive } from '../src/cli/interactive.js';

const program = setupCommands();

// If arguments are provided (e.g. "search", "download", etc.), run CLI command
if (process.argv.slice(2).length > 0) {
  program.parse(process.argv);
} else {
  // Otherwise, start interactive menu
  runInteractive().catch((err) => {
    console.error('Fatal Error:', err);
    process.exit(1);
  });
}
