"use strict";

var cl = global.botanLoader;
var Dragonfly = global.Dragonfly;

var util = require( "util" );
var Base = cl.load( "wen10srv.modular.notifications.notisbase" );
var utils = cl.load( "botansx.utils.random" );

class SubInboxNotis extends Base
{
	constructor( user )
	{
		super( user );
	}

	Unsubscribe( id, handler )
	{
		if( id )
		{
			this.Inbox.update( { $set: {
				"inbox" : this.Inbox.inbox.filter( x => x.id != id )
			} }, handler );
		}
		else
		{
			super.Unsubscribe( handler );
		}
	}

	Subscribe( id, handler )
	{
		if( id )
		{
			for( let subbox of this.Inbox.inbox )
			{
				// Already subscribed
				if( subbox.id == id )
				{
					handler( undefined, this.Inbox );
					return;
				}
			}

			this.Inbox.inbox.push({ "id": id, "message": [] });
		}

		super.Subscribe( handler );
	}

	IsSubscribed( TargetId )
	{
		if( TargetId == undefined ) return super.IsSubscribed();
		return this.Inbox.inbox.some( x => x.id == TargetId );
	}

	get Count()
	{
		if( super.Count == -1 ) return -1;
		var i = 0;

		for( let s of this.Inbox.inbox )
		{
			i ++;
		}

		return i;
	}

	Dispatch( TargetId, Message, Link )
	{
		var Candidate = this.__user.profile.display_name;

		if( !this.IsSubscribed( TargetId ) )
		{
			Dragonfly.Debug( Candidate + " didn't subscribe to this message" );
			return;
		}

		var Subbox = this.Inbox.inbox.find( x => x.id == TargetId );

		Subbox.message.push({ "id": utils.uuid(), "mesg": Message, "link": Link, "date": new Date() });

		this.Inbox.update( { $set: {
			"inbox" : this.Inbox.inbox
		} }, ( err, data ) => {
			if( err )
			{
				Dragonfly.Error( "Failed to dispatch notification to " + Candidate );
				return;
			}

			Dragonfly.Debug( "Notification dispatched to " + Candidate );
		} );
	}

	Read( uuid )
	{
		// Checks all inbox for this uuid
		// If everything is unchanged, do nothing
		if( this.Inbox.inbox.every( x => {

			let fmessage = x.message.filter( y => y.id != uuid );

			// Unchanged
			if( fmessage.length == x.message.length )
				return true;

			// Something was changed
			x.message = fmessage;
			return false;

		} ) ) return;

		this.Inbox.update( { $set: {
			"inbox" : this.Inbox.inbox
		} }, ( err, data ) => Dragonfly.Info( data ) );
	}

	get Messages()
	{
		var mesgs = [];
		for( let subbox of this.Inbox.inbox )
		{
			Array.prototype.push.apply( mesgs, subbox.message );
		}

		return mesgs;
	}
}

module.exports = SubInboxNotis;
