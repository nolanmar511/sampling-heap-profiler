

import {heap} from 'pprof';

import {writeAsync} from './write';

export interface Allocation {
  size: number;
  count: number;
}
export interface AllocationProfileNode {
  name?: string;
  scriptName: string;
  scriptId: number;
  lineNumber: number;
  columnNumber: number;
  allocations: Allocation[];
  children: AllocationProfileNode[];
}

let profiling = false;

export interface StartOptions {
  sampleIntervalBytes?: number;
  stackDepth?: number;
}

export function start(cfg?: {sampleIntervalBytes: number, stackDepth: number}) {
  const DEFAULT_CONFIG = {
    sampleIntervalBytes: 512 * 1024,
    stackDepth: 64,
  };
  cfg = {...DEFAULT_CONFIG, ...cfg};
  if (!profiling) {
    heap.start(cfg.sampleIntervalBytes, cfg.stackDepth);
    profiling = true;
  }
}

export function stop() {
  if (profiling) {
    heap.stop();
    profiling = false;
  }
}

export function get(translate: true): DevToolsProfileNode;
export function get(translate?: false): AllocationProfileNode;
export function get(translate?: boolean): AllocationProfileNode|
    DevToolsProfileNode {
  if (!profiling) {
    throw new Error('get can only be called after profiler has been started');
  }
  const profile = heap.profile();
  return translate ? translateToDevtools(profile) : profile;
}

export interface Callback {
  (err: Error|null, filename?: string): void;
}

export function write(): Promise<string>;
export function write(filename: string): Promise<string>;
export function write(cb: Callback): void;
export function write(filename: string, cb: Callback): void;
export function write(
    filename?: string|Callback, cb?: Callback): Promise<string>|void {
  if (typeof filename === 'function') {
    cb = filename;
    filename = undefined;
  }

  const profile = get(true);
  const promise = profiling ? writeAsync(profile, filename) :
                              Promise.reject(new Error('profiler not running'));
  if (cb) {
    promise.then(cb.bind(null, null)).catch(cb);
  } else {
    return promise;
  }
}

export interface DevToolsProfileNode {
  functionName?: string;
  scriptId: number;
  lineNumber: number;
  columnNumber: number;
  url: string;
  selfSize: number;
  children: DevToolsProfileNode[];
}

function translateToDevtools(node: AllocationProfileNode): DevToolsProfileNode {
  return {
    functionName: node.name,
    scriptId: node.scriptId,
    lineNumber: node.lineNumber,
    columnNumber: node.columnNumber,
    url: node.scriptName,
    selfSize: node.allocations.reduce(
        (sum, alloc) => {
          return sum + alloc.size * alloc.count;
        },
        0),
    children: node.children.map(translateToDevtools)
  };
}
