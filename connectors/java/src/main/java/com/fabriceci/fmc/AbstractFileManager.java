package com.fabriceci.fmc;

import com.fabriceci.fmc.error.FMIOException;
import com.fabriceci.fmc.error.FMInitializationException;
import com.fabriceci.fmc.error.FMSyntaxException;
import com.fabriceci.fmc.error.FileManagerException;
import com.fabriceci.fmc.util.FileUtils;
import com.fabriceci.fmc.util.StringUtils;
import org.imgscalr.Scalr;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.awt.image.BufferedImage;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;
import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.regex.PatternSyntaxException;

public abstract class AbstractFileManager implements IFileManager {

    protected final static String CONFIG_DEFAULT_PROPERTIES = "filemanager.config.default.properties";
    protected final static String CONFIG_CUSTOM_PROPERTIES = "filemanager.config.properties";
    protected final static String LANG_FILE = "filemanager.lang.en.properties";
    protected final Logger logger = LoggerFactory.getLogger(AbstractFileManager.class);

    protected Properties propertiesConfig = new Properties();
    protected Properties dictionnary = new Properties();

    protected DateFormat df;
    protected Locale locale;

    public AbstractFileManager(Locale locale, Map<String,String> options) throws FMInitializationException {
        // load server properties
        InputStream tempLoadIS= null;
        try {
            // load default config
            tempLoadIS = Thread.currentThread().getContextClassLoader().getResourceAsStream(CONFIG_DEFAULT_PROPERTIES);
            propertiesConfig.load(tempLoadIS);
            try { tempLoadIS.close(); } catch(IOException e){}

            // load custom config if exist
            tempLoadIS = Thread.currentThread().getContextClassLoader().getResourceAsStream(CONFIG_CUSTOM_PROPERTIES);
            if(tempLoadIS != null){
                Properties customConfig = new Properties();
                customConfig.load(tempLoadIS);
                propertiesConfig.putAll(customConfig);
                try { tempLoadIS.close(); } catch(IOException e){}
            }
        } catch (IOException e) {
            throw new FMInitializationException("Config file is not found: (" + CONFIG_DEFAULT_PROPERTIES + ")", e);
        }

        if(locale == null) {
            locale = new Locale(propertiesConfig.getProperty("culture"));
        }

        try {
            tempLoadIS = Thread.currentThread().getContextClassLoader().getResourceAsStream(LANG_FILE.replace("en", locale.getLanguage()));
            if(tempLoadIS == null){
                logger.error(String.format("Lang file for language \"%s\" not founded, loading the default file", locale.getLanguage()));
                tempLoadIS = Thread.currentThread().getContextClassLoader().getResourceAsStream(LANG_FILE);
            }
            dictionnary.load(tempLoadIS);
            tempLoadIS.close();
        } catch (IOException e) {
            logger.error(String.format("Dictionnary for the locale %s not found, loanding the default dic", locale.getLanguage()));
            throw new FMInitializationException("Dictionnary file is not found : (" + LANG_FILE + ")", e);
        }

        try {
            df = new SimpleDateFormat(propertiesConfig.getProperty("dateFormat"));
        }catch(IllegalArgumentException e){
            logger.error("The date format is not valid - setting the default one instead : yyyy-MM-dd HH:mm:ss");
            df = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");
        }

        if(options != null && !options.isEmpty()) {
            propertiesConfig.putAll(options);
        }
    }
    public AbstractFileManager(Locale locale) throws FMInitializationException {
        this(locale, null);
    }

    public AbstractFileManager(Map<String,String> options) throws FMInitializationException {
        this(null, options);
    }

    public AbstractFileManager() throws FMInitializationException {
        this(null, null);
    }

    public final void handleRequest(HttpServletRequest request, HttpServletResponse response) {

        //baseUrl = ServletUtils.getBaseUrl(request);

        final String method = request.getMethod();
        final String mode = request.getParameter("mode");

        JSONObject responseData = null;
        response.setStatus(200);

        try {
            if (StringUtils.isEmpty("mode")) {
                generateResponse(response, getErrorResponse(dictionnary.getProperty("MODE_ERROR")).toString());
                return;
            }

            if (method.equals("GET")) {
                switch (mode) {
                    default:
                        responseData = getErrorResponse(dictionnary.getProperty("MODE_ERROR"));
                        break;
                    case "initiate":
                        responseData = actionInitiate(request);
                        break;
                    case "getfile":
                        if (!StringUtils.isEmpty(request.getParameter("path"))) {
                            responseData = actionGetFile(request);
                        }
                        break;
                    case "getfolder":
                        if (!StringUtils.isEmpty(request.getParameter("path"))) {
                            responseData = actionGetFolder(request);
                        }
                        break;
                    case "rename":
                        if (!StringUtils.isEmpty(request.getParameter("old")) && !StringUtils.isEmpty(request.getParameter("new"))) {
                            responseData = actionRename(request);
                        }
                        break;
                    case "copy":
                        if (!StringUtils.isEmpty(request.getParameter("source")) && !StringUtils.isEmpty(request.getParameter("target"))) {
                            responseData = actionCopy(request);
                        }
                        break;
                    case "move":
                        if (!StringUtils.isEmpty(request.getParameter("old")) && !StringUtils.isEmpty(request.getParameter("new"))) {
                            responseData = actionMove(request);
                        }
                        break;
                    case "editfile":
                        if (!StringUtils.isEmpty(request.getParameter("path"))) {
                            responseData = actionEditFile(request);
                        }
                        break;
                    case "delete":
                        if (!StringUtils.isEmpty(request.getParameter("path"))) {
                            responseData = actionDelete(request);
                        }
                        break;
                    case "addfolder":
                        if (!StringUtils.isEmpty(request.getParameter("path")) &&
                                !StringUtils.isEmpty(request.getParameter("name"))) {
                            responseData = actionAddFolder(request);
                        }
                        break;
                    case "download":
                        if (!StringUtils.isEmpty(request.getParameter("path"))) {
                            responseData = actionDownload(request, response);
                        }
                        break;
                    case "getimage":
                        if (!StringUtils.isEmpty(request.getParameter("path"))) {
                            Boolean thumbnail = Boolean.parseBoolean(request.getParameter("thumbnail"));
                            responseData = actionGetImage(request, response, thumbnail);
                        }
                        break;
                    case "readfile":
                        if (!StringUtils.isEmpty(request.getParameter("path"))) {
                            responseData = actionReadFile(request, response);
                        }
                        break;
                    case "summarize":
                        responseData = actionSummarize();
                        break;
                }
            } else if (method.equals("POST")) {
                switch (mode) {

                    default:
                        responseData = getErrorResponse(dictionnary.getProperty("MODE_ERROR"));
                        break;
                    case "upload":
                        if (!StringUtils.isEmpty(request.getParameter("path"))) {
                            responseData = actionUpload(request);
                        }
                        break;
                    case "replace":
                        if (!StringUtils.isEmpty(request.getParameter("path"))) {
                            responseData = actionReplace(request);
                        }
                        break;
                    case "savefile":
                        if (!StringUtils.isEmpty(request.getParameter("path"))) {
                            responseData = actionSaveFile(request);
                        }
                        break;
                }
            }
        } catch(FMIOException e){
            logger.error(e.getMessage(), e);
            generateResponse(response, getErrorResponse(dictionnary.getProperty("ERROR_SERVER")).toString());
        } catch (FileManagerException e) {
            logger.error(e.getMessage(), e);
            generateResponse(response, getErrorResponse(e.getMessage()).toString());
        } catch (Exception e){
            logger.error(e.getMessage(), e);
            generateResponse(response, getErrorResponse(dictionnary.getProperty("ERROR_SERVER")).toString());
        }

        if (responseData != null) {
            generateResponse(response, responseData.toString());
        }
    }

    protected final JSONObject getErrorResponse(String msg) {

        JSONObject errorInfo = new JSONObject();

        try {
            errorInfo.put("id", "server");
            errorInfo.put("code", "500");
            errorInfo.put("title", msg);

        } catch (JSONException e) {
            logger.error("JSONObject error");
        }
        return new JSONObject().put("errors", new JSONArray().put(errorInfo));
    }

    public static JSONObject getDirSummary(Path path) throws IOException
    {

        final Map<String, Long> result =  new HashMap<>();
        result.put("files", 0L);
        result.put("folders", 0L);
        result.put("size", 0L);

        Files.walkFileTree(path, new SimpleFileVisitor<Path>()
        {
            @Override
            public FileVisitResult visitFile(Path file, BasicFileAttributes attrs)
                    throws IOException
            {
                result.put("files", (result.get("files")) + 1);
                result.put("size", (result.get("size")) + Files.size(file));
                return FileVisitResult.CONTINUE;
            }

            @Override
            public FileVisitResult visitFileFailed(Path file, IOException exc) throws IOException
            {
                result.put("files", (result.get("files")) + 1);
                return FileVisitResult.CONTINUE;
            }

            @Override
            public FileVisitResult postVisitDirectory(Path dir, IOException exc) throws IOException
            {
                if (exc == null)
                {
                    result.put("folders", (result.get("folders")) + 1);
                    return FileVisitResult.CONTINUE;
                }
                else
                {
                    // directory iteration failed; propagate exception
                    throw exc;
                }
            }
        });

        return new JSONObject(result);
    }



    protected final void generateResponse(HttpServletResponse response, String json)  {
        response.setStatus(200);
        response.addHeader("Content-Type", "application/json; charset=utf-8");
        try {
            response.getWriter().write(json);
        }catch(Exception e){
            logger.error("Error during the response generation", e);
        }
    }

    protected final boolean hasPermission(String action){
        return Arrays.stream(propertiesConfig.getProperty("capabilities").split(",")).anyMatch(x -> x.equals(action));
    }

    @Override
    public JSONObject actionGetFile(HttpServletRequest request) throws FileManagerException {
        throw new UnsupportedOperationException();
    }

    @Override
    public JSONObject actionGetFolder(HttpServletRequest request) throws FileManagerException {
        throw new UnsupportedOperationException();
    }

    @Override
    public JSONObject actionDownload(HttpServletRequest request, HttpServletResponse response) throws FileManagerException {
        throw new UnsupportedOperationException();
    }

    @Override
    public JSONObject actionAddFolder(HttpServletRequest request) throws FileManagerException {
        throw new UnsupportedOperationException();
    }

    @Override
    public JSONObject actionDelete(HttpServletRequest request) throws FileManagerException {
        throw new UnsupportedOperationException();
    }

    @Override
    public JSONObject actionRename(HttpServletRequest request) throws FileManagerException {
        throw new UnsupportedOperationException();
    }

    @Override
    public JSONObject actionMove(HttpServletRequest request) throws FileManagerException {
        throw new UnsupportedOperationException();
    }

    @Override
    public JSONObject actionGetImage(HttpServletRequest request, HttpServletResponse response, Boolean thumbnail) throws FileManagerException {
        throw new UnsupportedOperationException();
    }

    @Override
    public JSONObject actionEditFile(HttpServletRequest request) throws FileManagerException {
        throw new UnsupportedOperationException();
    }

    @Override
    public JSONObject actionSummarize() throws FileManagerException  {
        throw new UnsupportedOperationException();
    }

    @Override
    public JSONObject actionUpload(HttpServletRequest request) throws FileManagerException {
        throw new UnsupportedOperationException();
    }

    @Override
    public JSONObject actionReplace(HttpServletRequest request) throws FileManagerException {
        throw new UnsupportedOperationException();
    }

    @Override
    public JSONObject actionSaveFile(HttpServletRequest request) throws FileManagerException {
        throw new UnsupportedOperationException();
    }

    @Override
    public JSONObject actionInitiate(HttpServletRequest request) throws FileManagerException {
        JSONObject init = new JSONObject();
        JSONObject data = new JSONObject();
        JSONObject attributes = new JSONObject();
        data.put("id", "/");
        data.put("type", "initiate");

        JSONObject options = new JSONObject();
        options.put("culture", propertiesConfig.getProperty("culture"));
        options.put("charsLatinOnly", Boolean.parseBoolean(propertiesConfig.getProperty("charsLatinOnly")));
        if( propertiesConfig.getProperty("capabilities") != null ){
            options.put("capabilities", propertiesConfig.getProperty("capabilities"));
        } else{
            options.put("capabilities", false);
        }
        options.put("allowFolderDownload", Boolean.parseBoolean(propertiesConfig.getProperty("allowFolderDownload")));

        JSONObject security = new JSONObject();
        security.put("allowNoExtension", Boolean.parseBoolean(propertiesConfig.getProperty("allowNoExtension")));
        security.put("editRestrictions", propertiesConfig.getProperty("editRestrictions").split(","));

        JSONObject upload = new JSONObject();
        try {
            upload.put("fileSizeLimit", Long.parseLong(propertiesConfig.getProperty("upload_fileSizeLimit")));
        }catch (NumberFormatException e){
            logger.error("fileSizeLimit -> Format Exception", e);
        }
        upload.put("policy", propertiesConfig.getProperty("upload_policy"));
        upload.put("restrictions", propertiesConfig.getProperty("upload_restrictions").split(","));

        JSONObject sharedConfig = new JSONObject();
        sharedConfig.put("options", options);
        sharedConfig.put("security", security);
        sharedConfig.put("upload", upload);
        attributes.put("config", sharedConfig);

        data.put("attributes", attributes);
        init.put("data", data);
        return init;
    }

    @Override
    public JSONObject actionReadFile(HttpServletRequest request, HttpServletResponse response) throws FileManagerException {
        throw new UnsupportedOperationException();
    }

    @Override
    public JSONObject actionCopy(HttpServletRequest request) throws FileManagerException {
        throw new UnsupportedOperationException();
    }

    protected String getPath(HttpServletRequest request, String parameterName){
        if(request == null) throw new IllegalArgumentException("Request is null");
        String path = request.getParameter(parameterName);
        if(path == null) throw new IllegalArgumentException("Path is null");
        return path.replace("//", "/").replace("..", "");
    };

    protected Map getFileModel(){

        Map model = new HashMap();
        Map modelAttribute = new HashMap();

        model.put("id", "");
        model.put("type", "file");

        modelAttribute.put("name", "");
        modelAttribute.put("extension", "");
        modelAttribute.put("path", "");
        modelAttribute.put("readable", 1);
        modelAttribute.put("writable", 1);
        modelAttribute.put("created", "");
        modelAttribute.put("modified", "");
        modelAttribute.put("timestamp", "");
        modelAttribute.put("height", 0);
        modelAttribute.put("width", 0 );
        modelAttribute.put("size", 0);

        model.put("attributes", modelAttribute);

        return model;
    }

    protected Map getFolderModel(){

        Map model = new HashMap();
        Map modelAttribute = new HashMap();

        model.put("id", "");
        model.put("type", "folder");

        modelAttribute.put("name", "");
        modelAttribute.put("path", "");
        modelAttribute.put("readable", 1);
        modelAttribute.put("writable", 1);
        modelAttribute.put("created", "");
        modelAttribute.put("modified", "");

        model.put("attributes", modelAttribute);

        return model;
    }


    protected final boolean isAllowedImageExt(String ext){
        return Arrays.stream(propertiesConfig.getProperty("outputFilter_images").split(",")).anyMatch(x -> x.equals(ext));
    }

    protected final boolean isAllowedFileType(String file){
        String extension = FileUtils.getExtension(file);

        // no extension
        if(StringUtils.isEmpty(extension)){
            return Boolean.parseBoolean(propertiesConfig.getProperty("allowNoExtension"));
        }

        String[] uploadRestrictions = propertiesConfig.getProperty("upload_restrictions").split(",");
        String uploadPolicy = propertiesConfig.getProperty("upload_policy").toLowerCase();

        if(uploadPolicy.equals("DISALLOW_ALL")){
            return Arrays.stream(uploadRestrictions).anyMatch(x -> x.equals(extension));
        }

        if(uploadPolicy.equals("ALLOW_ALL")){
            return !Arrays.stream(uploadRestrictions).anyMatch(x -> x.equals(extension));
        }

        return true;
    }

    protected final boolean isEditable(String name) {
        String ext = FileUtils.getExtension(name);
        return Arrays.stream(propertiesConfig.getProperty("editRestrictions").split(",")).anyMatch(x -> x.equals(ext));
    }

    protected final boolean isAllowedName(String name, boolean isDir) throws FMSyntaxException{

        if(isDir){

            boolean excluded_dir = Arrays.stream(propertiesConfig.getProperty("excluded_dirs").split(",")).anyMatch(x -> x.equals(name));
            boolean excluded_regex_dir = false;
            try {
                excluded_regex_dir = name.matches(propertiesConfig.getProperty("excluded_dirs_REGEXP"));
            }catch (PatternSyntaxException e){
                throw new FMSyntaxException("Regex Dir Syntax Exception : " + propertiesConfig.getProperty("excluded_dirs_REGEXP") , e);
            }
            return !(excluded_dir || excluded_regex_dir);
        }
        else {
            boolean excluded_file = Arrays.stream(propertiesConfig.getProperty("excluded_files").split(",")).anyMatch(x -> x.equals(name));
            boolean excluded_regex_file = false;
            try {
                excluded_regex_file = name.matches(propertiesConfig.getProperty("excluded_files_REGEXP"));
            }catch (PatternSyntaxException e){
                throw new FMSyntaxException("Regex File Syntax Exception : " + propertiesConfig.getProperty("excluded_files_REGEXP") , e);
            }
            return !(excluded_file || excluded_regex_file);
        }
    }

    protected final BufferedImage generateThumbnail(BufferedImage source) {
        return Scalr.resize(source, Scalr.Method.AUTOMATIC, Scalr.Mode.FIT_TO_WIDTH, Integer.parseInt(propertiesConfig.getProperty("image_thumbnail_maxWidth")), Integer.parseInt(propertiesConfig.getProperty("image_thumbnail_maxHeight")), Scalr.OP_ANTIALIAS);
    }
}