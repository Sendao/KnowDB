Project ERE: English Reasoning Engine

-> KnowDB: semi-optimum storage of nodes, parameters, and lists. The idea here is to provide a data structure that more naturally mirrors english, after having written many many different interfaces and databases to support them, it does eventually become clear what elements
are rigorously necessary for indexing, search, comparison, sorting, and presentation of data w.r.t. information.

-> Extracter.js: reads from assertions list (10gb, not included) to produce words.jsdb
-> specialwords.js: repairs idiotic assertions about the nature of basic words. also adds some specificity
-> db.js: Optimal keyvalue stores, both in small and large versions with slightly different storage strategies.
-> dbx.js: that's knowdb.
-> grammar.js: emergent rules and engine for parsing english into encodings, sentences become encodings
-> encoder.js: emergent rules and engine for parsing (english) encodings into knowdb formats, phrases become nodes with detail parameters from the english parse


