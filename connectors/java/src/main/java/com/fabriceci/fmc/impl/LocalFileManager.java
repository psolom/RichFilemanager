package com.fabriceci.fmc.impl;

import com.fabriceci.fmc.AbstractFileManager;
import com.fabriceci.fmc.error.*;
import com.fabriceci.fmc.util.*;
import org.json.JSONArray;
import org.json.JSONObject;

import javax.imageio.ImageIO;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.Part;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.Date;
import java.util.Locale;
import java.util.Map;

import static com.fabriceci.fmc.util.FileUtils.getExtension;

public class LocalFileManager extends AbstractFileManager {

    private File docRoot;

    public LocalFileManager() throws FMInitializationException {
        this(null,null);
    }

    public LocalFileManager(Map<String,String> options) throws FMInitializationException {
        this(null, options);
    }

    public LocalFileManager(Locale locale) throws FMInitializationException {
        this(locale, null);
    }
    public LocalFileManager(Locale locale, Map<String,String> options) throws FMInitializationException {

        super(locale, options);

        docRoot = new File(propertiesConfig.getProperty("fileRoot"));

        if (docRoot.exists() && docRoot.isFile()) {
            throw new FMInitializationException("File manager root must be a directory !");
        } else if (!docRoot.exists()) {
            try {
                Files.createDirectory(docRoot.toPath(), FileUtils.getPermissions755());
            } catch(IOException e){
                throw new FMInitializationException("Unable the create the doc root directory: " + docRoot.getAbsolutePath(), e);
            }
        }
    }

    @Override
    public JSONObject actionGetFolder(HttpServletRequest request) throws FileManagerException {

        String path =  getPath(request, "path");
        String type = request.getParameter("type");
        File dir = getFile(path);

        if(!dir.exists()){
            return getErrorResponse(dictionnary.getProperty("INVALID_DIRECTORY_OR_FILE"));
        }

        if (!dir.isDirectory()) {
            return getErrorResponse(String.format(dictionnary.getProperty("DIRECTORY_NOT_EXIST"), path));
        }

        if (!dir.canRead()) {
            return getErrorResponse(dictionnary.getProperty("NOT_ALLOWED_SYSTEM"));
        }

        String[] files;
        try {
            files = dir.list();
        } catch (SecurityException e) {
            logger.error("Reading directory's files: " + dir.getName(), e);
            return getErrorResponse(String.format(dictionnary.getProperty("UNABLE_TO_OPEN_DIRECTORY"), path));
        }

        String filePath;
        File file = null;

        JSONArray array = new JSONArray();
        if(files!= null) {
            for (int i = 0; i < files.length; i++) {

                file = new File(docRoot.getPath() + path + files[i]);
                filePath = path + files[i];
                String filename = file.getName();
                if (file.isDirectory()) {
                    if (isAllowedName(filename, file.isDirectory())) {
                        array.put(getFileInfo(filePath + "/"));
                    }
                } else if (isAllowedName(filename, file.isDirectory())) {
                    if (type == null || type.equals("images") && isAllowedImageExt(getExtension(filename))) {
                        array.put(getFileInfo(filePath));
                    }
                }
            }
        }

        return new JSONObject().put("data", array);
    }

    @Override
    public JSONObject actionGetFile(HttpServletRequest request) throws FileManagerException {
        String path =  getPath(request, "path");

        File file = new File(docRoot.getPath() + path);

        if (file.isDirectory()) {
            return getErrorResponse(dictionnary.getProperty("FORBIDDEN_ACTION_DIR"));
        }

        // check if the name is not in "excluded" list
        String filename = file.getName();

        if (!isAllowedName(filename, file.isDirectory())) {
            return getErrorResponse(dictionnary.getProperty("INVALID_DIRECTORY_OR_FILE"));
        }

        // check if file is readable
        if (!file.canRead()) {
            return getErrorResponse(dictionnary.getProperty("NOT_ALLOWED_SYSTEM"));
        }

        return new JSONObject().put("data", new JSONObject(getFileInfo(path)));
    }

    @Override
    public JSONObject actionGetImage(HttpServletRequest request, HttpServletResponse response, Boolean thumbnail) throws FileManagerException {
        InputStream is = null;
        String path = getPath(request, "path");
        File file = getFile(path);

        if (!file.exists()) {
            return getErrorResponse(String.format(dictionnary.getProperty("FILE_DOES_NOT_EXIST"), file.getName()));
        }

        if (file.isDirectory()) {
            return getErrorResponse(dictionnary.getProperty("FORBIDDEN_ACTION_DIR"));
        }

        if (!file.canRead()) {
            return getErrorResponse(dictionnary.getProperty("NOT_ALLOWED_SYSTEM"));
        }

        if (!isAllowedImageExt(getExtension(file.getName()))) {
            return getErrorResponse(dictionnary.getProperty("INVALID_FILE_TYPE"));
        }

        try {
            String filename = file.getName();
            String fileExt = filename.substring(filename.lastIndexOf(".") + 1);
            String mimeType = (!StringUtils.isEmpty(getExtension(fileExt))) ? FileManagerUtils.getMimeTypeByExt(fileExt) : "application/octet-stream";
            long fileSize = file.length();
            if (thumbnail) {

                if (Boolean.parseBoolean(propertiesConfig.getProperty("image_thumbnail_enabled"))) {

                    File thumbnailFile = getThumbnail(path, true);
                    if (thumbnailFile == null) return getErrorResponse(dictionnary.getProperty("ERROR_SERVER"));
                    is = new FileInputStream(thumbnailFile);
                    fileSize = thumbnailFile.length();
                } else {
                    // no cache
                    BufferedImage image = ImageIO.read(file);
                    BufferedImage resizedImage = generateThumbnail(image);
                    ByteArrayOutputStream os = new ByteArrayOutputStream();
                    ImageIO.write(resizedImage, fileExt, os);
                    is = new ByteArrayInputStream(os.toByteArray());
                    fileSize = os.toByteArray().length;
                }

            } else {
                is = new FileInputStream(file);
            }

            response.setContentType(mimeType);
            response.setHeader("Content-Length", Long.toString(fileSize));
            response.setHeader("Content-Transfer-Encoding", "binary");
            response.setHeader("Content-Disposition", "inline; filename=\"" + filename + "\"");

            FileUtils.copy(new BufferedInputStream(is), response.getOutputStream());
        } catch (IOException e) {
            throw new FMIOException("Error serving image: " + file.getName() , e);
        }
        return null;
    }

    @Override
    public JSONObject actionMove(HttpServletRequest request) throws FileManagerException {
        String sourcePath = getPath(request, "old");
        String targetPath = getPath(request, "new");

        // security check
        if (!targetPath.startsWith("/")) targetPath = "/" + targetPath;
        if (!targetPath.endsWith("/")) targetPath += "/";

        File sourceFile = getFile(sourcePath);
        String filename = sourceFile.getName();
        File targetDir = getFile(targetPath);
        File targetFile = getFile(targetPath + "/" + filename);

        String finalPath = targetPath + filename + (sourceFile.isDirectory() ? "/" : "");

        if (!hasPermission("move")) {
            return getErrorResponse(dictionnary.getProperty("NOT_ALLOWED"));
        }
        if (!targetDir.exists() || !targetDir.isDirectory()) {
            return getErrorResponse(String.format(dictionnary.getProperty("DIRECTORY_NOT_EXIST"), targetPath));
        }
        // check system permission
        if (!sourceFile.canRead() && !targetDir.canWrite()) {
            return getErrorResponse(dictionnary.getProperty("NOT_ALLOWED_SYSTEM"));
        }
        // check if not requesting main FM userfiles folder
        if (sourceFile.equals(docRoot)) {
            return getErrorResponse(dictionnary.getProperty("NOT_ALLOWED"));
        }
        // check if name are not excluded
        if (!isAllowedName(targetFile.getName(), false)) {
            return getErrorResponse(dictionnary.getProperty("INVALID_DIRECTORY_OR_FILE"));
        }
        // check if file already exists
        if (targetFile.exists()) {
            if (targetFile.isDirectory()) {
                return getErrorResponse(String.format(dictionnary.getProperty("DIRECTORY_ALREADY_EXISTS"), targetFile.getName()));
            } else {
                return getErrorResponse(String.format(dictionnary.getProperty("FILE_ALREADY_EXISTS"), targetFile.getName()));
            }
        }

        try {
            Files.move(sourceFile.toPath(), targetFile.toPath());
            File thumbnailFile = new File(getThumbnailPath(sourcePath));
            if (thumbnailFile.exists()) {
                if (thumbnailFile.isFile()) {
                    thumbnailFile.delete();
                } else {
                    FileUtils.removeDirectory(thumbnailFile.toPath());
                }
            }
        } catch (IOException e) {
            if (sourceFile.isDirectory()) {
                return getErrorResponse(String.format(dictionnary.getProperty("ERROR_MOVING_DIRECTORY"), sourceFile.getName(), targetPath));
            } else {
                return getErrorResponse(String.format(dictionnary.getProperty("ERROR_MOVING_FILE"), sourceFile.getName(), targetPath));
            }

        }

        return new JSONObject().put("data", new JSONObject(getFileInfo(finalPath)));
    }

    @Override
    public JSONObject actionRename(HttpServletRequest request) throws FileManagerException {

        String sourcePath = getPath(request, "old");
        if (sourcePath.endsWith("/")) {
            sourcePath = sourcePath.substring(0, (sourcePath.length() - 1));
        }

        String targetName = StringUtils.normalize(request.getParameter("new"));

        // get the path
        int pathPos = sourcePath.lastIndexOf("/");
        String path = sourcePath.substring(0, pathPos + 1);
        String targetPath = path + targetName;

        File sourceFile = getFile(sourcePath);
        File fileTo = getFile(targetPath);

        String filename = sourceFile.getName();

        if (!hasPermission("rename")) {
            return getErrorResponse(dictionnary.getProperty("NOT_ALLOWED"));
        }

        if (!sourceFile.exists()) {
            return getErrorResponse(dictionnary.getProperty("NOT_ALLOWED_SYSTEM"));
        }

        // check if file is writable
        if (!sourceFile.canWrite()) {
            return getErrorResponse(dictionnary.getProperty("NOT_ALLOWED_SYSTEM"));
        }

        // check if not requesting main FM userfiles folder
        if (sourceFile.equals(docRoot)) {
            return getErrorResponse(dictionnary.getProperty("NOT_ALLOWED"));
        }

        if (!sourceFile.isDirectory()) {
            if (!isAllowedFileType(targetName)) {
                return getErrorResponse(dictionnary.getProperty("INVALID_FILE_TYPE"));
            }
        }

        if (!isAllowedName(targetName, false)) {
            return getErrorResponse(String.format(dictionnary.getProperty("FORBIDDEN_NAME"), targetName));
        }

        if (fileTo.exists()) {
            if (fileTo.isDirectory()) {
                return getErrorResponse(String.format(dictionnary.getProperty("DIRECTORY_ALREADY_EXISTS"), targetName));
            } else { // fileTo.isFile
                return getErrorResponse(String.format(dictionnary.getProperty("FILE_ALREADY_EXISTS"), targetName));
            }
        } else if (!sourceFile.renameTo(fileTo)) {

            if (sourceFile.isDirectory()) {
                return getErrorResponse(String.format(dictionnary.getProperty("ERROR_RENAMING_DIRECTORY"), filename, targetName));
            } else {
                return getErrorResponse(String.format(dictionnary.getProperty("ERROR_RENAMING_FILE"), filename, targetName));
            }
        }

        File oldThumbnailFile = new File(getThumbnailPath(sourcePath));
        if (oldThumbnailFile.exists()) {
            oldThumbnailFile.renameTo(new File(getThumbnailPath(targetPath)));
        }

        if (fileTo.isDirectory()) {
            if (!targetPath.endsWith("/"))
                targetPath = targetPath + "/";
        }

        return new JSONObject().put("data", new JSONObject(getFileInfo(targetPath)));
    }

    @Override
    public JSONObject actionDelete(HttpServletRequest request) throws FileManagerException {

        String path = getPath(request, "path");
        File thumbnail = new File(getThumbnailPath(path));
        File file = new File(docRoot.getPath() + path);

        if (!hasPermission("delete")) {
            return getErrorResponse(dictionnary.getProperty("NOT_ALLOWED"));
        }

        if (!file.exists() || !isAllowedName(file.getName(), false)) {
            return getErrorResponse(dictionnary.getProperty("INVALID_DIRECTORY_OR_FILE"));
        }

        if (!file.canWrite()) {
            return getErrorResponse(dictionnary.getProperty("NOT_ALLOWED_SYSTEM"));
        }

        if (file.equals(docRoot)) {
            return getErrorResponse(dictionnary.getProperty("NOT_ALLOWED"));
        }

        // Recover the result before the operation
        JSONObject result = new JSONObject().put("data", new JSONObject(getFileInfo(path)));
        if (file.isDirectory()) {
            try {
                FileUtils.removeDirectory(file.toPath());
                if (thumbnail.exists()) {
                    FileUtils.removeDirectory(thumbnail.toPath());
                }
            } catch (IOException e) {
                throw new FMIOException("Error during removing directory: " + file.getName(), e);
            }
        } else {
            if (!file.delete()) {
                return getErrorResponse(String.format(dictionnary.getProperty("ERROR_SERVER"), path));
            }
            if (thumbnail.exists()) thumbnail.delete();
        }

        return result;
    }

    @Override
    public JSONObject actionAddFolder(HttpServletRequest request) throws FileManagerException {

        String path = getPath(request, "path");

        String filename = StringUtils.normalize(request.getParameter("name"));

        if (filename.length() == 0) // the name existed of only special characters
            return getErrorResponse(String.format(dictionnary.getProperty("FORBIDDEN_NAME"), filename));

        File file = new File(docRoot.getPath() + path + filename);
        if (file.isDirectory()) {
            return getErrorResponse(String.format(dictionnary.getProperty("DIRECTORY_ALREADY_EXISTS"), filename));
        }

        try {
            Files.createDirectories(file.toPath(), FileUtils.getPermissions755());
        } catch (IOException e) {
            return getErrorResponse(String.format(dictionnary.getProperty("UNABLE_TO_CREATE_DIRECTORY"), filename));
        }

        return new JSONObject().put("data", new JSONObject(getFileInfo(path + filename + "/")));

    }

    @Override
    public JSONObject actionDownload(HttpServletRequest request, HttpServletResponse response) throws FileManagerException {
        String path = getPath(request, "path");

        File file = getFile(path);
        String filename = file.getName();

        if (!hasPermission("download")) {
            return getErrorResponse(dictionnary.getProperty("NOT_ALLOWED"));
        }

        if (!file.exists()) {
            return getErrorResponse(String.format(dictionnary.getProperty("FILE_DOES_NOT_EXIST"), file.getName()));
        }

        if (!file.canRead()) {
            return getErrorResponse(dictionnary.getProperty("NOT_ALLOWED_SYSTEM"));
        }

        if (!isAllowedName(filename, file.isDirectory())) {
            return getErrorResponse(dictionnary.getProperty("INVALID_DIRECTORY_OR_FILE"));
        }

        if (file.isDirectory()) {

            // check  if permission is granted
            if (!Boolean.parseBoolean(propertiesConfig.getProperty("allowFolderDownload"))) {
                return getErrorResponse(dictionnary.getProperty("NOT_ALLOWED"));
            }

            // check if not requestion the main FM userfiles folder
            if (file.equals(docRoot)) {
                return getErrorResponse(dictionnary.getProperty("NOT_ALLOWED"));
            }
        }

        // Ajax
        if ("XMLHttpRequest".equals(request.getHeader("X-Requested-With"))) {
            return new JSONObject().put("data", new JSONObject(getFileInfo(path)));
        } else {

            try {
                response.setHeader("Content-Description", "File Transfer");
                if (file.isFile()) {
                    String fileExt = filename.substring(filename.lastIndexOf(".") + 1);
                    String mimeType = (!StringUtils.isEmpty(FileManagerUtils.mimetypes.get(fileExt))) ? FileManagerUtils.mimetypes.get(fileExt) : "application/octet-stream";
                    response.setContentLength((int) file.length());
                    response.setContentType(mimeType);
                    response.setHeader("Content-Disposition", "attachment; filename=\"" + filename + "\"");
                    response.setContentLength((int) file.length());

                    FileUtils.copy(new BufferedInputStream(new FileInputStream(file)), response.getOutputStream());
                } else {
                    String[] files = file.list();

                    if (files == null || files.length == 0) {
                        return getErrorResponse(String.format(dictionnary.getProperty("DIRECTORY_EMPTY"), file.getName()));
                    }

                    String zipFileName = FileUtils.getBaseName(path.substring(0, path.length() - 1)) + ".zip";
                    String mimType = FileManagerUtils.mimetypes.get("zip");
                    response.setContentType(mimType);
                    response.setHeader("Content-Disposition", "attachment; filename=\"" + zipFileName + "\"");
                    byte[] zipFileByteArray;
                    try {
                        zipFileByteArray = ZipUtils.zipFolder(file);
                    } catch (IOException e) {
                        throw new FMIOException("Exception during ZipFiles", e);
                    }
                    response.setContentLength(zipFileByteArray.length);

                    FileUtils.copy(new ByteArrayInputStream(zipFileByteArray), response.getOutputStream());
                }

            } catch (IOException e) {
                throw new FMIOException("Download error: " + file.getName(), e);
            }

            return null;
        }
    }

    @Override
    public JSONObject actionUpload(HttpServletRequest request) throws FileManagerException {
        String path = getPath(request, "path");
        File targetDirectory = getFile(path);
        String targetDirectoryString = path.substring(0, path.lastIndexOf("/") + 1);
        if (!hasPermission("upload")) {
            return getErrorResponse(dictionnary.getProperty("NOT_ALLOWED"));
        }

        if(!targetDirectory.exists()){
            return getErrorResponse(String.format(dictionnary.getProperty("DIRECTORY_NOT_EXIST"), path));
        }
        if (!targetDirectory.canWrite()) {
            return getErrorResponse(dictionnary.getProperty("NOT_ALLOWED_SYSTEM"));
        }

        JSONArray array = uploadFiles(request, targetDirectoryString);

        return new JSONObject().put("data", array);

    }

    @Override
    public JSONObject actionCopy(HttpServletRequest request) throws FileManagerException {
        String sourcePath = getPath(request, "source");
        String targetPath = getPath(request, "target");

        // security check
        if (!targetPath.startsWith("/")) targetPath = "/" + targetPath;
        if (!targetPath.endsWith("/")) targetPath += "/";

        File sourceFile = getFile(sourcePath);
        String filename = sourceFile.getName();
        File targetDir = getFile(targetPath);
        File targetFile = getFile(targetPath + filename);

        String finalPath = targetPath + filename + (sourceFile.isDirectory() ? "/" : "");

        if (!hasPermission("copy")) {
            return getErrorResponse(dictionnary.getProperty("NOT_ALLOWED"));
        }
        if (!targetDir.exists() || !targetDir.isDirectory()) {
            return getErrorResponse(String.format(dictionnary.getProperty("DIRECTORY_NOT_EXIST"), targetPath));
        }
        // check system permission
        if (!sourceFile.canRead() && !targetDir.canWrite()) {
            return getErrorResponse(dictionnary.getProperty("NOT_ALLOWED_SYSTEM"));
        }
        // check if not requesting main FM userfiles folder
        if (sourceFile.equals(docRoot)) {
            return getErrorResponse(dictionnary.getProperty("NOT_ALLOWED"));
        }
        // check if name are not excluded
        if (!isAllowedName(targetFile.getName(), false)) {
            return getErrorResponse(dictionnary.getProperty("INVALID_DIRECTORY_OR_FILE"));
        }
        // check if file already exists
        if (targetFile.exists()) {
            if (targetFile.isDirectory()) {
                return getErrorResponse(String.format(dictionnary.getProperty("DIRECTORY_ALREADY_EXISTS"), targetFile.getName()));
            } else {
                return getErrorResponse(String.format(dictionnary.getProperty("FILE_ALREADY_EXISTS"), targetFile.getName()));
            }
        }

        try {
            if (sourceFile.isDirectory()) {
                FileUtils.copyDirectory(sourceFile.toPath(), targetFile.toPath());
            } else {
                Files.copy(sourceFile.toPath(), targetFile.toPath(), StandardCopyOption.REPLACE_EXISTING);
            }

        } catch (IOException e) {
            if (sourceFile.isDirectory()) {
                return getErrorResponse(String.format(dictionnary.getProperty("ERROR_COPYING_DIRECTORY"), filename, targetPath));
            } else {
                return getErrorResponse(String.format(dictionnary.getProperty("ERROR_COPYING_FILE"), filename, targetPath));
            }

        }

        return new JSONObject().put("data", new JSONObject(getFileInfo(finalPath)));
    }

    @Override
    public JSONObject actionReadFile(HttpServletRequest request, HttpServletResponse response) throws FileManagerException {

        String path = getPath(request, "path");

        File file = new File(docRoot.getPath() + path);

        if (!file.exists()) {
            return getErrorResponse(dictionnary.getProperty("INVALID_DIRECTORY_OR_FILE"));
        }

        if (file.isDirectory()) {
            return getErrorResponse(dictionnary.getProperty("FORBIDDEN_ACTION_DIR"));
        }

        if (!isAllowedName(file.getName(), false)) {
            return getErrorResponse(dictionnary.getProperty("INVALID_DIRECTORY_OR_FILE"));
        }

        // check if file is readable
        if (!file.canRead()) {
            return getErrorResponse(dictionnary.getProperty("NOT_ALLOWED_SYSTEM"));
        }

        String filename = file.getName();
        String fileExt = filename.substring(filename.lastIndexOf(".") + 1);
        String mimeType = FileManagerUtils.getMimeTypeByExt(fileExt);
        long fileSize = file.length();

        //TO DO : IMPLEMENT HTTP RANGE FOR STREAM FILE (AUDIO/VIDEO)

        response.setContentType(mimeType);
        response.setHeader("Content-Length", Long.toString(fileSize));
        response.setHeader("Content-Transfer-Encoding", "binary");
        response.setHeader("Content-Disposition", "inline; filename=\"" + filename + "\"");

        try {
            FileUtils.copy(new BufferedInputStream(new FileInputStream(file)), response.getOutputStream());
        } catch (IOException e) {
            throw new FMIOException("Read file error: " + path, e);
        }
        return null;
    }

    @Override
    public JSONObject actionEditFile(HttpServletRequest request) throws FileManagerException {
        String path = getPath(request, "path");
        File file = getFile(path);

        if (!file.exists()) {
            return getErrorResponse(dictionnary.getProperty("INVALID_DIRECTORY_OR_FILE"));
        }

        if (file.isDirectory()) {
            return getErrorResponse(dictionnary.getProperty("NOT_ALLOWED"));
        }

        if (!hasPermission("edit") || !isEditable(file.getName())) {
            return getErrorResponse(dictionnary.getProperty("FORBIDDEN_ACTION_DIR"));
        }

        if (!file.canWrite()) {
            return getErrorResponse(dictionnary.getProperty("NOT_ALLOWED_SYSTEM"));
        }

        if (!isAllowedName(file.getName(), false)) {
            return getErrorResponse(dictionnary.getProperty("INVALID_DIRECTORY_OR_FILE"));
        }

        BufferedReader br = null;
        StringBuilder sb = new StringBuilder();
        try {
            br = new BufferedReader(new FileReader(file));
            for (String line; (line = br.readLine()) != null; ) {
                sb.append(line);
                sb.append('\n');
            }
        } catch (IOException e) {
            throw new FMIOException(e);
        } finally {
            if (br != null) {
                try {
                    br.close();
                } catch (Exception e) {}
            }
        }

        String fileContent = sb.toString();
        Map fileInfo = getFileInfo(path);
        Map attributes = (Map) fileInfo.get("attributes");
        attributes.put("content", fileContent);
        fileInfo.put("attributes", attributes);

        return new JSONObject().put("data", new JSONObject(fileInfo));
    }

    @Override
    public JSONObject actionSaveFile(HttpServletRequest request) throws FileManagerException {
        String path = getPath(request, "path");
        String content = request.getParameter("content");
        File file = getFile(path);

        if (!file.exists()) {
            return getErrorResponse(dictionnary.getProperty("INVALID_DIRECTORY_OR_FILE"));
        }

        if (file.isDirectory()) {
            return getErrorResponse(dictionnary.getProperty("NOT_ALLOWED"));
        }

        if (!hasPermission("edit") || !isEditable(file.getName())) {
            return getErrorResponse(dictionnary.getProperty("FORBIDDEN_ACTION_DIR"));
        }

        if (!file.canWrite()) {
            return getErrorResponse(dictionnary.getProperty("NOT_ALLOWED_SYSTEM"));
        }

        if (!isAllowedName(file.getName(), false)) {
            return getErrorResponse(dictionnary.getProperty("INVALID_DIRECTORY_OR_FILE"));
        }

        try {
            FileOutputStream oldFile = new FileOutputStream(file, false);
            oldFile.write(content.getBytes());
            oldFile.close();
        } catch (IOException e) {
            throw new FMIOException("Error writing modified file", e);
        }

        return new JSONObject().put("data", new JSONObject(getFileInfo(path)));
    }

    @Override
    public JSONObject actionReplace(HttpServletRequest request) throws FileManagerException {
        String path = getPath(request, "path");
        File file = getFile(path);
        File targetDirectory = new File(file.getParent());

        String targetDirectoryString = path.substring(0, path.lastIndexOf("/") + 1);

        if (!hasPermission("replace") || !hasPermission("upload")) {
            return getErrorResponse(dictionnary.getProperty("NOT_ALLOWED"));
        }

        if (file.isDirectory()) {
            return getErrorResponse(dictionnary.getProperty("NOT_ALLOWED"));
        }

        if (!isAllowedName(file.getName(), false)) {
            return getErrorResponse(dictionnary.getProperty("INVALID_DIRECTORY_OR_FILE"));
        }

        if (!targetDirectory.canWrite()) {
            return getErrorResponse(dictionnary.getProperty("NOT_ALLOWED_SYSTEM"));
        }

        JSONArray array = null;

        array = uploadFiles(request, targetDirectoryString);
        file.delete();
        File thumbnail = getThumbnail(path, false);
        if (thumbnail != null && thumbnail.exists()) {
            thumbnail.delete();
        }

        return new JSONObject().put("data", array);
    }

    @Override
    public JSONObject actionSummarize() throws FileManagerException {
        JSONObject attributes = null;
        try {
            attributes = this.getDirSummary(getFile("/").toPath());
        } catch (IOException e) {
            throw new FMIOException("Error during the building of the summary", e);
        }
        JSONObject result = new JSONObject();
        result.put("id", "/");
        result.put("type", "summary");
        result.put("attributes", attributes);
        return new JSONObject().put("data", result);
    }

    private Map getFileInfo(String path) throws FileManagerException {

        // get file
        File file = getFile(path);

        if(file.isDirectory() && !path.endsWith("/")){
            throw new FMIOException("Error reading the file: " + file.getAbsolutePath());
        }

        BasicFileAttributes attr;
        try {
            attr = Files.readAttributes(file.toPath(), BasicFileAttributes.class);
        } catch (IOException e) {
            throw new FMIOException("Error reading the file: " + file.getAbsolutePath(), e);
        }

        // check if file is readable
        boolean isReadable = file.canRead();
        // check if file is writable
        boolean isWritable = file.canWrite();

        Map model;
        Map attributes;
        String filename = file.getName();
        if (file.isDirectory()) {
            model = this.getFolderModel();
            attributes = (Map) model.get("attributes");
        } else {
            model = this.getFileModel();
            attributes = (Map) model.get("attributes");

            String fileExt = getExtension(filename);

            attributes.put("extension", fileExt);

            if (isReadable) {
                attributes.put("size", file.length());
                if (isAllowedImageExt(fileExt)) {
                    Dimension dim;
                    if (file.length() > 0) {
                        dim = ImageUtils.getImageSize(docRoot.getPath() + path);
                    } else {
                        dim = new Dimension(0, 0);
                    }
                    attributes.put("width", dim.getWidth());
                    attributes.put("height", dim.getHeight());
                }
            }
        }

        model.put("id", path);
        attributes.put("name", filename);
        attributes.put("path", getDynamicPath(path));
        attributes.put("readable", isReadable ? 1 : 0);
        attributes.put("writable", isWritable ? 1 : 0);
        attributes.put("timestamp", attr.lastModifiedTime().toMillis());
        attributes.put("modified", df.format(new Date(attr.lastModifiedTime().toMillis())));
        attributes.put("created", df.format(new Date(attr.creationTime().toMillis())));
        model.put("attributes", attributes);
        return model;
    }

    private File getFile(String path) {
        return new File(docRoot.getPath() + path);
    }

    private String getDynamicPath(String path) {
        String serverRoot = propertiesConfig.getProperty("serverRoot");
        return (StringUtils.isEmpty(serverRoot)) ? path : serverRoot + path;
    }

    private File getThumbnailDir() throws FMIOException {

        File thumbnailDir = new File(propertiesConfig.getProperty("image_thumbnail_dir"));

        if (!thumbnailDir.exists()) {
            try {
                Files.createDirectory(thumbnailDir.toPath(), FileUtils.getPermissions755());
            } catch (IOException e) {
                throw new FMIOException("Cannot create the directory: " + thumbnailDir.getAbsolutePath(), e);
            }
        }
        return thumbnailDir;
    }

    private String getThumbnailPath(String path) throws FMIOException {
        return getThumbnailDir().getPath() + path;
    }

    private File getThumbnail(String path, boolean create) throws FMIOException, FMFileNotFoundException {

        File thumbnailFile = new File(getThumbnailPath(path));

        if (thumbnailFile.exists()) {
            return thumbnailFile;
        } else if (!create) {
            return null;
        }

        File originalFile = new File(docRoot.getPath() + path);
        String ext = FileUtils.getExtension(originalFile.getName());

        if (!originalFile.exists())
            throw new FMFileNotFoundException(path);

        try {
            if (!thumbnailFile.mkdirs()) {
                Files.createDirectories(thumbnailFile.getParentFile().toPath());
            }

            BufferedImage source = ImageIO.read(originalFile);
            BufferedImage resizedImage = generateThumbnail(source);
            ImageIO.write(resizedImage, ext, thumbnailFile);
        } catch (IOException e) {
            logger.error("Error during thumbnail generation - ext: " + ext + " name: " + originalFile.getName(), e);
            return null;
        }

        return thumbnailFile;
    }

    private JSONArray uploadFiles(HttpServletRequest request, String targetDirectory) throws FileManagerException {
        JSONArray array = new JSONArray();
        try {
            for (Part uploadedFile : request.getParts()) {

                if (uploadedFile.getContentType() == null) {
                    continue;
                }

                if (uploadedFile.getSize() == 0) {
                    throw new FMUploadException(dictionnary.getProperty("FILE_EMPTY"));
                }

                String submittedFileName = uploadedFile.getSubmittedFileName();
                String filename = StringUtils.normalize(FileUtils.getBaseName(submittedFileName)) + '.' + FileUtils.getExtension(submittedFileName);

                if (!isAllowedName(filename, false)) {
                    throw new FMUnallowedException(filename);
                }
                Long uploadFileSizeLimit = 0L;
                String uploadFileSizeLimitString = propertiesConfig.getProperty("upload_fileSizeLimit");
                try {
                    uploadFileSizeLimit = Long.parseLong(uploadFileSizeLimitString);
                } catch (NumberFormatException e) {
                    throw new FMConfigException(String.format(dictionnary.getProperty("ERROR_CONFIG_FILE"), "upload_fileSizeLimit:" + uploadFileSizeLimitString));
                }

                if (uploadedFile.getSize() > uploadFileSizeLimit) {
                    throw new FMUploadException(dictionnary.getProperty("upload_file_too_big"));
                }

                String uploadedPath = getFile(targetDirectory).getAbsolutePath() + "/" + filename;

                Files.copy(new BufferedInputStream(uploadedFile.getInputStream()), Paths.get(uploadedPath), StandardCopyOption.REPLACE_EXISTING);
                array.put(new JSONObject(getFileInfo(targetDirectory + filename)));
            }
        } catch (IOException|ServletException e){
            throw new FMIOException(dictionnary.getProperty("ERROR_UPLOADING_FILE"), e);
        }
        return array;
    }
}