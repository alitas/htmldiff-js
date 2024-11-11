export type Match = {
  startInOld: number;
  startInNew: number;
  endInOld: number;
  endInNew: number;
  size: number;
};

export const NoMatch = {
  size: 0,
  startInNew: 0,
  endInNew: 0,
  endInOld: 0,
  startInOld: 0,
} as const;
