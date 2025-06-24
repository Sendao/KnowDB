const fs = require('fs');
const { LargeKVStore, SimpleKVStore } = require('./db.js'); // adjust the path if needed

const args = process.argv.slice(2);
if (args.length < 2) {
    console.error("Usage: node cli.js [simple|large] [filename]");
    process.exit(1);
}

const [mode, filename] = args;

let store;
if (mode === 'simple') {
    store = new SimpleKVStore(filename);
} else if (mode === 'large') {
    store = new LargeKVStore(filename);
} else {
    console.error("Unknown mode. Use 'simple' or 'large'.");
    process.exit(1);
}

const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
});

console.log("Enter keys to get values, or key=value to set. Empty line to quit.");

rl.on('line', async function(line) {
    line = line.trim();
    if (line === '') {
        if (store.close) await store.close();
        rl.close();
        return;
    }

    const eqIndex = line.indexOf('=');
    if (eqIndex !== -1) {
        const key = line.slice(0, eqIndex).trim();
        const value = line.slice(eqIndex + 1).trim();
        if (store.set.length === 2) {
            store.set(key, value);
        } else {
            await store.set(key, value);
        }
        console.log(`OK: ${key} = ${value}`);
    } else {
        const value = store.get(line);
        if (value === undefined) {
            console.log(`(undefined)`);
        } else {
            console.log(value);
        }
    }
});
