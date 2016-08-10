"use strict";

var cl = global.botanLoader;
var Dragonfly = global.Dragonfly;

var util = require( "util" );
var Base = cl.load( "wen10srv.modular.notifications.subboxnotis" );

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

		var Commenter = Comment.author.profile.display_name

		var Their = ( Script.author.id == this.__user.id )
			? "your"
			: Script.author.profile.display_name + "'s"
			;

		var mesg = Commenter + " has commented on " + Their + " script";

		super.Dispatch( Script.uuid, mesg, "COMM," + Script.uuid + "," + Comment.id );
	}
}

module.exports = UserComment;
