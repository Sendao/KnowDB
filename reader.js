// view-assertions.js

const fs = require('fs');
const readline = require('readline');

const FILE_NAME = 'assertions.csv';
const MAX_LINES = 10; // adjust this to control how many lines to show

const stream = fs.createReadStream(FILE_NAME);

const rl = readline.createInterface({
  input: stream,
  crlfDelay: Infinity
});

let lineCount = 0;

rl.on('line', (line) => {
  if (lineCount < MAX_LINES) {
    console.log(line);
    lineCount++;
  } else {
    rl.close(); // stop reading after max lines
  }
});

rl.on('close', () => {
  if (lineCount === 0) {
    console.log(`No lines read from ${FILE_NAME}.`);
  }
});
