"use strict";

const cl = global.botanLoader;
const Dragonfly = global.Dragonfly;

const Base = cl.load( "wen10srv.modular.notifications.subboxnotis" );

const Locale = cl.load( "botansx.modular.localization" );

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

		var lang = this.__user.lang;
		var StackAuthor = CommentStack.author;

		var Their = StackAuthor.id == this.__user.id
			? Locale.Notis.YOUR( lang )
			: Locale.Notis.POSSESSIVE( lang ).L( StackAuthor.profile.display_name );

		var Commenter = Comment.author.profile.display_name;
		var mesg = Locale.Notis.COMMENT_REPLY( lang ).L( Commenter, Their );

		super.Dispatch( CommentStack.id, mesg, "COMM," + CommentStack.ref_script.uuid + "," +  CommentStack.id );
	}
}

module.exports = CommentReply;
