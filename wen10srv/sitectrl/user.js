const cl = global.botanLoader;

const Models = cl.load( "wen10srv.schema" );
const Infrastructure = cl.load( "botansx.modular.infrastructure" );

class UserControls extends Infrastructure
{
	constructor()
	{
		super();
		this.__session = this.callAPI( "botansx.modular.session" );
		this.LoggedIn = false;
	}

	Run( callback )
	{
		this.Ready( () => {
			if( this.__session.get( "LoggedIn" ) )
			{
				// Check database user exists
				Models.User.findById( session.get( "user.id" ) )
				.exec(
					( err, data ) => {
						if( !data )
						{
							this.__session.destroy();
							this.LoggedIn = false;
						}
						else
						{
							this.LoggedIn = true;
							this.user = data;
						}

						callback();
					}
				);
			}
			else callback();
		} );
	}
}

module.exports = UserControls;
