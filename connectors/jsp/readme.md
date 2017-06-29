# Jsp Connector

**Note** : This is (also) a (very) quick update of the JSP connector. The connector uses Servlet 2.5 API. 

## Installation

### Requirements

Java 7

#### Details 

- Uses Java Connector code /java/src/main/java/ com.fabriceci.fmc.util.* and c.f.f.error.* packages as a relative dependency (or copy java classes and change build.gradle)
- commons fileupload, slf4j and a library containing org.json

#### Build

```
gradle clean build
```

builds required classes into libraries/java/bin directory and jar into build/libs directory.

#### Deployment

The libraries directory contains the java source and classes used by the java connector file 'filemanager.jsp'

You should copy the libraries/java/bin directory content for instance to the WEB-INF\classes directory (in case you are using a Tomcat application server) to make everything work

After copying the libraries/java/bin directory content, you can delete the whole libraries directory. It is not needed for a production version of the file manager.

#### Configuration 

Open filemanager.jsp to get an overview of supported API calls.

Server-side configuration cft. file config.properties

### TODO

Support for thumbnail generation, editable files, extract
