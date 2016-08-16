/**
 * Created by Joshua.Austill on 8/11/2016.

 This connector is actually an api, so you can use it on a seperate server from your ui.  However, because of this, it will require
 a bit more setup than your average connector.

 Firstly, you will need a global variable for the application root, why this isn't a standard nodejs variable is seriously
 beyond me.  Just copy and paste this into your app.js, or whatever file you use for your root

 global.__appRoot = path.normalize(__dirname);

 Also, ensure you are requiring path in that file.

 Second, you will need to add path-posix to your project, just run

 npm install --save path-posix

 And you should be good to go there.  I named it paths instead of path in this file because RichFilemanager is passing in a path variable
 and I wanted to keep them as clear as possible.

 Next, you will need a copy of your filemanager.config.json file in /config .  This is to keep from having to do an ajax request back to the ui
 for every single request.  Hopefully in future we will get the server side and client side config seperated into two seperate files.  In the
 mean-time, this means keeping two copies of your config when using nodejs, not ideal, sorry.
 
 Lastly, you will need to require this file and use it as a route.  My call looks like this

 router.use('/filemanager', require('./filemanager')());
 
 If you are new to nodejs and express, the first parameter defines the endpoint, and the second the loading of this file.
 */

var express = require('express');
var router = express.Router();
var fs = require("fs");
var paths = require("path");
var multer  = require('multer');
var upload = multer({ dest: 'upload/'});
var config = require("../config/filemanager.config.json");

paths.posix = require("path-posix");

module.exports = function () {
    "use strict";

    // We will handle errors consistently by using a function that returns an error object
    function errors(err) {
        err = err || {}; // This allows us to call errors and just get a default error
        return {
            Error: err.Error,
            nodeCode: err.errno,
            Code: -1
        };//return
    }//errors

    // This is a seperate function because branch new files are uploaded and won't have an existing file
    // to get information from
    function parseNewPath(path, callback) {
        var parsedPath = {},
            fileRoot = config.options.fileRoot || "";
        parsedPath.uiPath = path;

        // if the passed in path isn't in the fileRoot path, make it so
        // This should go away and every path should be relative to the fileRoot
        if (path.substring(0, fileRoot.length) !== fileRoot) {
            path = paths.posix.join(fileRoot, path);
        }

        parsedPath.relativePath = paths.posix.normalize(path);
        parsedPath.filename = paths.posix.basename(parsedPath.relativePath);
        parsedPath.osRelativePath = paths.normalize(path);
        parsedPath.osExecutionPath = __appRoot;
        parsedPath.osFullPath = paths.join(parsedPath.osExecutionPath, parsedPath.osRelativePath);
        parsedPath.osFullDirectory = paths.parse(parsedPath.osFullPath).dir;
        callback(parsedPath);
    }//parseNewPath

    // because of windows, we are going to start by parsing out all the needed path information
    // this will include original values, as well as OS specific values
    function parsePath(path, callback) {
        parseNewPath(path, function (parsedPath) {
            fs.stat(parsedPath.osFullPath, function (err, stats) {
                if (err) {
                    callback(errors(err));
                } else if (stats.isDirectory()) {
                    parsedPath.isDirectory = true;
                    parsedPath.stats = stats;
                    callback(parsedPath);
                } else if (stats.isFile()) {
                    parsedPath.isDirectory = false;
                    parsedPath.stats = stats;
                    callback(parsedPath);
                } else {
                    callback(errors(err));
                }
            });
        });//parseNewPath
    }//parsePath

    // This function will create the return object for a file.  This keeps it consistent and
    // adheres to the DRY principle
    function fileInfo(pp, callback) {
        var result = {
            "Path": pp.uiPath,
            "Preview": pp.uiPath,
            "Filename": pp.filename,
            "File Type": paths.parse(pp.osFullPath).ext.toLowerCase().replace(".", ""),
            "Thumbnail": "images/fileicons/" + paths.parse(pp.osFullPath).ext.toLowerCase().replace(".", "") + ".png",
            "Properties": {
                "Date Created": pp.stats.birthtime,
                "Date Modified": pp.stats.mtime,
                "filemtime": pp.stats.mtime,
                "Height": 0,
                "Width": 0,
                "Size": 0
            },
            "Error": "",
            "Code": 0
        };//result
        callback(result);
    }//fileInfo

    // This function will create the return object for a directory.  This keeps it consistent and
    // adheres to the DRY principle
    function directoryInfo(pp, callback) {
        var result = {
            "Path": pp.uiPath,
            "Preview": pp.uiPath,
            "Filename": pp.filename,
            "File Type": "dir",
            "Thumbnail": "images/fileicons/_Open.png",
            "Properties": {
                "Date Created": pp.stats.birthtime,
                "Date Modified": pp.stats.mtime,
                "filemtime": pp.stats.mtime,
                "Height": 0,
                "Width": 0,
                "Size": 0
            },
            "Error": "",
            "Code": 0
        };//result
        callback(result);
    }//directoryInfo

    // Getting information is different for a file than it is for a directory, so here
    // we make sure we are calling the right function.
    function getinfo(pp, callback) {
        if (pp.isDirectory) {
            directoryInfo(pp, function (result) {
                callback(result);
            });
        } else {
            fileInfo(pp, function (result) {
                callback(result);
            });
        }//if
    }//getinfo

    // Here we get the information for a folder, which is a content listing

    // This function exists merely to capture the index and and pp(parsedPath) information in the for loop
    // otherwise the for loop would finish before our async functions
    function getIndividualFileInfo(pp, files, loopInfo, callback, $index) {
        parsePath(paths.posix.join(pp.uiPath, files[$index]), function (ipp) {
            getinfo(ipp, function (result) {
                loopInfo.results[result.Path] = result;
                if ($index + 1 >= loopInfo.total) {
                    callback(loopInfo.results);
                }//if
            });//getinfo
        });//parsePath
    }//getIndividualFileInfo

    function getfolder(pp, callback) {
        fs.readdir(pp.osFullPath, function (err, files) {
            if (err) {
                console.log("err -> ", err);
                callback(errors(err));
            } else {
                var loopInfo = {
                    results: {},
                    total: files.length
                },
                    i;

                if (loopInfo.total === 0) {
                    callback(loopInfo.results);
                }

                for (i = 0; i < loopInfo.total; i++) {
                    getIndividualFileInfo(pp, files, loopInfo, callback, i);
                }//for
            }//if
        });//fs.readdir
    }//getinfo

    // function to delete a file/folder
    function deleteItem(pp, callback) {
        if (pp.isDirectory === true) {
            fs.rmdir(pp.osFullPath, function (err) {
                if (err) {
                    callback(errors(err));
                } else {
                    callback({
                        "Path": pp.relativePath,
                        "Error": "",
                        "Code": 0
                    });//callback
                }//if
            });//fs.rmdir
        } else {
            fs.unlink(pp.osFullPath, function (err) {
                if (err) {
                    callback(errors(err));
                } else {
                    callback({
                        "Path": pp.relativePath,
                        "Error": "",
                        "Code": 0
                    });//callback
                }//if
            });//fs.unlink
        }//if
    }//deleteItem

    // function to add a new folder
    function addfolder(pp, name, callback) {
        fs.mkdir(paths.join(pp.osFullPath, name), function (err) {
            if (err) {
                callback(errors(err));
            } else {
                callback({
                    "Parent": pp.relativePath,
                    "Name": name,
                    "Error": "",
                    "Code": 0
                });//callback
            }//if
        });//fs.mkdir
    }//addfolder

    // function to save uploaded files to their proper locations
    function renameIndividualFile(loopInfo, files, pp, callback, $index) {
        if (loopInfo.error === false) {
            var oldfilename = paths.join(__appRoot, files[$index].path),
            // new files comes with a directory, replaced files with a filename.  I think there is a better way to handle this
            // but this works as a starting point
                newfilename = paths.join(
                    pp.osFullDirectory,
                    pp.isDirectory ? pp.relativePath : "",
                    pp.isDirectory ? files[$index].originalname : pp.filename
                ); //not sure if this is the best way to handle this or not

            fs.rename(oldfilename, newfilename, function (err) {
                if (err) {
                    loopInfo.error = true;
                    console.log("savefiles error -> ", err);
                    callback(errors(err));
                } else if ($index + 1 >= loopInfo.total) {
                    callback({
                        "Path": pp.relativePath,
                        "Name": pp.filename,
                        "Error": "",
                        "Code": 0
                    });//callback
                }//if
            });//fs.rename
        }//if not loop error
    }//renameIndividualFile

    function savefiles(pp, files, callback) {
        var loopInfo = {
                results: {},
                total: files.length,
                error: false
            },
            i;

        for (i = 0; i < loopInfo.total; i++) {
            renameIndividualFile(loopInfo, files, pp, callback, i);
        }//for
    }//savefiles

    // function to rename files
    function rename(old, newish, callback) {
        fs.rename(old.osFullPath, newish.osFullPath, function (err) {
            if (err) {
                callback(errors(err));
            } else {
                callback({
                    "Old Path": old.uiPath,
                    "Old Name": old.filename,
                    "New Path": newish.uiPath,
                    "New Name": newish.filename,
                    "Error": "",
                    "Code": 0
                });//callback
            }//if
        }); //fs.rename
    }//rename

    // RichFilemanager expects a pretified string and not a json object, so this will do that
    // This results in numbers getting recieved as 0 instead of '0'
    function respond(res, obj) {
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify(obj));
    }//respond

    // finally, our main route handling that calls the above functions :)
    router.route("/")
        .get(function (req, res) {
            var mode = req.query.mode,
                path = req.query.path;

            switch (mode.trim()) {
            case "getinfo":
                parsePath(path, function (pp) {
                    getinfo(pp, function (result) {
                        respond(res, result);
                    });//getinfo
                });//parsePath
                break;
            case "getfolder":
                parsePath(path, function (pp) {
                    getfolder(pp, function (result) {
                        respond(res, result);
                    });//getfolder
                });//parsePath
                break;
            case "getimage":
            // until I implement the thumbnail feature, getimage is just returning the entire file
            // so this falls through to download.
            case "download":
                parsePath(path, function (pp) {
                    if (req.query.force === 'true' || req.query.thumbnail === "true") {
                        res.setHeader("content-disposition", "attachment; filename=" + pp.filename);
                        res.setHeader("content-type", "application/octet-stream");
                        res.sendFile(pp.osFullPath);
                    } else {
                        respond(res, {Code: 0});
                    }//if
                });//parsePath
                break;
            case "addfolder":
                parsePath(path, function (pp) {
                    addfolder(pp, req.query.name, function (result) {
                        respond(res, result);
                    });//addfolder
                });//parsePath
                break;
            case "delete":
                parsePath(path, function (pp) {
                    deleteItem(pp, function (result) {
                        respond(res, result);
                    });//parsePath
                });//parsePath
                break;
            case "rename":
                parsePath(req.query.old, function (opp) {
                    var newPath = paths.posix.parse(opp.uiPath).dir,
                        newish = paths.posix.join(newPath, req.query.new);

                    parseNewPath(newish, function (npp) {
                        rename(opp, npp, function (result) {
                            respond(res, result);
                        });//rename
                    });//parseNewPath
                });//parsePath
                break;
            case "move":
                parsePath(req.query.old, function (opp) {
                    parseNewPath(paths.posix.join("/", req.query.new, opp.filename), function (npp) {
                        rename(opp, npp, function (result) {
                            respond(res, result);
                        });//rename
                    });//parseNewPath
                });//parsePath
                break;
            default:
                console.log("no matching GET route found with mode: '", mode.trim(), " query -> ", req.query);
                respond(res, {Code: 0});
            }//switch
        })//get
        .post(upload.array("files", 5), function (req, res) {
            var mode = req.body.mode;

            switch (mode.trim()) {
            case "add":
                parsePath(req.body.currentpath, function (pp) {
                    savefiles(pp, req.files, function (result) {
                        respond(res, result);
                    });//savefiles
                });//parsePath
                break;
            case "replace":
                parsePath(req.body.newfilepath, function (pp) {
                    savefiles(pp, req.files, function (result) {
                        respond(res, result);
                    });//savefiles
                });//parsePath
                break;
            default:
                console.log("no matching POST route found with mode: '", mode.trim(), " query -> ", req.query);
                respond(res, {Code: 0});
            }//switch
        }); //post

    return router;
};//module.exports