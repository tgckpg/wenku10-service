"use strict";

var cl = global.botanLoader;
var Dragonfly = global.Dragonfly;

var util = require( "util" );
var events = require( "events" );

var model = cl.load( "wen10srv.schema" );
var UserModel = model.User;

class NotificationCenter
{
	GetTypes()
	{
		return (function*()
		{
			yield cl.load( "wen10srv.modular.notifications.commentreply" );
			yield cl.load( "wen10srv.modular.notifications.usercomment" );
		})();
	}

	constructor()
	{
	}

	GetSubs( user, type, handler )
	{
		var c = arguments.length;

		if( c == 2 )
		{
			return this.GetSubs( user, undefined, type );
		}
		else if( c < 2 )
		{
			throw new Error( "Invalid arguments" );
		}

		UserModel.populate(
			user, { path: "nsubs" }, ( err, user ) =>
		{
			if( err )
			{
				Dragonfly.Error( err );
				handler( err, user );
				return;
			}

			var Types = this.GetTypes();

			if( type )
			{
				Types = ( function*(){ yield type; } )();
			}

			var summary = {};

			for( let INotis of Types )
			{
				let n = new INotis( user );
				let TypeSum = { "name": INotis.Name, "type": INotis.ID };
				if( -1 < n.Count ) TypeSum[ "count" ] = n.Count;

				summary[ INotis.ID ] = TypeSum;
			}

			handler( undefined, summary );
		});
	}

	Unsubscribe( user, TypeId, CarrierId, handler )
	{
		UserModel.populate(
			user, { path: "nsubs" }, ( err, user ) =>
		{
			var found = false;

			for( let INotis of this.GetTypes() )
			{
				if( !TypeId || INotis.ID == TypeId )
				{
					found = true;
					let N = new INotis( user );
					N.Unsubscribe( CarrierId, handler );
					break;
				}
			}

			// Error passes true
			if( !found ) handler( true, null );
		} );

	}

	Subscribe( user, TypeId, CarrierId, handler )
	{
		UserModel.populate(
			user, { path: "nsubs" }, ( err, user ) =>
		{
			var found = false;

			for( let INotis of this.GetTypes() )
			{
				if( INotis.ID == TypeId )
				{
					found = true;
					let N = new INotis( user );
					N.Subscribe( CarrierId, handler );
					break;
				}
			}

			// Error passes true
			if( !found ) handler( false );
		} );
	}

	NotisList( user, handler )
	{
		UserModel.populate(
			user, { path: "nsubs" }, ( err, user ) =>
		{
			var AllMessage = [];

			for( let INotis of this.GetTypes() )
			{
				let N = new INotis( user );

				if( N.Messages.length )
				{
					Array.prototype.push.apply( AllMessage, N.Messages );
				}
			}

			handler( err, AllMessage );
		} );
	}

	Read( user, uuid, handler )
	{
		UserModel.populate(
			user, { path: "nsubs" }, ( err, user ) =>
		{
			for( let INotis of this.GetTypes() )
			{
				new INotis( user ).Read( uuid );
			}

			handler();
		} );
	}

	Dispatch( INotis, args )
	{
		UserModel
			.find({ active: true })
			.populate( "nsubs" )
		.exec( ( err, data ) => {

			if( err )
			{
				Dragonfly.Error( err );
				return;
			}

			for( let user of data )
			{
				let N = new INotis( user );
				INotis.prototype.Dispatch.apply( N, args );
			}

		} );
	}

	GetNotis( user, TypeId, handler )
	{
		var found = false;
		UserModel.populate(
			user, { path: "nsubs" }, ( err, user ) =>
		{

			for( let INotis of this.GetTypes() )
			{
				if( INotis.ID == TypeId )
				{
					found = true;
					handler( undefined, new INotis( user ) );
				}
			}

			if( !found ) handler( true, null );
		} );
	}
}

module.exports = NotificationCenter;
