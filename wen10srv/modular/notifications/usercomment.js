"use strict";

const cl = global.botanLoader;
const Dragonfly = global.Dragonfly;

const Base = cl.load( "wen10srv.modular.notifications.subboxnotis" );

const Locale = cl.load( "botansx.modular.localization" );

class UserComment extends Base
{
	static get ID() { return 8; }
	static get Name() { return "User Comment"; }

	Dispatch( Script, Comment )
	{
		// Do not put a notification to oneself
		if( this.__user.id == Comment.author.id )
		{
			Dragonfly.Debug( "Comment belongs to the commenter, doing nothing" );
			return;
		}

		var lang = this.__user.lang;
		var Commenter = Comment.author.profile.display_name

		var Their = ( Script.author.id == this.__user.id )
			? Locale.Notis.YOUR( lang )
			: Locale.Notis.POSSESSIVE( lang ).L( Script.author.profile.display_name );
			;

		var mesg = Locale.Notis.USER_COMMENT( lang ).L( Commenter, Their );

		super.Dispatch( Script.uuid, mesg, "COMM," + Script.uuid + "," + Comment.id );
	}
}

module.exports = UserComment;
