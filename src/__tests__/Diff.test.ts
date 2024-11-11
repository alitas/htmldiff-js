import { expect, it } from 'vitest';
import { Diff } from '../Diff';

// tests from: https://github.com/Rohland/htmldiff.net/blob/master/Test.HtmlDiff/HtmlDiffSpecTests.cs

it.each([
  [
    'a word is here',
    'a nother word is there',
    'a<ins class="diffins">&nbsp;nother</ins> word is <del class="diffmod">here</del><ins class="diffmod">there</ins>',
  ],
  ['a c', 'a b c', 'a <ins class="diffins">b </ins>c'],
  ['a b c', 'a c', 'a <del class="diffdel">b </del>c'],
  [
    'a b c',
    'a <strong>b</strong> c',
    'a <strong><ins class="mod">b</ins></strong> c',
  ],
  [
    'a b c',
    'a d c',
    'a <del class="diffmod">b</del><ins class="diffmod">d</ins> c',
  ],
  [
    "<a title='xx'>test</a>",
    "<a title='yy'>test</a>",
    "<a title='yy'>test</a>",
  ],
  [
    "<img src='logo.jpg'/>",
    '',
    '<del class="diffdel"><img src=\'logo.jpg\'/></del>',
  ],
  [
    '',
    "<img src='logo.jpg'/>",
    '<ins class="diffins"><img src=\'logo.jpg\'/></ins>',
  ],
  [
    "symbols 'should not' belong <b>to</b> words",
    'symbols should not belong <b>"to"</b> words',
    'symbols <del class="diffdel">\'</del>should not<del class="diffdel">\'</del> belong <b><ins class="diffins">"</ins>to<ins class="diffins">"</ins></b> words',
  ],
  [
    'entities are separate amp;words',
    'entities are&nbsp;separate &amp;words',
    'entities are<del class="diffmod">&nbsp;</del><ins class="diffmod">&nbsp;</ins>separate <del class="diffmod">amp;</del><ins class="diffmod">&amp;</ins>words',
  ],
  [
    'This is a longer piece of text to ensure the new blocksize algorithm works',
    'This is a longer piece of text to <strong>ensure</strong> the new blocksize algorithm works decently',
    'This is a longer piece of text to <strong><ins class="mod">ensure</ins></strong> the new blocksize algorithm works<ins class="diffins">&nbsp;decently</ins>',
  ],
  [
    'By virtue of an agreement between xxx and the <b>yyy schools</b>, ...',
    'By virtue of an agreement between xxx and the <b>yyy</b> schools, ...',
    'By virtue of an agreement between xxx and the <b>yyy</b> schools, ...',
  ],
  [
    'Some plain text',
    'Some <strong><i>plain</i></strong> text',
    'Some <strong><i><ins class="mod">plain</ins></i></strong> text',
  ],
  [
    'Some <strong><i>formatted</i></strong> text',
    'Some formatted text',
    'Some <ins class="mod">formatted</ins> text',
  ],
  [
    '这个是中文内容, CSharp is the bast',
    '这是中国语内容，CSharp is the best language.',
    '这<del class="diffdel">个</del>是中<del class="diffmod">文</del><ins class="diffmod">国语</ins>内容<del class="diffmod">, </del><ins class="diffmod">，</ins>CSharp is the <del class="diffmod">bast</del><ins class="diffmod">best language.</ins>',
  ],
  [
    'tüh, jantı feda et; pislik böceği yormuş, vazgeç.',
    'tüh, jantı feda et; pislik böceği yormuş, vazgeç.',
    'tüh, jantı feda et; pislik böceği yormuş, vazgeç.',
  ],
  [
    'tüh, jantı feda et; pislik böceği yormuş, vazgeç.',
    'tüh, jantı feda et; pislik bacağı yokmuş, vazgeç.',
    'tüh, jantı feda et; pislik <del class="diffmod">böceği</del><ins class="diffmod">bacağı</ins> <del class="diffmod">yormuş</del><ins class="diffmod">yokmuş</ins>, vazgeç.',
  ],
  [
    'The Dealer.',
    'The Dealer info,',
    'The Dealer<del class="diffmod">.</del><ins class="diffmod">&nbsp;info,</ins>',
  ],
  [
    'The Dealer.',
    'Mr Dealer info,',
    '<del class="diffmod">The</del><ins class="diffmod">Mr</ins> Dealer<del class="diffmod">.</del><ins class="diffmod">&nbsp;info,</ins>',
  ],
])(
  "old text '%s', new text '%s' gives delta '%s'",
  (oldtext, newText, delta) => {
    const result = Diff.execute(oldtext, newText);
    expect(result).toBe(delta);
  },
);

it.each([
  [
    'a word is here',
    'a nother word is there',
    'a<ins class="diffins">&nbsp;nother</ins> word is <del class="diffmod">here</del><ins class="diffmod">there</ins>',
  ],
  ['a c', 'a b c', 'a <ins class="diffins">b </ins>c'],
  ['a b c', 'a c', 'a <del class="diffdel">b </del>c'],
  [
    'a b c',
    'a <strong>b</strong> c',
    'a <strong><ins class="mod">b</ins></strong> c',
  ],
  [
    'a b c',
    'a d c',
    'a <del class="diffmod">b</del><ins class="diffmod">d</ins> c',
  ],
  [
    "<a title='xx'>test</a>",
    "<a title='yy'>test</a>",
    "<a title='yy'>test</a>",
  ],
  [
    "<img src='logo.jpg'/>",
    '',
    '<del class="diffdel"><img src=\'logo.jpg\'/></del>',
  ],
  [
    '',
    "<img src='logo.jpg'/>",
    '<ins class="diffins"><img src=\'logo.jpg\'/></ins>',
  ],
  [
    "symbols 'should not' belong <b>to</b> words",
    'symbols should not belong <b>"to"</b> words',
    'symbols <del class="diffdel">\'</del>should not<del class="diffdel">\'</del> belong <b><ins class="diffins">"</ins>to<ins class="diffins">"</ins></b> words',
  ],
  [
    'entities are separate amp;words',
    'entities are&nbsp;separate &amp;words',
    'entities are<del class="diffmod">&nbsp;</del><ins class="diffmod">&nbsp;</ins>separate <del class="diffmod">amp;</del><ins class="diffmod">&amp;</ins>words',
  ],
  [
    'This is a longer piece of text to ensure the new blocksize algorithm works',
    'This is a longer piece of text to <strong>ensure</strong> the new blocksize algorithm works decently',
    'This is a longer piece of text to <strong><ins class="mod">ensure</ins></strong> the new blocksize algorithm works<ins class="diffins">&nbsp;decently</ins>',
  ],
  [
    'By virtue of an agreement between xxx and the <b>yyy schools</b>, ...',
    'By virtue of an agreement between xxx and the <b>yyy</b> schools, ...',
    'By virtue of an agreement between xxx and the <b>yyy</b> schools, ...',
  ],
  [
    'Some plain text',
    'Some <strong><i>plain</i></strong> text',
    'Some <strong><i><ins class="mod">plain</ins></i></strong> text',
  ],
  [
    'Some <strong><i>formatted</i></strong> text',
    'Some formatted text',
    'Some <ins class="mod">formatted</ins> text',
  ],
  [
    '这个是中文内容, CSharp is the bast',
    '这是中国语内容，CSharp is the best language.',
    '这<del class="diffdel">个</del>是中<del class="diffmod">文</del><ins class="diffmod">国语</ins>内容<del class="diffmod">, </del><ins class="diffmod">，</ins>CSharp is the <del class="diffmod">bast</del><ins class="diffmod">best language.</ins>',
  ],
  [
    'tüh, jantı feda et; pislik böceği yormuş, vazgeç.',
    'tüh, jantı feda et; pislik böceği yormuş, vazgeç.',
    'tüh, jantı feda et; pislik böceği yormuş, vazgeç.',
  ],
  [
    'tüh, jantı feda et; pislik böceği yormuş, vazgeç.',
    'tüh, jantı feda et; pislik bacağı yokmuş, vazgeç.',
    'tüh, jantı feda et; pislik <del class="diffmod">böceği yormuş</del><ins class="diffmod">bacağı yokmuş</ins>, vazgeç.',
  ],
  [
    'The Dealer.',
    'The Dealer info,',
    'The Dealer<del class="diffmod">.</del><ins class="diffmod">&nbsp;info,</ins>',
  ],
  [
    'The Dealer has been really helpful',
    'The Dealer has no idea about this',
    'The Dealer has <del class="diffmod">been really helpful</del><ins class="diffmod">no idea about this</ins>',
  ],
])(
  "orphan match: old text '%s', new text '%s' gives delta '%s'",
  (oldtext, newText, delta) => {
    const result = Diff.execute(oldtext, newText, {
      combineWords: true,
    });
    expect(result).toBe(delta);
  },
);
