=JQuery Collision=

==INSTALLATION==

* Copy jquery-collision.js or any specific or minified version of jquery-collision(-x.x.x)(.min).js into your javascript directory
* Make sure that jquery 1.8.3 or later is somewhere accessible
* To use, make sure that jquery 1.8.3 or later is loaded in a <script> tag
* After that, load jquery-collision:
  <script src="jquery-1.8.3.js"></script>
  <script src="jquery-collision.js"></script>
* From then on, $(...).collision(...) will be available in your javascript code

==USAGE==

* Basic usage returns the obstacles that are hit by the colliders:
  var colliders_selector = ".collider";
  var obstacles_selector = ".obstacle";
  var hits = $(colliders_selector).collision(obstacles_selector)

* There are a number of options available, passed in as a second argument:
  var hits = $(colliders_selector).collision(obstacles_selector, { mode: "collision" /*etc*/ } )

==OPTIONS==

=== as: "<div />" or any selector to morph ===
  
This changes the nature of what is returned. Rather than returning the obstacles that were hit, it returns the overlapping
areas themselves. The "as" refers to the kind of HTML DOM object it creates. If there is one collision, and the overlap
is 50x50 starting at [100,100] from the edge of the window, and "as" is "<div />", it essentially returns:

  <nowiki>$('<div style="left:100px; top:100px; width:50px; height:50px;"></div>')</nowiki>

=== relative: "body", "collider", "obstacle", or any selector ===

If we are returning an "as" object, the default coordinates are relative to "body". If "collider" is given, then the
coordinates are relative to that collision's collider. If "obstacle" is given, then the coordinates are relative to the
obstacle hit. If any other selector is given, then the coordinates are relative to that. This means that you can give
"#gameboard" as a relative setting, get all the collisions, and then append them to "#gameboard", and they will overlap
properly.

=== colliderData: "some_string" ===

If set, all returned "as" objects have a .data("some_string") value available, containing the $(collider) object for that
particular collision.

=== obstacleData: "some_string" ===

If set, all returned "as" objects have a .data("some_string") value available, containing the $(obstacle) object for that
particular collision.

=== directionData: "some_string" ===

If set, all returned "as" objects have a .data("some_string") value available, containing a string describing what part of
the collider was hit. Possibilities include the 8 compass directions in caps, plus "Inside" and "Outside". For example,
if the collision was on the top, left part of the collider, then the value would be "NW". If it occurred on the right side
of the collider, either the whole right edge or an inner portion of it, the value would be "E". If the obstacle is completely
engulfed by the collider, then the collider was hit on the "Inside". If the obstacle completely engulfs the collider, then
the collider was hit on the "Outside".

The association to the collider is reversed for protrusions, see below.

=== mode: "collision" (default), or "protrusion" ===

If set to collision or not set at all, all of the above is what happens. If set to "protrusion", the collision detection
goes in reverse. So rather than returning what obstacles the colliders hit, it returns what ones they are escaping from.
So if a small collider is engulfed by a large obstacle (let's call it a restraint instead), then it returns nothing,
because none of the collider is "protruding" from the restraint. If it is peeking out from any edge or completely outside
the restraint, the restraint is returned.

That's if there is no "as" option set. Just like in collisions, protrusions returned "as" a "<div />" (for example) are
the portion that's affected, not the whole obstacle/restraint. So the "part"(s) of the collider that are protruding from
the retraint are returned. The easiest example is a small collider that is just peeking out of the right side of a
restraint. What is returned is the part that's outside the restraint. And if you asked for directionData, the direction
would be "E" because it's escaping out the "E" edge of the restraint.

* IMPORTANT: The directionData for protrusions is with respect to the restraint, not the collider. It usually corresponds
well to the collider as well, but what follows is why the associativity is reversed:

What happens if the collider is escaping out the top-right corner of the restraint? Well, we had to pick a good way to
describe this accurately and usefully. What happens is that it will return THREE protrusions. The chunk of the collider
that is directly above the restraint (but not to the right of the corner) is returned with a direction of "N". The chunk 
of the collider that is wholly to the right of the restraint (but not above the corner) is returned with a direction of
"E". And the chunk of the collider that is entirely above and to the right of the corner of the restraint is returned
with a direction of "NE". The best way to figure out what this means and how it works is to try the examples.

* NOTE: if the collider is bigger in one or both dimensions from the restraint, you will end up with even more chunks. FIVE
if it's escaping out the top, bottom, and side simultaneously, for example: one each for top, bottom, and side, plus the
two corner chunks. And EIGHT if the collider totally engulfs (is escaping in every direction from) the restraint.

==EXAMPLES==

* In addition to the above installation requirements, also make sure that jquery ui 1.9.2 or later is available
* Make sure that jquery-collision.js, jquery-1.8.3.js and ui/jquery.ui.*.js are in the same directory as the examples
* Load the examples up in a browser

