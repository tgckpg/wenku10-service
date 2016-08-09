"use strict";

var cl = global.botanLoader;

var model = cl.load( "wen10srv.schema" );
var NotisM = model.Notification;

class NotisBase
{
	constructor( user )
	{
		this.__user = user;
		this.__inbox = null;
	}

	Subscribe( handler )
	{
		this.SaveInbox( handler );
	}

	Unsubscribe( handler )
	{
		this.RemoveInbox( handler );
	}

	SaveInbox( handler )
	{
		var user = this.__user;

		if( this.Count == -1 )
		{
			this.Inbox.save( () => {
				user.nsubs.push( this.Inbox );
				user.save( handler );
			} );
		}
		else
		{
			this.Inbox.save( handler );
		}
	}

	RemoveInbox( handler )
	{
		for( let s in this.__user.nsubs )
		{
			let inb = this.__user.nsubs[ s ];

			if( inb.type == this.constructor.ID )
			{
				inb.remove( () => {} );
				delete this.__user.nsubs[ s ];
			}
		}

		this.__user.save( handler );
	}

	get Inbox()
	{
		if( this.__inbox ) return this.__inbox;

		for( let sub of this.__user.nsubs )
		{
			if( sub.type == this.constructor.ID )
			{
				return this.__inbox = sub;
			}
		}

		// New Inbox
		this.__inbox = new NotisM({
			type: this.constructor.ID
		});

		return this.__inbox;
	}

	IsSubscribed()
	{
		return this.Count != -1;
	}

	get Count()
	{
		var i = 0;
		var j = -1;

		for( let s of this.__user.nsubs )
		{
			if( s.type == this.constructor.ID )
			{
				j ++;
				i += s.inbox.length;
			}
		}

		// Return -1 if didn't subscribed to this type
		if( j == -1 ) i = j;

		return i;
	}

	Dispatch(){}
	Read(){}
	get Messages(){ return [{ "mesg": "NOT_IMPL: " + this.constructor.name }]; }

	static get ID() { return 0; }
	static get Name() { return "NotificationBase"; }
};

module.exports = NotisBase;
