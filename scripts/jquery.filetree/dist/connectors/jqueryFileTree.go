package main

import (
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"path"
	"regexp"
)

var (
	noHidden = true // noHidden mean not include hidden file or dir
)

func main() {
	http.HandleFunc("/jqueryFileTree", handler)
	log.Fatal(http.ListenAndServe(":8080", nil))
}

func handler(w http.ResponseWriter, r *http.Request) {
	r.ParseForm()
	dir := r.Form["dir"][0]
	out := ""
	out += `<ul class="jqueryFileTree" style="display: none;">`
	files, _ := ioutil.ReadDir(dir)
	for _, f := range files {
		if false == noHidden || f.Name()[0] != '.' {
			p := path.Join(dir, f.Name())
			if true == f.IsDir() {
				out += fmt.Sprintf(`<li class="directory collapsed"><a rel="%s">%s</a></li>`, p+"/", f.Name())
			} else {
				out += fmt.Sprintf(`<li class="file ext_%s"><a rel="%s">%s</a></li>`, path.Ext(f.Name())[1:], p, f.Name())
			}
		}
	}
	out += `</ul>`
	w.Write([]byte(out))
}

func isHidden(path string) bool {
	b, _ := regexp.MatchString("/\\.\\w", path)
	return b
}
