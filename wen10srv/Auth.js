"use strict";

const cl = global.botanLoader;
const Dragonfly = global.Dragonfly;

const bcrypt = require( "bcryptjs" );

const Model = cl.load( "wen10srv.schema" );
const Validation = cl.load( "wen10srv.Validation" );
const Locale = cl.load( "botansx.modular.localization" );

class Auth
{
	constructor( App )
	{
		this.App = App;
		this.Control = App.Control;
		this.cookie = App.HTTP.response.cookie;
	}

	get user() { return this.Control.user; }
	get LoggedIn() { return this.Control.LoggedIn; }

	UpdateProfile( postdata, callback )
	{
		if( !this.LoggedIn )
		{
			callback( this.App.JsonError( Locale.Error.ACCESS_DENIED ) );
			return;
		}

		Validation.NOT_EMPTY( postdata, "display_name" );

		var session = this.Control.session;
		Model.User.findById( session.get( "user.id" ) ).exec(
			( err, data ) => {
				if( this.__dbErr( err, callback ) ) return;

				data.profile.display_name = postdata.display_name;
				data.save( ( sErr ) => {
					if( this.__dbErr( sErr, callback ) ) return;
					callback( this.App.JsonSuccess() );
				});
			}
		);
	}

	MyProfile( callback )
	{
		if( !this.LoggedIn )
		{
			callback( this.App.JsonError( Locale.Error.ACCESS_DENIED ) );
			return;
		}

		var session = this.Control.session;
		Model.User.findById( session.get( "user.id" ) ).exec(
			( err, data ) => {
				if( this.__dbErr( err, callback ) ) return;

				data.save( ( sErr ) => {
					if( this.__dbErr( sErr, callback ) ) return;
					callback( this.App.JsonSuccess( data.profile ) );
				});
			}
		);
	}

	Authenticate( username, password, callback )
	{
		if( this.LoggedIn )
		{
			callback( this.App.JsonError( Locale.Auth.ALREADY_LOGGED_IN ) );
			return;
		}

		var session = this.Control.session;
		var LoginName = username.trim().toUpperCase();

		Model.User.findOne({ name: LoginName }).exec(
			( err, data ) => {
				if( this.__dbErr( err, callback ) ) return;

				if( data && bcrypt.compareSync( password, data.password ) )
				{
					session.spawn( undefined, ( e ) => {
						if( e )
						{
							Dragonfly.Error( e );
							callback( this.App.JsonError( Locale.Error.SESS_DATA_FAILED ) );
							return;
						}
						session.set( "LoggedIn", true );
						session.set( "user.id", data.id );
						session.set( "user.nickname", data.profile.display_name );

						session.once( "set", () => {
							this.cookie.set( "Path", "/" );
							this.cookie.seth( "sid", session.id );
							callback( this.App.JsonSuccess() );
						} );

						data.last_login = Date.now();
						data.save();
					} );
				}
				else
				{
					callback( this.App.JsonError( Locale.Auth.AUTH_FAILED ) );
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
			callback( this.App.JsonError( Locale.Error.ACCESS_DENIED ) );
		}
	}

	ChangePasswd( currPasswd, newPasswd, callback )
	{
		if( !this.LoggedIn )
		{
			throw this.App.JsonError( Locale.Error.ACCESS_DENIED );
		}

		if(!( currPasswd && newPasswd ))
		{
			throw new Error( "INTERNAL: Passwords cannot be empty" );
		}

		var session = this.Control.session;

		Model.User.findById( session.get( "user.id" ) ).exec(
			( err, data ) => {
				if( this.__dbErr( err, callback ) ) return;

				if( data && bcrypt.compareSync( currPasswd, data.password ) )
				{
					data.password =  bcrypt.hashSync( newPasswd ).replace( /^\$2a/, "$2y" );
					data.save( ( sErr ) => {
						if( this.__dbErr( sErr, callback ) ) return;
						callback( this.App.JsonSuccess() );
					});
				}
				else
				{
					callback( this.App.JsonError( Locale.Auth.AUTH_FAILED ) );
				}
			}
		);
	}

	Register( username, password, email, callback )
	{
		var LoginName = username.trim().toUpperCase();
		Model.User.findOne({ name: LoginName }).exec(
			( err, data ) => {
				if( this.__dbErr( err, callback ) ) return;

				if( data )
				{
					callback( this.App.JsonError( Locale.Auth.USER_EXISTS ) );
					return;
				}

				var User = new Model.User();
				User.name = LoginName;
				User.password = bcrypt.hashSync( password ).replace( /^\$2a/, "$2y" );
				User.email = email;
				User.profile.display_name = username.trim();
				User.lang = this.App.Lang;

				User.save( ( sErr ) => {
					if( this.__dbErr( sErr, callback ) ) return;
					callback( this.App.JsonSuccess() );
				} );
			}
		);
	}

	__dbErr( err, callback )
	{
		if( err )
		{
			Dragonfly.Error( err );
			callback( this.App.JsonError( Locale.System.DATABASE_ERROR ) );
			return true;
		}

		return false;
	}
}

module.exports = Auth;
