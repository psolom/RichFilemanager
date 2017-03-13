package com.fabriceci.fmc.error;

public class FMSyntaxException extends FileManagerException {
    public FMSyntaxException() { super(); }
    public FMSyntaxException(String message) { super(message); }
    public FMSyntaxException(String message, Throwable cause) { super(message, cause); }
    public FMSyntaxException(Throwable cause) { super(cause); }
}
