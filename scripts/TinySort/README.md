<img src="http://tinysort.sjeiti.com/styles/logo.svg" width="32" alt="TinySort" style="vertical-align:middle;" /> TinySort
=======

TinySort is a small script that sorts HTMLElements. It sorts by text- or attribute value, or by that of one of it's children.

Documentation and examples are at [tinysort.sjeiti.com](http://tinysort.sjeiti.com).




## usage

The first (and only required) argument is a [NodeList](https://developer.mozilla.org/en/docs/Web/API/NodeList), an array of HTMLElements or a string (which is converted to a NodeList using document.querySelectorAll).

``` javascript
tinysort(NodeList);
```

The other arguments can be an an options object.

``` javascript
tinysort(NodeList,{place:'end'});
```

If the option object only contains a `selector` you can suffice by using the selector string instead of the object.

``` javascript
tinysort(NodeList,'span.surname');
```

For multiple criteria you can just overload.

``` javascript
tinysort(NodeList,'span.surname','span.name',{data:'age'});
```

Default settings can be changed

``` javascript
tinysort.defaults.order = 'desc';
tinysort.defaults.attr = 'title';
```

### options

The options object can have the following settings:

{{options}}

