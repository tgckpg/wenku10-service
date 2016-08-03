"use strict";

class DataSetter
{
	static ArrayData( item, postdata, ...args )
	{
		for( let arg of args )
		{
			var v = postdata[ arg ];
			if( !v ) continue;

			item[ arg ] = ( Array.isArray( v ) ? v : v.split( "\n" ) ).map( Function.prototype.call, String.prototype.trim );
		}
	}
}

module.exports = DataSetter;
