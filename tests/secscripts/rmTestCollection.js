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

mongoose.model( "users", {} ).remove({}, function( err )
{
	ThrowEverything( err );

	console.log( "Dropped Collection Users" );
	mongoose.model( "scripts", {} ).remove({}, function( err )
	{
		ThrowEverything( err );

		console.log( "Dropped Collection Scirpts" );
		process.exit(0);
	});
});
