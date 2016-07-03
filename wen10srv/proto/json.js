"use strict";

class Json
{
	constructor( data, status, message )
	{
		this.data = data == undefined ? [] : data;
		this.status = status == undefined ? true : status;
		this.message = message == undefined ? "OK" : message;
	}

	toString()
	{
		return JSON.stringify( {
			data: this.data
			, status: this.status
			, message: this.message
		} );
	}
}

module.exports = Json;
