"use strict";

const cl = global.botanLoader;
const Dragonfly = global.Dragonfly;

const Base = cl.load( "botanss.net.PostFrame" );

const Locale = cl.load( "botansx.modular.localization" );
const JsonProto = cl.load( "wen10srv.proto.json" );

const UserControl = cl.load( "wen10srv.sitectrl.user" );
const MAuth = cl.load( "wen10srv.Auth" );
const Validation = cl.load( "wen10srv.Validation" );
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
				Dragonfly.Info(
					( this.HTTP.request.raw.headers[ "x-forwarded-for" ] || this.HTTP.request.remoteAddr )
					+ " POST: " + e.Data.action
					+ " - " + this.HTTP.request.raw.headers["user-agent"]
					, Dragonfly.Visibility.VISIBLE
				);

				// Auth Scope
				switch( e.Data.action )
				{
					case "session-valid":
						Render( new JsonProto( null, this.Auth.LoggedIn, "OK" ) );
						return;

					case "login":
						Validation.NOT_EMPTY( e.Data, "user", "passwd" );
						this.Auth.Authenticate( e.Data.user, e.Data.passwd, Render );
						return;

					case "edit-profile":
						this.Auth.UpdateProfile( e.Data, Render );
						return;

					case "my-profile":
						this.Auth.MyProfile( Render );
						return;

					case "logout":
						this.Auth.DeAuth( Render );
						return;

					case "register":
						Validation.NOT_EMPTY( e.Data, "user", "passwd", "email" );
						Validation.PASSWD( e.Data.passwd );
						Validation.EMAIL( e.Data.email );
						this.Auth.Register( e.Data.user, e.Data.passwd, e.Data.email, Render );
						return;

					case "passwd":
						Validation.NOT_EMPTY( e.Data, "curr", "new" );
						Validation.PASSWD( e.Data.new );
						this.Auth.ChangePasswd( e.Data.curr, e.Data.new, Render );
						return;
				}

				// ScriptManager Scope
				var mgr = new ScriptManager( this );
				switch( e.Data.action )
				{
					case "comment"               : mgr.Comment( e.Data, Render ); return;
					case "get-comment"           : mgr.GetComments( e.Data, Render, 3 ); return;
					case "search"                : mgr.Search( e.Data, Render ); return;
					case "place-request"         : mgr.PlaceRequest( e.Data, Render ); return;
					case "grant-request"         : mgr.GrantRequest( e.Data, Render ); return;
					case "get-requests"          : mgr.GetRequests( e.Data, Render ); return;
					case "my-requests"           : mgr.MyRequests( e.Data, Render ); return;
					case "clear-grant-records"   : mgr.ClearGrantRecords( e.Data, Render ); return;
					case "withdraw-request"      : mgr.WithdrawRequest( e.Data, Render ); return;
					case "status-report"         : mgr.PushStatus( e.Data, Render ); return;
					case "reserve-uuid"          : mgr.ReserveUuid( e.Data, Render ); return;
					case "upload"                : mgr.Upload( e.Data, Render ); return;
					case "download"              : mgr.Download( e.Data, Render ); return;
					case "remove"                : mgr.Remove( e.Data, Render ); return;
					case "publish"               : mgr.Publish( e.Data, Render ); return;

					default:
						throw this.JsonError( Locale.Error.NO_SUCH_ACTION, e.Data.action );
				}
			}
			catch( e )
			{
				switch( e.constructor )
				{
					case JsonProto:
						this.result = e;
						break;
					case Validation.ValidationError:
						this.result = this.JsonError( e.message, e.params );
						break;
					default:
						this.result = new JsonProto( null, false, e.message );
				}

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
