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
			if( this.__dbErr( e, callback ) ) return;
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

			if( data.zone ) ScriptM.zone.push( data.zone.split( "\n" ) );
			if( data.type ) ScriptM.type.push( data.type.split( "\n" ) );
			if( data.tags ) ScriptM.tags.push( data.tags.split( "\n" ) );

		}, callback );
	}

	Search( postdata, callback )
	{
		var criteria = {};

		var fields = { comments: false, access_token: false, data: false };

		this.__stringSearch( postdata, criteria, "name", "desc" );
		this.__privateAccess( postdata, criteria );
		this.__in( postdata, criteria, "zone", "type", "tags" );
		this.utils.use( "object", "math" );

		var skip = Math.abs( parseInt( postdata.skip ) || 0 );
		var limit = this.utils.clamp( parseInt( postdata.limit ) || 50, 1, 100 );

		Model.Script.find( criteria, fields, ( err, items ) => {
			if( this.__dbErr( err, callback ) ) return;

			var output = [];

			for( let item of items )
			{
				var saneData = this.utils.refObj(
					item
					, "uuid", "name", "desc", "hits", "zone"
					, "type" , "date_modified", "date_createod"
					, "history", "tags", "related", "draft"
					, "public"
				);

				saneData.author = item.author ? item.author.profile.display_name : null;

				output.push( saneData );
			}

			callback( this.App.JsonSuccess( output ) );
		} )
			.populate( "author" )
			.skip( skip ).limit( limit );
	}

	Publish( postdata, callback )
	{
		this.__validate( postdata, "uuid", "access_token", "public" );

		this.__edit( postdata.uuid, postdata.access_token, ( data ) => {

			data.public = postdata.public;
			data.draft = false;

			data.save( ( e ) => {
				if( this.__dbErr( e, callback ) ) return;
				callback( this.App.JsonSuccess() );
			} );

		}, callback );
	}

	Download( postdata, callback )
	{
		this.__validate( postdata, "uuid" );

		var criteria = { uuid: postdata.uuid };
		this.__privateAccess( postdata, criteria );

		this.__get(
			criteria, { data: true }
			, ( e ) => {
				callback( this.App.JsonSuccess( e.data.toString( "utf8" ) ) );
			}
			, callback
		);
	}

	Remove( postdata, callback )
	{
		this.__validate( postdata, "uuid", "access_token" );

		Model.Script.findOne(
			{ uuid: postdata.uuid }, { access_token: true }, ( e, data ) => {
				if( this.__dbErr( e, callback ) ) return;

				if( !data )
				{
					callback( this.App.JsonError( Locale.ScriptMananger.NO_SUCH_SCRIPT, uuid ) );
					return;
				}

				if( data.access_token != postdata.access_token )
				{
					callback( this.App.JsonError( Locale.ScriptMananger.ACCESS_DENIED ) );
					return;
				}

				data.remove( ( e ) => {
					if( this.__dbErr( e, callback ) ) return;
					callback( this.App.JsonSuccess() );
				} );
			}
		);
	}

	__in( postdata, criteria, ...fields )
	{
		for( let field of fields )
		{
			if( postdata[ field ] )
				criteria[ field ] = { $in: postdata[ field ].split( "\n" ) };
		}
	}

	__stringSearch( postdata, criteria, ...fields )
	{
		try
		{
			for( let field of fields )
			{
				if( postdata[ field ] )
					criteria[ field ] = new RegExp( postdata[ field ], "g" );
			}
		}
		catch( ex )
		{
			throw this.App.JsonError( ex.message );
		}
	}

	__privateAccess( postdata, criteria )
	{
		if( postdata.access_token )
		{
			criteria.$or = [
				{ access_token: postdata.access_token }
				, { public: true, draft: false, enable: true }
			];
		}
		else
		{
			criteria.public = true;
			criteria.draft = false;
			criteria.enable = true;
		}
	}

	__get( criteria, fields, getCallback, callback )
	{
		Model.Script.findOne(
			criteria, fields, ( e, data ) => {
				if( this.__dbErr( e, callback ) ) return;

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
				if( this.__dbErr( e, callback ) ) return;

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
					if( this.__dbErr( e, callback ) ) return;
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

	__dbErr( err, callback )
	{
		if( err )
		{
			Dragonfly.Error( err );
			callback( this.App.JsonError( Locale.System.DATABASE_ERROR ) );
			return true;
		}

		return false;
	}
}

module.exports = ScriptMananger;
