"use strict";

const cl = global.botanLoader;
const Dragonfly = global.Dragonfly;

const Base = cl.load( "botanss.net.PostFrame" );

const Locale = cl.load( "botansx.modular.localization" );
const JsonProto = cl.load( "wen10srv.proto.json" );

const UserControl = cl.load( "wen10srv.sitectrl.user" );
const MAuth = cl.load( "wen10srv.Auth" );
const ScriptManager = cl.load( "wen10srv.ScriptManager" );

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

					case "passwd":
						this.Auth.ChangePasswd( e.Data.curr, e.Data.new, Render );
						break;

					case "comment":
						break;

					case "search":
						new ScriptManager( this ).Search( e.Data, Render );
						break;

					case "reserve-uuid":
						new ScriptManager( this ).ReserveUuid( e.Data, Render );
						break;

					case "upload":
						new ScriptManager( this ).Upload( e.Data, Render );
						break;

					case "download":
						new ScriptManager( this ).Download( e.Data, Render );
						break;

					case "remove":
						new ScriptManager( this ).Remove( e.Data, Render );
						break;

					case "publish":
						new ScriptManager( this ).Publish( e.Data, Render );
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
