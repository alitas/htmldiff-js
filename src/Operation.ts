import type { Action } from './Action';

export type Operation = {
  action: Action;
  startInOld: number;
  endInOld: number;
  startInNew: number;
  endInNew: number;
};
