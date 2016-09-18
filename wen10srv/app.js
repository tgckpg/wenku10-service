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
			Dragonfly.Info(
				( this.HTTP.request.raw.headers[ "x-forwarded-for" ] || this.HTTP.request.remoteAddr )
				+ " GET: " + this.HTTP.request.uri.path
				+ " - " + this.HTTP.request.raw.headers["user-agent"]
				, Dragonfly.Visibility.VISIBLE
			);

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

		var postData = e.Data;

		this.Control = new UserControl( this );
		this.Auth = new MAuth( this );
		this.Lang = postData.lang || this.Lang;

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
					+ " POST: " + postData.action
					+ " - " + this.HTTP.request.raw.headers["user-agent"]
					, Dragonfly.Visibility.VISIBLE
				);

				if( !postData.ver ) postData.ver = "1.0.0p";

				Validation.APPVER( postData.ver );

				// Auth Scope
				switch( postData.action )
				{
					case "session-valid":
						Render( new JsonProto( null, this.Auth.LoggedIn, "OK" ) );
						return;

					case "login":
						Validation.NOT_EMPTY( postData, "user", "passwd" );
						this.Auth.Authenticate( postData.user, postData.passwd, Render );
						return;

					case "edit-profile":
						this.Auth.UpdateProfile( postData, Render );
						return;

					case "my-profile":
						this.Auth.MyProfile( Render );
						return;

					case "logout":
						this.Auth.DeAuth( Render );
						return;

					case "register":
						Validation.NOT_EMPTY( postData, "user", "passwd", "email" );
						Validation.PASSWD( postData.passwd );
						Validation.EMAIL( postData.email );
						this.Auth.Register( postData.user, postData.passwd, postData.email, Render );
						return;

					case "passwd":
						Validation.NOT_EMPTY( postData, "curr", "new" );
						Validation.PASSWD( postData.new );
						this.Auth.ChangePasswd( postData.curr, postData.new, Render );
						return;
				}

				// ScriptManager Scope
				var mgr = new ScriptManager( this );
				switch( postData.action )
				{
					case "comment"               : mgr.Comment( postData, Render ); return;
					case "get-comment"           : mgr.GetComments( postData, Render, 3 ); return;
					case "get-comment-stack"     : mgr.GetCommentStack( postData, Render ); return;
					case "search"                : mgr.Search( postData, Render ); return;
					case "place-request"         : mgr.PlaceRequest( postData, Render ); return;
					case "grant-request"         : mgr.GrantRequest( postData, Render ); return;
					case "get-requests"          : mgr.GetRequests( postData, Render ); return;
					case "my-requests"           : mgr.MyRequests( postData, Render ); return;
					case "my-inbox"              : mgr.MyInbox( postData, Render ); return;
					case "mesg-read"             : mgr.MessageRead( postData, Render ); return;
					case "clear-grant-records"   : mgr.ClearGrantRecords( postData, Render ); return;
					case "withdraw-request"      : mgr.WithdrawRequest( postData, Render ); return;
					case "status-report"         : mgr.PushStatus( postData, Render ); return;
					case "reserve-uuid"          : mgr.ReserveUuid( postData, Render ); return;
					case "upload"                : mgr.Upload( postData, Render ); return;
					case "download"              : mgr.Download( postData, Render ); return;
					case "remove"                : mgr.Remove( postData, Render ); return;
					case "publish"               : mgr.Publish( postData, Render ); return;

					default:
						throw this.JsonError( Locale.Error.NO_SUCH_ACTION, postData.action );
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
