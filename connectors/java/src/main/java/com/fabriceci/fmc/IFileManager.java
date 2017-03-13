package com.fabriceci.fmc;

import com.fabriceci.fmc.error.FileManagerException;
import org.json.JSONObject;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

public interface IFileManager {

    void handleRequest(HttpServletRequest request, HttpServletResponse response);

    JSONObject actionInitiate(HttpServletRequest request) throws FileManagerException;

    JSONObject actionGetFile(HttpServletRequest request) throws FileManagerException;

    JSONObject actionGetFolder(HttpServletRequest request) throws FileManagerException;

    JSONObject actionReadFile(HttpServletRequest request, HttpServletResponse response) throws FileManagerException;

    JSONObject actionCopy(HttpServletRequest request) throws FileManagerException;

    JSONObject actionDownload(HttpServletRequest request, HttpServletResponse response) throws FileManagerException;

    JSONObject actionAddFolder(HttpServletRequest request) throws FileManagerException;

    JSONObject actionDelete(HttpServletRequest request) throws FileManagerException;

    JSONObject actionRename(HttpServletRequest request) throws FileManagerException;

    JSONObject actionMove(HttpServletRequest request) throws FileManagerException;

    JSONObject actionGetImage(HttpServletRequest request, HttpServletResponse response, Boolean thumbnail) throws FileManagerException;

    JSONObject actionEditFile(HttpServletRequest request) throws FileManagerException;

    JSONObject actionSummarize() throws FileManagerException;

    JSONObject actionUpload(HttpServletRequest request) throws FileManagerException;

    JSONObject actionReplace(HttpServletRequest request) throws FileManagerException;

    JSONObject actionSaveFile(HttpServletRequest request) throws FileManagerException;
}
