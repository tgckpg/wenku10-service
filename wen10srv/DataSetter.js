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

	static CompatVer( item, ver )
	{
		if( Array.isArray( ver ) )
		{
			for( let v of ver )
				DataSetter.CompatVer( item, v );
			return;
		}

		var v = ver.split( "." );
		var ch = ver.substr( -1 );

		// Debug == Testing
		item[ ch == "d" ? "t" : ch ] = {
			m: Number( v[0] )
			, n: Number( v[1] )
			, r: Number( v[2].substr( 0, v[2].length - 1 ) )
		}
	}

}

module.exports = DataSetter;
