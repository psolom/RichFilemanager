/*
 *	RichFilemanager.java utility class for for filemanager.jsp
 *
 *	@license	MIT License
 *
 *	@author		Dick Toussaint <d.tricky@gmail.com>
 *
 */
package edu.fuberlin;

import static com.fabriceci.fmc.util.FileUtils.getExtension;

import java.awt.Dimension;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.Date;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

import javax.servlet.ServletContext;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.apache.commons.fileupload.FileItem;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import com.fabriceci.fmc.error.FMIOException;
import com.fabriceci.fmc.error.FileManagerException;
import com.fabriceci.fmc.util.ImageUtils;
import com.fabriceci.fmc.util.StringUtils;

/**
 * 
 * 
 * 
 * CHANGES 
 * August 2016
 * - using {@link Path} instead of {@link File} methods
 * - added mode replace
 * - added interface
 * - adapted download to new two-step mode
 * - optional indirection methods cleanPreview to allow for URL-mapping
 * June 2017
 * - adapted to new version of RichFileManager
 * - using java connector helper classes com.fabriceci.error and com.fabriceci.util   
 * 
 * @author gkallidis
 *
 */
public class RichFileManager extends AbstractFM implements FileManagerI  {

	
	/**
	 * 
	 * @param servletContext
	 * @param request
	 * @throws Exception 
	 */
	
	public RichFileManager(ServletContext servletContext, HttpServletRequest request) throws Exception {
		
		super(servletContext,request);
					
	}
	
	@Override
	public JSONObject getInfo() throws JSONException, FileManagerException {
		this.item = new HashMap<String,Object>();
		this.item.put("properties", this.properties);
		this.getFileInfo("");
		JSONObject array = new JSONObject();
	
		try {
			array.put("path", this.get.get("path"));
			array.put("name", this.item.get("filename"));
			array.put("type", this.item.get("filetype"));
			array.put("attributes", this.item.get("properties"));
			array.put("error", "");
			array.put("code", 0);
		} catch (Exception e) {
			return getErrorResponse("JSONObject error");
		}
		return array;
	}
	
	@Override
	public JSONObject preview(HttpServletRequest request, HttpServletResponse resp) throws JSONException {
		
		Path file =this.documentRoot.resolve(this.get.get("path"));
		boolean thumbnail = false;
		String paramThumbs  =request.getParameter("thumbnail");
		if (paramThumbs != null && paramThumbs.equals("true")) {
			thumbnail = true;
		}
		long size = 0;
		try {
			size = Files.size(file);
		} catch (IOException e) {
			return getErrorResponse(sprintf(lang("INVALID_DIRECTORY_OR_FILE"), file.toFile().getName()));
		}
		
		if (this.get.get("path") != null && Files.exists(file)) {
			resp.setHeader("Content-type", "image/"+ getFileExtension(file.toFile().getName())); // octet-stream" + getFileExtension(file.toFile().getName()));
			resp.setHeader("Content-Transfer-Encoding", "Binary");
			resp.setHeader("Content-length", "" + size);
			resp.setHeader("Content-Disposition", "inline; filename=\"" + getFileBaseName(file.toFile().getName()) + "\"");
			// handle caching
			resp.setHeader("Pragma", "no-cache");
			resp.setHeader("Expires", "0");
			resp.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
			readSmallFile(resp, file);
		} else {
			return getErrorResponse(sprintf(lang("FILE_DOES_NOT_EXIST"), this.get.get("path")));
		}
		return null;
	}

	// expect small filesw
	protected JSONObject readSmallFile(HttpServletResponse resp, Path file) throws JSONException {
		OutputStream os = null;
		try {
			os = resp.getOutputStream();
			os.write(Files.readAllBytes(file));
		} catch (Exception e) {
			return getErrorResponse(sprintf(lang("INVALID_DIRECTORY_OR_FILE"), file.toFile().getName()));
		} finally {
			try {
				if (os != null)
					os.close();
			} catch (Exception e2) {
			}
		}
		return null;
	}
	
	
	@Override
	public JSONObject getFolder(HttpServletRequest request) throws JSONException, IOException, FileManagerException {
		JSONArray array = new JSONArray();

		boolean showThumbs = false;
		String paramshowThumbs = request.getParameter("showThumbs");
		if (paramshowThumbs != null ) {
			showThumbs = true;
		}
//		boolean isRoot = this.get.get("path").equals("/")? true:false;
//		// replace 
//		String path = this.get.get("path"); //.replaceFirst("^/", ""); 
		
		log.debug("resolving path:" + this.get.get("path") + " in docroot "+ documentRoot);
		
		Path root  = null;
		// we are already
		if (documentRoot.endsWith(this.get.get("path")) || 
				(
				this.get.get("path") != null && 
				!this.get.get("path").equals("") &&
				!this.get.get("path").equals("/") && 
				documentRoot.toString().indexOf(this.get.get("path")) > 0) 
				) {
			root = documentRoot;
			log.debug("documentRoot ends with path, set to dr:" + root.toAbsolutePath());
		} else {
			// default or success
			root = documentRoot.resolve(this.get.get("path"));			
		}
		
		if (!root.toFile().exists() || !root.toFile().isDirectory()) {
			log.warn("path problem root does not exist or is no folder:" + root.toAbsolutePath());
			root = documentRoot;
			log.debug("reset path to documentRoot:" + root.toAbsolutePath());
		} else {
			log.debug("path absolute:" + root.toAbsolutePath());			
		}

		Path docDir = root.toRealPath(LinkOption.NOFOLLOW_LINKS);
		File dir = docDir.toFile(); //new File(documentRoot + this.get.get("path"));
	
		File file = null;
		if (!dir.isDirectory()) {
			return getErrorResponse(sprintf(lang("DIRECTORY_NOT_EXIST"), this.get.get("path")));
		} else {
			if (!dir.canRead()) {
				return getErrorResponse(sprintf(lang("UNABLE_TO_OPEN_DIRECTORY"), this.get.get("path")));
			} else {
				String[] files = dir.list();
				for (int i = 0; i < files.length; i++) {
					file = docDir.resolve(files[i]).toFile();
					if (file.isDirectory() && !contains(propertiesConfig.getProperty("unallowed_dirs"), files[i])) {
						try { // getFile(path) getFolderModel(file);
							array.put( getFileInfo(this.get.get("path") + files[i] + "/") );
							
						} catch (Exception e) {
							return getErrorResponse("JSONObject error");
						}
					} else if (file.canRead() && (!contains(propertiesConfig.getProperty("unallowed_files"), files[i])) ) {
						this.item = new HashMap<String,Object>();
						this.item.put("properties", this.properties);
						array.put( getFileInfo(this.get.get("path") + files[i]) );
					} else {
					    log.warn( "not allowed file or dir:" +files[i] );
					}
				}
			}
		}
		log.debug("array size ready:"+ ((array != null)?array.toString():"") );		
		return new JSONObject().put("data", array);
	}
	
	private Map getFileInfo(String path) throws FileManagerException {

        // get file
        File file = getFile(path);

        if(file.isDirectory() && !path.endsWith("/")){
            throw new FMIOException("Error reading the file (file as directory not allowed): " + file.getAbsolutePath());
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
                        dim = ImageUtils.getImageSize(documentRoot.resolve(path).toString() );
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
      if (path.equals("/")) {
    	  path = ""; // otherwise resolve interprets this as absolute root (like in unix)
      }
      return documentRoot.resolve(path).toFile();
    }

    private String getDynamicPath(String path) {
        String serverRoot = propertiesConfig.getProperty("serverRoot");
        return (StringUtils.isEmpty(serverRoot)) ? path : serverRoot + path;
    }

	/**
	 * path file name path
	 */
	@Override
	public JSONObject download(HttpServletRequest request, HttpServletResponse resp) throws JSONException, FileManagerException {
		File file = this.documentRoot.resolve(this.get.get("path")).toFile();
		if (this.get.get("path") != null && file.exists()) {
            resp.setHeader("Content-Description", "File Transfer");
            //resp.setHeader("Content-Type", "application/force-download");
            //resp.setHeader("Content-Disposition", "inline;filename=\"" + documentRoot.resolve(this.get.get("path")).toString() + "\"");
            resp.setHeader("Content-Transfer-Encoding", "Binary");
            resp.setHeader("Content-Length", "" + file.length());
            resp.setHeader("Content-Type", "application/octet-stream");
            resp.setHeader("Content-Disposition", "attachment; filename=\"" + file.getName() + "\"");
            // handle caching
            resp.setHeader("Pragma", "public");
            resp.setHeader("Expires", "0");
            resp.setHeader("Cache-Control", "must-revalidate, post-check=0, pre-check=0");
            this.error = null;
            readFile(resp, file);
            log("file downloaded \""+ file.getAbsolutePath() + "\"");
            return null;
		} else {
			return getErrorResponse(sprintf(lang("FILE_DOES_NOT_EXIST"), this.get.get("path")));
		}
	}
	
	/**
	 * path: folder 
	 * files, filename in form-data
	 */
	@Override
	public JSONObject add() throws JSONException {
		JSONArray array = new JSONArray();
		Iterator<FileItem> it = this.files.iterator();
		String mode = "";
		String currentPath = "";
		long size = 0;
		if (!it.hasNext()) {
			return getErrorResponse(lang("INVALID_FILE_UPLOAD"));
		} else {
			String fileName = "";
			FileItem targetItem = null;
			try {
				while (it.hasNext()) {
					FileItem item = it.next();
					if (item.isFormField()) {
						if (item.getFieldName().equals("mode")) {
							mode = item.getString();
							// v1.0.6 renamed mode add to upload
							if (!mode.equals("upload")  && !mode.equals("add") && !mode.equals("replace")) {
								//this.error(lang("INVALID_FILE_UPLOAD"));
							} 
						} else if (item.getFieldName().equals("path")) {
							currentPath = item.getString();
						} else if (item.getFieldName().equals("newfilepath")){
							currentPath = item.getString();
						}
					} else if ( item.getFieldName().equals("files")) { // replace
						//replace= true;
						size = item.getSize();
						targetItem =item; 
						// v1.0.6 renamed mode add to upload
						if (mode.equals("add") || mode.equals("upload")) {
							fileName = item.getName();
							// set fileName
						}
					} else if (item.getFieldName().equals("newfile")) {
						fileName = item.getName();
						// strip possible directory (IE)
						int pos = fileName.lastIndexOf(File.separator);
						if (pos > 0) {
							fileName = fileName.substring(pos + 1);
						}
						size = item.getSize();
						targetItem =item;
					}
				}
				if (mode.equals("replace")) {
					String tmp[] = currentPath.split("/");
					fileName = tmp[tmp.length - 1];
					int pos = fileName.lastIndexOf(File.separator);
					if (pos > 0)
						fileName = fileName.substring(pos + 1);
					if (fileName != null) {
						currentPath = currentPath.replace(fileName, "");
						currentPath = currentPath.replace("//", "/");
					}
				} else {
					if (!isImage(fileName)
							&& (propertiesConfig.getProperty("upload-imagesonly") != null
									&& propertiesConfig.getProperty("upload-imagesonly").equals("true") || this.params
									.get("type") != null && this.params.get("type").equals("Image"))) {
						return getErrorResponse(lang("UPLOAD_IMAGES_ONLY"));
					}	
				}
				fileName = cleanFileNameDefault(fileName);
				long maxSize = 0;
				if (propertiesConfig.getProperty("upload-size") != null) {
					maxSize = Integer.parseInt(propertiesConfig.getProperty("upload-size"));
					if (maxSize != 0 && size > (maxSize * 1024 * 1024)) {
						return  getErrorResponse(sprintf(lang("UPLOAD_FILES_SMALLER_THAN"), maxSize + "Mb"));
					}
				}
				currentPath = currentPath.replaceFirst("^/", "");// relative
				Path path = currentPath.equals("")? this.documentRoot: this.documentRoot.resolve(currentPath);
				if (propertiesConfig.getProperty("upload-overwrite").toLowerCase().equals("false")) {							
					fileName = this.checkFilename(path.toString(), fileName, 0);
				}
				if (mode.equals("replace")) {
					File saveTo = path.resolve(fileName).toFile();
					targetItem.write(saveTo);
					log.info("saved "+ saveTo);
				} else {
					fileName = fileName.replace("//", "/").replaceFirst("^/", "");// relative
					File saveTo = path.resolve(fileName).toFile();
					targetItem.write(saveTo);
					log.info("saved "+ saveTo);
				}
				array.put(new JSONObject(getFileInfo(currentPath + fileName)));
				return new JSONObject().put("data", array);
			} catch (Exception e) {
				return getErrorResponse(lang("INVALID_FILE_UPLOAD"));
			}
		}
	}
	
	
	/**
	 * old: fileName
	 * new: folder
	 */
	@Override
	public JSONObject moveItem() throws JSONException, FileManagerException {
	   String itemName = this.get.get("old");
	   JSONObject array = null;
	   String tmp[] = itemName.split("/");
	   String filename = tmp[tmp.length - 1];
	   int pos = itemName.lastIndexOf("/");
	   
	   Path fileTo = null;
	   if (pos > 0 && itemName.contains("..")) {
		   String path = itemName.substring(0, pos + 1);
		   fileTo = this.documentRoot.resolve(path); // from subfolder, folder could be .. check later in root
	   } else {
		   fileTo = this.documentRoot;
	   }
	   //String root =  this.get.get("root"); // slash at beginning and end
	   String folder =  this.get.get("new");
	   if (folder.trim().startsWith( "/")) { // absolute path is not allowed, this is then just root folder
	       folder = folder.trim().replaceFirst( "/", "" );
	   } 
	   if (!folder.trim().endsWith( "/")) { // absolute path is not allowed, this is then just root folder
	       folder = folder.trim() + "/";
	   }
	   // allow sub folder slash
	   folder = cleanFileName(folder, new char[]{ '/', '.', '-' }, null);
	   Path fileFrom = null;

	   try {
	       fileFrom = this.documentRoot.resolve(itemName);
	       fileTo = fileTo.resolve(folder).resolve(filename).normalize();
	       
	       if (!fileTo.toString().contains(this.documentRoot.toString())) {
	    	   log.error( "file is not in root folder "+ this.documentRoot
	                   +" but " + fileTo);
	    	  return getErrorResponse(sprintf(lang("ERROR_RENAMING_FILE"), filename + "#" + this.get.get("new")));
	       }
	       if (fileFrom.equals(fileTo)) {
	    	   return getErrorResponse(sprintf(lang("FILE_ALREADY_EXISTS"), filename));
	       }
		   log.info( "moving file from "+ this.documentRoot.resolve(this.get.get("old"))
                   +" to " + this.documentRoot.resolve(folder).resolve(filename));
	       if (Files.exists(fileTo)) {
	           if (Files.isDirectory(fileTo)) {
	        	   return getErrorResponse(sprintf(lang("DIRECTORY_ALREADY_EXISTS"),this.documentRoot.resolve(folder).resolve(filename).toString()));
	           } else { // fileTo.isFile
	        	   return getErrorResponse(sprintf(lang("FILE_ALREADY_EXISTS"), filename ));
	           }
	       } else {
	    	   Files.move(fileFrom, fileTo);
	       }
	   } catch (Exception e) {
	       if (Files.isDirectory(fileFrom)) {
	    	   return getErrorResponse(sprintf(lang("ERROR_RENAMING_DIRECTORY"), filename + "#" + this.get.get("new")));
	       } else {
	    	   return getErrorResponse(sprintf(lang("ERROR_RENAMING_FILE"), filename + "#" + this.get.get("new")));
	       }
	   }     
       array = new JSONObject().put("data", new JSONObject(getFileInfo( 
	    		   folder +filename
	    		   )));;
	   return array;
	}
	
	/**
	 * old: old relative file path
	 * new: new file name without path
	 */
	@Override
	public JSONObject rename() throws JSONException, FileManagerException {
		String relativePath = this.get.get("old");
		if (relativePath.endsWith("/")) {
			//this.get.put("old", (this.get.get("old")).substring(0, ((this.get.get("old")).length() - 1)));
			relativePath = relativePath.replaceFirst("/$", "");
		}
		JSONObject array = null;
		String tmp[] = relativePath.split("/");
		String filename = tmp[tmp.length - 1];
		int pos = relativePath.lastIndexOf("/");
		String path = relativePath.substring(0, pos + 1);
		
		if (path.startsWith("/")) {
			path.replaceAll("^/", "");
		}
		
		Path fileFrom = null;
		Path fileTo = null;
		String newFileName = cleanFileNameDefault(this.get.get("new"));
		
		try {
			fileFrom = this.documentRoot.resolve(path).resolve(filename);
			

			
			/*String tmpOldFileName = cleanFileNameDefault(filename);
			// check if local file name was invalid and new name is the same as old,
			//then do renaming and do not throw file already exists
			if (tmpOldFileName.equals(filename) &&
					newFileName.equals(tmpOldFileName)	) {
			}
			*/
				
			fileTo = this.documentRoot.resolve(path).resolve(newFileName);
		
			if (fileTo.toFile().exists()) {
				if (fileTo.toFile().isDirectory()) {
					return getErrorResponse(sprintf(lang("DIRECTORY_ALREADY_EXISTS"), newFileName));
				} else { // fileTo.isFile
					// Files.isSameFile(fileFrom, fileTo);
					return getErrorResponse(sprintf(lang("FILE_ALREADY_EXISTS"), newFileName));
				}
			} else {
				//if (fileFrom.equals(fileTo));
				Files.move(fileFrom, fileTo, StandardCopyOption.REPLACE_EXISTING);
			}
		} catch (Exception e) {
			if (fileFrom.toFile().isDirectory()) {
				return getErrorResponse(sprintf(lang("ERROR_RENAMING_DIRECTORY"), filename + "#" + this.get.get("new")),e);
			} else {
				return getErrorResponse(sprintf(lang("ERROR_RENAMING_FILE"), filename + "#" + this.get.get("new")),e);
			}
		}
		return new JSONObject().put("data", new JSONObject(getFileInfo(path + newFileName)));
	}
	
	/**
	 * path: folder or file to delete
	 */
	@Override
	public JSONObject delete() throws JSONException, FileManagerException {
		
		String targetPath =  this.get.get("path");
		File file = this.documentRoot.resolve(targetPath).toFile();
				//new File(this.documentRoot + this.get.get("path"));
		 // Recover the result before the operation
        JSONObject result = new JSONObject().put("data", new JSONObject(getFileInfo(
        		this.get.get("path")
        		)));
		if (file.isDirectory()) {
			this.unlinkRecursive(this.documentRoot.resolve(targetPath).toFile(), true);

		} else if (file.exists()) {
			if (!file.delete()) {
				return getErrorResponse(sprintf(lang("ERROR_DELETING FILE"), this.get.get("path")));
			}
		} else {
			return getErrorResponse(lang("INVALID_DIRECTORY_OR_FILE"));
		}
		return result;
	}

	/**
	 * path: root folder
	 * name: new folder name
	 */
	@Override
	public JSONObject addFolder() throws JSONException, FileManagerException {
		char allowed[] = { '/', '-', ' ' };
		String filename = cleanFileName(this.get.get("name"), allowed, "");
		if (filename.length() == 0) // the name existed of only special
									// characters
			return getErrorResponse(sprintf(lang("UNABLE_TO_CREATE_DIRECTORY"), this.get.get("name")));
		else {
			String targetPath =  this.get.get("path");// may be empty
			if (!targetPath.startsWith("/") ) {
				targetPath += targetPath.replaceFirst("^/", "");
			}
			if (!filename.endsWith("/")) filename += "/";
			File file = this.documentRoot.resolve(targetPath).resolve(filename).toFile();
			if (file.isDirectory()) {
				return getErrorResponse(sprintf(lang("DIRECTORY_ALREADY_EXISTS"), filename));
			} else if (!file.mkdir()) {
				return getErrorResponse(sprintf(lang("UNABLE_TO_CREATE_DIRECTORY"), filename));
			} else {
				try {
					String parent = (this.get.get("path").equals(""))? "/": this.get.get("path");
				} catch (Exception e) {
					return getErrorResponse("JSONObject error");
				}
			}
			return new JSONObject().put("data", new JSONObject(getFileInfo(targetPath + filename + "/")));
		}
	}
	
	/**
	 * source: source file
	 * target: target folder
	 */
    @Override
    public JSONObject copyItem(HttpServletRequest request) throws FileManagerException, JSONException {
        String sourcePath = getPath(request, "source");
        String targetPath = getPath(request, "target");
        
        // security check target must be folder
        if (!targetPath.endsWith("/")) targetPath += "/";

        File sourceFile = getFile(sourcePath);
        String filename = sourceFile.getName();
        File targetDir = getFile(targetPath);
        File targetFile = getFile(targetPath + filename);

        String finalPath = targetPath + filename + (sourceFile.isDirectory() ? "/" : "");

        if (!hasPermission("copy")) {
            return getErrorResponse(lang("NOT_ALLOWED"));
        }
        if (!targetDir.exists() || !targetDir.isDirectory()) {
            return getErrorResponse(String.format(lang("DIRECTORY_NOT_EXIST"), targetPath));
        }
        // check system permission
        if (!sourceFile.canRead() && !targetDir.canWrite()) {
            return getErrorResponse(lang("NOT_ALLOWED_SYSTEM"));
        }
        // check if not requesting main FM file root folder
        if (sourceFile.equals(documentRoot.toFile())) {
            return getErrorResponse(lang("NOT_ALLOWED"));
        }
        // check if name are not excluded
        if (!isAllowedName(targetFile.getName(), false)) {
            return getErrorResponse(lang("INVALID_DIRECTORY_OR_FILE"));
        }
        // check if file already exists
        if (targetFile.exists()) {
            if (targetFile.isDirectory()) {
                return getErrorResponse(String.format(lang("DIRECTORY_ALREADY_EXISTS"), targetFile.getName()));
            } else {
                return getErrorResponse(String.format(lang("FILE_ALREADY_EXISTS"), targetFile.getName()));
            }
        }

        try {
        	// folder copy not supported yet
        	if (sourceFile.isDirectory()) {
            	return getErrorResponse(lang("NOT_ALLOWED"));
            } else {
                Files.copy(sourceFile.toPath(), targetFile.toPath(), StandardCopyOption.REPLACE_EXISTING);
            }

        } catch (IOException e) {
            if (sourceFile.isDirectory()) {
                return getErrorResponse(String.format(lang("ERROR_COPYING_DIRECTORY"), filename, targetPath));
            } else {
                return getErrorResponse(String.format(lang("ERROR_COPYING_FILE"), filename, targetPath));
            }

        }

        return new JSONObject().put("data", new JSONObject(getFileInfo(finalPath)));
    }

	
	@Override
	public JSONObject summarize() throws FMIOException, JSONException {
		JSONObject attributes = null;
        try {
            attributes = getDirSummary(getFile("/").toPath());
        } catch (Exception e) {
            throw new FMIOException("Error during the building of the summary", e);
        }
        JSONObject result = new JSONObject();
        result.put("id", "/");
        result.put("type", "summary");
        result.put("attributes", attributes);
        return new JSONObject().put("data", result);
	}
	
	@Override
	public void loadLanguageFile() throws FileManagerException {

		// we load langCode var passed into URL if present
		// else, we use default configuration var
		if (language == null || reload) {
			String lang = "";
			if (params.get("langCode") != null)
				lang = this.params.get("langCode");
			else
				lang = propertiesConfig.getProperty("culture");
			BufferedReader br = null;
			InputStreamReader isr = null;
			String text;
			StringBuffer contents = new StringBuffer();
			try {
				isr = new InputStreamReader(
						new FileInputStream(
								this.fileManagerRoot
								.resolve("languages/")
								.resolve(lang+ ".json").toString()
								), "UTF-8");
				br = new BufferedReader(isr);
				while ((text = br.readLine()) != null)
					contents.append(text);
				language = new JSONObject(contents.toString());
			} catch (Exception e) {
				throw new FileManagerException("Fatal error: Language file not found.");
			} finally {
				try {
					if (br != null)
						br.close();
				} catch (Exception e2) {
				}
				try {
					if (isr != null)
						isr.close();
				} catch (Exception e2) {
				}
			}
		}
	}
	
}
