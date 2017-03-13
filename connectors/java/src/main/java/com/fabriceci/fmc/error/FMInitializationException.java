package com.fabriceci.fmc.error;

public class FMInitializationException extends FileManagerException {

    public FMInitializationException() { super(); }
    public FMInitializationException(String message) { super(message); }
    public FMInitializationException(String message, Throwable cause) { super(message, cause); }
    public FMInitializationException(Throwable cause) { super(cause); }
}