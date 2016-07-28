"use strict";

const cl = global.botanLoader;
const Dragonfly = global.Dragonfly;

const Model = cl.load( "wen10srv.schema" );
const Validation = cl.load( "wen10srv.Validation" );
const DataSetter = cl.load( "wen10srv.DataSetter" );
const Locale = cl.load( "botansx.modular.localization" );

const ObjectId = require( "mongoose" ).Types.ObjectId;

class ScriptManager
{
	constructor( App )
	{
		this.App = App;
		this.utils = this.App.Control.utils;
	}

	/*{{{ Private Actions: Upload / Publish / Remove */
	Upload( postdata, callback )
	{
		Validation.NOT_EMPTY( postdata, "uuid", "access_token", "data", "name", "desc", "zone", "type" );
		Dragonfly.Debug( "Upload: " + postdata.uuid );

		this.__edit( postdata.uuid, postdata.access_token, ( item ) => {
			item.data = new Buffer( postdata.data );
			item.desc = postdata.desc;
			item.name = postdata.name;
			item.enc = ( postdata.enc == "1" );
			item.force_enc = ( postdata.force_enc == "1" );
			item.author = postdata.anon == "1" ? null : this.App.Auth.user;

			DataSetter.ArrayData( item, postdata, "zone", "type", "tags" );

		}, callback );
	}

	Publish( postdata, callback )
	{
		Validation.NOT_EMPTY( postdata, "uuid", "access_token", "public" );

		this.__edit( postdata.uuid, postdata.access_token, ( data ) => {

			data.public = postdata.public;
			data.draft = false;

			data.save( ( e ) => {
				if( this.__dbErr( e, callback ) ) return;
				callback( this.App.JsonSuccess() );
			} );

		}, callback, { public: 1, draft: 1, access_token: 1 } );
	}

	Remove( postdata, callback )
	{
		Validation.NOT_EMPTY( postdata, "uuid", "access_token" );

		Model.Script.findOne(
			{ uuid: postdata.uuid }, { access_token: true }, ( e, data ) => {
				if( this.__dbErr( e, callback ) ) return;

				if( !data )
				{
					callback( this.App.JsonError( Locale.ScriptManager.NO_SUCH_SCRIPT, uuid ) );
					return;
				}

				if( data.access_token != postdata.access_token )
				{
					callback( this.App.JsonError( Locale.Error.ACCESS_DENIED ) );
					return;
				}

				data.remove( ( e ) => {
					if( this.__dbErr( e, callback ) ) return;
					callback( this.App.JsonSuccess() );
				} );
			}
		);
	}
	/* End Private Actions }}}*/

	/*{{{ Public Actions: Reserve / Download / Status Reports */
	ReserveUuid( data, callback )
	{
		Validation.NOT_EMPTY( data, "access_token" );

		this.utils.use( "random" );
		var uuid = this.utils.uuid();

		var ScriptM = new Model.Script();
		ScriptM.uuid = uuid;
		ScriptM.access_token = data.access_token;

		ScriptM.save( ( e ) => {
			if( this.__dbErr( e, callback ) ) return;
			callback( this.App.JsonSuccess( uuid ) );
		} );
	}

	Download( postdata, callback )
	{
		Validation.NOT_EMPTY( postdata, "uuid" );

		var criteria = { uuid: postdata.uuid };
		this.__privateAccess( postdata, criteria );

		this.__get(
			criteria, { data: true, hits: true }
			, ( e ) => {
				callback( this.App.JsonSuccess( e.data.toString( "utf8" ) ) );

				e.hits ++;
				e.save();
			}
			, callback
		);
	}

	PushStatus( postdata, callback )
	{
		Validation.NOT_EMPTY( postdata, "uuid", "type" );

		this.__edit( postdata.uuid, postdata.access_token, ( item ) => {

			var firstItem = item.history[0];
			var Desc =  "\n" + ( postdata.desc || "" ).replace( "\n", " " );

			if( firstItem && firstItem.status == postdata.type )
			{
				firstItem.date = Date.now();
				firstItem.desc = ( firstItem.desc + Desc ).trim();
			}
			else
			{
				item.history.push({
					desc: Desc.trim()
					, status: postdata.type
				});
			}

		}, callback, { history: 1 } );
	}
	/* End Public Actions }}}*/

	/*{{{ Search */
	Search( postdata, callback )
	{
		var criteria = {};
		var fields = {
			comments: false
			, key_requests: false
			, token_requests: false
			, access_token: false
			, data: false };

		this.__privateAccess( postdata, criteria );

		var extract = ( err, items ) => {
			if( this.__dbErr( err, callback ) ) return;

			var output = [];

			this.utils.use( "object" );
			for( let item of items )
			{
				var saneData = this.utils.refObj(
					item
					, "uuid", "name", "desc", "hits", "zone"
					, "type" , "date_modified", "date_created"
					, "history", "tags", "related", "draft"
					, "public", "enc", "force_enc"
				);

				saneData.author = item.author
					? { _id: item.author._id, display_name: item.author.profile.display_name }
					: null;

				output.push( saneData );
			}

			callback( this.App.JsonSuccess( output ) );
		};

		var skip = Math.abs( parseInt( postdata.skip ) || 0 );

		// UUID search should be fast
		if( postdata.uuid )
		{
			// uuid search with skip always yield 0
			if( 0 < skip )
			{
				this.App.JsonSuccess([]);
				return;
			}

			criteria.uuid = postdata.uuid;

			Model.Script.findOne(
				criteria, fields
				, ( e, data ) => extract( e, data ? [ data ] : [] )
			).populate( "author" );
		}
		else
		{
			this.utils.use( "math" );

			var limit = this.utils.clamp( parseInt( postdata.limit ) || 50, 1, 100 );

			this.__stringSearch( postdata, criteria, "name", "desc" );
			this.__in( postdata, criteria, "zone", "type", "tags" );

			Model.Script.find( criteria, fields, extract )
				.populate( "author" )
				.sort({ date_created: -1 })
				.skip( skip ).limit( limit );
		}
	}
	/* End Search }}}*/

	/*{{{ Comments */
	Comment( postdata, callback )
	{
		if( !this.App.Auth.LoggedIn )
			throw this.App.JsonError( Locale.Error.ACCESS_DENIED );

		Validation.NOT_EMPTY( postdata, "id", "target", "content" );

		var crit_id = {};
		var model;
		var target;

		switch( postdata.target )
		{
			case "script":
				model = "Script";
				target = "comments";
				crit_id.uuid = postdata.id;
				break;

			case "comment":
				model = "Comment";
				target = "replies";

				if( !ObjectId.isValid( postdata.id ) )
					throw new this.App.JsonError( Locale.Error.INVALID_PARM, "id", postdata.id );

				crit_id._id = ObjectId( postdata.id );
				break;

			default:
				callback( this.App.JsonError( Locale.Error.NO_SUCH_TARGET, postdata.target ) );
				return;
		}

		Model[ model ].findOne(
				crit_id, { comments: true, replies: true }, ( e, data ) => {
				if( this.__dbErr( e, callback ) ) return;

				if( !data )
				{
					callback( this.App.JsonError( Locale.Error.NO_SUCH_TARGET, postdata.id ) );
					return;
				}

				var comm = new Model.Comment();
				comm.content = postdata.content;
				comm.author = this.App.Auth.user;
				comm.enc = ( postdata.enc == "1" );

				data[ target ].push( comm );

				// Save the comment first
				// This ensure the associating script exists
				comm.save( ( e ) => {
					if( this.__dbErr( e, callback ) ) return;

					// Then save the script
					data.save( ( e2 ) => {
						if( this.__dbErr( e2, callback ) ) return;
						callback( this.App.JsonSuccess() );
					} );

				} );
			}
		);
	}

	GetComments( postdata, callback, level )
	{
		Validation.NOT_EMPTY( postdata, "id", "target" );

		var pipelines = [];
		var model;

		switch( postdata.target )
		{
			case "script":
				model = "Script";
				pipelines.push({ $match: { uuid: postdata.id } });
				pipelines.push({ $project: { _id: "$comments" } });
				break;

			case "comment":
				model = "Comment";

				var targets = Array.isArray( postdata.id )
					? postdata.id : [ postdata.id ];

				var selected = [];
				for( let i of targets )
				{
					selected.push( ObjectId( i ) );
				}

				pipelines.push({ $match: { _id: { $in: selected } } });
				pipelines.push({ $project: { _id: "$replies" } });
				break;

			default:
				callback( this.App.JsonError( Locale.Error.NO_SUCH_TARGET, postdata.target ) );
				return;
		}

		this.utils.use( "math" );
		var skip = Math.abs( parseInt( postdata.skip ) || 0 );
		var limit = this.utils.clamp( parseInt( postdata.limit ) || 30, 1, 100 );
		var date_before = new Date( Date.now() );

		// XXX: in mongodb 3.3.4, lookup can do arrays
		// So we may save up 1 unwind step when it released
		pipelines.push({ $unwind: "$_id" });
		pipelines.push({ $lookup: { from: "comments", localField: "_id", foreignField: "_id", as: "data" } });
		pipelines.push({ $unwind: "$data" });

		// pagination
		pipelines.push({ $match: { "data.date_created": { $lte: date_before } } });
		pipelines.push({ $sort: { "data.date_created": -1 } });
		pipelines.push({ $skip: skip });
		pipelines.push({ $limit: limit });

		// Find the associated user
		pipelines.push({ $lookup: { from: "users", localField: "data.author", foreignField: "_id", as: "author" } });
		pipelines.push({ $unwind: "$author" });

		// Project finally
		pipelines.push({ $project: {
			"content": { $cond: {
				if: "$data.enabled", then: "$data.content", else: "$data.remarks"
			} }
			, "replies": "$data.replies"
			, "enc": "$data.enc"
			, "date_created": "$data.date_created"
			, "date_modified": "$data.date_modified"
			, "author._id": "$author._id"
			, "author.name": "$author.profile.display_name"
		} });

		Model[ model ].aggregate( pipelines ).exec( ( e, data ) => {
			if( this.__dbErr( e, callback ) ) return;

			var NResolv = 0;
			var PendingResolv = {};

			if( 0 < level )
			for( let d of data )
			{
				if( 0 < d.replies.length )
				{
					PendingResolv[ d._id ] = d;
					NResolv ++;
				}
			}

			// Resolve comments recursively
			if( 0 < NResolv )
			{
				var ResolveReplies = ( e ) => {
					for( let d of e.data )
					{
						for( let i in PendingResolv )
						{
							var item = PendingResolv[i];
							var idx = item.replies.findIndex( x => d._id.equals( x ) );

							if( ~idx )
							{
								item.replies[ idx ] = d;
								break;
							}
						}
					}

					callback( this.App.JsonSuccess( data ) );
				};

				this.GetComments(
					{ target: "comment", id: Object.keys( PendingResolv ) }
					// e: JsonStatus
					, ResolveReplies 
					, level - 1
				);
			}
			else
			{
				callback( this.App.JsonSuccess( data ) );
			}
		} );
	}
	/* End Comments }}}*/

	/*{{{ Key / Token Requests */
	PlaceRequest( postdata, callback )
	{
		if( !this.App.Auth.LoggedIn )
			throw this.App.JsonError( Locale.Error.ACCESS_DENIED );

		Validation.NOT_EMPTY( postdata, "id", "target", "pubkey", "remarks" );

		var target;

		switch( postdata.target )
		{
			case "key":
				target = "key_requests";
				break;

			case "token":
				target = "token_requests";
				break;

			default:
				callback( this.App.JsonError( Locale.Error.NO_SUCH_TARGET, postdata.target ) );
				return;
		}

		var fields = {};
		fields[ target ] = true;

		Model.Script.findOne(
				{ uuid: postdata.id }, fields, ( e, data ) => {
				if( this.__dbErr( e, callback ) ) return;

				if( !data )
				{
					callback( this.App.JsonError( Locale.Error.NO_SUCH_TARGET, postdata.id ) );
					return;
				}

				// Only one request per user per script
				var ReplaceRequest = false;
				var KRequest = new Model.Request();

				for( let exReq of data[ target ] )
				{
					// Replace the public key
					if( exReq.author.equals( this.App.Auth.user.id ) )
					{
						Dragonfly.Debug( "Replacing Request" );
						KRequest = exReq;
						ReplaceRequest = true;
						break;
					}
				}

				KRequest.author = this.App.Auth.user;
				KRequest.pubkey = postdata.pubkey;
				KRequest.remarks = postdata.remarks;
				KRequest.script = data;
				KRequest.target = target;

				if( !ReplaceRequest ) data[ target ].push( KRequest );

				KRequest.save( ( e ) => {
					if( this.__dbErr( e, callback ) ) return;

					data.save( ( e2 ) => {
						if( this.__dbErr( e2, callback ) ) return;
						callback( this.App.JsonSuccess() );
					} );
				} );
			}
		).populate( target );
	}

	GetRequests( postdata, callback )
	{
		Validation.NOT_EMPTY( postdata, "id", "target" );

		var pipelines = [];
		pipelines.push({ $match: { uuid: postdata.id } });

		switch( postdata.target )
		{
			case "key":
				pipelines.push({ $project: { _id: "$key_requests" } });
				break;

			case "token":
				pipelines.push({ $project: { _id: "$token_requests" } });
				break;

			default:
				callback( this.App.JsonError( Locale.Error.NO_SUCH_TARGET, postdata.target ) );
				return;
		}

		this.utils.use( "math" );
		var skip = Math.abs( parseInt( postdata.skip ) || 0 );
		var limit = this.utils.clamp( parseInt( postdata.limit ) || 30, 1, 100 );

		// XXX: See GetComments
		pipelines.push({ $unwind: "$_id" });
		pipelines.push({ $lookup: { from: "requests", localField: "_id", foreignField: "_id", as: "data" } });
		pipelines.push({ $unwind: "$data" });

		// pagination
		pipelines.push({ $sort: { "data.date_created": -1 } });
		pipelines.push({ $skip: skip });
		pipelines.push({ $limit: limit });

		// Find the associated user
		pipelines.push({ $lookup: { from: "users", localField: "data.author", foreignField: "_id", as: "author" } });
		pipelines.push({ $unwind: "$author" });

		// Project finally
		pipelines.push({ $project: {
			"pubkey": "$data.pubkey"
			, "remarks": "$data.remarks"
			, "date_created": "$data.date_created"
			, "author._id": "$author._id"
			, "author.name": "$author.profile.display_name"
		} });

		Model.Script.aggregate( pipelines ).exec( ( e, data ) => {
			if( this.__dbErr( e, callback ) ) return;
			callback( this.App.JsonSuccess( data ) );
		} );
	}

	// Requests are granted anonymously
	GrantRequest( postdata, callback )
	{
		Validation.NOT_EMPTY( postdata, "id", "grant" );

		Model.Request.findById( postdata.id, { grants: true }, ( e, data ) => {
			if( this.__dbErr( e, callback ) ) return;
			if( !data )
			{
				callback( this.App.JsonError( Locale.Error.NO_SUCH_TARGET, postdata.id ) );
				return;
			}

			data.grants.push( postdata.grant );
			data.save(( e ) => {
				if( this.__dbErr( e, callback ) ) return;
				callback( this.App.JsonSuccess() );
			} );

		} );
	}

	MyRequests( postdata, callback )
	{
		if( !this.App.Auth.LoggedIn )
			throw this.App.JsonError( Locale.Error.ACCESS_DENIED );

		Model.Request.find({ author: this.App.Auth.user }, ( e, items ) => {
			if( this.__dbErr( e, callback ) ) return;

			var output = [];

			this.utils.use( "object" );
			for( let item of items )
			{
				var saneData = this.utils.refObj(
					item
					, "_id", "target", "script", "date_created", "grants"
				);

				output.push( saneData );
			}

			callback( this.App.JsonSuccess( output ) );
		} ).populate({
			path: "script"
			, select: { "uuid": true, "name": true }
			, model: Model.Script
		});
	}

	ClearGrantRecords( postdata, callback )
	{
		if( !this.App.Auth.LoggedIn )
			throw this.App.JsonError( Locale.Error.ACCESS_DENIED );

		Validation.NOT_EMPTY( postdata, "id" );

		Model.Request.update(
			{ _id: ObjectId( postdata.id ), author: this.App.Auth.user }
			, { $set: { grants: [] } }
			, ( e, data ) => {
				if( this.__dbErr( e, callback ) ) return;

				switch( data.nModified )
				{
					case 0:
						callback( this.App.JsonError( Locale.Error.NO_SUCH_TARGET, postdata.id ) );
						break;
					case 1:
						callback( this.App.JsonSuccess() );
						break;
					default:
						Dragonfly.Warning( "Unusual number of cleared records for CGR: " + data.nModified );
						callback( this.App.JsonSuccess() );
				}
			}
		);
	}

	WithdrawRequest( postdata, callback )
	{
		if( !this.App.Auth.LoggedIn )
			throw this.App.JsonError( Locale.Error.ACCESS_DENIED );

		Validation.NOT_EMPTY( postdata, "id" );

		Model.Request.remove(
			{ _id: ObjectId( postdata.id ), author: this.App.Auth.user }
			, ( e, data ) => {
				if( this.__dbErr( e, callback ) ) return;

				switch( data.result.n )
				{
					case 0:
						callback( this.App.JsonError( Locale.Error.NO_SUCH_TARGET, postdata.id ) );
						break;
					case 1:
						callback( this.App.JsonSuccess() );
						break;
					default:
						Dragonfly.Warning( "Unusual number of removed records for WR: " + data.nModified );
						callback( this.App.JsonSuccess() );
				}
			}
		);
	}
	/* End Key Requests }}}*/

	/*{{{ Field Helpers */
	__in( postdata, criteria, ...fields )
	{
		for( let field of fields )
		{
			var v = postdata[ field ];
			if( !v ) continue;

			criteria[ field ] = { $in: Array.isArray( v ) ? v : [ new RegExp( v, "gi" ) ] };
		}
	}

	__stringSearch( postdata, criteria, ...fields )
	{
		try
		{
			for( let field of fields )
			{
				if( postdata[ field ] )
					criteria[ field ] = new RegExp( postdata[ field ], "gi" );
			}
		}
		catch( ex )
		{
			throw this.App.JsonError( ex.message );
		}
	}

	__privateAccess( postdata, criteria )
	{
		if( postdata.access_token )
		{
			criteria.$or = [
				Array.isArray( postdata.access_token )
					? { access_token: { $in: postdata.access_token } }
					: { access_token: postdata.access_token }
				, { public: true, draft: false, enable: true }
			];
		}
		else
		{
			criteria.public = true;
			criteria.draft = false;
			criteria.enable = true;
		}
	}

	__get( criteria, fields, getCallback, callback )
	{
		Model.Script.findOne(
			criteria, fields, ( e, data ) => {
				if( this.__dbErr( e, callback ) ) return;

				if( !data )
				{
					callback( this.App.JsonError( Locale.ScriptManager.NO_SUCH_SCRIPT, criteria.uuid ) );
					return;
				}

				getCallback( data );
			}
		);
	}

	__edit( uuid, accessToken, editCallback, callback, fields )
	{
		if( fields == undefined )
			fields = { comment: 0, history: 0 };

		Model.Script.findOne(
			{ uuid: uuid }, fields, ( e, data ) => {
				if( this.__dbErr( e, callback ) ) return;

				if( !data )
				{
					callback( this.App.JsonError( Locale.ScriptManager.UUID_NOT_RESERVED, uuid ) );
					return;
				}

				if( data.access_token != accessToken )
				{
					callback( this.App.JsonError( Locale.Error.ACCESS_DENIED ) );
					return;
				}

				editCallback( data );

				data.save( ( e ) => {
					if( this.__dbErr( e, callback ) ) return;
					callback( this.App.JsonSuccess() );
				} );
			}
		);
	}

	__dbErr( err, callback )
	{
		if( err )
		{
			if( err.name == "ValidationError" )
			{
				for( let i in err.errors )
				{
					var e = err.errors[i];
					callback( this.App.JsonError( Locale.Error.INVALID_PARAM, e.path, e.value ) );
					return true;
				}
			}

			Dragonfly.Error( err );
			callback( this.App.JsonError( Locale.System.DATABASE_ERROR ) );
			return true;
		}

		return false;
	}
	/* End Field Helpers }}}*/

}

module.exports = ScriptManager;
