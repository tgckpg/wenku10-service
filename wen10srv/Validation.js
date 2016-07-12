"use strict";

const cl = global.botanLoader;
const Locale = cl.load( "botansx.modular.localization" );

class ValidationError
{
	constructor( message, ...params )
	{
		this.message = message || Locale.Validation.ERROR;
		this.params = params;
	}
}

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
			throw new ValidationError( Locale.INVALID_PARAM.INVALID_PARAM, "Password", pass );

		if( pass.length < 8 )
			throw new ValidationError( Locale.Validation.PASS_TOO_SHORT, 8 );

		if( pass.replace( "12345678", "" ).length < 4
			|| pass.replace( pass[0], "" ).length < 3 )
			throw new ValidationError( Locale.Validation.PASS_IS_A_JOKE );
	}
}

Validation.ValidationError = ValidationError;

module.exports = Validation;
