"use strict";

var cl = global.botanLoader;
var Dragonfly = global.Dragonfly;

var util = require( "util" );
var Base = cl.load( "wen10srv.modular.notifications.subboxnotis" );

class CommentReply extends Base
{
	static get ID() { return 4; }
	static get Name() { return "Comment Reply"; }

	Dispatch( CommentStack, Comment )
	{
		// Do not put a notification to oneself
		if( this.__user.id == Comment.author.id )
		{
			Dragonfly.Debug( "The comment is made by this user, doing nothing" );
			return;
		}

		var StackAuthor = CommentStack.author;

		var Their = StackAuthor.id == this.__user.id
			? "your"
			: StackAuthor.profile.display_name + "'s";

		var Commenter = Comment.author.profile.display_name;
		var mesg = Commenter + " has replied to " + Their + " comment";

		super.Dispatch( CommentStack.id, mesg, "COMM," + CommentStack.ref_script + "," +  CommentStack.id );
	}
}

module.exports = CommentReply;
