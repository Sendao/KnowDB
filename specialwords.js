const { SimpleKVStore, LargeKVStore } = require('./db.js');

let kb = new SimpleKVStore("words.jsdb");

// unsatisfactorily categorized: if
// unknown: than, as

let cons = [
  'but', 'and', 'when', 'which', 'while', 'where', 'whereas', 'although', 'yet', 'or', 'nor', 'for', 'so',
  'once', 'whenever', 'as soon as',
  'because', 'as', 'now that', 'inasmuch as',
  'unless', 'provided', 'provided that', 'in case', 'in case', 'as long as',
  'although', 'though', 'even though', 'whereas',
  'so that', 'in order that',
  'however', 'therefore', 'therefor', 'nevertheless', 'moreover', 'meanwhile', 'consequently', 'otherwise', 'instead',
  'lest',
];
for( i=0; i<cons.length; i++ ) {
  let values = kb.get(cons[i]);
  if( typeof values == 'undefined' ) values = [[],'','',''];
  let value = values[0];
  if( typeof value == 'undefined' ) {
    value = ['c'];
  } else if( typeof value == 'string' ) {
    if( value != 'c' )
      value = [value, 'c'];
  } else if( value.indexOf("c") == -1 ) {
    value.push('c');
  }
  kb.set(cons[i],values);
}

let vpos = [ // vpos applies to verbs and nouns [against flying+against the wall]
  'into', 'between', 'to', 'from', 'off',
  'over', 'under',
  'through', 'across', 'along', 'about', 'concerning', 'regarding', 'despite',
  'without', 'against',
  'for', 'with', 'like', 'while', 'whilst', 'before', 'after', 'since', 'because of',
  'as', 'so', 'by', 'of', 'in',
  'not', 'no',

];
let npos = [ // npos only applies to nouns [among friends/not among walking]
  'at', 'on', 'onto', 'above', 'below', 'among', 'next to', 'near to', 'within', 'beside', 'during', 'until',
  'near', 'beyond', 'beneath'
]; // on the desk
let modals = [ // only apply before verbs, have special meaning
  "can",
  "could",
  "may",
  "might",
  "must",
  "shall",
  "should",
  "will",
  "would",
  "don't",
  "didn't",
  "doesn't",
  "can't",
  "won't",
  "shouldn't",
  "couldn't",
  "wouldn't",
  "mightn't",
  "mustn't",
  "shan't",
  "do",
  "does",
  "did",
  "ought to"
];
let smodals = [ // only before nouns
  "he'll",
  "she'll",
  "i'll",
  "you'll",
  "we'll",
  "they'll",
  "he'd",
  "she'd",
  "i'd",
  "you'd",
  "we'd",
  "they'd"
]; // there is no try

var i;
for( i=0; i<vpos.length; i++ ) {
  let values = kb.get(vpos[i]);
  if( typeof values == 'undefined' ) values = [[],'','',''];
  let value = values[0];
  if( typeof value == 'undefined' ) {
    value = ['vprep'];
  } else if( typeof value == 'string' ) {
    if( value != 'vprep' )
      value = [value, 'vprep'];
  } else if( value.indexOf('vprep') == -1 )  {
    value.push('vprep');
  }
  kb.set(vpos[i],values);
}

for( i=0; i<npos.length; i++ ) {
  let values = kb.get(npos[i]);
  if( typeof values == 'undefined' ) values = [[],'','',''];
  let value = values[0];
  if( typeof value == 'undefined' ) {
    value = ['nprep'];
  } else if( typeof value == 'string' ) {
    if( value != 'nprep' )
      value = [value, 'nprep'];
  } else if( value.indexOf('nprep') == -1 )  {
    value.push('nprep');
  }
  kb.set(npos[i],values);
}


for( i=0; i<modals.length; i++ ) {
  let values = kb.get(modals[i]);
  if( typeof values == 'undefined' ) values = [[],'','',''];
  let value = values[0];
  if( typeof value == 'undefined' ) {
    value = ['modal'];
  } else if( typeof value == 'string' ) {
    if( value != 'modal' )
      value = [value, 'modal'];
  } else if( value.indexOf('modal') == -1 ) {
    value.push('modal');
  }
  kb.set(modals[i],values);
}


for( i=0; i<smodals.length; i++ ) {
  let values = kb.get(smodals[i]);
  if( typeof values == 'undefined' ) values = [[],'','',''];
  let value = values[0];
  if( typeof value == 'undefined' ) {
    value = ['smodal'];
  } else if( typeof value == 'string' ) {
    if( value != 'smodal' )
      value = [value, 'smodal'];
  } else if( value.indexOf('smodal') == -1 ) {
    value.push('smodal');
  }
  kb.set(smodals[i],values);
}


let dets = [
  // articles
  'the', 'a', 'an',
  // demonstratives
  'this', 'that', 'these', 'those',
  // posesessives
  'my', 'your', 'his', 'her', 'its', 'our', 'their',
  // quantifiers
  'some', 'many', 'much', 'few', 'several', 'all', 'any', 'no', 'each', 'every', 'either', 'neither',
  // numbers
  'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
  'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety',
  'hundred', 'thousand', 'million', 'billion', 'trillion',
  // interrogatives -> leave these to grammar formatting
  //'which', 'what', 'whose', 'how many', 'how much', 'how few', 'how little'
];
for( i=0; i<dets.length; i++ ) {
  let values = kb.get(dets[i]);
  if( typeof values == 'undefined' ) values = [[],'','',''];
  let value = values[0];
  if( typeof value == 'undefined' ) {
    value = ['det'];
  } else if( typeof value == 'string' ) {
    if( value == 'c' )
      value = ['det'];
    else if( value != 'det' )
      value = [value, 'det'];
  } else {
    if( value.indexOf("c") != -1 ) {
      value.splice(value.indexOf("c"), 1);
    }
    if( value.indexOf("det") == -1 )
      value.push('det');
  }
  kb.set(dets[i],values);
}

let ints = [
  'many', 'much', 'few', 'little'
];
for( i=0; i<ints.length; i++ ) {
  let values = kb.get(ints[i]);
  if( typeof values == 'undefined' ) values = [[],'','',''];
  let value = values[0];
  if( typeof value == 'undefined' ) {
    value = ['i'];
  } else if( typeof value == 'string' ) {
    if( value != 'i' )
      value = [value, 'i'];
  } else if( value.indexOf('i') == -1 ) {
    value.push('i');
  }
  kb.set(ints[i],values);
}
let adjs = [
  'too'
];
for( i=0; i<adjs.length; i++ ) {
  let values = kb.get(adjs[i]);
  if( typeof values == 'undefined' ) values = [[],'','',''];
  let value = values[0];
  if( typeof value == 'undefined' ) {
    value = ['a'];
  } else if( typeof value == 'string' ) {
    if( value != 'a' )
      value = [value, 'a'];
  } else if( value.indexOf("a") == -1 ) {
    value.push('a');
  }
  kb.set(adjs[i],values);
}

let qries = [
  'who', 'what', 'where', 'when', 'why', 'how',
];
for( i=0; i<qries.length; i++ ) {
  let values = kb.get(qries[i]);
  if( typeof values == 'undefined' ) values = [[],'','',''];
  let value = values[0];
  if( typeof value == 'undefined' ) {
    value = ['q'];
  } else if( typeof value == 'string' ) {
    if( value != 'q' )
      value = [value, 'q'];
  } else if( value.indexOf('q') == -1 ) {
    value.push('q');
  }
  kb.set(qries[i],values);
}

let weirdos = [ 'help', 'make', 'have', 'let' ];
for( i=0; i<weirdos.length; i++ ) {
  let values = kb.get(weirdos[i]);
  if( typeof values == 'undefined' ) values = [[],'','',''];
  let value = values[0];
  if( typeof value == 'undefined' ) {
    value = ['cv'];
  } else if( typeof value == 'string' ) {
    if( value != 'cv' )
      value = [value, 'cv'];
  } else if( value.indexOf('cv') == -1 ) {
    value.push('cv');
  }
  kb.set(weirdos[i],values);
}


// remove excess definitions from common words:

let fullupdates = {
  'is': ['v'], 'or': ['c'], 'a': ['det'], 'the': ['det'], 'its': ['det'], 'how': ['h','q'], 'what': ['q'], 'which': ['q'], 'who': ['q'], 'when': ['q'], 'where': ['q'],
  'of': ['vprep'], 'on': ['nprep'], 'in': ['nprep'],
  'you': ['n'],
  'over': ['nprep', 'r', 'n'],
  'under': ['nprep', 'r', 'n'],
  'thinking': ['n','v'],
  'if': ['r'],
  'lazy': ['a']
};

for( var key in fullupdates ) {
  let cur = kb.get(key);
  cur[0] = fullupdates[key];
  kb.set(key,cur);
}

console.log("Completed.");

