const { SimpleKVStore, LargeKVStore, StringTrie } = require('./db.js');

let active_kdb = null;





function nodeCode(n) {
    if (!n) return '';
    let buf = `${n.w}:${n.t}:[`;
    for (let i = 0; i < n.q.length; i++) {
        if (i !== 0) buf += ";";
        buf += `${n.q[i][0]},${nodeCode(n.q[i][1])}`;
    }
    buf += "]";
    return buf;
}
function printGNode(g)
{
    let buf = "\ngnode[w=" + g.w + ",t=" + g.t + ",q={";
    var i;
    for( i=0; i<g.q.length; i++ ) {
        buf += "\n" + g.q[i][0] + ":" + printNode(g.q[i][1]);
    }
    buf += "\n};";
    return buf;
}
function printNode(n, short_report=false)
{
	var buf;
	var idbuf;
	if( typeof n == 'number' ) {
		return '' + n;
	}
	if( typeof n == 'string' ) {
		return '!' + n + '!';
	}
    if( typeof n.w == 'string' ) {
        return printGNode(n);
    }

    if( typeof n.params == 'undefined' ) {
    	return 'no:' + JSON.stringify(n);
    }
    if( typeof n.id == 'undefined' ) idbuf = '__';
    else if( n.id == -1 ) idbuf = '--';
    else idbuf = n.id;
    if( n.params.length == 0 ) {
        return idbuf + "=`" + n.title + "`";
    }
    buf = "\nnode " + idbuf + "='" + n.title + "'";
    if( !short_report ) {
	    for( let i=0; i<n.params.length; i++ ) {
	        buf += printParam(n.params[i]);
	    }
	}
    buf += "\nend " + n.title + "\n";
    return buf;
}
function printParam(p)
{
	var idbuf;
    if( typeof p.id == 'undefined' ) idbuf = '__';
    else if( p.id == -1 ) idbuf = '--';
    else idbuf = p.id;
	if( typeof p == 'number' ) return '\n' + p;
	var titlebuf = typeof p.title == 'undefined' ? "__" : p.title;
    let buf = "\nparam " + idbuf + "=" + titlebuf + " {";
    var key, val;
    if( typeof p.key == 'string' ) {
        key = p.key;
    } else {
        key = printNode(p.key, false);
    }
    if( typeof p.value == 'string' ) {
        val = p.value;
    } else {
        val = printNode(p.value, false);
    }
    return buf + key + "=" + val + " }";
}




class Param {
	constructor(key = '', value = '', owner = -1, weight = 1.0, source = -1)
	{
		this.id = -1;
		this.weight = weight; // float
		this.source = source; // number||Node
		this.owner = owner; // number||Node
		this.key = key; // number||Node
		this.value = value; // number||Node
		this.inKeyIndex = false;
		this.inNodeList = false;
		this.changed = true;
	}

	setSource(source)
	{
		this.changed = true;
		this.source = source;
	}

	async removeFromKeyIndex()
	{
		this.inKeyIndex = false;
		if( this.id == -1 ) return;

		const keyValue = await active_kdb.resolveNode( this.key );
		if( keyValue == '' ) return;

		const valValue = await active_kdb.resolveNode( this.value );
		if( valValue == '' ) return;

		let idxList = await active_kdb.getKeyIndex( keyValue );
		if( idxList === null || idxList[0].length == 0 ) return;

		const idxSorted = new SortedList(idxList[0], idxList[1]);
		const results = idxSorted.findAll( valValue );
		results.sort( (a,b) => a-b );

		let minus = 0;
		for( let i=0; i<results.length; i++ ) {
			if( idxSorted[0][ results[i]-minus ] == this.id ) {
				idxSorted.removeAt(results[i]-minus);
				minus++;
			}
		}

		idxList[2] = true;
	}
	async removeFromKeyLists()
	{
		this.inNodeList = false;
		if( this.id == -1 ) return;

		const owner_id = typeof this.owner == 'number' ? this.owner : this.owner.id;
		if( owner_id == -1 ) return;

		const keyValue = await active_kdb.resolveNode( this.key );
		if( keyValue == '' ) return;
		

		let idxList = await active_kdb.getNodeParams( ownerId );
		if( idxList === null || idxList[0].length == 0 ) return;

		const idxSorted = new SortedList(idxList[0], idxList[1]);
		const results = idxSorted.findAll( keyValue );			
		results.sort( (a,b) => a-b );

		let minus = 0;
		for( let i=0; i<results.length; i++ ) {
			if( idxSorted[0][ results[i]-minus ] == this.id ) {
				idxSorted.removeAt(results[i]-minus);
				minus++;
			}
		}

		idxList[2] = true;
	}


	async addToKeyIndex() {
		if( this.id == -1 ) return;

		const keyValue = await active_kdb.resolveNode( this.key );
		if( keyValue == '' ) return;
		const valValue = await active_kdb.resolveNode( this.value );
		if( valValue == '' ) return;

		this.inKeyIndex = true;
		
		let idxList = await active_kdb.getKeyIndex( keyValue );
		if( idxList !== null ) {
			let idxSort = new SortedList(idxList[0], idxList[1]);
			if( idxSort.items.length == 1000 ) {
				console.log("Oversize index for " + keyValue);
			} else {
				idxSort.add( valValue, this.id );
			}
		}
	}

	async addToKeyLists() {
		if( this.id == -1 ) return;

		const owner_id = typeof this.owner == 'number' ? this.owner : this.owner.id;
		if( owner_id == -1 ) return;
		const keyValue = await active_kdb.resolveNode( this.key );
		if( keyValue == '' ) return;

		this.inNodeList = true;

		let idxList = await active_kdb.getNodeParams( owner_id );
		if( idxList !== null ) {
			let idxSort = new SortedList(idxList[0], idxList[1]);
			if( idxSort.items.length == 1000 ) {
				console.log("Oversize index for " + keyValue);
			} else {
				idxSort.add( keyValue, this.id );
			}
		}
	}

	async setOwner(owner)
	{
		this.changed = true;
		await this.removeFromKeyIndex();
		this.owner = owner;
		await this.addToKeyIndex();
	}

	async setKey(key)
	{
		this.changed = true;
		await this.removeFromKeyIndex();
		await this.removeFromKeyLists();
		this.key = key;
		await this.addToKeyIndex();
		await this.addToKeyLists();
	}

	async setValue(value)
	{
		this.changed = true;
		await this.removeFromKeyIndex();
		await this.removeFromKeyLists();
		this.value = value;
		await this.addToKeyIndex();
		await this.addToKeyLists();
	}
}
class Node {
	constructor(title = '', source = -1, params = [])
	{
		this.id = -1;
		this.title = title; // string
		this.source = source; // userid
		this.params = params; // [Param]
		this.changed = true;
		this.changedParams = false;
		this.inTitledNodes = false;
	}

	async removeFromTitledNodes()
	{
		this.inTitledNodes = false;
		if( this.id == -1 ) return;

		let pType = await this.getParam('type');
		if( pType === null ) return;
		let pTypeval = await active_kdb.resolveNode(pType);
		
		let idxList = await active_kdb.getTitledNodes( this.title );
		if( idxList === null || idxList[0].length == 0 ) return;

		const idxSorted = new SortedList(idxList[0], idxList[1]);
		const results = idxSorted.findAll( pTypeval );
		results.sort( (a,b) => a-b );

		let minus = 0;
		for( let i=0; i<results.length; i++ ) {
			if( idxSorted[0][ results[i]-minus ] == this.id ) {
				idxSorted.removeAt(results[i]-minus);
				minus++;
			}
		}

		idxList[2] = true;
	}

	async addToTitledNodes()
	{
		if( this.id == -1 ) return;

		this.inTitledNodes = true;

		if( this.title == '' ) return;

		var pTypeval;
		let pType = await this.getParam('type');
		if( pType === null ) pTypeval = '_';
		else pTypeval = await active_kdb.resolveNode(pType);
		
		let idxList = await active_kdb.getTitledNodes( this.title );
		if( idxList === null ) return;

		const s_list = new SortedList(idxList[0], idxList[1]);
		if( idxList[0].length == 1000 )
			console.log("Title '" + this.title + "': 1000");
		s_list.add(pTypeval, this.id);
		idxList[2] = true;
	}

	async getParam( key )
	{
		for( let i=0; i<this.params.length; i++ ) {
			if( await active_kdb.resolveNode( this.params[i].key ) == key )
				return this.params[i];
		}
		return null;
	}
	async setParam( key, value )
	{
		for( let i=0; i<this.params.length; i++ ) {
			const p = this.params[i];
			if( key ==  p || key == await active_kdb.resolveNode( p.key ) ) {
				await p.setValue(typeof value == 'string' ? await active_kdb.Node(value, true) : value); // in this case the lists will be updated appropriately
				return;
			}
		}
		await this.addParam(key,value); // here the lists are not added and the node will need to be saved again
	}
	async addParam( key, value )
	{
		this.params.push( await active_kdb.KeyVal(key,value) );
		this.changedParams = true;
	}
	async setTitle(title)
	{
		await this.removeFromTitledNodes();
		this.title = title;
		await this.addToTitledNodes();
		this.changed = true;
	}

}

class SortedList {
    constructor(items=[], datas=[]) {
        this.items = items;
        this.datas = datas;
    }

    add(obj, data) {
        const index = this.#findInsertIndex(obj);
        this.items.splice(index, 0, obj);
        this.datas.splice(index, 0, data);
        if( this.items.length == 1000 ) {
        	console.trace();
        	throw "large list";
        }
        return index;
    }

    addAll(objs, datas) {
    	var i;

    	for( i=0; i<objs.length; i++ ) {
    		this.add(objs[i], datas[i]);
    	}
    }

    removeAt(index) {
        if (index >= 0 && index < this.items.length) {
            return [this.items.splice(index, 1), this.datas.splice(index, 1)];
        }
        return null;
    }

    remove(obj) {
        const index = this.findIndex(obj);
        return index !== -1 ? this.removeAt(index) : null;
    }

    has(value) {
    	return ( this.findIndex(value) != -1 );
    }

    findIndex(value) {
        let left = 0;
        let right = this.items.length - 1;

        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            const midValue = this.items[mid];
            if (midValue === value) return mid;
            if (midValue < value) left = mid + 1;
            else right = mid - 1;
        }
        return -1;
    }

    #findInsertIndex(value) {
        let left = 0;
        let right = this.items.length;

        while (left < right) {
            const mid = Math.floor((left + right) / 2);
            if (this.items[mid] < value) {
                left = mid + 1;
            } else {
                right = mid;
            }
        }
        return left;
    }

    findGreaterThan(value, inclusive = false) {
        const index = this.#findInsertIndex(value);
        return [ inclusive ? index : index + 1, this.items.length ]; //[ this.items.slice(inclusive ? index : index + 1), this.datas.slice(inclusive ? index : index + 1) ];
    }

    findLessThan(value, inclusive = false) {
        const index = this.#findInsertIndex(value);
        const endpt = !inclusive && index < this.items.length && this.items[index] === value ? index: (index+1);
        return [ 0, endpt ]; // this.items.slice(0, endpt), this.datas.slice(0, endpt) ];
    }

    findRange(min, max, inclusiveMin = true, inclusiveMax = true) {
    	if( min > max ) return [];
        const start = this.#findInsertIndex(min);
        const end = this.#findInsertIndex(max);

        const adjStart = inclusiveMin ? start : (start < this.items.length && this.items[start] === min ? start + 1 : start);
        const adjEnd = !inclusiveMax && end < this.items.length && this.items[end] === max ? end : ( end + 1 );

        return [adjStart, adjEnd]; //[ this.items.slice(adjStart, adjEnd), this.datas.slice(adjStart, adjEnd) ];
    }

    get size() {
        return this.items.length;
    }

    getAll() {
        return [ this.items, this.data ];
    }

    findAll(value) {
        const index = this.findIndex(value);
        const result = [];

        if (index === -1) return result;

        for( let i=index; i >= 0 && this.items[i] === value; i-- ) {
            result.push(i);
        }
        for( let i=index+1; i < this.items.length && this.items[i] === value; i++ ) {
            result.push(i);
        }
        return result;
    }

    clear() {
    	this.items.splice(0,this.items.length);
    	this.datas.splice(0,this.datas.length);
    }
}










class KnowDB {

	constructor(filename)
	{
		this.filename = filename;
		this.Nodes = new LargeKVStore("n_" + filename); // object storage by id
		this.Params = new LargeKVStore("p_" + filename); // object storage by id
		this.NodeKeys = new LargeKVStore("ns_" + filename); // node ids by title
		this.ParamLists = new LargeKVStore("pl_" + filename); // param ids by key, sorted lists by value
		this.KeyLists = new LargeKVStore("kl_" +  filename); // param ids by owner_id(node), sorted lists by key
		this.System = new LargeKVStore("s_" + filename);


		this.mNodes = new Map(); // loaded nodes by id
		this.mParams = new Map(); // loaded params by id
	}

	async init()
	{
		active_kdb = this;

		await this.Nodes.open();
		await this.NodeKeys.open();
		await this.ParamLists.open();
		await this.KeyLists.open();
		await this.Params.open();
		await this.System.open();

		this.nextlist = this.System.get("nextlist");
		if( typeof this.nextlist == 'undefined' ) {
			this.nextlist = 0;
			this.System.set("nextlist", this.nextlist);
		}

		this.nextnode = this.System.get("nextnode");
		if( typeof this.nextnode == 'undefined' ) {
			this.nextnode = 0;
			this.System.set("nextnode", this.nextnode);
		}

		this.nextparam = this.System.get("nextparam");
		if( typeof this.nextparam == 'undefined' ) {
			this.nextparam = 0;
			this.System.set("nextparam", this.nextparam);
		}
	}

	loosen()
	{
		this.Nodes.loosen();
		this.Params.loosen();

		this.NodeKeys.loosen();
		this.ParamLists.loosen();
		this.KeyLists.loosen();

		this.System.loosen();
	}

	async tighten()
	{
		console.log("Compacting knowdb...");
		await this.Nodes.compact();
		await this.Params.compact();

		await this.NodeKeys.compact();
		await this.ParamLists.compact();
		await this.KeyLists.compact();

		await this.System.compact();
		console.log("Knowdb Compacted.");
	}

	async sync()
	{
		await this.finishWrites( this.NodeKeys );
		await this.finishWrites( this.ParamLists );
		await this.finishWrites( this.KeyLists );
	}

	async close()
	{
		await this.Nodes.close();
		await this.NodeKeys.close();
		await this.ParamLists.close();
		await this.KeyLists.close();
		await this.Params.close();
		await this.System.close();
	}

	async Node( title, allowRootWord=false )
	{
		if( allowRootWord ) {
			const list = await this.findNodes(title);
			var base;

			if( list.length > 0 ) {
				if( (base = await this.getNode( list[0] )) != null ) {
					//console.log("Found " + list[0] + ": ", printNode(base));
					return base;
				} else {
					console.error("Invalid node ", title, list);
				}
			}
		}
		let n = new Node(title);
		if( allowRootWord )
			console.log("New Node(" + title + ")");
		await this.setNode(n);
		return n;
	}
	Param()
	{
		return new Param();
	}
	async KeyVal( key, val, owner=-1, source=-1 )
	{
		if( typeof key == 'number' )
			key = '' + key;
		if( typeof key == 'string' )
			key = await this.Node(key, true);
		if( typeof val == 'number' )
			val = '' + val;
		if( typeof val == 'string' )
			val = await this.Node(val, true);
		const p = new Param(key,val,owner,1.0,source);
		return p;
	}

	async importKb( kb )
	{
		const keys = kb.keys();
		let count = 0;

		this.loosen();

		const pos = await this.Node('pos', true);
		const root = await this.Node('root', true);
		const plur = await this.Node('plur', true);
		const tens = await this.Node('tens', true);

		let deets = [];

		let addWord = async function(n, rootWord=false) {
			var key;
			if( typeof n == 'string' ) key=n;
			else key=n.title;

			const info = kb.get(key);
			if( typeof n == 'string' )
				n = await this.Node(key, true);

			if( typeof info != 'undefined' && info ) {
				//console.log("Info found",info);
				if( !(n instanceof Node) ) {
					console.log("Wrote type for " + typeof n + ", ", n);
				}
				await n.addParam( pos, info[0].join(',') );
				if( info[1] != key ) {
					await n.addParam( root, info[1] );
				}

				await n.addParam( plur, info[2] );
				await n.addParam( tens, info[3] );
			}
			//console.log(n.title);
			count++;
			if( count == 10000 ) {
				count=0;
				console.log("Added 10,000 words.");
			}

			if( !rootWord ) {
				deets.push(n);
			}

			return n;
		}.bind(this);

		await addWord(pos, true);
		await addWord(root, true);
		await addWord(plur, true);
		await addWord(tens, true);

		await this.linkNode(pos);
		await this.linkNode(root);
		await this.linkNode(plur);
		await this.linkNode(tens);

		for( const key of keys ) {
			if( key == 'pos' || key == 'root' || key == 'plur' || key == 'tens' ) continue;
			await addWord(key, false);
		}

		console.log("Link.");

		count=0;
		for( var node of deets ) {
			await this.linkNode(node);
			await this.setNode(node);
			count++;
			if( count == 10000 ) {
				console.log("Linked 10,000 words.");
				count=0;
			}
		}

		console.log("Sync...");

		await this.sync();
		await this.tighten();

		console.log("Done");
	}

	async linkNode( n )
	{
		// resolve matching titled nodes in n that already exist in this knowdb (via nodekeys)
		let lst = {'key':n}, vars = ['key', 'value'], seen = new Set();
		var i,k, base;
		let q = [lst];

		while( q.length > 0 ) {
			i = q.shift();

			for( k of vars ) {
				if( !(k in i) ) continue;
				n = i[k];
				if( !n.changed ) continue;
				if( n.id != -1 ) continue;
				//console.log(k + ": [" + printNode(n, true) + "]\n");
				if( n.params.length > 0 ) {
					if( seen.has(n) ) continue;
					seen.add(n);
					q.push(...n.params);
				} else {
					const list = await this.findNodes(n.title);
					console.log("Link ", n.title, ": " + (list===null?-1:list.length) + " results");
					if( list.length > 0 && (base = await this.getNode( list[0] )) ) {
						console.log(list[0]);
						i[k] = base;
					} else {
						console.log("Create node ", n.title);
						await this.setNode(n); // it needs an id if it's the first copy
					}
				}
			}
		}

		if( lst.key != n ) {
			console.log("Modified directly linked node " + n.title);
		}
		return lst.key;
	}

	async resolveNode( n )
	{
		if( typeof n == 'number' ) {
			if( n == -1 ) return '';
			n = await this.getNode(n);
		}
		if( typeof n != 'object' ) {
			console.log("Invalid object ", n);
			console.trace();
			return '';
		}

		return n.title;
	}
	resolveNodeId( n )
	{
		if( typeof n == 'number' ) return n;
		return n.id;
	}

	async finishWrites(largeKV)
	{
		const pl = largeKV.keys();
		let loose = false;

		for( let i=0; i<pl.length; i++ ) {
			const key = pl[i];
			const cac = largeKV.cache[key];
			if( typeof cac == 'undefined' ) continue;
			if( cac[2] === true ) {
				cac[2] = false;
				if( !loose ) {
					loose = true;
					await largeKV.loosen();
				}
				await largeKV.set(key,cac);
			}
		}
		if( loose ) {
			await largeKV.compact();
		}
	}

	async getTitledNodes( title )
	{
		if( title == '' ) return null;

		let list = this.NodeKeys.get(title);
		if( typeof list == 'undefined' ) {
			list = [[],[],true];
			await this.NodeKeys.set(title,list);
		}
		return list;
	}
	async getKeyIndex( key )
	{
		const black = [ 'tens', 'plur', 'root', 'base', 'key', 'value', 'source', 'owner', 'pos', 'noun', 'verb', 'adverb', 'adject', 'type', 'weight' ];
		if( key == '' || black.indexOf(key) >= 0 ) return null;

		let list = this.ParamLists.get(key);
		if( typeof list == 'undefined' ) {
			list = [[],[],true];
			await this.ParamLists.set(key,list);
		}
		return list;
	}
	async getNodeParams( owner )
	{
		if( typeof owner == 'undefined' ) return null;
		if( typeof owner != 'number' ) {
			owner = owner.id;
		}
		if( typeof owner != 'number' )
			return null;

		let list = this.KeyLists.get(owner);
		if( typeof list == 'undefined' ) {
			list = [[],[],true];
			await this.KeyLists.set(owner,list);
		}
		return list;
	}


	async getNode( id )
	{
		// load from cache
		if( this.mNodes.has(id) ) return this.mNodes.get(id);

		// try to load from disk
		const nc = await this.Nodes.get(id);
		if( typeof nc == 'undefined' ) {
			console.log("Node " + typeof id + id + " not found.");
			return null;
		}

		const n = new Node();
		n.id = nc.id;
		n.title = nc.title;
		n.source = nc.source;

		const np = await this.getNodeParams( n.id );
		var i;
		if( np !== null ) {
			for( i=0; i<np[0].length; i++ )  {
				const pid = np[1][i];
				if( this.mParams.has(pid) ) n.params.push( this.mParams.get(pid) );
				else n.params.push( pid );
			}
		}

		this.mNodes.set(n.id, n);
		return n;
	}
	async getParam( id )
	{
		// load from cache
		if( this.mParams.has(id) ) return this.mParams.get(id);

		// try to load from disk
		const pc = await this.Params.get(id);
		if( typeof pc == 'undefined' ) return null;

		const p = new Param();
		p.id = pc.id;
		p.title = pc.title;
		p.weight = pc.weight;

		// attach to any preloaded nodes
		let key, nodeps = [ 'key', 'value', 'source', 'owner' ];
		for( key of nodeps ) {
			if( this.mNodes.has(pc[key]) ) p[key] = this.mNodes.get(pc[key]);
			else p[key] = pc[key];
		}

		this.mParams.set(p.id, p);
		return p;
	}


	async setNode( n )
	{
		if( typeof n == 'number' ) return;
		if( typeof n.params == 'undefined' ) {
			console.warn("invalid", n);
			return;
		}


		if( n.id == -1 || typeof n.id == 'undefined' ) {
			n.id = this.nextnode;
			this.nextnode++;
			await this.System.set("nextnode", this.nextnode);
			n.changed = true;
		}
		if( !n.changed && !n.changedParams ) return;
		n.changed = false;
		var i;
		let nc = { title: n.title, id: n.id };
		//console.log("Saving ", n.title, n.id);

		if( n.changedParams ) {
			n.changedParams = false;

			const np = await this.getNodeParams( n.id );
			if( np === null ) {
				console.warn("invalid", n, n.id);
				return;
			}
			const npSort = new SortedList(np[0], np[1]);

			// save modified parameters, retrieve node type, and update node params:
			for( i=0; i<n.params.length; i++ ) { 
				if( typeof n.params[i] == 'number' ) continue;
				if( !n.params[i].changed ) continue;
				if( n.params[i].owner === -1 ) await n.params[i].setOwner(n);
				await this.setParam(n.params[i], true);
				try {
					npSort.add( await this.resolveNode(n.params[i].key), n.params[i].id );
				} catch( e ) {
					console.error("error ", n.params[i].key, n.id, n.title, e, np[0], np[1]);
					throw e;
				}
			}

			np[2] = true;
		}

		if( !n.inTitledNodes ) {
			//console.log("add titled (" + n.title + ")", typeof n, n instanceof Node, n);
			n.addToTitledNodes();
		}

		await this.Nodes.set(n.id, nc); // update database with constructed details

		this.mNodes.set(n.id, n); // update cache
	}

	async setParam( p, addingFromNode=false )
	{
		if( typeof p == 'number' ) return; // previously saved and already (not fully) reloaded

		if( p.id == -1 ) {
			p.id = this.nextparam;
			this.nextparam++;
			await this.System.set("nextparam", this.nextparam);
			p.changed = true;
		}
		if( !p.changed ) return;
		p.changed = false;

		const pc = { title: p.title, id: p.id, weight: p.weight };
		let i, nodeps = [ 'key', 'value', 'source', 'owner' ];
		for( i=0; i<nodeps.length; i++ ) {
			if( typeof p[nodeps[i]] == 'number' ) {
				pc[nodeps[i]] = p[nodeps[i]];	
			} else if( p[nodeps[i]] instanceof Node || ( typeof p[nodeps[i]] == 'object' && typeof p[nodeps[i]].title != 'undefined' ) ) {
				if( nodeps[i] != 'source' && nodeps[i] != 'owner' ) {
					await this.setNode(p[nodeps[i]]);
				}
				pc[nodeps[i]] = p[nodeps[i]].id;
			} else {
				console.log("Unsupported type ", nodeps[i], p, typeof p[nodeps[i]]);
			}
		}

		if( !p.inKeyIndex ) {
			p.addToKeyIndex();
		}
		if( !p.inNodeList && !addingFromNode ) {
			p.addToKeyLists();
		}

		await this.Params.set(p.id, pc);
		this.mParams.set(p.id, p);
	}

	async findNodes( title )
	{
		const list = await this.getTitledNodes( title );
		return list===null?[]:list[1];
	}
	async getNodes( title )
	{
		const nodes = [], list = await this.getTitledNodes( title );
		if( list === null ) return nodes;

		for( let i=0; i<list[1].length; i++ ) {
			const node = this.getNode(list[1][i]);
			if( node ) nodes.push(node);
		}
		return nodes;
	}

	async findKeyParams( key, value )
	{
		var results;
		const list = await this.getKeyIndex(key);
		if( list === null ) return [];

		if( typeof value == 'object' ) {
			if( 'gt' in value ) {
				if( 'lt' in value ) results = list.findRange( value['lt'], value['gt'], false, false );
				else if( 'le' in value ) results = list.findRange( value['le'], value['gt'], true, false );
				else results = list.findGreaterThan(value['gt']);
			} else if( 'ge' in value ) {
				if( 'lt' in value ) results = list.findRange( value['lt'], value['ge'], false, true );
				else if( 'le' in value ) results = list.findRange( value['le'], value['ge'], true, true );
				else results = list.findGreaterThan(value['ge'], true);
			} else if( 'lt' in value ) {
				results = list.findLessThan(value['lt']);
			} else if( 'le' in value ) {
				results = list.findLessThan(value['le'], true);
			} else {
				results = [];
			}
		} else {
			results = list.findAll(value);
		}
		return results;
	}
	async findKeyNodes( key, value )
	{
		const params = await this.findKeyParams(key,value);
		const nodes = [];
		var i, p;
		for( i=0; i<params.length; i++ ) {
			p = await this.getParam(params[i]);
			if( p && p.owner != -1 ) {
				if( typeof p.owner == 'number' )
					nodes.push( p.owner );
				else
					nodes.push( p.owner.id );
			}
		}
		return nodes;
	}
	async patternMatch( params )
	{
		let rvs = null;
		var i, rv, rvb, lst;

		for( var key in params ) {
			lst = await this.findKeyNodes(key,params[key]);
			rv = [];
			rvb = new Set();
			for( i=0; i<lst.length; i++ ) {
				if( rvs !== null && !rvs.has(lst[i]) ) continue;
				rv.push(lst[i]);
				rvb.add(lst[i]);
			}
			rvs = rvb;
		}
		return rv;
	}

};


module.exports = { Param, Node, SortedList, KnowDB,
    nodeCode,
    printNode,
    printParam };
