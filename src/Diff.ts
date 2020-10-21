﻿import Action from "./Action";
import Match from "./Match";
import MatchFinder from "./MatchFinder";
import MatchOptions from "./MatchOptions";
import Operation from "./Operation";
import * as Utils from "./Utils";
import * as WordSplitter from "./WordSplitter";

// This value defines balance between speed and memory utilization. The higher it is the faster it works and more memory consumes.
const MatchGranuarityMaximum = 4;

const specialCaseClosingTags = new Map([
  ["</strong>", 0],
  ["</em>", 0],
  ["</b>", 0],
  ["</i>", 0],
  ["</big>", 0],
  ["</small>", 0],
  ["</u>", 0],
  ["</sub>", 0],
  ["</strike>", 0],
  ["</s>", 0],
  ["</dfn>", 0],
]);

const specialCaseOpeningTagRegex = /<((strong)|(b)|(i)|(dfn)|(em)|(big)|(small)|(u)|(sub)|(sup)|(strike)|(s))[>\s]+/gi;

class HtmlDiff {
  content: string[];
  newText: string;
  oldText: string;
  specialTagDiffStack: string[];
  newWords: string[];
  oldWords: string[];
  matchGranularity: number;
  blockExpressions: RegExp[];
  repeatingWordsAccuracy: number;
  ignoreWhiteSpaceDifferences: boolean;
  orphanMatchThreshold: number;

  constructor(oldText: string, newText: string) {
    this.content = [];
    this.newText = newText;
    this.oldText = oldText;

    this.specialTagDiffStack = [];
    this.newWords = [];
    this.oldWords = [];
    this.matchGranularity = 0;
    this.blockExpressions = [];

    this.repeatingWordsAccuracy = 1.0;
    this.ignoreWhiteSpaceDifferences = false;
    this.orphanMatchThreshold = 0.0;
  }

  build(): string {
    if (this.oldText === this.newText) {
      return this.newText;
    }

    this.splitInputsIntoWords();

    this.matchGranularity = Math.min(
      MatchGranuarityMaximum,
      this.oldWords.length,
      this.newWords.length
    );
    const operations = this.operations();

    for (const item of operations) {
      this.performOperation(item);
    }

    return this.content.join("");
  }

  addBlockExpression(exp: RegExp): void {
    this.blockExpressions.push(exp);
  }

  splitInputsIntoWords(): void {
    this.oldWords = WordSplitter.convertHtmlToListOfWords(
      this.oldText,
      this.blockExpressions
    );

    this.newWords = WordSplitter.convertHtmlToListOfWords(
      this.newText,
      this.blockExpressions
    );
  }

  performOperation(opp: Operation): void {
    switch (opp.action) {
      case Action.equal:
        this.processEqualOperation(opp);
        break;
      case Action.delete:
        this.processDeleteOperation(opp, "diffdel");
        break;
      case Action.insert:
        this.processInsertOperation(opp, "diffins");
        break;
      case Action.none:
        break;
      case Action.replace:
        this.processReplaceOperation(opp);
        break;
    }
  }

  processReplaceOperation(opp: Operation): void {
    this.processDeleteOperation(opp, "diffmod");
    this.processInsertOperation(opp, "diffmod");
  }

  processInsertOperation(opp: Operation, cssClass: string): void {
    const text = this.newWords.filter(
      (_s, pos) => pos >= opp.startInNew && pos < opp.endInNew
    );
    this.insertTag("ins", cssClass, text);
  }

  processDeleteOperation(opp: Operation, cssClass: string): void {
    const text = this.oldWords.filter(
      (_s, pos) => pos >= opp.startInOld && pos < opp.endInOld
    );
    this.insertTag("del", cssClass, text);
  }

  processEqualOperation(opp: Operation): void {
    const result = this.newWords.filter(
      (_s, pos) => pos >= opp.startInNew && pos < opp.endInNew
    );
    this.content.push(result.join(""));
  }

  insertTag(tag: string, cssClass: string, words: string[]): void {
    while (words.length) {
      const nonTags = this.extractConsecutiveWords(
        words,
        (x: string) => !Utils.isTag(x)
      );

      let specialCaseTagInjection = "";
      let specialCaseTagInjectionIsbefore = false;

      if (nonTags.length !== 0) {
        const text = Utils.wrapText(nonTags.join(""), tag, cssClass);
        this.content.push(text);
      } else {
        if (specialCaseOpeningTagRegex.test(words[0])) {
          const matchedTag = words[0].match(specialCaseOpeningTagRegex);
          if (matchedTag !== null) {
            const matchedDiff =
              "<" + matchedTag[0].replace(/(<|>| )/g, "") + ">";
            this.specialTagDiffStack.push(matchedDiff);
          }
          specialCaseTagInjection = '<ins class="mod">';
          if (tag === "del") {
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
            this.specialTagDiffStack.length === 0
              ? null
              : this.specialTagDiffStack.pop();

          if (
            !(openingTag === null || openingTag !== words[0].replace(/\//g, ""))
          ) {
            specialCaseTagInjection = "</ins>";
            specialCaseTagInjectionIsbefore = true;
          }

          if (tag === "del") {
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
          this.content.push(
            specialCaseTagInjection +
              this.extractConsecutiveWords(words, Utils.isTag).join("")
          );
        } else {
          this.content.push(
            this.extractConsecutiveWords(words, Utils.isTag).join("") +
              specialCaseTagInjection
          );
        }
      }
    }
  }

  extractConsecutiveWords(
    words: string[],
    condition: (word: string) => boolean
  ): string[] {
    let indexOfFirstTag = 0;
    let tagFound = false;

    for (let i = 0; i < words.length; i++) {
      const word = words[i];

      if (i === 0 && word === " ") {
        words[i] = "&nbsp;";
      }

      if (!condition(word)) {
        indexOfFirstTag = i;
        tagFound = true;
        break;
      }
    }

    if (tagFound) {
      const items = words.filter(
        (_s, pos) => pos >= 0 && pos < indexOfFirstTag
      );
      if (indexOfFirstTag > 0) {
        words.splice(0, indexOfFirstTag);
      }

      return items;
    } else {
      const items = words.filter((_s, pos) => pos >= 0 && pos < words.length);
      words.splice(0, words.length);
      return items;
    }
  }

  operations(): Operation[] {
    let positionInOld = 0;
    let positionInNew = 0;
    const operations = [];

    const matches = this.matchingBlocks();
    matches.push(new Match(this.oldWords.length, this.newWords.length, 0));

    const matchesWithoutOrphans = this.removeOrphans(matches);

    for (const match of matchesWithoutOrphans) {
      if (match === null) continue;

      const matchStartsAtCurrentPositionInOld =
        positionInOld === match.startInOld;
      const matchStartsAtCurrentPositionInNew =
        positionInNew === match.startInNew;

      let action;

      if (
        !matchStartsAtCurrentPositionInOld &&
        !matchStartsAtCurrentPositionInNew
      ) {
        action = Action.replace;
      } else if (
        matchStartsAtCurrentPositionInOld &&
        !matchStartsAtCurrentPositionInNew
      ) {
        action = Action.insert;
      } else if (!matchStartsAtCurrentPositionInOld) {
        action = Action.delete;
      } else {
        action = Action.none;
      }

      if (action !== Action.none) {
        operations.push(
          new Operation(
            action,
            positionInOld,
            match.startInOld,
            positionInNew,
            match.startInNew
          )
        );
      }

      if (match.size !== 0) {
        operations.push(
          new Operation(
            Action.equal,
            match.startInOld,
            match.endInOld,
            match.startInNew,
            match.endInNew
          )
        );
      }

      positionInOld = match.endInOld;
      positionInNew = match.endInNew;
    }

    return operations;
  }

  *removeOrphans(matches: Match[]): Generator<Match | null> {
    let prev: Match = new Match(0, 0, 0);
    let curr: Match | null = null;

    for (const next of matches) {
      if (curr === null) {
        prev = new Match(0, 0, 0);
        curr = next;
        continue;
      }

      if (
        (prev.endInOld === curr.startInOld &&
          prev.endInNew === curr.startInNew) ||
        (curr.endInOld === next.startInOld && curr.endInNew === next.startInNew)
      ) {
        yield curr;
        prev = curr;
        curr = next;
        continue;
      }

      const sumLength = (t: number, n: string) => t + n.length;

      const oldDistanceInChars = this.oldWords
        .slice(prev.endInOld, next.startInOld)
        .reduce(sumLength, 0);
      const newDistanceInChars = this.newWords
        .slice(prev.endInNew, next.startInNew)
        .reduce(sumLength, 0);
      const currMatchLengthInChars = this.newWords
        .slice(curr.startInNew, curr.endInNew)
        .reduce(sumLength, 0);
      if (
        currMatchLengthInChars >
        Math.max(oldDistanceInChars, newDistanceInChars) *
          this.orphanMatchThreshold
      ) {
        yield curr;
      }

      prev = curr;
      curr = next;
    }

    yield curr;
  }

  matchingBlocks(): Match[] {
    const matchingBlocks: Match[] = [];
    this.findMatchingBlocks(
      0,
      this.oldWords.length,
      0,
      this.newWords.length,
      matchingBlocks
    );
    return matchingBlocks;
  }

  findMatchingBlocks(
    startInOld: number,
    endInOld: number,
    startInNew: number,
    endInNew: number,
    matchingBlocks: Match[]
  ): void {
    const match = this.findMatch(startInOld, endInOld, startInNew, endInNew);

    if (match !== null) {
      if (startInOld < match.startInOld && startInNew < match.startInNew) {
        this.findMatchingBlocks(
          startInOld,
          match.startInOld,
          startInNew,
          match.startInNew,
          matchingBlocks
        );
      }

      matchingBlocks.push(match);

      if (match.endInOld < endInOld && match.endInNew < endInNew) {
        this.findMatchingBlocks(
          match.endInOld,
          endInOld,
          match.endInNew,
          endInNew,
          matchingBlocks
        );
      }
    }
  }

  findMatch(
    startInOld: number,
    endInOld: number,
    startInNew: number,
    endInNew: number
  ): Match | null {
    for (let i = this.matchGranularity; i > 0; i--) {
      const options = new MatchOptions();
      options.blockSize = i;
      options.repeatingWordsAccuracy = this.repeatingWordsAccuracy;
      options.ignoreWhiteSpaceDifferences = this.ignoreWhiteSpaceDifferences;

      const finder = new MatchFinder(
        this.oldWords,
        this.newWords,
        startInOld,
        endInOld,
        startInNew,
        endInNew,
        options
      );
      const match = finder.findMatch();
      if (match !== null) {
        return match;
      }
    }

    return null;
  }

  static execute(oldText: string, newText: string): string {
    return new HtmlDiff(oldText, newText).build();
  }
}

export default HtmlDiff;
