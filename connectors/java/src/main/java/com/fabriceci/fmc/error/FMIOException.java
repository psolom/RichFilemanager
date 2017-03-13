package com.fabriceci.fmc.error;

public class FMIOException extends FileManagerException {
    public FMIOException() { super(); }
    public FMIOException(String message) { super(message); }
    public FMIOException(String message, Throwable cause) { super(message, cause); }
    public FMIOException(Throwable cause) { super(cause); }
}
