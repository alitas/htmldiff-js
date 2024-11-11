const tagRegex = /^\s*<[^>]+>\s*$/;
const tagWordRegex = /<[^\s>]+/;
const whitespaceRegex = /^(?:\s|&nbsp;)+$/;
const wordRegex = /[\p{Script_Extensions=Latin}\d@#]+/u;

const specialCaseWordTags = ['<img'];

export const isTag = (item: string) =>
  !specialCaseWordTags.some((tag) => item?.startsWith(tag)) &&
  tagRegex.test(item);

export const stripTagAttributes = (word: string) => {
  const tag = tagWordRegex.exec(word)?.[0];
  return tag ? tag + (word.endsWith('/>') ? '/>' : '>') : word;
};

export const wrapText = (text: string, tagName: string, cssClass: string) =>
  `<${tagName} class="${cssClass}">${text}</${tagName}>`;

export const isStartOfTag = (val: string) => val === '<';

export const isEndOfTag = (val: string) => val === '>';

export const isStartOfEntity = (val: string) => val === '&';

export const isEndOfEntity = (val: string) => val === ';';

export const isWhiteSpace = (value: string | undefined) =>
  value !== undefined && whitespaceRegex.test(value);

export const stripAnyAttributes = (word: string) =>
  isTag(word) ? stripTagAttributes(word) : word;

export const isWord = (text: string | undefined) =>
  text !== undefined && wordRegex.test(text);
