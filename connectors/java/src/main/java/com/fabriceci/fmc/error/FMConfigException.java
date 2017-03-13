package com.fabriceci.fmc.error;

public class FMConfigException extends FileManagerException {
    public FMConfigException() { super(); }
    public FMConfigException(String message) { super(message); }
    public FMConfigException(String message, Throwable cause) { super(message, cause); }
    public FMConfigException(Throwable cause) { super(cause); }
}