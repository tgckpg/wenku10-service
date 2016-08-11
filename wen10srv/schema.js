"use strict";

const Dragonfly = global.Dragonfly;
const cl = global.botanLoader; 
const EventEmitter = require( "events" ).EventEmitter;
const mongoose = require( "mongoose" );
	const Schema = mongoose.Schema;

const options = cl.load( "wen10srv.config.db" );

const throwEverything = function( err ) {
	if( err ) throw err;
};

mongoose.Promise = global.Promise;

var db = mongoose.connection;
db.on( "error", throwEverything );

mongoose.connect( options.host, options.auth );

/* Schema Heads */
var R_User = { type: Schema.Types.ObjectId, ref: "User" };
var R_Comment = { type: Schema.Types.ObjectId, ref: "Comment" };
var R_Script = { type: Schema.Types.ObjectId, ref: "Script" };
var R_Request = { type: Schema.Types.ObjectId, ref: "Request" };
var R_Notification = { type: Schema.Types.ObjectId, ref: "Notification" };
/* End Schema Heads */

var M_Script = new Schema({
	uuid: { type: String, unique: true }
	, name: String
	, data: Buffer
	, desc: { type: String, default: "" }
	, hits: { type: Number, default: 0 }
	, zone: [ String ]
	, type: [ String ]
	, date_modified: { type: Date, default: Date.now }
	, date_created: { type: Date, default: Date.now }
	, history: [{
		desc: String
		, status: Number
		, date: { type: Date, default: Date.now }
	}]
	, comments: [ R_Comment ]
	, key_requests: [ R_Request ]
	, token_requests: [ R_Request ]
	, tags: [ String ]
	, related: [ R_Script ]
	, draft: { type: Boolean, default: true }
	, public: { type: Boolean, default: false }
	/**
	 * Script can be disabled by admins if that script was inappropriate
	 * disabled script will not be downloadable nor listable unless
	 * provided a correct access_token
	 **/
	, enable: { type: Boolean, default: true }
	, enc: Boolean
	, force_enc: Boolean
	, access_token: String
	// Can be null, i.e. anonymous
	, author: R_User
});

var M_User = new Schema({
	name: { type: String , unique: true }
	, password: String
	, email: String
	, active: { type: Boolean, default: true }
	, profile: {
		display_name: String
	}

	, lang: { type: String, default: "en-US" }
	, nsubs: [ R_Notification ]
});

var M_Notification = new Schema({
	type: Number
	, inbox: Array
});

var M_Request = new Schema({
	author: R_User
	// Used by granters to encrypt the granted key
	, pubkey: String
	, grants: [ String ]
	, remarks: String
	, target: String
	, script: R_Script
	, date_created: { type: Date, default: Date.now }
});

var M_Comment = new Schema({
	author: R_User
	, content: String
	, enc: Boolean
	, ref_script: R_Script
	, date_modified: { type: Date, default: Date.now }
	, date_created: { type: Date, default: Date.now }
	, enabled: { type: Boolean, default: true }
	, remarks: String
	, replies: [ R_Comment ]
});

class DB extends EventEmitter
{
	constructor()
	{
		super();
		var Models = [
			  { name: "User"    , schema: M_User      , hasKey: true }
			, { name: "Script"  , schema: M_Script    , hasKey: true }
			, { name: "Notification" , schema: M_Notification }
			, { name: "Comment" , schema: M_Comment }
			, { name: "Request" , schema: M_Request }
		];

		var l = Models.length;

		var _widx = 0;
		var _widxl = 0;

		var ready = () => {
			this.ready = true;
			this.emit( "ready", this );
		};

		var waitIndex = function( err )
		{
			_widx ++;
			throwEverything( err );
			if( _widx == _widxl ) ready();
		};

		this.ready = false;

		for( var i = 0; i < l; i ++ )
		{
			var mod = Models[i];
			var b = mongoose.model( mod.name, mod.schema );
			if( mod.hasKey )
			{
				_widxl ++;
				b.on( "index", waitIndex );
			}
			this[ mod.name ] = b;
		}

		if( !_widxl ) ready();
	}
};

module.exports = new DB();
