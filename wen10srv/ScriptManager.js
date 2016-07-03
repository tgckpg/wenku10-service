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
		this.utils = this.App.Control.utils;
	}

	ReserveUuid( data, callback )
	{
		this.__validate( data, "access_token" );

		this.utils.use( "random" );
		var uuid = this.utils.uuid();

		var ScriptM = new Model.Script();
		ScriptM.uuid = uuid;
		ScriptM.access_token = data.access_token;

		ScriptM.save( ( e ) => {
			if( e )
			{
				callback( this.App.JsonError( Locale.System.DATABASE_ERROR ) );
				return;
			}

			callback( this.App.JsonSuccess( uuid ) );
		} );
	}

	Upload( data, callback )
	{
		var user = data.anon ? null : this.App.Auth.user;

		this.__validate( data, "uuid", "secret", "data", "name", "zone", "type" );

		Model.Script.findOne(
			{ uuid: data.uuid }, ( e, ScriptM ) => {
				if( e )
				{
					callback( this.App.JsonError( Locale.System.DATABASE_ERROR ) );
					return;
				}

				if( !ScriptM )
				{
					callback( this.App.JsonError( Locale.ScriptMananger.UUID_NOT_RESERVED, data.uuid ) );
					return;
				}

				ScriptM.data = new Buffer( data.data );
				ScriptM.desc = data.desc;
				ScriptM.name = data.name;
				ScriptM.secret = data.secret;
				ScriptM.author = user;

				if( data.zone ) ScriptM.zone.push( data.zone );
				if( data.tags ) ScriptM.zone.push( data.tags.split( "\n" ) );

				ScriptM.save( ( e ) => {
					if( e )
					{
						callback( this.App.JsonError( Locale.System.DATABASE_ERROR ) );
						return;
					}
					callback( this.App.JsonSuccess() );
				} );
			}
		);
	}

	__validate( data, ...fields )
	{
		for( let i of fields )
		{
			if( !data[ i ] )
				throw this.App.JsonError( Locale.GenericError.MISSING_PARAM, i );
		}
	}
}

module.exports = ScriptMananger;
