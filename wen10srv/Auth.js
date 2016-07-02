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
		this.Control = new UserControl();
	}

	get LoggedIn()
	{
		return this.Control.LoggedIn;
	}

	Authenticate( username, password, callback )
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

				if( !data )
				{
					callback(
						this.App.JsonError( Locale.Auth.AUTH_FAILED )
					);
				}
			}
		);
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
					else callback( new JsonProto );
				} );
			}
		);
	}
}


module.exports = Auth;
