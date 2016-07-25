"use strict";
require( "../../BotanSS/package" );
require( "../../config/global" );

var cl = global.botanLoader;

var mongoose = require("mongoose");
cl.rootNS( "wen10srv", "./wen10srv" );

var options = cl.load("wen10srv.config.db");

var db = mongoose.connection;
var ThrowEverything = function( err ) {
	if( err )
	{
		throw err;
		process.exit(1);
	}
};
db.on( "error", ThrowEverything );

mongoose.connect( options.host, options.auth );

var i = 0;
var rmCollection = [ "users", "scripts", "comments", "requests" ];
var l = rmCollection.length;

var TestThenExit = function() {
	if( ++ i == l ) process.exit( 0 );
};

var RemoveCollection = function( c )
{
	mongoose.model( c, {} ).remove({}, ( err ) => {
		ThrowEverything( err );
		console.log( "Dropped Collection: " + c );
		TestThenExit();
	} );
};

for( let col of rmCollection ) RemoveCollection( col );
