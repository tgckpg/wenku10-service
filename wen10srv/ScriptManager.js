"use strict";

const cl = global.botanLoader;
const Dragonfly = global.Dragonfly;

const Model = cl.load( "wen10srv.schema" );
const Validation = cl.load( "wen10srv.Validation" );
const DataSetter = cl.load( "wen10srv.DataSetter" );
const Locale = cl.load( "botansx.modular.localization" );

const NotificationCenter = cl.load( "wen10srv.modular.notificationcenter" );
const UserComment = cl.load( "wen10srv.modular.notifications.usercomment" );
const CommentReply = cl.load( "wen10srv.modular.notifications.commentreply" );

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
		Validation.NOT_EMPTY( postdata, "uuid", "data", "name", "desc", "zone", "type", "scope", "compat" );
		Validation.APPVER( postdata.compat );

		Dragonfly.Debug( "Upload: " + postdata.uuid );

		this.__edit( postdata.uuid, postdata.access_token, ( item ) => {
			item.data = new Buffer( postdata.data );
			item.desc = postdata.desc;
			item.name = postdata.name;
			item.enc = ( postdata.enc == "1" );
			item.scope = ( postdata.scope == "zone" ? postdata.scope : "book" );
			item.force_enc = ( postdata.force_enc == "1" );
			item.author = postdata.anon == "1" ? null : this.App.Auth.user;

			DataSetter.CompatVer( item.version, postdata.compat );
			DataSetter.ArrayData( item, postdata, "zone", "type", "tags" );

		}, callback );
	}

	Publish( postdata, callback )
	{
		Validation.NOT_EMPTY( postdata, "uuid", "public" );

		this.__edit( postdata.uuid, postdata.access_token, ( data ) => {

			data.public = postdata.public;
			data.draft = false;

			data.save( ( e ) => {
				if( this.__dbErr( e, callback ) ) return;
				callback( this.App.JsonSuccess() );
			} );

		}, callback, { public: true, draft: true, access_token: true, author: true } );
	}

	Remove( postdata, callback )
	{
		Validation.NOT_EMPTY( postdata, "uuid" );

		Model.Script.findOne(
			{ uuid: postdata.uuid }, { access_token: true, author: true }, ( e, data ) => {
				if( this.__dbErr( e, callback ) ) return;

				if( !data )
				{
					callback( this.App.JsonError( Locale.ScriptManager.NO_SUCH_SCRIPT, uuid ) );
					return;
				}

				if(!( this.__authorAccess( data ) || data.access_token == postdata.access_token ))
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
	ReserveUuid( postdata, callback )
	{
		Validation.NOT_EMPTY( postdata, "access_token" );

		this.utils.use( "random" );
		var uuid = this.utils.uuid();

		var ScriptM = new Model.Script();
		ScriptM.uuid = uuid;
		ScriptM.access_token = postdata.access_token;
		ScriptM.author = postdata.anon == "1" ? null : this.App.Auth.user;

		ScriptM.save( ( e ) => {
			if( this.__dbErr( e, callback ) ) return;
			callback( this.App.JsonSuccess( uuid ) );

			if( this.App.Auth.LoggedIn )
			{
				var NCenter = new NotificationCenter();
				NCenter.Subscribe(
					this.App.Auth.user
					, UserComment.ID
					, uuid
				);
			}
		} );
	}

	Download( postdata, callback )
	{
		Validation.NOT_EMPTY( postdata, "uuid" );

		var criteria = { uuid: postdata.uuid };
		this.__vercompat( postdata, criteria );
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

		this.__vercompat( postdata, criteria );
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
					, "version", "scope"
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

			this.__stringSearch( postdata, criteria, "name", "desc", "scope" );
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
		this.__AuthRequired();

		Validation.NOT_EMPTY( postdata, "id", "target", "content" );

		var crit_id = {};
		var model;
		var target;
		var NotiModal;

		switch( postdata.target )
		{
			case "script":
				model = "Script";
				target = "comments";
				crit_id.uuid = postdata.id;
				NotiModal = UserComment;
				break;

			case "comment":
				model = "Comment";
				target = "replies";

				Validation.OBJECT_ID( postdata.id );

				crit_id._id = ObjectId( postdata.id );
				NotiModal = CommentReply;
				break;

			default:
				callback( this.App.JsonError( Locale.Error.NO_SUCH_TARGET, postdata.target ) );
				return;
		}

		Model[ model ].findOne(
			crit_id, {
				uuid: true, comments: true, replies: true
				, author: true, ref_script: true
			}, ( e, data ) => {
				if( this.__dbErr( e, callback ) ) return;

				if( !data )
				{
					callback( this.App.JsonError( Locale.Error.NO_SUCH_TARGET, postdata.id ) );
					return;
				}

				var comDat = new Model.Comment();
				comDat.content = postdata.content;
				comDat.author = this.App.Auth.user;
				comDat.enc = ( postdata.enc == "1" );
				comDat.ref_script = ( model == "Script" ) ? data : data.ref_script;

				data[ target ].push( comDat );

				// Save the comment first
				// This ensure the associating script exists
				comDat.save( ( e ) => {
					if( this.__dbErr( e, callback ) ) return;

					var NCenter = new NotificationCenter();

					if( data.author )
						NCenter.Dispatch( NotiModal, [ data, comDat ] );

					NCenter.Subscribe(
						this.App.Auth.user
						, CommentReply.ID
						, comDat.id
					);

					// Then save the script
					data.save( ( e2 ) => {
						if( this.__dbErr( e2, callback ) ) return;
						callback( this.App.JsonSuccess() );
					} );

				} );
			}
		).populate([ "author", {
			path: "ref_script"
			, select: { "uuid": true }
			, model: Model.Script
		} ]);
	}

	// Get a Single stack of comment
	GetCommentStack( postdata, callback )
	{
		Validation.NOT_EMPTY( postdata, "id" );

		Model.Comment.findById( postdata.id, ( e, data ) => {
			if( this.__dbErr( e, callback ) ) return;

			if( !data )
			{
				callback( this.App.JsonError( Locale.Error.NO_SUCH_TARGET, postdata.id ) );
				return;
			}

			this.utils.use( "object" );
			var saneData = this.utils.refObj(
				data
				, "_id", "ref_script", "enc"
				, "date_created", "date_modified"
			);

			saneData.content = data.enabled ? data.content : data.remarks;
			saneData.author = data.author
				? { _id: data.author._id, name: data.author.profile.display_name }
				: null;


			this.GetComments(
				{ target: "comment", id: postdata.id }
				, ( e ) => {
					saneData.replies = e.data;
					callback( this.App.JsonSuccess([ saneData ]) );
				}
				, 5
			);

		} ).populate( "author" );
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
		this.__AuthRequired();

		Validation.NOT_EMPTY( postdata, "id", "target", "pubkey", "dev_id", "dev_name", "remarks" );

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
						Dragonfly.Debug( "Replacing Request: " + exReq._id );
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
				KRequest.dev_name = postdata.dev_name;
				KRequest.dev_id = postdata.dev_id;

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
		Validation.OBJECT_ID( postdata.id );

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
		this.__AuthRequired();

		Model.Request.find({ author: this.App.Auth.user }, ( e, items ) => {
			if( this.__dbErr( e, callback ) ) return;

			var output = [];

			this.utils.use( "object" );
			for( let item of items )
			{
				var saneData = this.utils.refObj(
					item
					, "_id", "target", "date_created", "grants", "dev_id", "dev_name"
				);

				if( item.script )
				{
					var script = this.utils.refObj( item.script, "uuid", "name" );
					saneData.script = script;
				}

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
		this.__AuthRequired();

		Validation.NOT_EMPTY( postdata, "id" );
		Validation.OBJECT_ID( postdata.id );

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
		this.__AuthRequired();

		Validation.NOT_EMPTY( postdata, "id" );
		Validation.OBJECT_ID( postdata.id );

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

	/*{{{ Inbox Actions */
	MyInbox( postdata, callback )
	{
		this.__AuthRequired();

		var NCenter = new NotificationCenter();
		NCenter.NotisList(
			this.App.Auth.user
			, ( err, dat ) => {
				callback( this.App.JsonSuccess( dat ) )
			}
		);
	}

	MessageRead( postdata, callback )
	{
		this.__AuthRequired();

		Validation.NOT_EMPTY( postdata, "id" );

		var id = postdata.id;
		var NCenter = new NotificationCenter();

		NCenter.Read( this.App.Auth.user, id, () =>
			callback( this.App.JsonSuccess() )
		);
	}
	/* End Inbox Actions }}}*/

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

	__vercompat( postdata, criteria )
	{
		var vs = {};
		DataSetter.CompatVer( vs, [ postdata.ver ] );
		criteria.$or = criteria.$or || [];

		for( var v in vs )
		{
			var vNum = vs[ v ];

			var vm = "version." + v + ".m";
			var vn = "version." + v + ".n";
			var vr = "version." + v + ".r";

			criteria.$or.push({ [vm]: { $lt: vNum.m } })
			criteria.$or.push({ [vm]: { $eq: vNum.m }, [vn]: { $lt: vNum.n } });
			criteria.$or.push({ [vm]: { $eq: vNum.m }, [vn]: { $eq: vNum.n }, [vr]: { $lte: vNum.r } });
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

			if( this.App.Auth.LoggedIn )
			{
				criteria.$or.push({ author: this.App.Auth.user });
			}
		}
		else
		{
			if( this.App.Auth.LoggedIn )
			{
				criteria.$or = [
					{ author: this.App.Auth.user }
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

				if(!( this.__authorAccess( data ) || data.access_token == accessToken ))
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

	__AuthRequired()
	{
		if( !this.App.Auth.LoggedIn )
			throw this.App.JsonError( Locale.Error.ACCESS_DENIED );
	}

	__authorAccess( data )
	{
		return data.author && this.App.Auth.user && this.App.Auth.user.equals( data.author );
	}
	/* End Field Helpers }}}*/

}

module.exports = ScriptManager;
