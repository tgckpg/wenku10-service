"use strict";

const cl = global.botanLoader;
const Locale = cl.load( "botansx.modular.localization" );

const ObjectId = require( "mongoose" ).Types.ObjectId;

class ValidationError
{
	constructor( message, ...params )
	{
		this.message = message || Locale.Validation.ERROR;
		this.params = params;
	}
}

var EmailRe = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

class Validation
{
	static NOT_EMPTY( data, ...fields )
	{
		for( let i of fields )
		{
			if( data[ i ] == undefined )
				throw new ValidationError( Locale.Validation.MISSING_PARAM, i );

			if(!( Array.isArray( data[i] ) ? data[i].length : data[i].trim() ))
				throw new ValidationError( Locale.Validation.CANNOT_BE_EMPTY, i );
		}
	}

	static PASSWD( pass )
	{
		if( Array.isArray( pass ) )
			throw new ValidationError( Locale.Validation.INVALID_PARAM, "Password", pass );

		if( pass.length < 8 )
			throw new ValidationError( Locale.Validation.PASS_TOO_SHORT, 8 );

		if( pass.replace( "12345678", "" ).length < 4
			|| pass.replace( pass[0], "" ).length < 3 )
			throw new ValidationError( Locale.Validation.PASS_IS_A_JOKE );
	}

	static EMAIL( email )
	{
		if( !EmailRe.test( email ) )
			throw new ValidationError( Locale.Validation.INVALID_EMAIL );
	}

	static OBJECT_ID( id )
	{
		if( !ObjectId.isValid( id ) )
			throw new ValidationError( Locale.Error.INVALID_PARM, "id", postdata.id );
	}

	static APPVER( ver )
	{
		if( Array.isArray( ver ) )
		{
			for( let v of ver )
				Validation.APPVER( v );
			return;
		}

		var v = ver.split( "." );
		if( !~"pbtd".indexOf( ver.substr( -1 ) )
			|| Number.isNaN( Number( v[0] ) )
			|| Number.isNaN( Number( v[1] ) )
			|| Number.isNaN( Number( v[2].substr( 0, v[2].length - 1 ) ) )
		) throw new ValidationError( Locale.Error.INVALID_VERSION, ver );
	}
}

Validation.ValidationError = ValidationError;

module.exports = Validation;
