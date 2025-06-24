let { Node } = require('./dbx.js');

// possible additions:
// node(!x) to mean 'node without x child'
const encoderRules = [
'n: => title=n,type=noun,noun=n',
'n:*noun => noun()',
'n:q,*noun => noun(q=true)',
'n:det,*noun(!det) => noun(det=true)',
'n:det,*verb => title=verb,type=noun,noun=verb,det=true',
'n:a,*noun(!det) => noun(a=true)',

'n:*noun,way(prep=key..noun=value) => noun(key=value)',
'n:*noun,way(prep=key..verb=value) => noun(key=value)',
'n:*noun,way(prep=key) => noun(key=true)',

'v: => title=v,type=verb,verb=v',
'v:*verb => verb()',
'v:cv,*noun,*verb => title=verb,type=+verb,+verb=verb,subject=noun,helper=cv',
'v:smodal,*verb => verb(subject=smodal..smodal=true)',
'v:modal,*verb => verb(modal=true)',
'v:modal,*noun,*verb(!subject) => verb(modal=true..subject=noun)',
'v:r,*verb => verb(r=true)',
'v:*verb(!object),*noun => verb(object=noun)',

'v:*verb,way(prep=key..noun=value) => verb(key=value)',
'v:*verb,way(prep=key..verb=value) => verb(key=value)',
'v:*verb,way(prep=key) => verb(key=true)',

'qry:q,*verb(subject) => title=q,type=query,question=q,action=verb,+subject=subject', // who ran
'qry:q,*verb => title=q,type=query,question=q,action=verb', // who ran
'qry:q,*noun,*verb(subject) => title=q,type=query,question=q,action=verb,+subject=subject,object=noun', // which frog can you see
'qry:q,*noun,*verb => title=q,type=query,question=q,action=verb,subject=noun', // which frog flew
'qry:modal,*noun,*verb => title=modal,type=query,question=modal,action=verb,subject=noun', // can you fly

'imp:*verb(!subject) => title=command,type=command,action=verb',

'pred:*noun,*verb(!subject) => title=event,type=event,action=verb,subject=noun',
'pred:*noun=n1,*verb(!subject,!object),*noun=n2 => title=event,type=event,action=verb,subject=n1,object=n2',

];
const encoderRules2 = [
    'noun=noun1,noun=noun2 => noun2(noun1=true,&noun1)' // copy all parameters from noun1 to noun2
];
const grammar_to_knowdb = [];

function processEncoderRules(er)
{
    var i, n, k;
    for( i=0; i<encoderRules.length; i++ ) {
        let params = encoderRules[i].split("=>");
        const handleParts = params[0].trim().split(":"), commands = params[1].trim().split(",");
        const rule = { main: handleParts[0], reqs: [], commands: [] };
        const p0 = handleParts[1].split(",");
        var type, baserule;
        for( n=0; n<p0.length; n++ ) {
            if( p0[n] == '' ) continue;
            const req = {};
            if( p0[n][0] == '*' ) {
                req.type = 'node';
                req.main = p0[n].substring(1);
            } else {
                req.type = 'gram';
                req.main = p0[n];
            }
            if( req.main.indexOf("(") != -1 ) {
                const m0 = req.main.split("(");
                req.main = m0[0];
                const m1 = m0[1].substring( 0, m0[1].length-1 ).split("..");
                req.children = [];
                for( k=0; k<m1.length; k++ ) {
                    if( m1[k].indexOf("=") != -1 ) {
                        const m2 = m1[k].split("=");
                        req.children.push({main:m2[0],alias:m2[1]});
                    } else {
                        req.children.push({main:m1[k]});
                    }
                }
            }
            if( req.main.indexOf("=") != -1 ) {
                const m3 = req.main.split("=");
                req.main = m3[0];
                req.alias = m3[1];
            }
            rule.reqs.push(req);
        }
        for( n=0; n<commands.length; n++ ) {
            const cmd = {};
            if( commands[n].indexOf("(") != -1 ) {
                const p1 = commands[n].split("(");
                cmd.target = p1[0];
                const buf = p1[1].substring(0,p1[1].length-1);
                const p2 = buf == '' ? [] : buf.split("..");
                cmd.params = [];
                for( k=0; k<p2.length; k++ ) {
                    cmd.params.push( p2[k].split("=") );
                }
            } else {
                const p3 = commands[n].split("=");
                cmd.key = p3[0];
                cmd.value = p3[1];
            }
            rule.commands.push(cmd);
        }
        grammar_to_knowdb.push(rule);
    }
}

async function processGrammarNodes(mem, kb, gr)
{
    const mainlist = [ [ typeof gr.t == 'string' ? gr.t : gr.t[0], gr ] ];
    const q = [mainlist];
    var i, n, k, y, z;
    let vist = new Set();

    if( grammar_to_knowdb.length == 0 ) {
        processEncoderRules();
        /*
        for( var zz in grammar_to_knowdb ) {
            console.log(grammar_to_knowdb[zz]);
        }
        */
    }

    while( q.length > 0 ) {
        const grl = q.shift();
        
        if( !vist.has(grl) ) {
            vist.add(grl);
            q.unshift(grl);
            for( z=0; z<grl.length; z++ ) {
                if( grl[z][1].q && typeof grl[z][1].q == 'object' ) {
                    q.unshift( grl[z][1].q );
                }
            }
            continue;
        }

        for( z=0; z<grl.length; z++ ) {
            gr = grl[z][1];
            if( typeof gr.title != 'undefined' ) continue;

            for( i=0; i<grammar_to_knowdb.length; i++ ) {
                const r = grammar_to_knowdb[i];
                if( r.main != grl[z][0] ) continue; // gr.t && ( typeof gr.t == 'string' || gr.t.indexOf(r.main) == -1 ) ) continue;
                if( r.reqs.length != gr.q.length ) continue; // no match
                //console.log("consider " + r.main + ": ", r.reqs, "\n", gr);
                let match = true;
                const pieces = {};
                pieces[ r.main ] = gr;
                for( n=0; n<r.reqs.length; n++ ) {
                    const req = r.reqs[n];
                    if( gr.q[n][0] != req.main ) {
                        match=false;
                        break;
                    }
                    const child = gr.q[n][1];
                    if( req.type == 'gram' ) {
                        if( req.children ) {
                            if( req.children.length >= 1 && req.children[0].main[0] == '!' ) {
                                for( y=0; y<req.children.length; y++ ) {
                                    let anti = req.children[y].main.substring(1);
                                    for( k=0; k<child.q.length; k++ ) {
                                        if( child.q[k][0] == anti ) {
                                            match=false;
                                            break;
                                        }
                                    }
                                    if( !match ) break;
                                }
                            } else if( req.children.length != child.q.length ) {
                                match=false;
                            } else {
                                for( k=0; k<req.children.length; k++ ) {
                                    if( req.children[k].main != child.q[k][0] ) {
                                        match=false;
                                        break;
                                    }   
                                    if( req.children[k].alias ) {
                                        pieces[ req.children[k].alias ] = child.q[k][1];
                                    } else {
                                        pieces[ req.children[k].main ] = child.q[k][1];
                                    }
                                }
                            }
                        }
                    } else {
                        if( req.children ) {
                            for( k=0; k<req.children.length; k++ ) {
                                let found = false;
                                if( req.children[k].main[0] == '!' ) {
                                    let anti = req.children[0].main.substring(1);
                                    for( y=0; y<child.params.length; y++ ) {
                                        let pkey = child.params[y].key;
                                        if( typeof pkey != 'string' ) pkey = pkey.title;
                                        if( pkey == anti ) {
                                            match = false;
                                            break;
                                        }
                                    }
                                    if( !match ) break;
                                    continue;
                                }

                                for( y=0; y<child.params.length; y++ ) {
                                    let pkey = child.params[y].key;
                                    if( typeof pkey != 'string' ) pkey = pkey.title;
                                    if( pkey == req.children[k].main ) {
                                        found = child.params[y].value;
                                        break;
                                    }
                                }

                                if( found === false ) {
                                    match = false;
                                    break;
                                }
                                if( req.children[k].alias ) {
                                    pieces[ req.children[k].alias ] = found;
                                } else {
                                    pieces[ req.children[k].main ] = found;
                                }
                            }
                        }
                    }
                    if( !match ) break;
                    if( req.alias ) pieces[req.alias] = child;
                    else pieces[req.main] = child;
                }
                if( !match ) continue; // not all children fully match

                console.log("matched rule " + r.main + ":", r.reqs, "\n", pieces, gr);
                const nn = await mem.Node('',false);
                // reduce and replace this node.
                let foundType = false, backupType = 'unknown';
                var modnode = null;
                for( n=0; n<r.commands.length; n++ ) {
                    const cmd = r.commands[n];
                    if( cmd.target ) {
                        modnode = pieces[cmd.target];
                        for( k=0; k<modnode.params.length; k++ ) { // guess the type
                            let keynode = modnode.params[k].key;
                            let valnode = modnode.params[k].value;
                            if( keynode == 'type' || ( keynode.w && keynode.w == 'type' ) || ( keynode.title && keynode.title == 'type' ) ) {
                                if( typeof valnode == 'string' )
                                    backupType = valnode;
                                else if( valnode.w )
                                    backupType = valnode.w;
                                else if( valnode.title )
                                    backupType = valnode.title;
                                //console.log("backupType="+backupType);
                                break;
                            }
                        }
                        for( k=0; k<cmd.params.length; k++ ) { // process instructions
                            var key0 = cmd.params[k][0], val0 = cmd.params[k][1];
                            if( key0[0] == '+' ) {
                                key0 = key0.substring(1);
                            } else if( key0 in pieces ) {
                                key0 = pieces[key0];
                            }
                            if( val0[0] == '+' ) {
                                val0 = val0.substring(1);
                            } else if( val0 in pieces ) {
                                val0 = pieces[val0];
                            }
                            if( key0 == 'title' ) {
                                if( typeof val0 == 'string' )
                                    modnode.title = val0;
                                else if( val0.w )
                                    modnode.title = val0.w;
                                else
                                    modnode.title = val0.title;
                                continue;
                            }

                            if( typeof key0 == 'string' ) {
                                key0 = await mem.Node( key0 );
                            } else if( key0.w && typeof key0.w == 'string' ) { // convert grammar to node
                                if( key0.q.length == 0 ) {
                                    key0 = await mem.Node( key0.w, true );
                                } else {
                                    key0 = await mem.Node( key0.w );
                                }
                            } else if( key0 instanceof Node ) {
                            } else {
                                throw "Unrecognized node";
                            }

                            if( typeof val0 == 'string' ) {
                                if( foundType === null ) foundType = val0;
                                val0 = await mem.Node( val0, true );
                            } else if( val0.w && typeof val0.w == 'string' ) { // convert grammar to node
                                if( foundType === null ) foundType = val0.w;
                                if( val0.q.length == 0 ) {
                                    val0 = await mem.Node( val0.w, true );
                                } else {
                                    val0 = await mem.Node( val0.w );
                                }
                            } else if( val0 instanceof Node ) {
                                if( foundType === null ) foundType = val0.title;
                            } else {
                                throw "Unrecognized node value";
                            }

                            modnode.addParam(key0, val0);
                        }
                    } else if( cmd.key ) {
                        var key1 = cmd.key, val1 = cmd.value;
                        if( key1[0] == '+' ) {
                            key1 = key1.substring(1);
                        } else if( key1 in pieces ) {
                            key1 = pieces[key1];
                        }
                        if( val1[0] == '+' ) {
                            val1 = val1.substring(1);
                        } else if( val1 in pieces ) {
                            val1 = pieces[val1];
                        }
                        if( key1 == 'title' ) {
                            if( typeof val1 == 'string' )
                                nn.title = val1;
                            else if( val1.w )
                                nn.title = val1.w;
                            else
                                nn.title = val1.title;
                            continue;
                        }
                        
                        if( typeof key1 == 'string' ) {
                            if( key1 == 'type' ) foundType = null;
                            key1 = await mem.Node(key1, true);
                        } else if( key1.w && typeof key1.w == 'string' ) { // convert grammar to node
                            if( key1.q.length == 0 ) {
                                key1 = await mem.Node( key1.w, true );
                            } else {
                                key1 = await mem.Node( key1.w );
                            }
                        } else if( key1 instanceof Node ) {
                            ;
                        } else {
                            throw "Unrecognized node key1";
                        }

                        if( typeof val1 == 'string' ) {
                            if( foundType === null ) foundType = val1;
                            val1 = await mem.Node( val1, true );
                        } else if( val1.w && typeof val1.w == 'string' ) { // convert grammar to node
                            if( foundType === null ) foundType = val1.w;
                            if( val1.q.length == 0 ) {
                                val1 = await mem.Node( val1.w, true );
                            } else {
                                val1 = await mem.Node( val1.w );
                            }
                        } else if( val1 instanceof Node ) {
                            if( foundType === null ) foundType = val1.title;
                        } else {
                            throw "Unrecognized node value1";
                        }

                        nn.addParam(key1, val1);

                        if( !nn.valid ) nn.valid = true;
                    }
                }
                if( nn.valid ) {
                    gr = nn;
                } else if( modnode ) {
                    gr = modnode;
                    if( foundType === null || foundType === false ) {
                        grl[z][0] = backupType;
                    }
                }
                if( foundType !== null && foundType !== false ) {
                    grl[z][0] = foundType;
                }
                break;
            }

            grl[z][1] = gr;
        }
    }

    return mainlist[0][1];
}

module.exports = {  processGrammarNodes };
