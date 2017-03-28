/*
Copyright (c) 2011 Sean Cusack

MIT-LICENSE:

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

(function($){

	//
	// Private classes
	//

	function CollisionCoords( proto, containment )
	{
		if( ! proto )
		{
			// default if nothing else:
			this.x1 = this.y1 = this.x2 = this.y2 = 0;
			this.proto = null;
		}
		else if( "offset" in proto )
		{
			// used to grab stuff from a jquery object
			// if it has collision-coordinates data, use that
			// otherwise just pull in the offset

			var d = proto.data("jquery-collision-coordinates");
			if( d )
			{
				this.x1 = d.x1;
				this.y1 = d.y1;
				this.x2 = d.x2;
				this.y2 = d.y2;
			}
			else if( containment && containment.length && containment.length >= 4 )
			{
				this.x1 = containment[0];
				this.y1 = containment[1];
				this.x2 = containment[2]+proto.outerWidth(true);
				this.y2 = containment[3]+proto.outerHeight(true);
			}
			else if( proto.parent().length <= 0 )
			{
				this.x1 = parseInt(proto.css("left"  )) || 0;
				this.y1 = parseInt(proto.css("top"   )) || 0;
				this.x2 = parseInt(proto.css("width" )) || 0;
				this.y2 = parseInt(proto.css("height")) || 0;
				this.x2 += this.x1;
				this.x2 += (parseInt(proto.css("margin-left"))||0) + (parseInt(proto.css("border-left"))||0) + (parseInt(proto.css("padding-left"))||0) + 
									 (parseInt(proto.css("padding-right"))||0) + (parseInt(proto.css("border-right"))||0) + (parseInt(proto.css("margin-right"))||0);
				this.y2 += this.y1;
				this.y2 += (parseInt(proto.css("margin-top"))||0) + (parseInt(proto.css("border-top"))||0) + (parseInt(proto.css("padding-top"))||0) + 
									 (parseInt(proto.css("padding-bottom"))||0) + (parseInt(proto.css("border-bottom"))||0) + (parseInt(proto.css("margin-bottom"))||0);
			}
			else
			{
				var o = proto.offset();
				this.x1 = o.left - (parseInt(proto.css("margin-left"))||0); // not also border -- offset starts from inside margin but outside border
				this.y1 = o.top  - (parseInt(proto.css("margin-top" ))||0); // not also border -- offset starts from inside margin but outside border
				this.x2 = this.x1 + proto.outerWidth(true);
				this.y2 = this.y1 + proto.outerHeight(true);
			}
			this.proto = proto;
		}
		else if( "x1" in proto )
		{
			// used to effectively "clone"
			this.x1 = proto.x1;
			this.y1 = proto.y1;
			this.x2 = proto.x2;
			this.y2 = proto.y2;
			this.proto = proto;
		}

		if( "dir" in proto )
		{
			this.dir = proto.dir;
		}
	}
	
	CollisionCoords.prototype.innerContainer = function()
	{
		var clone = new CollisionCoords( this );
		if( this.proto["css"] )
		{
			clone.x1 += parseInt( this.proto.css( "margin-left"  ) ) || 0;
			clone.x1 += parseInt( this.proto.css( "border-left"  ) ) || 0;
			clone.x1 += parseInt( this.proto.css("padding-left"  ) ) || 0;
			clone.x2 -= parseInt( this.proto.css("padding-right" ) ) || 0;
			clone.x2 -= parseInt( this.proto.css( "border-right" ) ) || 0;
			clone.x2 -= parseInt( this.proto.css( "margin-right" ) ) || 0;
			clone.y1 += parseInt( this.proto.css( "margin-top"   ) ) || 0;
			clone.y1 += parseInt( this.proto.css( "border-top"   ) ) || 0;
			clone.y1 += parseInt( this.proto.css("padding-top"   ) ) || 0;
			clone.y2 -= parseInt( this.proto.css("padding-bottom") ) || 0;
			clone.y2 -= parseInt( this.proto.css( "border-bottom") ) || 0;
			clone.y2 -= parseInt( this.proto.css( "margin-bottom") ) || 0;
		}
		return clone;
	}

	CollisionCoords.prototype.move = function( dx, dy )
	{
		this.x1 += dx;
		this.x2 += dx;
		this.y1 += dy;
		this.y2 += dy;
		return this;
	};
	
	CollisionCoords.prototype.update = function( obj )
	{
		if( "x1" in obj ) this.x1 = obj["x1"];
		if( "x2" in obj ) this.x1 = obj["x2"];
		if( "y1" in obj ) this.x1 = obj["y1"];
		if( "y2" in obj ) this.x1 = obj["y2"];
		if( "left" in obj )
		{
			var w = this.x2-this.x1;
			this.x1 = obj["left"];
			this.x2 = this.x1 + w;
		}
		if( "top" in obj )
		{
			var h = this.y2-this.y1;
			this.y1 = obj["top"];
			this.y2 = this.y1 + h;
		}
		if( "offset" in obj )
		{
			var o = obj.offset();
			this.update( o );
			this.x2 = this.x1 + obj.width();
			this.y2 = this.y1 + obj.height();
		}
		if( "dir" in obj ) this.x1 = obj["dir"];
		return this;
	};
	
	CollisionCoords.prototype.width   = function() { return ( this.x2 - this.x1 );     };
	CollisionCoords.prototype.height  = function() { return ( this.y2 - this.y1 );     };
	CollisionCoords.prototype.centerx = function() { return ( this.x1 + this.x2 ) / 2; };
	CollisionCoords.prototype.centery = function() { return ( this.y1 + this.y2 ) / 2; };

	
	CollisionCoords.prototype.toString = function()
	{
		return ( this.proto["get"] ? "#"+this.proto.get(0).id : "" ) + "["+[this.x1,this.y1,this.x2,this.y2].join(",")+"]";
	};
	
	// the big mistake in a lot of collision-detectors,
	// make floating-point arithmetic work for you, not against you:
	CollisionCoords.EPSILON = 0.001;
	
	CollisionCoords.prototype.containsPoint = function( x, y, inclusive )
	{
		if( ! inclusive ) inclusive = false;
		var epsilon = ( inclusive ? -1 : +1 ) * CollisionCoords.EPSILON;
		if( ( x > ( this.x1 + epsilon ) && x < ( this.x2 - epsilon ) ) &&
				( y > ( this.y1 + epsilon ) && y < ( this.y2 - epsilon ) )    )
			return true;
		else
			return false;
	};
	
	CollisionCoords.prototype.overlaps = function( other, inclusive )
	{
		var hit = this._overlaps( other, inclusive );
		if( hit.length > 0 ) return hit;
				hit = other._overlaps( this, inclusive );
		if( hit.length > 0 )
		{
			hit[0].dir = hit[0].dir == "Inside"  ? "Outside" :
									 hit[0].dir == "Outside" ? "Inside"  :
									 hit[0].dir == "N"       ? "S"       :
									 hit[0].dir == "S"       ? "N"       :
									 hit[0].dir == "W"       ? "E"       :
									 hit[0].dir == "E"       ? "W"       :
									 hit[0].dir == "NE"      ? "SW"      :
									 hit[0].dir == "SW"      ? "NE"      :
									 hit[0].dir == "SE"      ? "NW"      :
									 hit[0].dir == "NW"      ? "SE"      :
																						 undefined;
		}
		return hit || [];
	}

	CollisionCoords.prototype._overlaps = function( other, inclusive )
	{
		var c1 = other;
		var c2 = this;
		if( ! inclusive ) inclusive = false;
		var ax = c1.centerx();
		var ay = c1.centery();
		// nine points to check whether they're in e2: e1's four corners, e1's center-sides, and e1's center
		// if center of e1 is within e2, there's some kind of total inclusion
		var points = [ [c1.x1,c1.y1,"SE"], [c1.x2,c1.y1,"SW"], [c1.x2,c1.y2,"NW"], [c1.x1,c1.y2,"NE"], [ax,c1.y1,"S"], [c1.x2,ay,"W"], [ax,c1.y2,"N"], [c1.x1,ay,"E"], [ax,ay,undefined] ];
		var hit    = null;
		var dirs   = { NW:false, N:false, NE:false, E:false, SE:false, S:false, SW:false, W:false };
		for( var i=0; i<points.length; i++ )
		{
			if( this.containsPoint( points[i][0], points[i][1], inclusive ) )
			{
				if( points[i][2] ) dirs[points[i][2]] = true;
				if( hit ) continue; // don't need to make another one - it'll be the same anyways //
				hit = [ new CollisionCoords( { x1: Math.max(c1.x1,c2.x1), y1: Math.max(c1.y1,c2.y1),
																			 x2: Math.min(c1.x2,c2.x2), y2: Math.min(c1.y2,c2.y2), dir: points[i][2]  } ) ];
			}
		}
		if( hit )
		{
			if( dirs["NW"] && dirs["NE"] ) hit[0].dir = "N";
			if( dirs["NE"] && dirs["SE"] ) hit[0].dir = "E";
			if( dirs["SE"] && dirs["SW"] ) hit[0].dir = "S";
			if( dirs["SW"] && dirs["NW"] ) hit[0].dir = "W";
			if( dirs["NW"] && dirs["NE"] &&
					dirs["SE"] && dirs["SW"] ) hit[0].dir = "Outside";
			if( !dirs["NW"] && !dirs["NE"] &&
					!dirs["SE"] && !dirs["SW"] &&
					!dirs["N"] && !dirs["E"] &&
					!dirs["S"] && !dirs["W"] ) hit[0].dir = "Inside";
		}
		return hit || [];
	};
	
	CollisionCoords.prototype._protrusion = function( area, dir, list )
	{
		var o = this.overlaps( new CollisionCoords( area ), false );
		if( o.length <= 0 ) return list;
		o[0].dir = dir;
		list.push( o[0] );
		return list;
	};

	CollisionCoords.prototype.protrusions = function( container )
	{
		var list = [];
		var n    = Number.NEGATIVE_INFINITY;
		var p    = Number.POSITIVE_INFINITY;
		var l    = container.x1;
		var r    = container.x2;
		var t    = container.y1;
		var b    = container.y2;
		list = this._protrusion( { x1:l, y1:n, x2:r, y2:t }, "N" , list );
		list = this._protrusion( { x1:r, y1:n, x2:p, y2:t }, "NE", list );
		list = this._protrusion( { x1:r, y1:t, x2:p, y2:b }, "E" , list );
		list = this._protrusion( { x1:r, y1:b, x2:p, y2:p }, "SE", list );
		list = this._protrusion( { x1:l, y1:b, x2:r, y2:p }, "S" , list );
		list = this._protrusion( { x1:n, y1:b, x2:l, y2:p }, "SW", list );
		list = this._protrusion( { x1:n, y1:t, x2:l, y2:b }, "W" , list );
		list = this._protrusion( { x1:n, y1:n, x2:l, y2:t }, "NW", list );
		return list;
	};
	
	function Collision( targetNode, obstacleNode, overlapCoords, overlapType )
	{
		this.target        = targetNode;
		this.obstacle      = obstacleNode;
		this.overlap       = overlapCoords;
		this.overlapType   = overlapType;
	}
	
	Collision.prototype.distance = function( other )
	{
		var tc = c.target;
		var oc = c.overlap;
		return Math.sqrt( (tc.centerx()-oc.centerx())*(tc.centerx()-oc.centerx()) +
											(tc.centery()-oc.centery())*(tc.centery()-oc.centery())   );
	}

	function CollisionFactory( targets, obstacles, containment )
	{
		this.targets   = targets;
		this.obstacles = obstacles;
		this.collisions = null;
		this.cache      = null;
		if( containment ) this.containment = containment;
		else              this.containment = null;
	}
	
	CollisionFactory.prototype.getCollisions = function( overlapType )
	{
		if( this.collisions !== null ) return this.collisions;
		this.cache = {};
		this.collisions = [];
		// note: doesn't do any dup-detection, so if you ask if something collides with
		// itself, it will!
		if( ! overlapType ) overlapType = "collision";
		if( overlapType != "collision" && overlapType != "protrusion" ) return [];
		var c = [];
		var t = this.targets;  
		var o = this.obstacles;
		for( var ti=0; ti<t.length; ti++ )
		{
			var tc = t[ti];
			for( var oi=0; oi<o.length; oi++ )
			{
				var oc = o[oi];
				var ol = ( (overlapType=="collision") ? tc.overlaps( oc ) : tc.protrusions( oc.innerContainer() ) );
				for( var oli=0; oli<ol.length; oli++ )
				{
					c.push( new Collision( t[ti], o[oi], ol[oli], overlapType ) );
				}
			}
		}
		this.collisions = c;
		return c;
	};

	//
	// Setup
	//
	
	function makeCoordsArray( j )
	{
		return $(j).get().map(function(e,i,a){ return new CollisionCoords( $(e) ); });
	}

	function combineQueries( array )
	{
		var j = $();
		for( var i=0; i<array.length; i++ )
		{
			j=j.add( array[i] );
		}
		return j;
	}

	$.fn.collision = function( selector, options )
	{
		if( ! options ) options = {};
		var mode = "collision";
		var as   = null;
		var cd   = null;
		var od   = null;
		var dd   = null;
		var rel  = "body"; // can be "body" (default), "collider", "obstacle", or a selector
		if( options.mode == "protrusion" ) mode = options.mode;
		if( options.as                   ) as   = options.as;
		if( options.colliderData         ) cd   = options.colliderData;
		if( options.obstacleData         ) od   = options.obstacleData;
		if( options.directionData        ) dd   = options.directionData;
		if( options.relative             ) rel  = options.relative;
		var cf = new CollisionFactory( makeCoordsArray(this), makeCoordsArray(selector) );
		var ov = cf.getCollisions( mode );
		var array;
		// if no "as", then just the jquery object that we collided with
		// but if there's as="<div/>", then make div's out of the overlaps
		if( ! as ) array = $.map( ov, function(e,i,a){ return e.obstacle.proto; } );
		else       array = $.map( ov, function(e,i,a){ var xoff = e.overlap.x1;
																								var yoff = e.overlap.y1;
																								if( rel && rel != "body" ) 
																								{ 
																									var r = rel == "collider" ? $(e.target.proto) :
																													rel == "obstacle" ? $(e.obstacle.proto) :
																																							$(rel);
																									if( r.length>0 ) 
																									{ 
																										var roff = r.offset();
																										xoff -= roff.left;
																										yoff -= roff.top;
																									}
																								}
																								var c = $(as).offset( { left: xoff, top: yoff } )
																														 .width(  e.overlap.width() )
																														 .height( e.overlap.height() );
																								if( cd ) c.data(cd, $(e.target.proto));
																								if( od ) c.data(od, $(e.obstacle.proto));
																								if( dd && e.overlap.dir ) c.data(dd, e.overlap.dir);
																								return c;
																							} );
		return combineQueries( array );
	};

})(jQuery);
