package edu.fuberlin;

import java.io.IOException;
import java.nio.file.FileVisitOption;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;
import java.text.DateFormat;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Properties;
import java.util.regex.PatternSyntaxException;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

//import org.imgscalr.Scalr;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.fabriceci.fmc.error.FMSyntaxException;
import com.fabriceci.fmc.util.FileUtils;
import com.fabriceci.fmc.util.StringUtils;

/**
 * - stubbed version of  com.fabriceci.fmc.AbstractFileManager:
 * <li>adapted method {@link #isAnyMatch(String[], String)} downgrading from Java 8 to Java 7 syntax
 * <li>simplified loading of locale and dateformat in subclass after loading configuration (skipping constructor)
 * <li>getFileModel, getFolderModel, getErrorResponse, isAllowedName, isAllowedFileType plain copied 
 * <li>{@link #getDirSummary(Path)} with maxDepth, modified folder counter and more generic walkFileTree,
 * <li>{@link #getErrorResponse(String, Exception)} with message instead of title attribute
 * 
 * @author gkallidis
 *
 */
public abstract class AbstractFileManager  {

    protected final Logger logger = LoggerFactory.getLogger(AbstractFileManager.class);

    protected Properties propertiesConfig = new Properties();

    protected DateFormat df;
    protected Locale locale;
    
    public AbstractFileManager() {
	}
    
    protected final JSONObject getErrorResponse(String msg, Exception ex) throws JSONException {

        JSONObject errorInfo = new JSONObject();

        try {
            errorInfo.put("id", "server");
            errorInfo.put("code", "500");
            errorInfo.put("message", msg);
            
            if (propertiesConfig.getProperty("errorObject_arguments_redirect") != null 
            		&& !propertiesConfig.getProperty("errorObject_arguments_redirect").equals("")) {
            	 JSONObject redirect = new JSONObject();
            	 redirect.put("redirect", propertiesConfig.getProperty("errorObject_arguments_redirect"));	
            	 errorInfo.put("arguments",redirect);
            } else {
                errorInfo.put("arguments", new JSONObject());
            } 
            
            if (ex != null) {
            	logger.warn( msg, ex);
            } else {
            	logger.warn(msg); 
            }

        } catch (JSONException e) {
            logger.error("JSONObject error", e);
        }
        return new JSONObject().put("errors", new JSONArray().put(errorInfo));
    }


    /**
     * limit maxDepth to 10
     * 
     * @param path
     * @return
     * @throws IOException
     */
    public static JSONObject getDirSummary(Path path) throws IOException
    {

        final Map<String, Long> result =  new HashMap();
        result.put("files", 0L);
        result.put("folders", -1L); // minus root folder  
        result.put("size", 0L);
        
        int maxDepth = 10;
        EnumSet<FileVisitOption> opts = EnumSet.noneOf(FileVisitOption.class);

        Files.walkFileTree(path, opts, maxDepth, new SimpleFileVisitor<Path>()
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
        return isAnyMatch(propertiesConfig.getProperty("capabilities").split(","), action);
        //Arrays.stream(propertiesConfig.getProperty("capabilities").split(",")).anyMatch(x -> x.equals(action));
    }

    protected String getPath(HttpServletRequest request, String parameterName){
        if(request == null) throw new IllegalArgumentException("Request is null");
        String path = request.getParameter(parameterName);
        if(path == null) throw new IllegalArgumentException("Path is null");
        return path.replace("//", "/").replace("..", "");
    };

    protected Map getFileModel(){

        Map<String,Object> model = new HashMap<String,Object>();
        Map<String,Object> modelAttribute = new HashMap<String,Object>();

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

        Map<String,Object> model = new HashMap<String,Object>();
        Map<String,Object> modelAttribute = new HashMap<String,Object>();

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
        return isAnyMatch(propertiesConfig.getProperty("outputFilter_images").split(","), ext); 
        		//Arrays.stream(propertiesConfig.getProperty("outputFilter_images").split(",")).anyMatch(x -> x.equals(ext));
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
            return isAnyMatch(uploadRestrictions,extension);
            		//Arrays.stream(uploadRestrictions).anyMatch(x -> x.equals(extension));
        }

        if(uploadPolicy.equals("ALLOW_ALL")){
            return ! isAnyMatch(uploadRestrictions,extension);
        }

        return true;
    }
    
    protected boolean isAnyMatch(String[] arrstr, String criteria) {
    	boolean isAnyMatch = false;
    	  for(String i : arrstr){
    	    if(i.equals(criteria)){
    	      isAnyMatch = true;
    	      break;
    	    }
    	  }
    	  return isAnyMatch;
    }
    

    protected final boolean isEditable(String name) {
        String ext = FileUtils.getExtension(name);
        return  isAnyMatch(propertiesConfig.getProperty("editRestrictions").split(","), ext); 
        		//Arrays.stream(propertiesConfig.getProperty("editRestrictions").split(",")).anyMatch(x -> x.equals(ext));
    }

    protected final boolean isAllowedName(String name, boolean isDir) throws FMSyntaxException{

        if(isDir){

            boolean excluded_dir = isAnyMatch(propertiesConfig.getProperty("excluded_dirs").split(","), name); 
            		//Arrays.stream(propertiesConfig.getProperty("excluded_dirs").split(",")).anyMatch(x -> x.equals(name));
            boolean excluded_regex_dir = false;
            try {
                excluded_regex_dir = name.matches(propertiesConfig.getProperty("excluded_dirs_REGEXP"));
            }catch (PatternSyntaxException e){
                throw new FMSyntaxException("Regex Dir Syntax Exception : " + propertiesConfig.getProperty("excluded_dirs_REGEXP") , e);
            }
            return !(excluded_dir || excluded_regex_dir);
        } else {
            boolean excluded_file =
            		isAnyMatch(propertiesConfig.getProperty("excluded_files").split(","), name); 
            		//Arrays.stream(propertiesConfig.getProperty("excluded_files").split(",")).anyMatch(x -> x.equals(name));
            boolean excluded_regex_file = false;
            try {
                excluded_regex_file = name.matches(propertiesConfig.getProperty("excluded_files_REGEXP"));
            }catch (PatternSyntaxException e){
                throw new FMSyntaxException("Regex File Syntax Exception : " + propertiesConfig.getProperty("excluded_files_REGEXP") , e);
            }
            return !(excluded_file || excluded_regex_file);
        }
    }

}