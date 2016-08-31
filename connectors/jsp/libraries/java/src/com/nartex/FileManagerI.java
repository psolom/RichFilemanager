package com.nartex;

import java.io.IOException;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import org.json.JSONException;
import org.json.JSONObject;

/**
 * 
 * created August 2016
 * 
 * @author gkallidis
 *
 */
public interface FileManagerI {

	public abstract JSONObject error(String msg, Throwable ex);

	public abstract JSONObject error(String msg);

	public abstract JSONObject getError();

	public abstract String lang(String key);
	
	public void loadLanguageFile();

	public abstract boolean setGetVar(String var, String value);

	public abstract JSONObject getInfo() throws JSONException;

	public abstract JSONObject getFolder(HttpServletRequest request) throws JSONException, IOException;

	public abstract JSONObject rename();

	public abstract JSONObject delete();

	public abstract JSONObject add();

	public abstract JSONObject addFolder();

	public abstract JSONObject moveItem();

	public abstract JSONObject download(HttpServletRequest request, HttpServletResponse resp);

	public abstract void preview(HttpServletRequest request, HttpServletResponse resp);

	public abstract String getConfigString(String key);

	public abstract void log(String msg);

}