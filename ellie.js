const fs = require('fs');

const { SimpleKVStore, StringTrie } = require('./db.js');
const { Param, Node, SortedList, printNode, printParam, KnowDB } = require('./dbx.js');
const { parseEnglish, isAlpha, isDigit, charType } = require('./grammar.js');

function readLineSync() {
  const buffer = Buffer.alloc(1024);
  let input = '';
  while (true) {
    const bytes = fs.readSync(0, buffer, 0, 1, null); // read one byte
    if (bytes === 0) break; // EOF
    const char = buffer.toString('utf8', 0, 1);
    if (char === '\n') break;
    input += char;
  }
  return input;
}

// Initialize
async function runtime() {
  console.log("Loading database.");
  let kb = new SimpleKVStore("words.jsdb");
  let mem = new KnowDB("know.jsdb");
  await mem.init(); // open the file descriptors
  console.log("KnowDb initialized.");

  let search_results = await mem.findNodes('family');
  if( search_results.length == 0 ) { // import word db
    console.log("Importing words.jsdb to know.jsdb...");
    await mem.importKb(kb);
    console.log("Import completed.");
  } else {
    console.log("Search results: ", search_results);
    for( var o of search_results ) 
      console.log(printNode(await mem.getNode(o)));
  }

  let phrases = new StringTrie();
  let allwords = kb.keys();
  var i;
  for( i=0; i<allwords.length; i++ ) {
    if( typeof allwords[i] == 'number' ) continue;

  	if( allwords[i].indexOf(" ")!=-1 ) {
  		phrases.insert(allwords[i],true);
  	}
  }

  // Main loop
  var i;

  while (true) {
    const line = readLineSync();
    if (line.trim() === '') {
      console.log("Exitting");
      break;
    }
    var results
    let clauses = [];
    results = await parseEnglish(mem, kb, phrases, line);
    for( i=0; i<results.length; i++ ) {
      const n = results[i];
      if( n[2] <= 0 ) break; // too low - not a valid format.
      console.log("Linking result " + i + ".");
      console.log(printNode(n[0]));
      n[1] = await mem.linkNode(n[1]);
      console.log("Link complete, saving.");
      console.log(printNode(n[1]));
      await mem.setNode(n[1]);
      console.log("Save complete.");
      console.log(printNode(n[1]));
    }
    console.log("done\n");
  }

  await mem.close();
  console.log("ready to close");
}

runtime();