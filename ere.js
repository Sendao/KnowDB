const fs = require('fs');

const { parseEnglish, printNode } = require('./grammar.js');
const { SimpleKVStore, LargeKVStore, StringTrie } = require('./db.js');

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
let kb = new SimpleKVStore("words.jsdb");

let phrases = new StringTrie();
let allwords = kb.keys();
var i;
for( i=0; i<allwords.length; i++ ) {
	if( allwords[i].indexOf(" ")!=-1 ) {
		phrases.insert(allwords[i],true);
	}
}

// Main loop
while (true) {
  const line = readLineSync();
  if (line.trim() === '') break;
  let result = parseEnglish(kb, phrases, line);
  console.log(result);
  var i;
  for(i=0;i<result.length && i < 3;i++){
  	console.log(i+":");
  	printNode(result[i]);
  	console.log("\n\n");
  }
}
