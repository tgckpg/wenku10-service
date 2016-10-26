#!/usr/bin/env node

require( "./BotanSS/package" );
require( "./config/global" );

var cl = global.botanLoader;

var Dragonfly = cl.load( "botanss.Dragonfly" );
Dragonfly.defaultSphere = 999;


var cluster = require('cluster');
var numCPUs = 1;


if( cluster.isMaster )
{
	var clog = require( "./config/log" );
	var Masterfly = new Dragonfly( clog.handler );

	var procFock = function( c )
	{
		// fork and bind the message bus from masterfly
		c.fork().addListener( "message", Masterfly.messageBus );
	};

	var clusterDisconnect = function( worker )
	{
		if( worker.exitedAfterDisconnect === true )
		{
			Masterfly.Info( "Worker committed suicide" );
			Masterfly.Info( "Forking process ..." );
			procFock( cluster );
		}
		else
		{
			Masterfly.Info( "Worker died" );
		}
	};

	for( var i = 0; i < numCPUs; i ++ ) procFock( cluster );

	cluster.addListener( "disconnect", clusterDisconnect );
}
else
{
	Dragonfly = new Dragonfly();
	global.Dragonfly = Dragonfly;

	global.X_SERVER_CLUSTER = cluster;

	var AppDomain = cl.load( "botanss.net.AppDomain" );
	var Httph = cl.load( "botanss.net.Http" );

	// Define AppNS
	cl.rootNS( "config", "./config/" );
	cl.rootNS( "wen10srv", "./wen10srv" );
	cl.rootNS( "botansx", "./ext/" );
	cl.rootNS( "LocaleSX", "./wen10srv/locale" );

	var App = cl.load( "wen10srv.app" );

	new AppDomain( function( req, res )
	{
		var h = new Httph( req, res );
		new App( h ).run();
	}, 5006 );
	//*/
}
