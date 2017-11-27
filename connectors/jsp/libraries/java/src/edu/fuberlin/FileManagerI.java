/*
 *	Interface for JSP Connector
 *
 *	@license	MIT License
 *
 *	@author		Dick Toussaint <d.tricky@gmail.com>, Georg Kallidis
 */
package edu.fuberlin;

import java.io.IOException;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.json.JSONException;
import org.json.JSONObject;

import com.fabriceci.fmc.error.FMIOException;
import com.fabriceci.fmc.error.FileManagerException;

/**
 * 
 * created August 2016
 * 
 * @author gkallidis
 *
 */
 public interface FileManagerI {


     JSONObject initiate(HttpServletRequest request) throws FileManagerException, JSONException;

	 String lang(String key);
	
	 void loadLanguageFile() throws FileManagerException;

	 boolean setGetVar(String var, String value) throws FileManagerException;

	 JSONObject getInfo() throws JSONException, FileManagerException;

	 JSONObject readFolder(HttpServletRequest request) throws JSONException, IOException, FileManagerException;

	 JSONObject rename() throws JSONException, FileManagerException;

	 JSONObject delete() throws JSONException, FileManagerException;

	 JSONObject add() throws JSONException;

	 JSONObject addFolder() throws JSONException, FileManagerException;

	 JSONObject moveItem() throws JSONException, FileManagerException;

	 JSONObject download(HttpServletRequest request, HttpServletResponse resp) throws JSONException, FileManagerException;

	 String getConfigString(String key);

	 void log(String msg);

	JSONObject preview(HttpServletRequest request, HttpServletResponse resp) throws JSONException;

	JSONObject getErrorResponse(String msg) throws JSONException;

	JSONObject summarize() throws FMIOException, JSONException;

	JSONObject copyItem(HttpServletRequest request) throws FileManagerException, JSONException;

}