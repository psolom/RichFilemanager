<%@ WebHandler Language="C#" Class="filemanager" %>

//	** Filemanager ASP.NET connector
//
//	** .NET Framework >= 2.0
//
//	** license	    MIT License
//	** author		Ondřej "Yumi Yoshimido" Brožek | <cholera@hzspraha.cz>
//	** Copyright	Author

using System;
using System.Web;
using System.IO;
using System.Collections.Specialized;
using System.Text;

public class filemanager : IHttpHandler 
{
    //===================================================================
    //==================== EDIT CONFIGURE HERE ==========================
    //===================================================================

    public string IconDirectory = "./images/fileicons/"; // Icon directory for filemanager. [string]
    public string[] imgExtensions = new string[] { ".jpg", ".png", ".jpeg", ".gif", ".bmp" }; // Only allow this image extensions. [string]
	public long size = 0L;
	public int files = 0;
	public int folders = 0;

    //===================================================================
    //========================== END EDIT ===============================
    //===================================================================       

	private static void NoCache()
	{
		HttpContext.Current.Response.AppendHeader("Cache-Control", "no-cache, no-store, must-revalidate"); // HTTP 1.1.
		HttpContext.Current.Response.AppendHeader("Pragma", "no-cache"); // HTTP 1.0.
		HttpContext.Current.Response.AppendHeader("Expires", "0"); // Proxies.
		
		HttpContext.Current.Response.Cache.SetExpires(DateTime.UtcNow.AddDays(-1));
		HttpContext.Current.Response.Cache.SetValidUntilExpires(false);
		HttpContext.Current.Response.Cache.SetRevalidation(HttpCacheRevalidation.AllCaches);
		HttpContext.Current.Response.Cache.SetCacheability(HttpCacheability.NoCache);
		HttpContext.Current.Response.Cache.SetNoStore();
	}

    private bool IsImage(FileInfo fileInfo)
    {
        foreach (string ext in imgExtensions)
        {
            if (Path.GetExtension(fileInfo.FullName).ToLower() == ext.ToLower())
            {
                return true;
            }
        }
        return false;
    }
    
    private string getInfo(string path)
    {
        DirectoryInfo RootDirInfo = new DirectoryInfo(HttpContext.Current.Server.MapPath(path));
        StringBuilder sb = new StringBuilder();

        sb.AppendLine("{ \"data\": [");
        int i = 0;
        foreach (DirectoryInfo DirInfo in RootDirInfo.GetDirectories()) 
        {
            if (i > 0) 
            {
                sb.Append(",");
            }
			sb.Append(getDirectoryInfo(DirInfo, Path.Combine(path, DirInfo.Name).Replace('\\', '/')));
            i++;
        }

        foreach (FileInfo fileInfo in RootDirInfo.GetFiles())
        {
			if (i > 0)
            {
                sb.Append(",");
            }
			sb.Append(getFileInfo(fileInfo, Path.Combine(path, fileInfo.Name).Replace('\\', '/')));
            i++;
        }
        sb.AppendLine("] }");

        return sb.ToString();
    }
	
	private string HandleUpload(string path, HttpFileCollection uploadfiles)
	{
		StringBuilder sb = new StringBuilder();
		sb.Append("{ \"data\": [");		
		foreach (string file in uploadfiles)
		{
			HttpPostedFile hpf = uploadfiles[file] as HttpPostedFile;
			string FileName = string.Empty;
			if (HttpContext.Current.Request.Browser.Browser.ToUpper() == "IE")
			{
				string[] files = hpf.FileName.Split(new char[] { '\\' });
				FileName = files[files.Length - 1];
			}
			else FileName = hpf.FileName;
			
			if (hpf.ContentLength == 0) continue;
			
			hpf.SaveAs(HttpContext.Current.Server.MapPath(Path.Combine(path, Path.GetFileName(FileName))));
			hpf.InputStream.Dispose();
			
			FileInfo fileInfo = new FileInfo(HttpContext.Current.Server.MapPath(Path.Combine(path, Path.GetFileName(FileName))));
			sb.Append(getFileInfo(fileInfo, Path.Combine(path, FileName)));
		}
		
		sb.Append("] }");
		return sb.ToString();
	}
	
    private string getDirectoryInfo(DirectoryInfo dirInfo, string path) 
    {
        StringBuilder sb = new StringBuilder();
		
		sb.AppendLine("{");
		sb.AppendLine("\"id\": \"" + path + "/\",");
		sb.AppendLine("\"type\": \"folder\",");
		sb.AppendLine("\"attributes\": {");
			sb.AppendLine("\"name\": \"" + dirInfo.Name + "\",");
			sb.AppendLine("\"path\": \"" + path + "/\",");
			sb.AppendLine("\"readable\": 1,");
			sb.AppendLine("\"writable\": 1,");
			sb.AppendLine("\"created\": \"" + dirInfo.CreationTime.ToString() + "\", ");
			sb.AppendLine("\"modified\": \"" + dirInfo.LastWriteTime.ToString() + "\", ");
			sb.AppendLine("\"timestamp\": "+ ((Int32)(dirInfo.CreationTime.Subtract(new DateTime(1970, 1, 1))).TotalSeconds).ToString());
		sb.Append("} }");
		
		return sb.ToString();
    }
	
	private string getFileInfo(FileInfo fileInfo, string path)
	{
        StringBuilder sb = new StringBuilder();
		
		sb.AppendLine("{");
		sb.AppendLine("\"id\": \""+ path +"\",");
		sb.AppendLine("\"type\": \"file\",");
		sb.AppendLine("\"attributes\": {");
			sb.AppendLine("\"name\": \"" + fileInfo.Name + "\",");
			sb.AppendLine("\"extension\": \"" + fileInfo.Extension.Replace(".","") + "\",");
			sb.AppendLine("\"path\": \"" + path + "\",");
			sb.AppendLine("\"readable\": 1,");
			sb.AppendLine("\"writable\": 1,");
			sb.AppendLine("\"created\": \"" + fileInfo.CreationTime.ToString() + "\", ");
			sb.AppendLine("\"modified\": \"" + fileInfo.LastWriteTime.ToString() + "\", ");
			sb.AppendLine("\"timestamp\": "+ ((Int32)(fileInfo.CreationTime.Subtract(new DateTime(1970, 1, 1))).TotalSeconds).ToString() +", ");
		if (IsImage(fileInfo)) 
		{
			using (System.Drawing.Image img = System.Drawing.Image.FromFile(fileInfo.FullName))
			{
				sb.AppendLine("\"height\": " + img.Height.ToString() + ",");
				sb.AppendLine("\"width\": " + img.Width.ToString() + ",");
			}
		}
		else
		{
			sb.AppendLine("\"height\": 0,");
			sb.AppendLine("\"width\": 0,");
		}                   
		sb.AppendLine("\"size\": \"" + fileInfo.Length.ToString() + "\"");
		sb.AppendLine("} }");

		return sb.ToString();
	}
	
    private string Rename(string path, string newName)
    {
        FileAttributes attr = File.GetAttributes(HttpContext.Current.Server.MapPath(path));

        StringBuilder sb = new StringBuilder();
        sb.AppendLine("{ \"data\":");
        if ((attr & FileAttributes.Directory) == FileAttributes.Directory)
        {
            DirectoryInfo dirInfo = new DirectoryInfo(HttpContext.Current.Server.MapPath(path));
            Directory.Move(HttpContext.Current.Server.MapPath(path), Path.Combine(dirInfo.Parent.FullName, newName));

            DirectoryInfo fileInfo2 = new DirectoryInfo(Path.Combine(dirInfo.Parent.FullName, newName));

			path = path.Remove(path.Length - 1); // remove last slash
			sb.Append(getDirectoryInfo(fileInfo2, path.Remove(path.LastIndexOf('/'))));
        }
        else 
        {
            FileInfo fileInfo = new FileInfo(HttpContext.Current.Server.MapPath(path));
            File.Move(HttpContext.Current.Server.MapPath(path), Path.Combine(fileInfo.Directory.FullName, newName));

            FileInfo fileInfo2 = new FileInfo(Path.Combine(fileInfo.Directory.FullName, newName));
            
			path = path.Remove(path.Length - 1); // remove last slash
			sb.Append(getFileInfo(fileInfo2, path.Remove(path.LastIndexOf('/'))));
        }
        sb.Append("}");
        return sb.ToString();
    }
	
	private string Move(string path, string newPath)
    {
        FileAttributes attr = File.GetAttributes(HttpContext.Current.Server.MapPath(path));

        StringBuilder sb = new StringBuilder();
        sb.AppendLine("{ \"data\":");
        if ((attr & FileAttributes.Directory) == FileAttributes.Directory)
        {
            DirectoryInfo dirInfo = new DirectoryInfo(HttpContext.Current.Server.MapPath(path));
            Directory.Move(HttpContext.Current.Server.MapPath(path), Path.Combine(dirInfo.Parent.FullName, newPath));

            DirectoryInfo fileInfo2 = new DirectoryInfo(Path.Combine(dirInfo.Parent.FullName, newPath));

			sb.Append(getDirectoryInfo(fileInfo2, path.Remove(path.LastIndexOf('/'))));
        }
        else 
        {
			string filename = path.Substring(path.LastIndexOf('/'));
            FileInfo fileInfo = new FileInfo(HttpContext.Current.Server.MapPath(path));
            File.Move(HttpContext.Current.Server.MapPath(path), HttpContext.Current.Server.MapPath(newPath) +"/"+ filename);

            FileInfo fileInfo2 = new FileInfo(HttpContext.Current.Server.MapPath(newPath) +"/"+ filename);
            
			sb.Append(getFileInfo(fileInfo2, newPath));
        }
        sb.Append("}");
        return sb.ToString();
    }

    private string Delete(string path) 
    {
        FileAttributes attr = File.GetAttributes(HttpContext.Current.Server.MapPath(path));
        StringBuilder sb = new StringBuilder();		
		sb.Append("{ \"data\":");

        if ((attr & FileAttributes.Directory) == FileAttributes.Directory)
        {
			path = path.Remove(path.LastIndexOf('/'), 1);
			DirectoryInfo dirInfo = new DirectoryInfo(HttpContext.Current.Server.MapPath(path));
			sb.Append(getDirectoryInfo(dirInfo, path));
            Directory.Delete(HttpContext.Current.Server.MapPath(path), true);
        }
        else
        {
			FileInfo fileInfo = new FileInfo(HttpContext.Current.Server.MapPath(path));
            sb.Append(getFileInfo(fileInfo, path));
			File.Delete(HttpContext.Current.Server.MapPath(path));			
        }
        
		sb.Append("}");
        return sb.ToString();
    }

    private string AddFolder(string path, string NewFolder)
    {
        StringBuilder sb = new StringBuilder();

        Directory.CreateDirectory(Path.Combine(HttpContext.Current.Server.MapPath(path), NewFolder));
		DirectoryInfo dirInfo = new DirectoryInfo(Path.Combine(HttpContext.Current.Server.MapPath(path), NewFolder));
		
        sb.AppendLine("{ \"data\":");
		sb.Append(getDirectoryInfo(dirInfo, Path.Combine(path, NewFolder)));
        sb.Append("}");
		
        return sb.ToString();
    }
	
	private string Replace(string path, HttpFileCollection uploadfiles)
	{
		StringBuilder sb = new StringBuilder();
		sb.Append(Delete(path));
		
		HttpPostedFile hpf = uploadfiles[0] as HttpPostedFile;
		string FileName = path.Substring(path.LastIndexOf("/"));
		path = path.Substring(0, path.LastIndexOf("/"));
		if (HttpContext.Current.Request.Browser.Browser.ToUpper() == "IE")
		{
			string[] files = FileName.Split(new char[] { '\\' });
			FileName = files[files.Length - 1];
		}
		
		hpf.SaveAs(HttpContext.Current.Server.MapPath(Path.Combine(path, FileName)));
		hpf.InputStream.Dispose();
		
		return sb.ToString();
	}
	
	private string Summarize()
	{
		DirectoryInfo RootDirInfo = new DirectoryInfo(HttpContext.Current.Server.MapPath("/"));
		
		size = 0L;
		files = 0;
		folders = 0;		
		GetSummaryInfo(HttpContext.Current.Server.MapPath("/"));
		
		StringBuilder sb = new StringBuilder();
		sb.Append("{ \"data\": {");
		sb.Append("\"id\": \"/\",");
		sb.Append("\"type\": \"summary\",");
		sb.Append("\"attributes\": {");
		sb.Append("\"size\": "+ size +",");
		sb.Append("\"files\": "+ files +",");
		sb.Append("\"folders\": "+ folders +",");
		sb.Append("\"sizelimit\": 16000000");	// TODO read from config
		sb.Append("} } }");
		
		return sb.ToString();
	}
	
	private string GetSummaryInfo(string path)
	{
		string[] newpath = Directory.GetDirectories(path); 
		foreach (string fp in newpath)
		{
			folders++;
			GetSummaryInfo(fp);
		}			
		
		newpath = Directory.GetFiles(path);
		foreach (string fp in newpath)
		{
			files++;
			FileInfo finfo = new FileInfo(fp);
			
			size += finfo.Length;
		}
		return size.ToString() +","+ files.ToString() +","+ folders.ToString();
	}

    private string Initiate()
    {
        StringBuilder sb = new StringBuilder();
        sb.AppendLine("{");
        sb.Append("\"data\": {");
        sb.AppendLine("\"id\": \"/\",");
        sb.AppendLine("\"type\": \"initiate\",");
        sb.AppendLine("\"attributes\": {");
        sb.Append("\"config\": {");
        sb.AppendLine("\"security\": {");
        sb.AppendLine("\"readOnly\": false,");
        sb.AppendLine("\"extensions\": {");
        sb.AppendLine("\"policy\": \"ALLOW_LIST\",");
        sb.AppendLine("\"restrictions\": [\"jpg\",\"jpe\",\"jpeg\",\"gif\",\"png\"]");
        sb.AppendLine("}");
        sb.AppendLine("}");
        sb.AppendLine("}");
        sb.AppendLine("}");
        sb.AppendLine("}");
        sb.AppendLine("}");

        return sb.ToString();
    }
	
	public byte[] ReadAllBytes(string fileName)
	{
		byte[] buffer = null;
		using (FileStream fs = new FileStream(fileName, FileMode.Open, FileAccess.Read))
		{
			buffer = new byte[fs.Length];
			fs.Read(buffer, 0, (int)fs.Length);
		}
		return buffer;
	} 
	
    public void ProcessRequest(HttpContext context) 
    {
        FileInfo fi = null;
		context.Response.ClearHeaders();
        context.Response.ClearContent();
        context.Response.Clear();

        switch (context.Request["mode"])
        {
            case "initiate":
                context.Response.ContentType = "plain/text";
                context.Response.ContentEncoding = Encoding.UTF8;
                context.Response.Write(Initiate());
                break;
            case "readfolder":
                 context.Response.ContentType = "plain/text";
                 context.Response.ContentEncoding = Encoding.UTF8;
                 context.Response.Write(getInfo(context.Request["path"]));
				break;
            case "rename":
                context.Response.ContentType = "plain/text";
                context.Response.ContentEncoding = Encoding.UTF8;
                context.Response.Write(Rename(context.Request["old"], context.Request["new"]));
                break;
            case "delete":
                context.Response.ContentType = "plain/text";
                context.Response.ContentEncoding = Encoding.UTF8;
                context.Response.Write(Delete(context.Request["path"]));
                break;
            case "addfolder":               
                context.Response.ContentType = "plain/text";
                context.Response.ContentEncoding = Encoding.UTF8;
                context.Response.Write(AddFolder(context.Request["path"], context.Request["name"]));
                break;
			case "upload":
                context.Response.Cache.SetCacheability(HttpCacheability.NoCache);
				context.Response.ContentType = "text/html";
                context.Response.ContentEncoding = Encoding.UTF8;
				context.Response.Write(HandleUpload(context.Request["path"], context.Request.Files));
				break;
			case "move":
                context.Response.ContentType = "plain/text";
                context.Response.ContentEncoding = Encoding.UTF8;
                context.Response.Write(Move(context.Request["old"], context.Request["new"]));	
				break;
			case "getimage":
				NoCache();
				//context.Response.Write(Preview(context.Request["thumbnail"] == "true"));	
				fi = new FileInfo(context.Server.MapPath(context.Request["path"]));
                context.Response.AddHeader("Content-Disposition", "attachment; filename=" + context.Server.UrlPathEncode(fi.Name));
                context.Response.AddHeader("Content-Length", fi.Length.ToString());
                context.Response.ContentType = System.Web.MimeMapping.GetMimeMapping(fi.Name);
                context.Response.TransmitFile(fi.FullName);
				break;
			case "replace":
                context.Response.ContentType = "plain/text";
                context.Response.ContentEncoding = Encoding.UTF8;
                context.Response.Write(Replace(context.Request["path"], context.Request.Files));
				break;
			case "summarize":
                context.Response.ContentType = "plain/text";
                context.Response.ContentEncoding = Encoding.UTF8;
                context.Response.Write(Summarize());				
				break;
			case "download": //call in window.open
				fi = new FileInfo(context.Server.MapPath(context.Request["path"]));
				
				System.Web.HttpResponse response = System.Web.HttpContext.Current.Response;
				response.Clear();
				response.ClearContent();
				response.ClearHeaders();
				
				response.AppendHeader("Content-Type", System.Web.MimeMapping.GetMimeMapping(fi.Name)+"; charset=UTF-8");
				response.Charset = "UTF-8";
				response.ContentEncoding = System.Text.Encoding.UTF8;
				response.AppendHeader("Content-Disposition","attachment; filename="+fi.Name+"; size="+fi.Length.ToString());
				context.Response.AddHeader("Content-Length", fi.Length.ToString());
				response.CacheControl = "Public";
				response.BinaryWrite(ReadAllBytes(fi.FullName));
				response.Flush();
				response.End();
				
				break;
            default:
                break;
        }
    }
 
    public bool IsReusable 
	{
        get {
            return false;
        }
    }

}
