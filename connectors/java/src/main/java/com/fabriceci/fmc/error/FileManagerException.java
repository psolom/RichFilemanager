package com.fabriceci.fmc.error;

public class FileManagerException extends Exception {
    public FileManagerException() { super(); }
    public FileManagerException(String message) { super(message); }
    public FileManagerException(String message, Throwable cause) { super(message, cause); }
    public FileManagerException(Throwable cause) { super(cause); }
}