"use strict";

var cl = global.botanLoader;
var Dragonfly = global.Dragonfly;

var Base = cl.load( "botanss.net.PostFrame" );

class App extends Base
{
	constructor( Http )
	{
		super( Http );

		// Everything here is plain text
		this.HTTP.response.headers[ "Content-Type" ] = "text/plain; charset=utf-8";

		this.result = "Hello there:)";

		if( !this.HTTP.request.isPost )
		{
			if( this.HTTP.request.uri.path != "/" )
			{
				this.result = "Hi :P";
				this.HTTP.response.statusCode = 404;
			}

			this.plantResult();
			return;
		}

		this.addListener( "PostRequest", this.PostRequest );
	}

	PostRequest( sender, e )
	{
		e.Handled = true;
		this.plantResult();
	}

}

module.exports = App;
