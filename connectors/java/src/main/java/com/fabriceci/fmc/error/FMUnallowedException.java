package com.fabriceci.fmc.error;

public class FMUnallowedException extends FileManagerException {
    public FMUnallowedException() { super(); }
    public FMUnallowedException(String message) { super(message); }
    public FMUnallowedException(String message, Throwable cause) { super(message, cause); }
    public FMUnallowedException(Throwable cause) { super(cause); }
}
