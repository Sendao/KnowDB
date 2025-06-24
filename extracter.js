const { SimpleKVStore } = require('./db.js');
const fs = require('fs');

let doNothing = true;
let sentences = [];
let results = {};
let forms = {};
let text = "";
let reserved = ['constructor'];
function isAscii(str) {
    // Check if the string contains only ASCII characters
    return /^[\x00-\x7F]*$/.test(str);
}
function getEdgeWord(x) {
    if( x[0] == '' ) x.shift();
    if( x.length < 3 ) return false;
    if( x[0] != 'c' || x[1] != 'en' ) return false;
    let word = x[2].replaceAll('_', ' ');
    if( reserved.indexOf(word) >= 0 ) {
      word = "_" + word;
    }
    return word;
}
function processEdge(x) {
    if( x[0] == '' ) x.shift();
    if( x.length < 4 ) return;
    if( x[0] != 'c' || x[1] != 'en' ) return;
    let word = x[2].replaceAll('_', ' ');
    if( reserved.indexOf(word) >= 0 ) {
      word = "_" + word;
    }
    let part = x[3];
    if( !(word in results) ) results[word]=[[],'','',''];
    try {
        if( results[word][0].indexOf(part) < 0 ) results[word][0].push(part);
    } catch( er ) {
        console.log(word,typeof results[word], JSON.stringify(results[word]));
    }
}
function loadStream(url, cb) {
    const readline = require('readline');

    const fileStream = fs.createReadStream(url);

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let lineno = 0, resultno = 0, prevline="";
    let millions = 0, resultcount = 0, hundreds = 0;
    let badlines = 0, found = new Set();
    var edgetypes = new Set();
    let edgereports = new Map();
    let formers = {
        'IsA': '%1 is %2',
        'Syn': '%1 is %2',
        'Ant': '%1 is the opposite of %2',
        'Antonym': '%1 is the opposite of %2',
        'LocatedNear': 'the %1 is like the %2',
        'PartOf': 'the %1 is part of the %2',
        'MannerOf': 'the %1 is a kind of %2',
        'RelatedTo': 'the %1 is related to the %2',
        'SimilarTo': 'a %1 is like a %2',
        'SymbolOf': 'the %1 means %2'
    };

    rl.on('line', (line) => {
        if( !isAscii(line) ) {
            badlines++;
            return;
        }
        const fields = line.split(/\s+/); // Split by spaces (multiple spaces included)
        lineno++;
        if( lineno == 1000000 ) {
            console.log("Read 1000000 lines (" + Object.keys(results).length + " results)");
            lineno=0;
            millions++;
        }

        const s = fields[2].split("/");
        if( s.length < 3 || s[2] != 'en' ) return;

        const r0 = fields[1].split('/');
        const w1 = fields[2].split('/');
        const w2 = fields[3].split('/');

        const rela = r0[2];
        if( rela in formers ) {
          const word1 = getEdgeWord(w1);
          const word2 = getEdgeWord(w2);
          if( word1 && word2 ) {
          //  console.log("former " + rela + ":" + word1 + "," + word2);
            sentences.push( formers[rela].replaceAll('%1',word1).replaceAll('%2',word2) );
          }
        } else if( rela == 'FormOf' ) {
          const word1 = getEdgeWord(w1);
          const word2 = getEdgeWord(w2);
          if( word1 && word2 ) {
            if( !(word1 in forms) ) forms[word1] = [];
            if( !(word2 in forms) ) forms[word2] = [];
            forms[word1].push(word2);
            forms[word2].push(word1);
          }
        } else if( !(edgetypes.has(rela)) ) { // report new edge type:
          edgetypes.add(rela);
          console.log(rela, fields[2], fields[3]);
        }

        processEdge(w1);
        processEdge(w2);
    });

    rl.on('close', () => {
        console.log('File processed successfully');
        cb(results);
    });
}

function keyVowels(word) // it's the last vowel (consider 'begin/began') unless it's e (break/broke)
{
  let capture = '', vowels = ['a','e','i','o','u','y'];
  let backup = false;
  for( i=word.length-1; i>=0; i-- ) {
    if( vowels.indexOf(word[i]) != -1 ) { // is a vowel
      capture += word[i];
    } else {
      if( capture == 'e' ) {
        backup = true;
        capture = '';
      }
      if( capture != '' ) break;
    }
  }
  if( capture == '' && backup ) capture = 'e';
  return capture;
}



loadStream('assertions.csv', async function(results){

  // write sentences to a file:
  await fs.writeFileSync('./sentences.txt', sentences.join("\n"));

  if( doNothing ) return;

  let storage = new SimpleKVStore('words.jsdb');
  var cycler  = 0;
  function baseWord(key) { // finds the shortest variation of a word
    let minlen = key.length, minv = key;
    if( !(key in forms) ) {
      return key;
    }
    for( var w of forms[key] ) {
      if( w.length > 0 && w.length < minlen ) {
        minlen = w.length;
        minv = w;
      }
    }
    return minv;
  }
  // TODO: handle sing-sang-sung by setting root word, tense, and plurality properly based on vowel changes
  

  let review_words = [];//'the quick brown fox jumped over lazy dog'.split(' ');
  console.log("Forms has " + Object.keys(forms).length + " keys.");

  storage.loosen();

  for( var key in results ) {
    let base = results[key][1] = baseWord(key);
    let main = key;
    let myvowel = keyVowels(main);
    let basevowel = keyVowels(base);
    let isverb = results[key][0].indexOf('v') >= 0;
    let isnoun = results[key][0].indexOf('n') >= 0;

    if( main.endsWith('s') && !base.endsWith('s') ) {
      results[key][2] = 's'; // plural
      if( main.endsWith("ies") )
        main = main.substring(0,main.length-3);
      else if( main.endsWith("es") )
        main = main.substring(0,main.length-2);
      else
        main = main.substring(0,main.length-1);
    } else if( base.endsWith('s') && !main.endsWith('s') ) {
      results[key][2] = '1'; // singular plural
    } else {
      if( !base.endsWith('ren') && main.endsWith('ren') ) { // children
        results[key][2] = 's';
      } else {
        if( ( basevowel == "ou" && myvowel == "i" ) || ( basevowel == 'oo' && myvowel == 'ee' ) ) { // mouse/mice, goose/geese
          results[key][2] = 's';
        }
      }
    }
    //! flip verb plurality? 'bob sees' vs 'people see', the verb+s is plural, the 
    if( results[key][2] == '' ) results[key][2] = '0';

    if( isverb && ( ( main[main.length-1] == 't' || main.endsWith("ed") ) && ( base[base.length-1] != 't' && !base.endsWith('ed') ) ) ) {
      results[key][3] = 'p'; // past
    } else if( isverb && main.endsWith("ing") && !base.endsWith('ing') ) {
      results[key][3] = 'c'; // continuous
    } else if( isverb && main.endsWith('en') && !base.endsWith('en') ) {
      results[key][3] = 'P'; // past perfect
    } else if( isverb && main.endsWith('un') && !base.endsWith('un') ) { // begun
      results[key][3] = 'pp';
    } else if( isverb && main.endsWith('an') && !base.endsWith('an') ) { // ran
      results[key][3] = 'p';
    } else {
      results[key][3] = '0'; // present or general purpose form
    }
    if( review_words.indexOf(key) != -1 ) {
      console.log(key, results[key]);
      console.log(forms[key]);
    }
    await storage.set(key, results[key]);

    cycler = (cycler+1)%10000;
    if( cycler == 9999 ) {
      console.log("10000 words added");
    }
  }
  console.log("Writing storage.");
  await storage.compact();
  console.log("Done"); // final format for words.jsdb: word = [parts of speech],[base word],[tense and plurality flags]
});
