/*
 *	Filemanager.java utility class for for filemanager.jsp
 *
 *	@license	MIT License
 *	@author		Dick Toussaint <d.tricky@gmail.com>
 *	@copyright	Authors
 */
package com.nartex;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.file.LinkOption;
import java.nio.file.Path;
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
 * 
 * @author gkallidis
 *
 */
public class RichFileManager extends AbstractFM  {

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
		this.item = new HashMap();
		this.item.put("properties", this.properties);
		this.getFileInfo("");
		JSONObject array = new JSONObject();
	
		try {
			array.put("Path", this.get.get("path"));
			array.put("Filename", this.item.get("filename"));
			array.put("File Type", this.item.get("filetype"));
			array.put("Thumbnail", this.item.get("preview"));
			array.put("Properties", this.item.get("properties"));
			array.put("Error", "");
			array.put("Code", 0);
		} catch (Exception e) {
			this.error("JSONObject error");
		}
		return array;
	}
	
	@Override
	public JSONObject getFolder() throws JSONException, IOException {
		JSONObject array = null;
		//uri
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
						//this.item = new HashMap();
						this.item = new HashMap();
						this.item.put("properties", this.properties);
						this.getFileInfo(this.get.get("path") + files[i]);
	
						//if (this.params.get("type") == null || (this.params.get("type") != null && (!this.params.get("type").equals("Image") || checkImageType()))) {
						if (this.params.get("type") == null || 
								(this.params.get("type") != null && ( (!this.params.get("type").equals("Image") && 
										!this.params.get("type").equals("Flash")) ||
										checkImageType() || checkFlashType() ))) {
							try {
								data.put("Path", this.get.get("path") + files[i]);
								data.put("Filename", this.item.get("filename"));
								data.put("File Type", this.item.get("filetype"));
								data.put("Thumbnail", this.item.get("preview"));
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
	   
    /* (non-Javadoc)
	 * @see com.nartex.FileManagerI#download(javax.servlet.http.HttpServletResponse)
	 */
	@Override
	public JSONObject download(HttpServletRequest request, HttpServletResponse resp) {
		File file = this.documentRoot.resolve(this.get.get("path")).toFile();
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
		Iterator it = this.files.iterator();
		String mode = "";
		String currentPath = "";
		boolean error = false;
		boolean replace = false;
		long size = 0;
		if (!it.hasNext()) {
			fileInfo =this.uploadError(lang("INVALID_FILE_UPLOAD"));
		} else {
			String allowed[] = { ".", "-" };
			String fileName = "";
			FileItem targetItem = null;
			try {
				while (it.hasNext()) {
					FileItem item = (FileItem) it.next();
					if (item.isFormField()) {
						if (item.getFieldName().equals("mode")) {
							mode = item.getString();
							if (!mode.equals("add") && !mode.equals("replace")) {
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
						if (mode.equals("add")) {
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
						if (tmp.length > 1) {
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
						if (config.getProperty("upload-overwrite").equals("false")) {
							fileName = this.checkFilename(this.documentRoot.resolve(currentPath).toString(), fileName, 0);
						}
						if (mode.equals("replace")) {
							File saveTo = this.documentRoot.resolve(currentPath).resolve(fileName).toFile();
							targetItem.write(saveTo);
							log.info("saved "+ saveTo);
						} else {
							currentPath = currentPath.replace("/", "/").replaceFirst("^/", "");// relative
							fileName = fileName.replace("//", "/").replaceFirst("^/", "");// relative
							File saveTo = this.documentRoot.resolve(currentPath).resolve(fileName).toFile();
							targetItem.write(saveTo);
							log.info("saved "+ saveTo);
						}
						fileInfo.put("Path", currentPath);
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
	public void loadLanguageFile() {

		// we load langCode var passed into URL if present
		// else, we use default configuration var
		if (language == null) {
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

}
