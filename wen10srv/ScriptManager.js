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

		this.__validate( data, "uuid", "access_token", "secret", "data", "name", "zone", "type" );

		this.__edit( data.uuid, data.access_token, ( ScriptM ) => {
			ScriptM.data = new Buffer( data.data );
			ScriptM.desc = data.desc;
			ScriptM.name = data.name;
			ScriptM.secret = data.secret;
			ScriptM.author = user;

			if( data.zone ) ScriptM.zone.push( data.zone );
			if( data.tags ) ScriptM.zone.push( data.tags.split( "\n" ) );

		}, callback );
	}

	Publish( data, callback )
	{
		this.__validate( data, "uuid", "access_token", "public" );

		this.__edit( data.uuid, data.access_token, ( ScriptM ) => {
			ScriptM.public = data.public;
		}, callback );
	}

	Download( postdata, callback )
	{
		this.__validate( postdata, "uuid" );

		var criteria = { uuid: postdata.uuid };

		if( postdata.access_token )
		{
			criteria.$or = [
				{ access_token: postdata.access_token }
				, { public: true, draft: false }
			];
		}
		else
		{
			criteria.public = true;
			criteria.draft = false;
		}

		this.__get(
			criteria, { data: true }
			, ( e ) => {
				callback( this.App.JsonSuccess( e.data.toString( "utf8" ) ) );
			}
			, callback
		);
	}

	__get( criteria, fields, getCallback, callback )
	{
		Model.Script.findOne(
			criteria, fields, ( e, data ) => {
				if( e )
				{
					Dragonfly.Error( e );
					callback( this.App.JsonError( Locale.System.DATABASE_ERROR ) );
					return;
				}

				if( !data )
				{
					callback( this.App.JsonError( Locale.ScriptMananger.NO_SUCH_SCRIPT, criteria.uuid ) );
					return;
				}

				getCallback( data );
			}
		);
	}

	__edit( uuid, accessToken, editCallback, callback )
	{
		Model.Script.findOne(
			{ uuid: uuid }, { comment: 0, history: 0 }, ( e, data ) => {
				if( e )
				{
					callback( this.App.JsonError( Locale.System.DATABASE_ERROR ) );
					return;
				}

				if( !data )
				{
					callback( this.App.JsonError( Locale.ScriptMananger.UUID_NOT_RESERVED, uuid ) );
					return;
				}

				if( data.access_token != accessToken )
				{
					callback( this.App.JsonError( Locale.ScriptMananger.ACCESS_DENIED ) );
					return;
				}

				editCallback( data );

				data.save( ( e ) => {
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
