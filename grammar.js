const { Node, Param, nodeCode, printNode, printParam } = require('./dbx.js');
const { processGrammarNodes } = require('./encoder.js');

// Optimized English grammar parser with memoization, structural sharing, and early pruning

function makeNode(w, t, q, memo) {
    const key = `${w}:${t}:${q.map(([r, n]) => `${r},${nodeCode(n)}`).join(';')}`;
    if (memo.has(key)) return memo.get(key);
    const node = { w, t: [t], q };
    memo.set(key, node);
    //console.log("New node", printNode(node));
    return node;
}

function cloneNode(n) {
    const cl = { w: ''+n.w, t: [n.t.slice()], q: n.q.map(([rel, node]) => [''+rel, cloneNode(node)]) };
    return cl;
}

function cloneNodes(nodes) {
    return nodes.map(cloneNode);
}

function charType(c) {
    const code = c.charCodeAt(0);
    if( (code >= 65 && code <= 90) || (code >= 97 && code <= 122) ) return 0;
    if( (code >= 48 && code <= 57) ) return 1;
    if( c==' ' || c=='\r' || c=='\n' || c=='\t' ) return 2;
    return 3;
}
function isAlpha(c) {
  const code = c.charCodeAt(0);
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}
function isAlphastring(s) {
    for( var c of s ) {
        if( !isAlpha(c) ) return false;
    }
    return true;
}
function isDigit(c) {
  const code = c.charCodeAt(0);
  return code >= 48 && code <= 57;
}

async function parseEnglish(mem, kb, phrase, sentence) {
    const startTime = Date.now();
    const timeLimit = 4000; // milliseconds

    let words = sentence.replace(/\r|\n/g, ' ').split(" ");
    const memo = new Map();
    const resultSet = new Set();
    let results = [];
    let maxScore = -Infinity;
    let currentResult = false;

    let i,n,k,y,z;

//! todo: handle '-ly' adverbs separately
    /*
    it might make sense to add 'v', 'n2' => 'v' as any time a verb can be used, you can use a verb with an object
    */
    const rules = [
        [['a', 'n'], 'n', 1.0], // blue frog
        
        [['det', 'n'], 'n2', 4.0], // the mouse
        [['det', 'v'], 'n2', 0.1], // the kick

        [['nprep', 'n2'], 'nway', 2.0], // over the frog
        [['nprep'], 'nway', 0.2], // beyond

        [['vprep', 'n2'], 'vway', 1.8], // of the frog
        [['vprep', 'v'], 'vway', 2.0], // by kissing / of flying
        [['vprep'], 'vway', 0.2], // beyond
        
        [['n'], 'n2', 0], // note this is 0, it's not often that nouns do not need determinants, but in the case of proper nouns, they don't

        [['h','r'], 'q', 0.5], // how fast
        [['h','a'], 'q', 0.5], // how long
        [['h','i'], 'q', 0.5], // how many

        [['q','n'], 'n2', 1.0], // which frog
        
        [['modal', 'v'], 'v', 1.3], // can kick
        [['modal', 'n', 'v'], 'v', 2.2],
        [['smodal', 'v'], 'v', 1.0], // he'll fly

        [['v', 'r'], 'v', 0.1], // kick quickly
        [['r', 'v'], 'v', 1.0], // fast kick

        [['v', 'n2'], 'v', 1.5], // kick the mouse
        [['cv', 'n2', 'v'], 'v', 1.5],
        
        [['v', 'vway'], 'v', 0.8], // kick over the fence
        [['v', 'nway'], 'v', 0.8], // kick over the fence
        [['n2', 'nway'], 'n2', 0.8], // the frog above the fence
        [['n2', 'vway'], 'n2', 0.8], // the frog above the fence

        [['v', 'c', 'v'], 'v', 0.7], // kick and scream
        [['n2', 'c', 'n2'], 'n2', 0.5], // kicking and screaming

        [['c', 'c'], 'c', 0.0], // and so, and but, etc

        [[0, 'n2', 'v', 0], 'pred', 1.0], // bob fucks


        [[0, 'v', 0], 'imp', 1.0], // fly

        [[0, 'modal', 'n2', 'v', 0], 'qry', 2.5], // can the mouse fly
        [[0, 'h', 'modal', 'n2', 'v', 0], 'qry', 2.0], // how can the mouse fly
        [[0, 'q', 'v', 0], 'qry', 1.0], // who ran
        [[0, 'q', 'n2', 'v', 0], 'qry', 2.0], // which mouse flew

        [[0, 'pred', 'c', 'pred', 0], 'pred', 0.8], // bob fucks alice and bob does not fuck cindy
        [[0, 'imp', 'c', 'imp', 0], 'imp', 0.8], // fly a kite and lose it
        [[0, 'qry', 'c', 'qry', 0], 'qry', 1.8]
    ];
    let rulelengths = new Array(rules.length).fill(0);
    for( i=0; i<rules.length; i++ ) {
        for( n=0; n<rules[i][0].length; n++ ) {
            if( rules[i][0][n] === 0 ) continue;
            rulelengths[i]++;
        }
    }

    // Tokenization and initial node generation
    const tokens = [];
    for( i=0; i<words.length; i++ ) {
        let w = words[i];
        let wb = '', lastType=null;
        for( n=0; n<w.length; n++ ) {
            thisType=charType(w[n]);
            if( lastType!=null && lastType!=thisType ) {
                if( wb != '' ) {
                    tokens.push(wb);
                    wb = '';
                }
            }
            wb += w[n];
            lastType=thisType;
        }
        if( wb != '' )
            tokens.push(wb);
    }
    words = tokens;
    const inputs = [];
    for (i = 0; i < words.length; i++) {
        let w = words[i];
        if ([',', ';', 'and', 'but', ':'].includes(w)) {
            inputs.push({ w, t: ['c'], q: [] });
            continue;
        }

        let found = false;
        for (let span = words.length - i; span > 0; span--) {
            const candidate = words.slice(i, i + span).join(' ');
            if (phrase.has(candidate)) {
                const deets = kb.get(candidate)[0];
                const types = Array.isArray(deets) ? deets : [deets];
                inputs.push({ w: candidate, t: types, q: [] });
                i += span - 1;
                found = true;
                break;
            }
        }

        if (!found) {
            let t = kb.get(w);
            if (typeof t === 'undefined') {
                console.log("Not found word:", w);
                continue;
            }
            t = t[0];
            const types = Array.isArray(t) ? t : [t];
            inputs.push({ w, t: types, q: [] });
        }
    }

    const queue = [[0, inputs]];

    while (queue.length > 0) {
        if (Date.now() - startTime > timeLimit) break;

        queue.sort((a, b) => b[0] - a[0]);
        const [score, seq] = queue.shift();

        for( k=0; k<rules.length; k++ ) {
            const [pattern, resultTag, weight] = rules[k];
            for (i = 0; i <= seq.length - rulelengths[k]; i++) {
                const children = [];
                let matched = true;
                z=0;
                for( n=0; n+z<pattern.length; n++ ) {
                	if( pattern[n+z] === 0 && n+z == 0 ) {
                		if( i+n-1 >= 0 && !seq[i+n-1].t.includes('c') ) {
                			matched=false;
                			break;
                		}
                        z++;
                        n--;
                	} else if( pattern[n+z] === 0 ) {
                		if( i+n < seq.length && !seq[i+n].t.includes('c') ) {
                			matched=false;
                			break;
                		}
                        z++;
                        n--;
                	} else if( seq[i+n].t.includes(pattern[n+z]) ) {
                		children.push( [pattern[n+z], seq[i+n]] );
                    } else {
                        matched=false;
                        break;
                	}
                }
                if (!matched) continue;

                const newSeq = seq.slice(0, i);
                const parent = makeNode('', resultTag, children, memo);
                newSeq.push(parent);
                newSeq.push(...seq.slice(i + children.length));

                if (newSeq.length === 1) {
                    const code = nodeCode(newSeq[0]);
                    if (!resultSet.has(code)) {
                        results.push([score + weight, newSeq[0]]);
                        if (score + weight > maxScore) {
                            maxScore = score + weight;
                            currentResult = newSeq[0];
                        }
                        resultSet.add(code);
                    }
                } else {
                    queue.push([score + weight, newSeq]);
                }
            }
        }
    }

    results.sort((a, b) => b[0] - a[0]);
    if( results.length == 0 ) {
        console.log("No results on parse", inputs);
        return [];
    }

    console.log("Got results(" + results.length + ")");
    
    let valid_types = [ 'pred', 'qry', 'imp' ];
    let convert_types = { 'n2': 'n', 'nway': 'way', 'vway': 'way', 'nprep': 'prep', 'vprep': 'prep' };
    var final = [], nonpreds = [];
    for (i = 0; final.length < 5; i++ ) {
    	if( i >= results.length ) {
    		if( nonpreds !== null && nonpreds.length > 0 ) {
    			results = results.concat(nonpreds);
    			nonpreds = null;
                i--;
    			continue;
    		} else break;
    	}
    	if( valid_types.indexOf(results[i][1].t[0]) == -1 && nonpreds !== null ) {
    		nonpreds.push(results[i]);
    		results.splice(i,1);
    		--i;
    		continue;
    	}
    	queue.push(results[i][1].q);
    	while( queue.length > 0 ) {
    		let c = queue.shift();
    		for (let j=0; j<c.length; j++ ) {
    			if( Array.isArray(c[j]) && c[j].length == 2 ) {
                    if( c[j][0] == 'q' ) { // event is interrogative
                        results[i][1].t = ['qry'];
                    }
                    if( c[j][0] in convert_types ) {
                        c[j][0] = convert_types[ c[j][0] ];
                    }
                    for( let k=0; k<c[j][1].t.length; k++ ) {
                        if( c[j][1].t[k] in convert_types ) {
                            c[j][1].t[k] = convert_types[ c[j][1].t[k] ];
                        }
                    }
    				queue.push( c[j][1].q );
    			} else {
                    console.error(j, results[i], c[j]);
                    throw "wtf";
    				if( !Array.isArray(c[j].t) ) {
    					console.log(j,c[j]);
    					continue;
    				}
                    for( let k=0; k<c[j].t.length; k++ ) {
                        if( c[j].t[k] in convert_types ) {
                            c[j].t[k] = convert_types[ c[j].t[k] ];
                        }
                    }
    				queue.push( c[j].q );
    			}
    		}
    	}
    	const copy = cloneNode(results[i][1]);
        const proc = await processGrammarNodes(mem, kb, copy);
        const fullness = await rateNodeFullness(mem, proc);
        if( fullness < 0 ) {
            //console.log("Invalid interpretation: ", printNode(results[i][1]));
            //console.log("Partial parse: ", printNode(proc));
            continue;
        }

    	final.push( [cloneNode(results[i][1]), proc, fullness] ); // remove pointers linked between results, then process into knowdb format
    }
    final.sort((a,b) => b[2] - a[2]);
    console.log("Final results [" + final.length + "]");
    return final;
}

async function rateNodeFullness(mem, n)
{
    let scores = [];
    let q = [n];
    console.log("rateFullness()");
    while( q.length > 0 ) {
        n = q.shift();

        if( typeof n == 'number' ) // empty node
            continue;
        if( ( typeof n != 'object' && typeof n != 'array' ) || typeof n.title != 'string' ) { // node structure is not pristine
            //console.log("Incomplete",printNode(n));
            return -1;
        }

        if( n.params.length <= 0 ) continue;
        let ns = new Set();
        var keyval;
        for( i=0; i<n.params.length; i++ ) {
            p = n.params[i];
            if( typeof p == 'number' ) {
                continue;
                //n.params[i] = p = await mem.getParam(p);
            }
            keyval = await mem.resolveNode(p.key);
            if( ns.has(keyval) ) {
                //console.log("double-key",printNode(n));
                return -1;
            }
            ns.add(keyval);
            q.push(p.key, p.value);
        }
        scores.push( n.params.length );
    }
    let avg = 0;
    for( i=0; i<scores.length; i++ ) {
        avg += scores[i];
    }
    avg /= scores.length;
    return avg;

}

module.exports = { parseEnglish, printNode, printParam, isAlpha, isDigit, charType };
