const fs = require('fs');
const path = require('path');

function escapeString(str) {
    return str.replaceAll("\\", "\\\\").replaceAll("\n", "\\n");
}

function unescapeString(str) {
    return str.replaceAll("\\n", "\n").replaceAll("\\\\", "\\");
}

class SimpleKVStore {
    constructor(filename) {
        this.filename = filename;
        this.store = new Map(); // In-memory cache
        this.loose = false;

        if (fs.existsSync(filename)) {
            this.load();
        }
    }

	escape(str) {
	    return str.replaceAll("\\", "\\\\").replaceAll("\n", "\\n");
	}

	unescape(str) {
	    return str.replaceAll("\\n", "\n").replaceAll("\\\\", "\\");
	}

    load() {
        const lines = fs.readFileSync(this.filename, 'utf-8').split('\n');
        for (const line of lines) {
            if (!line.trim()) continue;
            try {
                const parsedLine = JSON.parse(this.unescape(line));
                var { key, value, deleted } = parsedLine;
                if( typeof key == 'string' && parseInt(key) == key )
                    key = parseInt(key);

                if (deleted) {
                    this.store.delete(key);
                } else {
                    this.store.set(key, value);
                }
            } catch (err) {
                console.error('Failed to parse line:', line, err);
            }
        }
    }

    get(key) {
        if( typeof key == 'string' && parseInt(key) == key )
            key = parseInt(key);
        return this.store.get(key);
    }

    set(key, value) {
        if( typeof key == 'string' && parseInt(key) == key )
            key = parseInt(key);
        this.store.set(key, value);
        if( this.loose ) return;
        const safeLine = this.escape(JSON.stringify({ key, value }));
        fs.appendFileSync(this.filename, safeLine + '\n');
    }

    delete(key) {
        if( typeof key == 'string' && parseInt(key) == key )
            key = parseInt(key);
        this.store.delete(key);
        if( this.loose ) return;
        const safeLine = this.escape(JSON.stringify({ key, deleted: true }));
        fs.appendFileSync(this.filename, safeLine + '\n');
    }

    loosen() {
        this.loose = true;
    }

    compact() {
        const tmpFilename = this.filename + '.tmp';
        const lines = [];

        for (const [key, value] of this.store.entries()) {
            const safeLine = this.escape(JSON.stringify({ key, value }));
            lines.push(safeLine);
        }
        if( lines.length != 0 )
            lines.push('');

        fs.writeFileSync(tmpFilename, lines.join('\n'));
        fs.renameSync(tmpFilename, this.filename);

        this.loose = false;
    }

    keys() {
    	return [...this.store.keys()];
	}
}

class LargeKVStore {
    constructor(dataFile, cacheTTL = 5 * 60 * 1000) {
        this.indexKV = new SimpleKVStore("i_" +  dataFile);
        this.dataFile = dataFile;
        this.cache = {}; // key -> { value, lastAccess }
        this.cacheTTL = cacheTTL;
        this.eof = 0;
        this.loose = false;

        // Ensure data file exists
        if (!fs.existsSync(dataFile)) {
            fs.writeFileSync(dataFile, '');
        }
        this.dataFh = null;
        this.eof = 0;
        this.cacheInterval = null;
	}

    keys() {
        return this.indexKV.keys();
    }

	async open() {
        // Open sync fd for reads
        this.dataFh = await fs.promises.open(this.dataFile, 'r+');
        // Get current EOF
        this.eof = fs.statSync(this.dataFile).size;
        // Set up background cache eviction
        this.cacheInterval = setInterval(this.evictExpiredCache.bind(this), 60 * 1000);
    }

    evictExpiredCache() {
        const now = Date.now();
        for (const [key, entry] of Object.entries(this.cache)) {
            if (now - entry.lastAccess > this.cacheTTL) {
                delete this.cache[key];
            }
        }
    }

    get(key) {
        if( typeof key == 'string' && parseInt(key) == key )
            key = parseInt(key);

        const cached = this.cache[key];
        if (cached) {
            cached.lastAccess = Date.now();
            return cached.value;
        }

        const meta = this.indexKV.get(key);
        if (!meta) return undefined;

        const buffer = Buffer.alloc(meta[1]);
        fs.readSync(this.dataFh.fd, buffer, 0, meta[1], meta[0]);

        const value = JSON.parse(buffer.toString());
        this.cache[key] = { value, lastAccess: Date.now() };
        return value;
    }

    async set(key, value) {
        if( typeof key == 'string' && parseInt(key) == key )
            key = parseInt(key);

        const data = Buffer.from(JSON.stringify(value));
        const meta = this.indexKV.get(key);

        this.cache[key] = { value, lastAccess: Date.now() };

        if (meta && data.length <= meta[1]) {
            // Overwrite in-place
            this.indexKV.set(key, [ meta[0], data.length ]);
            if( this.loose ) return;
            await this.dataFh.write(data, 0, data.length, meta[0]);
            await this.dataFh.datasync();
        } else {
            // Append at EOF
            const offset = this.eof;
            this.indexKV.set(key, [ offset, data.length ] );
            if( this.loose ) return;
            this.eof += data.length;
            await this.dataFh.write(data, 0, data.length, offset);
            await this.dataFh.datasync();
        }
    }

    delete(key) {
        if( typeof key == 'string' && parseInt(key) == key )
            key = parseInt(key);
        
        this.indexKV.delete(key);
        delete this.cache[key];
    }

    close() {
        clearInterval(this.cacheInterval);
        this.cacheInterval = -1;
        fs.closeSync(this.dataFh.fd);
    }

    loosen() {
        this.indexKV.loosen(); // also loosen the index. it will be compacted with the main datafile.
        clearInterval(this.cacheInterval);
        this.cacheInterval = -1;
        this.loose = true; // data detached from files until compact() is called
    }

    async compact() {
        const tmpDataFile = this.dataFile + '.tmp';
        const tmpFd = fs.openSync(tmpDataFile, 'w+');

        let newIndex = {};
        let newEof = 0;

        for (const key of this.indexKV.keys()) {
            const meta = this.indexKV.get(key);
            let buffer;
            if( key in this.cache ) {
                let src = JSON.stringify(this.cache[key].value);
                buffer = Buffer.from(src);
                meta[1] = src.length;
            } else {
                buffer = Buffer.alloc(meta[1]);
                fs.readSync(this.dataFh.fd, buffer, 0, meta[1], meta[0]);
            }
            fs.writeSync(tmpFd, buffer, 0, meta[1], newEof);
            newIndex[key] = [ 0+newEof, meta[1] ];
            newEof += meta[1];
        }

        fs.closeSync(tmpFd);
        this.dataFh.close();
        fs.renameSync(tmpDataFile, this.dataFile);
        this.dataFh = await fs.promises.open(this.dataFile, 'r+');
        this.eof = newEof;

        this.indexKV.store = new Map();
        for( var key in newIndex ) {
        	this.indexKV.set(key, newIndex[key]);
        }

        this.indexKV.compact();

        if( this.cacheInterval == -1 ) {
            this.cacheInterval = setInterval(this.evictExpiredCache.bind(this), 60 * 1000);
        }

        this.loose = false;
    }
}

class TrieNode {
    constructor() {
        this.children = {};
        this.values = [];
    }
}

class StringTrie {
    constructor() {
        this.root = new TrieNode();
    }

    insert(key, value) {
        let node = this.root;
        for (const char of key) {
            if (!node.children[char]) {
                node.children[char] = new TrieNode();
            }
            node = node.children[char];
        }
        node.values.push(value); // Store the object/value
    }

    _collectAll(node, results) {
        results.push(...node.values);
        for (const child in node.children) {
            this._collectAll(node.children[child], results);
        }
    }

    has(prefix) {
        let node = this.root;
        for (const char of prefix) {
            if (!node.children[char]) return false;
            node = node.children[char];
        }
        return true;
    }

    scan(prefix) {
        let node = this.root;
        for (const char of prefix) {
            if (!node.children[char]) return [];
            node = node.children[char];
        }
        const results = [];
        this._collectAll(node, results);
        return results;
    }
}

module.exports = { LargeKVStore, SimpleKVStore, StringTrie };
