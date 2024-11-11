import type { Action } from './Action';
import type { Match } from './Match';
import { NoMatch } from './Match';
import { findMatch } from './MatchFinder';
import type { MatchOptions } from './MatchOptions';
import type { Operation } from './Operation';
import { isTag, isWhiteSpace, wrapText } from './Utils';
import { convertHtmlToListOfWords } from './WordSplitter';

const specialCaseClosingTags = new Map([
  ['</strong>', 0],
  ['</em>', 0],
  ['</b>', 0],
  ['</i>', 0],
  ['</big>', 0],
  ['</small>', 0],
  ['</u>', 0],
  ['</sub>', 0],
  ['</strike>', 0],
  ['</s>', 0],
  ['</dfn>', 0],
]);

const specialCaseOpeningTagRegex =
  /<(?:strong|[biu]|dfn|em|big|small|sub|sup|strike|s)[>\s]+/gi;

type DiffOptions = {
  repeatingWordsAccuracy?: number;
  ignoreWhiteSpaceDifferences?: boolean;
  orphanMatchThreshold?: number;
  matchGranularity?: number;
  combineWords?: boolean;
};

function build(
  oldText: string,
  newText: string,
  options?: DiffOptions,
): string {
  if (oldText === newText) {
    return newText;
  }

  const { oldWords, newWords } = splitInputsIntoWords(oldText, newText, []);

  const matchGranularity = Math.min(
    options?.matchGranularity ?? 4,
    oldWords.length,
    newWords.length,
  );

  const operations = getOperations(
    oldWords,
    newWords,
    options?.combineWords ?? false,
    options?.orphanMatchThreshold ?? 0,
    matchGranularity,
    options?.repeatingWordsAccuracy ?? 1,
    options?.ignoreWhiteSpaceDifferences ?? false,
  );

  const specialTagDiffStack: string[] = [];

  const content = operations.map((operation) =>
    performOperation(operation, oldWords, newWords, specialTagDiffStack),
  );
  return content.join('');
}

function splitInputsIntoWords(
  oldText: string,
  newText: string,
  blockExpressions: RegExp[],
) {
  const oldWords = convertHtmlToListOfWords(oldText, blockExpressions);
  const newWords = convertHtmlToListOfWords(newText, blockExpressions);
  return { oldWords, newWords };
}

function performOperation(
  operation: Readonly<Operation>,
  oldWords: readonly string[],
  newWords: readonly string[],
  specialTagDiffStack: string[],
): string {
  switch (operation.action) {
    case 'equal':
      return processEqualOperation(operation, newWords);
    case 'delete':
      return processDeleteOperation(
        operation,
        'diffdel',
        oldWords,
        specialTagDiffStack,
      );
    case 'insert':
      return processInsertOperation(
        operation,
        'diffins',
        newWords,
        specialTagDiffStack,
      );
    case 'replace':
      return processReplaceOperation(
        operation,
        oldWords,
        newWords,
        specialTagDiffStack,
      );
    default:
      return '';
  }
}

function processReplaceOperation(
  operation: Readonly<Operation>,
  oldWords: readonly string[],
  newWords: readonly string[],
  specialTagDiffStack: string[],
): string {
  const deletedContent = processDeleteOperation(
    operation,
    'diffmod',
    oldWords,
    specialTagDiffStack,
  );
  const insertedContent = processInsertOperation(
    operation,
    'diffmod',
    newWords,
    specialTagDiffStack,
  );
  return `${deletedContent}${insertedContent}`;
}

function processInsertOperation(
  operation: Operation,
  cssClass: string,
  newWords: readonly string[],
  specialTagDiffStack: string[],
): string {
  const text = newWords.filter(
    (_s, pos) => pos >= operation.startInNew && pos < operation.endInNew,
  );
  return insertTag('ins', cssClass, text, specialTagDiffStack);
}

function processDeleteOperation(
  operation: Operation,
  cssClass: string,
  oldWords: readonly string[],
  specialTagDiffStack: string[],
): string {
  const text = oldWords.filter(
    (_s, pos) => pos >= operation.startInOld && pos < operation.endInOld,
  );
  return insertTag('del', cssClass, text, specialTagDiffStack);
}

function processEqualOperation(
  operation: Operation,
  newWords: readonly string[],
): string {
  const result = newWords.filter(
    (_s, pos) => pos >= operation.startInNew && pos < operation.endInNew,
  );
  return result.join('');
}

function insertTag(
  tag: string,
  cssClass: string,
  words: string[],
  specialTagDiffStack: string[],
): string {
  const content: string[] = [];

  while (words[0] !== undefined) {
    const nonTags = extractConsecutiveWords(words, (x: string) => !isTag(x));

    let specialCaseTagInjection = '';
    let specialCaseTagInjectionIsbefore = false;

    if (nonTags.length !== 0) {
      const text = wrapText(nonTags.join(''), tag, cssClass);
      content.push(text);
    } else {
      if (specialCaseOpeningTagRegex.test(words[0])) {
        const matchedTag = words[0].match(specialCaseOpeningTagRegex);
        if (matchedTag !== null) {
          const matchedDiff = `<${matchedTag[0].replace(/[<> ]/g, '')}>`;
          specialTagDiffStack.push(matchedDiff);
        }
        specialCaseTagInjection = '<ins class="mod">';
        if (tag === 'del') {
          words.shift();

          while (
            words.length > 0 &&
            specialCaseOpeningTagRegex.test(words[0])
          ) {
            words.shift();
          }
        }
      } else if (specialCaseClosingTags.has(words[0])) {
        const openingTag =
          specialTagDiffStack.length === 0 ? null : specialTagDiffStack.pop();

        if (
          !(
            openingTag === null ||
            openingTag !== words[words.length - 1]?.replace(/\//g, '')
          )
        ) {
          specialCaseTagInjection = '</ins>';
          specialCaseTagInjectionIsbefore = true;
        }

        if (tag === 'del') {
          words.shift();

          while (words.length > 0 && specialCaseClosingTags.has(words[0])) {
            words.shift();
          }
        }
      }

      if (words.length === 0 && specialCaseTagInjection.length === 0) {
        break;
      }

      if (specialCaseTagInjectionIsbefore) {
        content.push(
          specialCaseTagInjection +
            extractConsecutiveWords(words, isTag).join(''),
        );
      } else {
        content.push(
          extractConsecutiveWords(words, isTag).join('') +
            specialCaseTagInjection,
        );
      }
    }
  }

  return content.join('');
}

function extractConsecutiveWords(
  words: string[],
  condition: (word: string) => boolean,
): readonly string[] {
  let indexOfFirstTag = 0;
  let tagFound = false;

  for (let i = 0; i < words.length; i++) {
    const word = words[i];

    if (word === undefined) continue;

    if (i === 0 && word === ' ') {
      words[i] = '&nbsp;';
    }

    if (!condition(word)) {
      indexOfFirstTag = i;
      tagFound = true;
      break;
    }
  }

  if (!tagFound) {
    indexOfFirstTag = words.length;
  }

  const items = words.filter((_s, pos) => pos >= 0 && pos < indexOfFirstTag);
  if (indexOfFirstTag > 0) {
    words.splice(0, indexOfFirstTag);
  }

  return items;
}

function getOperations(
  oldWords: readonly string[],
  newWords: readonly string[],
  combineWords: boolean,
  orphanMatchThreshold: number,
  matchGranularity: number,
  repeatingWordsAccuracy: number,
  ignoreWhiteSpaceDifferences: boolean,
): Operation[] {
  let positionInOld = 0;
  let positionInNew = 0;
  const operations: Operation[] = [];

  const oldWordsCount = oldWords.length;
  const newWordsCount = newWords.length;

  const matches = getMatchingBlocks(
    oldWords,
    newWords,
    matchGranularity,
    repeatingWordsAccuracy,
    ignoreWhiteSpaceDifferences,
  );
  matches.push({
    startInOld: oldWordsCount,
    startInNew: newWordsCount,
    endInOld: oldWordsCount,
    endInNew: newWordsCount,
    size: 0,
  });

  const matchesWithoutOrphans = removeOrphans(
    matches,
    oldWords,
    newWords,
    orphanMatchThreshold,
  );

  for (const match of matchesWithoutOrphans) {
    if (match === null) continue;

    const matchStartsAtCurrentPositionInOld =
      positionInOld === match.startInOld;
    const matchStartsAtCurrentPositionInNew =
      positionInNew === match.startInNew;

    let action: Action;

    if (
      !matchStartsAtCurrentPositionInOld &&
      !matchStartsAtCurrentPositionInNew
    ) {
      action = 'replace';
    } else if (
      matchStartsAtCurrentPositionInOld &&
      !matchStartsAtCurrentPositionInNew
    ) {
      action = 'insert';
    } else if (!matchStartsAtCurrentPositionInOld) {
      action = 'delete';
    } else {
      action = 'none';
    }

    if (action !== 'none') {
      operations.push({
        action,
        startInOld: positionInOld,
        endInOld: match.startInOld,
        startInNew: positionInNew,
        endInNew: match.startInNew,
      });
    }

    if (match.size !== 0) {
      operations.push({
        action: 'equal',
        startInOld: match.startInOld,
        endInOld: match.endInOld,
        startInNew: match.startInNew,
        endInNew: match.endInNew,
      });
    }

    positionInOld = match.endInOld;
    positionInNew = match.endInNew;
  }

  return combineWords
    ? combineOperations(operations, oldWords, newWords)
    : operations;
}

function combineOperations(
  operations: Operation[],
  oldWords: readonly string[],
  newWords: readonly string[],
): Operation[] {
  const combinedOperations: Operation[] = [];

  const operationIsWhitespace = (op: Operation) =>
    isWhiteSpace(
      oldWords
        .filter((_word, pos) => pos >= op.startInOld && pos < op.endInOld)
        .join(''),
    ) &&
    isWhiteSpace(
      newWords
        .filter((_word, pos) => pos >= op.startInNew && pos < op.endInNew)
        .join(''),
    );

  const lastOperation = operations[operations.length - 1];
  for (let index = 0; index < operations.length; index++) {
    const operation = operations[index];
    if (operation === undefined) continue;

    if (operation.action === 'replace') {
      let matchFound = false;

      for (
        let combineIndex = index + 1;
        combineIndex < operations.length;
        combineIndex++
      ) {
        const operationToCombine = operations[combineIndex];
        if (operationToCombine === undefined) continue;

        if (
          operationToCombine.action !== 'replace' &&
          operationToCombine.action === 'equal' &&
          !operationIsWhitespace(operationToCombine)
        ) {
          combinedOperations.push({
            action: 'replace',
            startInOld: operation.startInOld,
            endInOld: operationToCombine.startInOld,
            startInNew: operation.startInNew,
            endInNew: operationToCombine.startInNew,
          });
          index = combineIndex - 1;
          matchFound = true;
          break;
        }
      }

      if (!matchFound && lastOperation) {
        combinedOperations.push({
          action: 'replace',
          startInOld: operation.startInOld,
          endInOld: lastOperation.endInOld,
          startInNew: operation.startInNew,
          endInNew: lastOperation.endInNew,
        });

        break;
      }
    } else {
      combinedOperations.push(operation);
    }
  }

  return combinedOperations;
}

function removeOrphans(
  matches: Match[],
  oldWords: readonly string[],
  newWords: readonly string[],
  orphanMatchThreshold: number,
): Match[] {
  const matchesWithoutOrphans: Match[] = [];

  let prev: Match = { ...NoMatch };
  let curr: Match | null = null;

  for (const next of matches) {
    if (curr === null) {
      prev = { ...NoMatch };
      curr = next;
      continue;
    }

    if (
      (prev.endInOld === curr.startInOld &&
        prev.endInNew === curr.startInNew) ||
      (curr.endInOld === next.startInOld && curr.endInNew === next.startInNew)
    ) {
      matchesWithoutOrphans.push(curr);
      prev = curr;
      curr = next;
      continue;
    }

    const sumLength = (sum: number, word: string) => sum + word.length;

    const oldDistanceInChars = oldWords
      .slice(prev.endInOld, next.startInOld)
      .reduce(sumLength, 0);
    const newDistanceInChars = newWords
      .slice(prev.endInNew, next.startInNew)
      .reduce(sumLength, 0);
    const currMatchLengthInChars = newWords
      .slice(curr.startInNew, curr.endInNew)
      .reduce(sumLength, 0);
    if (
      currMatchLengthInChars >
      Math.max(oldDistanceInChars, newDistanceInChars) * orphanMatchThreshold
    ) {
      matchesWithoutOrphans.push(curr);
    }

    prev = curr;
    curr = next;
  }

  if (curr !== null) matchesWithoutOrphans.push(curr);

  return matchesWithoutOrphans;
}

function getMatchingBlocks(
  oldWords: readonly string[],
  newWords: readonly string[],
  matchGranularity: number,
  repeatingWordsAccuracy: number,
  ignoreWhiteSpaceDifferences: boolean,
): Match[] {
  return findMatchingBlocks(
    0,
    oldWords.length,
    0,
    newWords.length,
    oldWords,
    newWords,
    matchGranularity,
    repeatingWordsAccuracy,
    ignoreWhiteSpaceDifferences,
  );
}

function findMatchingBlocks(
  startInOld: number,
  endInOld: number,
  startInNew: number,
  endInNew: number,
  oldWords: readonly string[],
  newWords: readonly string[],
  matchGranularity: number,
  repeatingWordsAccuracy: number,
  ignoreWhiteSpaceDifferences: boolean,
): Match[] {
  if (startInOld >= endInOld || startInNew >= endInNew) return [];

  const match = findMatchByGranularity(
    startInOld,
    endInOld,
    startInNew,
    endInNew,
    oldWords,
    newWords,
    matchGranularity,
    repeatingWordsAccuracy,
    ignoreWhiteSpaceDifferences,
  );

  if (match === null) return [];

  const preMatch = findMatchingBlocks(
    startInOld,
    match.startInOld,
    startInNew,
    match.startInNew,
    oldWords,
    newWords,
    matchGranularity,
    repeatingWordsAccuracy,
    ignoreWhiteSpaceDifferences,
  );

  const postMatch = findMatchingBlocks(
    match.endInOld,
    endInOld,
    match.endInNew,
    endInNew,
    oldWords,
    newWords,
    matchGranularity,
    repeatingWordsAccuracy,
    ignoreWhiteSpaceDifferences,
  );

  return [...preMatch, match, ...postMatch];
}

function findMatchByGranularity(
  startInOld: number,
  endInOld: number,
  startInNew: number,
  endInNew: number,
  oldWords: readonly string[],
  newWords: readonly string[],
  matchGranularity: number,
  repeatingWordsAccuracy: number,
  ignoreWhiteSpaceDifferences: boolean,
): Match | null {
  for (let i = matchGranularity; i > 0; i--) {
    const options: MatchOptions = {
      blockSize: i,
      repeatingWordsAccuracy,
      ignoreWhiteSpaceDifferences,
    };

    const match = findMatch(
      oldWords,
      newWords,
      startInOld,
      endInOld,
      startInNew,
      endInNew,
      options,
    );

    if (match !== null) {
      return match;
    }
  }

  return null;
}

function execute(oldText: string, newText: string, options?: DiffOptions) {
  return build(oldText, newText, options);
}

export const Diff = { execute };
