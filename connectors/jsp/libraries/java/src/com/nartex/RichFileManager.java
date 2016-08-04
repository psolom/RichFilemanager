/*
 *	Filemanager.java utility class for for filemanager.jsp
 *
 *	@license	MIT License
 *	@author		Dick Toussaint <d.tricky@gmail.com>
 *	@copyright	Authors
 */
package com.nartex;

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
import java.util.Date;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedHashMap;

import javax.servlet.ServletContext;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.apache.commons.fileupload.FileItem;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

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
 * - optional indirection methods cleanPreview and getPreviewFolder to allow for URL-mapping  
 * 
 * @author gkallidis
 *
 */
public class RichFileManager extends AbstractFM implements FileManagerI  {


	
	/**
	 * 
	 * @param servletContext
	 * @param request
	 * @throws IOException 
	 */
	
	public RichFileManager(ServletContext servletContext, HttpServletRequest request) throws IOException {
		
		super(servletContext,request);
					
	}
	
	@Override
	public JSONObject getInfo() throws JSONException {
		this.item = new HashMap<String,Object>();
		this.item.put("properties", this.properties);
		this.getFileInfo("", false);
		JSONObject array = new JSONObject();
	
		try {
			array.put("Path", this.get.get("path"));
			array.put("Filename", this.item.get("filename"));
			array.put("File Type", this.item.get("filetype"));
			array.put("Properties", this.item.get("properties"));
			array.put("Error", "");
			array.put("Code", 0);
		} catch (Exception e) {
			this.error("JSONObject error");
		}
		return array;
	}
	
	@Override
	public void preview(HttpServletRequest request, HttpServletResponse resp) {
		
		Path file =this.documentRoot.resolve(cleanPreview(this.get.get("path")));
		boolean thumbnail = false;
		String paramThumbs  =request.getParameter("thumbnail");
		if (paramThumbs != null && paramThumbs.equals("true")) {
			thumbnail = true;
		}
		long size = 0;
		try {
			size = Files.size(file);
		} catch (IOException e) {
			this.error(sprintf(lang("INVALID_DIRECTORY_OR_FILE"), file.toFile().getName()));
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
			error(sprintf(lang("FILE_DOES_NOT_EXIST"), this.get.get("path")));
		}
	}

	// expect small filesw
	protected void readSmallFile(HttpServletResponse resp, Path file) {
		OutputStream os = null;
		try {
			os = resp.getOutputStream();
			os.write(Files.readAllBytes(file));
		} catch (Exception e) {
			this.error(sprintf(lang("INVALID_DIRECTORY_OR_FILE"), file.toFile().getName()));
		} finally {
			try {
				if (os != null)
					os.close();
			} catch (Exception e2) {
			}
		}
	}
	

	
	@Override
	public JSONObject getFolder(HttpServletRequest request) throws JSONException, IOException {
		JSONObject array = null;

		boolean showThumbs = false;
		String paramshowThumbs = request.getParameter("showThumbs");
		if (paramshowThumbs != null ) {
			showThumbs = true;
		}
		Path root = documentRoot.resolve(this.get.get("path"));
		log.debug("path absolute:" + root.toAbsolutePath());
		Path docDir = documentRoot.resolve(this.get.get("path")).toRealPath(LinkOption.NOFOLLOW_LINKS);
		File dir = docDir.toFile(); //new File(documentRoot + this.get.get("path"));
	
		File file = null;
		if (!dir.isDirectory()) {
			this.error(sprintf(lang("DIRECTORY_NOT_EXIST"), this.get.get("path")));
		} else {
			if (!dir.canRead()) {
				this.error(sprintf(lang("UNABLE_TO_OPEN_DIRECTORY"), this.get.get("path")));
			} else {
				array = new JSONObject();
				String[] files = dir.list();
				JSONObject data = null;
				JSONObject props = null;
				for (int i = 0; i < files.length; i++) {
					data = new JSONObject();
					props = new JSONObject();
					file = docDir.resolve(files[i]).toFile();
							//new File(documentRoot + this.get.get("path") + files[i]);
					if (file.isDirectory() && !contains(config.getProperty("unallowed_dirs"), files[i])) {
						try {
							props.put("Date Created", (String) null);
							props.put("Date Modified", (String) null);
							props.put("Height", (String) null);
							props.put("Width", (String) null);
							props.put("Size", (String) null);
							data.put("Path", this.get.get("path") + files[i] + "/");
							data.put("Filename", files[i]);
							data.put("File Type", "dir");
							data.put("Thumbnail",
									config.getProperty("icons-path") + config.getProperty("icons-directory"));
							data.put("Error", "");
							data.put("Code", 0);
							data.put("Properties", props);
	
							array.put(this.get.get("path") + files[i] + "/", data);
						} catch (Exception e) {
							this.error("JSONObject error");
						}
					} else if (file.canRead() && (!contains(config.getProperty("unallowed_files"), files[i])) ) {
						this.item = new HashMap<String,Object>();
						this.item.put("properties", this.properties);
						this.getFileInfo(this.get.get("path") + files[i], showThumbs);
	
						//if (this.params.get("type") == null || (this.params.get("type") != null && (!this.params.get("type").equals("Image") || checkImageType()))) {
						if (this.params.get("type") == null || 
								(this.params.get("type") != null && ( (!this.params.get("type").equals("Image") && 
										!this.params.get("type").equals("Flash")) ||
										checkImageType() || checkFlashType() ))) {
							try {
								//data.put("Path", this.get.get("path") + files[i]);
								data.put("Path", this.item.get("path"));								
								data.put("Filename", this.item.get("filename"));
								data.put("File Type", this.item.get("filetype"));
								data.put("Properties", this.item.get("properties"));
								data.put("Error", "");
								data.put("Code", 0);
								log.debug("data now :"+ data.toString());
	
								array.put(this.get.get("path") + files[i], data);
							} catch (Exception e) {
								this.error("JSONObject error");
							}
						}
					} else {
					    log.warn( "not allowed file or dir:" +files[i] );
					}
				}
			}
		}
		log.debug("array size ready:"+ ((array != null)?array.toString():"") );		
		return array;
	}
	
	
	protected void getFileInfo(String path, boolean thumbs) throws JSONException {
		String pathTmp = path;
		if ("".equals(pathTmp)) {
			pathTmp = this.get.get("path");
		}
		String[] tmp = pathTmp.split("/");
		File file = this.documentRoot.resolve(cleanPreview(pathTmp)).toFile();
		this.item = new HashMap<String,Object>();
		String fileName = tmp[tmp.length - 1];
		this.item.put("filename", fileName);
		if (file.isFile()) {
	          this.item.put("filetype", fileName.substring(fileName.lastIndexOf(".") + 1));
	    } else {
	                this.item.put("filetype", "dir");
	    }
		this.item.put("filemtime", "" + file.lastModified());
		this.item.put("filectime", "" + file.lastModified());
	
		this.item.put("path", config.getProperty("icons-path") + "/" + config.getProperty("icons-default")); 
	
		JSONObject props = new JSONObject();
		if (file.isDirectory()) {
	
			this.item.put("path", config.getProperty("icons-path") + config.getProperty("icons-directory")); 
	
		} else if (isImage(pathTmp)) {

			String imagePath = getPreviewFolder() + cleanPreview(pathTmp);
			if (thumbs) { // TODO not yet implemented
				this.item.put("path", imagePath );
			} else {
				this.item.put("path", imagePath);
			}
			Dimension imgData = getImageSize(documentRoot.resolve(pathTmp).toString());
			props.put("Height", "" + imgData.height);
			props.put("Width", "" + imgData.width);
			props.put("Size", "" + file.length());
		} else {
			File icon = fileManagerRoot.resolve(config.getProperty("icons-path")).resolve(
					((String) this.item.get("filetype")).toLowerCase() + ".png").toFile();
			if (icon.exists()) {
				this.item.put("preview",
						config.getProperty("icons-path") + ((String) this.item.get("filetype")).toLowerCase() + ".png");
				props.put("Size", "" + file.length());
			}
		}
	
		props.put("Date Modified", dateFormat.format(new Date(new Long((String) this.item.get("filemtime")))));
		this.item.put("properties", props);
	}
	
	/* (non-Javadoc)
	 * @see com.nartex.FileManagerI#download(javax.servlet.http.HttpServletResponse)
	 */
	@Override
	public JSONObject download(HttpServletRequest request, HttpServletResponse resp) {
		File file = this.documentRoot.resolve(cleanPreview(this.get.get("path"))).toFile();
		if (this.get.get("path") != null && file.exists()) {
			
			if (request.getParameter("force") == null || !request.getParameter("force").equals("true")) {
				JSONObject info = new JSONObject();
				try {
					info.put("Error", "");
					info.put("Code", 0);
					info.put("Path", this.get.get("path").toString());
				} catch (Exception e) {
					log("error:"+ e.getMessage());
					this.error("JSONObject error");
				}
				return info;
			}

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
		} else {
			this.error(sprintf(lang("FILE_DOES_NOT_EXIST"), this.get.get("path")));
		}
		return getError();
	}
	
	@Override
	public JSONObject add() {
		JSONObject fileInfo = new JSONObject();
		Iterator<FileItem> it = this.files.iterator();
		String mode = "";
		String currentPath = "";
		boolean error = false;
		long size = 0;
		if (!it.hasNext()) {
			fileInfo =this.uploadError(lang("INVALID_FILE_UPLOAD"));
		} else {
			String allowed[] = { ".", "-" };
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
						} else if (item.getFieldName().equals("currentpath")) {
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
				if (!error) {
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
								&& (config.getProperty("upload-imagesonly") != null
										&& config.getProperty("upload-imagesonly").equals("true") || this.params
										.get("type") != null && this.params.get("type").equals("Image"))) {
							fileInfo = this.uploadError(lang("UPLOAD_IMAGES_ONLY"));
							error =true;
						}	
						LinkedHashMap<String, String> strList = new LinkedHashMap<String, String>();
						strList.put("fileName", fileName);
						fileName = cleanString(strList, allowed).get("fileName");
					}
					long maxSize = 0;
					if (config.getProperty("upload-size") != null) {
						maxSize = Integer.parseInt(config.getProperty("upload-size"));
						if (maxSize != 0 && size > (maxSize * 1024 * 1024)) {
							fileInfo = this.uploadError(sprintf(lang("UPLOAD_FILES_SMALLER_THAN"), maxSize + "Mb"));
							error = true;
						}
					}
					if (!error) {
						currentPath = cleanPreview(currentPath.replaceFirst("^/", ""));// relative
						Path path = currentPath.equals("")? this.documentRoot: this.documentRoot.resolve(currentPath);
						if (config.getProperty("upload-overwrite").toLowerCase().equals("false")) {							
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
						fileInfo.put("Path", getPreviewFolder() + currentPath);
						fileInfo.put("Name", fileName);
						fileInfo.put("Error", "");
						fileInfo.put("Code", 0);
					}
				}
			} catch (Exception e) {
				fileInfo = this.uploadError(lang("INVALID_FILE_UPLOAD"));
			}
		}
		return fileInfo;
	}
	
	private JSONObject uploadError(String msg) {
		JSONObject errorInfo = new JSONObject();
		try {
			errorInfo.put("Code", "-1");
			JSONArray filesError = new JSONArray();
			filesError.put(msg);
			errorInfo.put("files", filesError);
		} catch (Exception e) {
			this.error("JSONObject error");
		}
		log.error( msg); 
		this.error = errorInfo;
		return error;
	}
	
	@Override
	public JSONObject moveItem() {
	   String itemName = this.get.get("old");
	   boolean error = false;
	   JSONObject array = null;
	   String tmp[] = itemName.split("/");
	   String filename = tmp[tmp.length - 1];
	   int pos = itemName.lastIndexOf("/");
	   
	   Path fileTo = null;
	   if (pos > 0 && itemName.contains("..")) {
		   String path = itemName.substring(0, pos + 1);
		   fileTo = this.documentRoot.resolve(cleanPreview(path)); // from subfolder, folder could be .. check later in root
	   } else {
		   fileTo = this.documentRoot;
	   }
	   //String root =  this.get.get("root"); // slash at beginning and end
	   String folder =  this.get.get("new");
	   if (folder.trim().startsWith( "/")) { // absolute path is not allowed, this is then just root folder
	       folder = folder.trim().replaceFirst( "/", "" );
	   } 
	   Path fileFrom = null;

	   try {
	       fileFrom = this.documentRoot.resolve(cleanPreview(itemName));
	       fileTo = fileTo.resolve(folder).resolve(filename).normalize();
	       
	       if (!fileTo.toString().contains(this.documentRoot.toString())) {
	    	   log.error( "file is not in root folder "+ this.documentRoot
	                   +" but " + fileTo);
	    	  return this.error(sprintf(lang("ERROR_RENAMING_FILE"), filename + "#" + this.get.get("new")));
	       }
		   log.info( "moving file from "+ this.documentRoot.resolve(cleanPreview(this.get.get("old")))
                   +" to " + this.documentRoot.resolve(folder).resolve(filename));
	       if (Files.exists(fileTo)) {
	           if (Files.isDirectory(fileTo)) {
	               this.error(sprintf(lang("DIRECTORY_ALREADY_EXISTS"),this.documentRoot.resolve(folder).resolve(filename).toString()));
	               error = true;
	           } else { // fileTo.isFile
	               this.error(sprintf(lang("FILE_ALREADY_EXISTS"), filename ));
	               error = true;
	           }
	       } else {
	    	   Files.move(fileFrom, fileTo);
	       }
	   } catch (Exception e) {
	       if (Files.isDirectory(fileFrom)) {
	           this.error(sprintf(lang("ERROR_RENAMING_DIRECTORY"), filename + "#" + this.get.get("new")));
	       } else {
	           this.error(sprintf(lang("ERROR_RENAMING_FILE"), filename + "#" + this.get.get("new")));
	       }
	       error = true;
	   }
	   if (!error) {
	       array = new JSONObject();
	       try {
	           folder = folder.replace("..", "");// if its an allowed up mpvement
	    	   array.put("Error", "");
	           array.put("Code", 0);
	           array.put("Old Path", itemName);
	           array.put("Old Name", filename);
	           array.put("New Path", getPreviewFolder() + folder);
	           array.put("New Name", filename);
	       } catch (Exception e) {
	           this.error("JSONObject error");
	       }
	   } 
	   return array;
	}
	
	@Override
	public JSONObject rename() {
		String relativePath = cleanPreview(this.get.get("old"));
		if (relativePath.endsWith("/")) {
			//this.get.put("old", (this.get.get("old")).substring(0, ((this.get.get("old")).length() - 1)));
			relativePath = relativePath.replaceFirst("/$", "");
		}
		boolean error = false;
		JSONObject array = null;
		String tmp[] = relativePath.split("/");
		String filename = tmp[tmp.length - 1];
		int pos = relativePath.lastIndexOf("/");
		String path = relativePath.substring(0, pos + 1);
		Path fileFrom = null;
		Path fileTo = null;
		try {
			fileFrom = this.documentRoot.resolve(path).resolve(filename);
			fileTo = this.documentRoot.resolve(path).resolve(cleanPreview( this.get.get("new")));
			if (fileTo.toFile().exists()) {
				if (fileTo.toFile().isDirectory()) {
					this.error(sprintf(lang("DIRECTORY_ALREADY_EXISTS"), this.get.get("new")));
					error = true;
				} else { // fileTo.isFile
					// Files.isSameFile(fileFrom, fileTo);
					this.error(sprintf(lang("FILE_ALREADY_EXISTS"), this.get.get("new")));
					error = true;
				}
			} else {
				//if (fileFrom.equals(fileTo));
				Files.move(fileFrom, fileTo, StandardCopyOption.REPLACE_EXISTING);
			}
		} catch (Exception e) {
			if (fileFrom.toFile().isDirectory()) {
				this.error(sprintf(lang("ERROR_RENAMING_DIRECTORY"), filename + "#" + this.get.get("new")),e);
			} else {
				this.error(sprintf(lang("ERROR_RENAMING_FILE"), filename + "#" + this.get.get("new")),e);
			}
			error = true;
		}
		if (!error) {
			array = new JSONObject();
			try {
				array.put("Error", "");
				array.put("Code", 0);
				array.put("Old Path", this.get.get("old"));
				array.put("Old Name", filename);
				array.put("New Path",  getPreviewFolder() + path + this.get.get("new"));
				array.put("New Name", this.get.get("new"));
			} catch (Exception e) {
				this.error("JSONObject error");
			}
		}
		return array;
	}

	@Override
	public JSONObject delete() {
		JSONObject array = null;
		String targetPath = cleanPreview( this.get.get("path"));
		File file = this.documentRoot.resolve(targetPath).toFile();
				//new File(this.documentRoot + this.get.get("path"));
		if (file.isDirectory()) {
			array = new JSONObject();
			this.unlinkRecursive(this.documentRoot.resolve(targetPath).toFile(), true);
			try {
				array.put("Error", "");
				array.put("Code", 0);
				array.put("Path", this.get.get("path"));
			} catch (Exception e) {
				this.error("JSONObject error");
			}
		} else if (file.exists()) {
			array = new JSONObject();
			if (file.delete()) {
				try {
					array.put("Error", "");
					array.put("Code", 0);
					array.put("Path", this.get.get("path"));
				} catch (Exception e) {
					this.error("JSONObject error");
				}
			} else
				this.error(sprintf(lang("ERROR_DELETING FILE"), this.get.get("path")));
			return array;
		} else {
			this.error(lang("INVALID_DIRECTORY_OR_FILE"));
		}
		return array;
	}


	@Override
	public JSONObject addFolder() {
		JSONObject array = null;
		String allowed[] = { "-", " " };
		LinkedHashMap<String, String> strList = new LinkedHashMap<String, String>();
		strList.put("fileName", this.get.get("name"));
		String filename = cleanString(strList, allowed).get("fileName");
		if (filename.length() == 0) // the name existed of only special
									// characters
			this.error(sprintf(lang("UNABLE_TO_CREATE_DIRECTORY"), this.get.get("name")));
		else {
			String targetPath = cleanPreview( this.get.get("path"));
			File file = this.documentRoot.resolve(targetPath).resolve(filename).toFile();
			if (file.isDirectory()) {
				this.error(sprintf(lang("DIRECTORY_ALREADY_EXISTS"), filename));
			} else if (!file.mkdir()) {
				this.error(sprintf(lang("UNABLE_TO_CREATE_DIRECTORY"), filename));
			} else {
				try {
					String parent = (this.get.get("path").equals(""))? "/": this.get.get("path");
					array = new JSONObject();
					array.put("Parent", parent);
					array.put("Name", filename);
					array.put("Error", "");
					array.put("Code", 0);
				} catch (Exception e) {
					this.error("JSONObject error");
				}
			}
		}
		return array;
	}


	
	@Override
	public void loadLanguageFile() {

		// we load langCode var passed into URL if present
		// else, we use default configuration var
		if (language == null || reload) {
			String lang = "";
			if (params.get("langCode") != null)
				lang = this.params.get("langCode");
			else
				lang = config.getProperty("culture");
			BufferedReader br = null;
			InputStreamReader isr = null;
			String text;
			StringBuffer contents = new StringBuffer();
			try {
				isr = new InputStreamReader(
						new FileInputStream(
								this.fileManagerRoot
								.resolve("scripts/languages/")
								.resolve(lang+ ".json").toString()
								), "UTF-8");
				br = new BufferedReader(isr);
				while ((text = br.readLine()) != null)
					contents.append(text);
				language = new JSONObject(contents.toString());
			} catch (Exception e) {
				this.error("Fatal error: Language file not found.");
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
	
	/**
	 * constructs mapping from property preview.
	 * 
	 * Suspended, due to https://github.com/servocoder/RichFilemanager/issues/27
	 * 
	 */
	protected String getPreviewFolder() {
		// TODO	not yet implemented
		//if (directURL) { } 
		return "";
	}
	
	/**
	 * clean mapping  
	 * @param filecontextpath
	 * @return filecontextpath
	 */
	protected String cleanPreview(String filecontextpath) {
		// TODO	 not yet implemented
		//if (directURL) { } 	
		return filecontextpath;
	}

}
