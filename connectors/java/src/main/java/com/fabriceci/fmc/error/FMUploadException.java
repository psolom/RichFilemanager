package com.fabriceci.fmc.error;

public class FMUploadException extends FileManagerException {
    public FMUploadException() { super(); }
    public FMUploadException(String message) { super(message); }
    public FMUploadException(String message, Throwable cause) { super(message, cause); }
    public FMUploadException(Throwable cause) { super(cause); }
}
