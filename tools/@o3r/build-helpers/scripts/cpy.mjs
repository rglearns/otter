#!/usr/bin/env node

import process from 'node:process';
import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import cpy from 'cpy';
import minimist from 'minimist';

const usageMessage = `
	Usage
	  $ o3r-cpy (<sources …> <destination> | --config=<filename>)

	Options
	  --no-overwrite       Don't overwrite the destination
	  --cwd=<dir>          Working directory for files
	  --rename=<filename>  Rename all <source> filenames to <filename>. Supports string templates.
	  --dot                Allow patterns to match entries that begin with a period (.)
	  --flat               Flatten directory structure. All copied files will be put in the same directory.
	  --concurrency        Number of files being copied concurrently
    --config=<filename>  Path to a configuration file containing Cli Parameters

	<sources> can contain globs if quoted

	Examples
	  Copy all .png files in src folder into dist except src/goat.png
	  $ o3r-cpy 'src/*.png' '!src/goat.png' dist

	  Copy all files inside src folder into dist and preserve path structure
	  $ o3r-cpy . '../dist/' --cwd=src

	  Copy all .png files in the src folder to dist and prefix the image filenames
	  $ o3r-cpy 'src/*.png' dist --cwd=src --rename=hi-{{basename}}

    Get parameters from a local cpy.json file
	  $ o3r-cpy --config './cpy.json'
`;

const argv = minimist(process.argv.slice(2));

try {
  const config = argv.config && JSON.parse(fs.readFileSync(path.resolve(process.cwd(), argv.config), {encoding: 'utf-8'}));
  let rename = argv.rename || config?.rename;
  const stringTemplate = '{{basename}}';
  if (rename?.includes(stringTemplate)) {
    rename = (basename) => {
      const parts = basename.split('.');
      const fileExtension = parts.length > 1 ? `.${parts.pop()}` : '';
      const nameWithoutExtension = parts.join('.');
      return rename.replace(stringTemplate, nameWithoutExtension) + fileExtension;
    };
  }

  const /** @type {string[]} */ sources = argv._?.length ? argv._ : (config?.sources && config?.destination ? [...config.sources, config.destination] : []);
  const destination = source.pop();
  const cwd = config?.cwd || argv.cwd;
  const overwrite = config?.overwrite || argv.overwrite;
  const dot = config?.dot || argv.dot;
  const flat = config?.flat || argv.flat;
  const concurrency = config?.concurrency || argv.concurrency;
  await cpy(sources, destination, {
    cwd: cwd || process.cwd(),
    rename,
    overwrite,
    dot,
    flat,
    concurrency: concurrency ?? (os.cpus().length > 0 ? os.cpus().length : 1) * 2,
  });
} catch (error) {
  if (error.name === 'CpyError') {
    console.error(error.message);
    console.info(usageMessage);
    process.exit(1);
  } else {
    throw error;
  }
}
