"use strict";

const cl = global.botanLoader;
const Dragonfly = global.Dragonfly;

const bcrypt = require( "bcryptjs" );

const Model = cl.load( "wen10srv.schema" );
const JsonProto = cl.load( "wen10srv.proto.json" );
const Locale = cl.load( "botansx.modular.localization" );
const UserControl = cl.load( "wen10srv.sitectrl.user" );

class Auth
{
	constructor( App )
	{
		this.App = App;
		this.Control = new UserControl( App );
		this.cookie = App.HTTP.response.cookie;
	}

	get LoggedIn() { return this.Control.LoggedIn; }

	Authenticate( username, password, callback )
	{
		if( this.LoggedIn )
		{
			callback( this.App.JsonError( Locale.Auth.ALREADY_LOGGED_IN ) );
			return;
		}

		var session = this.Control.session;

		Model.User.findOne({ name: username }).exec(
			( err, data ) => {
				if( err )
				{
					Dragonfly.Error( err );
					callback(
						this.App.JsonError( Locale.System.DATABASE_ERROR )
					);
					return;
				}

				if( !data )
				{
					callback(
						this.App.JsonError( Locale.Auth.AUTH_FAILED )
					);

					return;
				}

				if( bcrypt.compareSync( password, data.password ) )
				{
					session.set( "LoggedIn", true );
					session.set( "user.id", data.id );

					this.Control.session.once( "set", () => {
						this.cookie.set( "Path", "/" );
						this.cookie.seth( "sid", session.id );
						callback( this.App.JsonSuccess() );
					} );
				}
				else
				{
					callback(
						this.App.JsonError( Locale.Auth.AUTH_FAILED )
					);
				}
			}
		);
	}

	DeAuth( callback )
	{
		if( this.LoggedIn )
		{
			this.Control.session.destroy( () => {
				this.cookie.set( "Path", "/" );
				this.cookie.set( "sid", "" );
				this.cookie.seth( "Expires", "Thu Jan 01 1970 08:00:00 GMT" );

				callback( this.App.JsonSuccess() );

				this.Control.LoggedIn = false;
			} );
		}
		else
		{
			callback( this.App.JsonError( Locale.Auth.UNAUTHORIZED ) );
		}
	}

	Register( username, password, callback )
	{
		Model.User.findOne({ name: username }).exec(
			( err, data ) => {
				if( err )
				{
					Dragonfly.Error( err );
					callback(
						this.App.JsonError( Locale.System.DATABASE_ERROR )
					);
					return;
				}

				if( data )
				{
					callback(
						this.App.JsonError( Locale.Auth.USER_EXISTS )
					);
					return;
				}

				var User = new Model.User();
				User.name = username;
				User.password = bcrypt.hashSync( password ).replace( /^\$2a/, "$2y" );
				User.profile.display_name = User.name;

				User.save( ( e ) => {
					if( e )
					{
						Dragonfly.Error( e );
						callback( new JsonProto( null, false, e ) );
					}
					else callback( this.App.JsonSuccess() );
				} );
			}
		);
	}
}


module.exports = Auth;
