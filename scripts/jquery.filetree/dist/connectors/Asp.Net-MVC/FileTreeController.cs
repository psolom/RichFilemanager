[HttpPost]
public virtual ActionResult GetFiles(string dir)
{

	const string baseDir = @"/App_Data/userfiles/";

	dir = Server.UrlDecode(dir);
	string realDir = Server.MapPath(baseDir + dir);

	//validate to not go above basedir
	if (! realDir.StartsWith(Server.MapPath(baseDir)))
	{
		realDir = Server.MapPath(baseDir);
		dir = "/";
	}

	List<FileTreeViewModel> files = new List<FileTreeViewModel>();

	DirectoryInfo di = new DirectoryInfo(realDir);

	foreach (DirectoryInfo dc in di.GetDirectories())
	{                
		files.Add(new FileTreeViewModel() { Name = dc.Name, Path = String.Format("{0}{1}\\", dir, dc.Name), IsDirectory = true });
	}

	foreach (FileInfo fi in di.GetFiles())
	{
		files.Add(new FileTreeViewModel() { Name = fi.Name, Ext = fi.Extension.Substring(1).ToLower(), Path = dir+fi.Name, IsDirectory = false });
	}

	return PartialView(files);
}
