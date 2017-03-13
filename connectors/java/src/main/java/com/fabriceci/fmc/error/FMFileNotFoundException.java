package com.fabriceci.fmc.error;

public class FMFileNotFoundException extends FileManagerException {
    public FMFileNotFoundException() { super(); }
    public FMFileNotFoundException(String message) { super(message); }
    public FMFileNotFoundException(String message, Throwable cause) { super(message, cause); }
    public FMFileNotFoundException(Throwable cause) { super(cause); }
}
