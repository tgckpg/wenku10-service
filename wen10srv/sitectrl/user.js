const cl = global.botanLoader;

const Models = cl.load( "wen10srv.schema" );
const Infrastructure = cl.load( "botansx.modular.infrastructure" );
const Utils = cl.load( "botansx.utils.loader" );

class UserControls extends Infrastructure
{
	constructor( App )
	{
		super();
		this.App = App;
		var utils = new Utils();
		utils.use( "hash" );

		var Request = App.HTTP.request;
		var sessid = Request.cookie.get( "sid" );
		var clientId = utils.md5(
			Request.raw.headers[ "x-forwarded-for" ] + Request.remoteAddr
		);

		this.session = this.callAPI( "botansx.modular.session", sessid, clientId );
		this.utils = utils;
		this.LoggedIn = false;
	}

	Run( callback )
	{
		this.Ready( () => {
			if( this.session.get( "LoggedIn" ) )
			{
				// Check database user exists
				Models.User.findById( this.session.get( "user.id" ) )
				.exec(
					( err, data ) => {
						if( !data )
						{
							this.session.destroy();
							this.LoggedIn = false;
						}
						else
						{
							this.LoggedIn = true;
							this.user = data;
						}

						callback();

						data.last_login = Date.now();
						data.save();
					}
				);
			}
			else callback();
		} );
	}
}

module.exports = UserControls;
