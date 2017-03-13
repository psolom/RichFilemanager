# Java connector

**Note** : This is a (very) quick conversion of the PHP connector tested with Spring MVC. The connector uses Servlet 3 upload API.

## Installation

### JS part

#### Set the connectorUrl (filemanager.config.js)

```
 "api": {
        ...
        "connectorUrl": "/admin/fileManager/api",
        ...
    }
```
#### Set the previewUrl to false (filemanager.config.js)

```
"viewer": {
  ...
  "previewUrl": false,
   ...
}
```
#### Set the base Url in the initialisation of the connector

```
$('.fm-container').richFilemanager({
   baseUrl: "/static/cms/libs/RichFilemanager-master",
});
```
### Java part

#### (Spring MVC) Create a controller to handle the manager

```
@Controller
@RequestMapping(value = "/admin/fileManager")
public class AdminFileManagerController {

    @RequestMapping(value = "", method = RequestMethod.GET)
    public String index(ModelMap model, HttpServletRequest request, HttpServletResponse response) throws IOException {
        // content of the index.html provided
        return "admin/fm/home";
    }

    @RequestMapping(value = "/api")
    public void fm(ModelMap model, HttpServletRequest request, HttpServletResponse response) throws IOException, FileManagerException {
        new LocalFileManager().handleRequest(request, response);
    }
}
```

#### configuration

There is two way to override the configuration. Please read the filemanager.config.default.properties to have more information.

##### Add a file property

Add to your resources folder a property file with this name : filemanager.config.default.properties

##### Override during runtime.

You can also override the configuration during runtime if you pass a Map to the LocalFileManager constructor: 

```
@RequestMapping(value = "/api")
public void fm(ModelMap model, HttpServletRequest request, HttpServletResponse response) throws IOException, FileManagerException {
        Map<String,String> options = new HashMap<>();
        if(YourUtils.isSuperAdmin()){
            options.put("fileRoot", "webdata/upload/public");
        }
        new LocalFileManager(options).handleRequest(request, response);
}
```

#### Library

The connector uses the [imgscalr library](https://github.com/rkalla/imgscalr) to generate thumbnail for the time being.


```compile('org.imgscalr:imgscalr-lib:4.2')```

It's optional, but I **strongly recommend**  to add the [twelvemonkeys library](https://github.com/haraldk/TwelveMonkeys) to avoid errors during thumbnail generations. 

```compile('com.twelvemonkeys.imageio:imageio-jpeg:3.3.2');```