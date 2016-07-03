"use strict";

const cl = global.botanLoader;
const Dragonfly = global.Dragonfly;

const Base = cl.load( "botanss.net.PostFrame" );
const JsonProto = cl.load( "wen10srv.proto.json" );
const MAuth = cl.load( "wen10srv.Auth" );
const Locale = cl.load( "botansx.modular.localization" );
const ScriptManager = cl.load( "wen10srv.ScriptManager" );
const UserControl = cl.load( "wen10srv.sitectrl.user" );

class App extends Base
{
	constructor( Http )
	{
		super( Http );

		// Set language
		this.Lang = "en-US";

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

		this.Control = new UserControl( this );
		this.Auth = new MAuth( this );
		this.Lang = e.Data.lang || this.Lang;

		var Ready = () => {
			this.HTTP.response.headers[ "Content-Type" ] = "application/json";

			var Render = ( Json ) => {
				this.result = Json;
				this.plantResult();
			};

			try
			{
				switch( e.Data.action )
				{
					case "login":
						this.Auth.Authenticate( e.Data.user, e.Data.passwd, Render );
						break;

					case "logout":
						this.Auth.DeAuth( Render );
						break;

					case "register":
						this.Auth.Register( e.Data.user, e.Data.passwd, Render );
						break;

					case "comment":
						break;

					case "list":
						break;

					case "reserve-uuid":
						var smgr = new ScriptManager( this );
						smgr.ReserveUuid( e.Data, Render );
						break;

					case "upload":
						var smgr = new ScriptManager( this );
						smgr.Upload( e.Data, Render );
						break;

					case "download":
						var smgr = new ScriptManager( this );
						smgr.Download( e.Data, Render );
						break;

					default:
						throw this.JsonError( Locale.Error.NO_SUCH_ACTION, e.Data.action );
				}
			}
			catch( e )
			{
				this.result = ( e.constructor == JsonProto )
					? e
					: new JsonProto( null, false, e.message );

				this.plantResult();
			}
		};

		this.Control.Run( Ready );
	}

	JsonError( message, ...args )
	{
		return new JsonProto( null, false, message( this.Lang ).L( ...args ) );
	}

	JsonSuccess( data )
	{
		return new JsonProto( data, true, "OK" );
	}
}

module.exports = App;
