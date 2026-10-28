#!/usr/bin/env node

const originalEmitWarning = process.emitWarning;
process.emitWarning = (warning, ...args) => {
  if (typeof warning === 'string' && warning.includes('NODE_TLS_REJECT_UNAUTHORIZED')) return;
  if (warning?.message?.includes('NODE_TLS_REJECT_UNAUTHORIZED')) return;
  return originalEmitWarning.call(process, warning, ...args);
};
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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
