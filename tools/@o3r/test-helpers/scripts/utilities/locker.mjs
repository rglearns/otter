import {existsSync, rmSync, statSync, watch, writeFileSync} from 'node:fs';
import * as path from 'node:path';

export class Locker {
  constructor(options) {
    this.options = {
      MAX_LOCK_AGE: 10 * 60 * 1000,
      LOCK_TIMEOUT: 2 * 60 * 1000,
      lockFilePath: path.join(process.cwd(), 'lock'),
      ...options
    };
  }
  lock() {
    writeFileSync(this.options.lockFilePath, '');
  }
  unlock() {
    rmSync(this.options.lockFilePath);
  }
  isLocked() {
    return existsSync(this.options.lockFilePath) && !this.isLockExpired();
  }
  isLockExpired() {
    try {
      return (Date.now() - statSync(this.options.lockFilePath).birthtime.getTime()) > this.options.MAX_LOCK_AGE;
    } catch (err) {
      return false;
    }
  }
  waitUntilUnlocked() {
    return new Promise((resolve, reject) => {
      let timer, watcher;
      timer = setTimeout(() => {
        watcher.close();
        reject(new Error(`Exceeded timeout while waiting for the unlock on ${this.options.lockFilePath}`));
      }, this.options.LOCK_TIMEOUT);
      const check = () => {
        if (!existsSync(this.options.lockFilePath)) {
          watcher.close();
          clearTimeout(timer);
          resolve();
        }
      };
      watcher = watch(this.options.lockFilePath, {persistent: false}, check);
      watcher.on('error', check);
    });
  }
}
