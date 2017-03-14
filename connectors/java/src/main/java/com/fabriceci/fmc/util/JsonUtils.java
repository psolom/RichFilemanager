package com.fabriceci.fmc.util;

import org.json.JSONArray;

import java.util.HashSet;
import java.util.Set;

public class JsonUtils {

    public static Set<String> jsonArrayToSet(JSONArray array){

        Set<String> result = new HashSet();
        for (Object o : array) {
            result.add(o.toString());
        }
        return result;
    }
}
