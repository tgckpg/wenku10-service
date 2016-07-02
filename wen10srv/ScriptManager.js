"use strict";

const cl = global.botanLoader;
const Dragonfly = global.Dragonfly;

const Model = cl.load( "wen10srv.schema" );
const Locale = cl.load( "botansx.modular.localization" );

class ScriptMananger
{
	constructor( App )
	{
		this.App = App;
	}

	Upload( data, callback )
	{
		var user = data.anon ? null : this.App.Auth.user;

		this.__validate( data );

		var ScriptM = new Model.Script();
		ScriptM.data = new Buffer( data.data );
		ScriptM.desc = data.desc;
		ScriptM.name = data.name;
		ScriptM.secret = data.secret;
		ScriptM.access_token = data.access_token;
		ScriptM.author = user;

		if( data.zone ) ScriptM.zone.push( data.zone );

		ScriptM.save( ( e ) => {
			callback( new JsonProto( null, true, "OK" ) );
		} );
	}

	__validate( s )
	{
		for( let i of [ "access_token", "secret", "data", "name", "zone", "type" ] )
		{
			if( !s[ i ] )
				throw this.App.JsonError( Locale.ScriptMgr.MISSING_PARAM, i );
		}
	}
}

module.exports = ScriptMananger;
