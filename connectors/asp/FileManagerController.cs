using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using System.IO;
using System.Text;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
namespace RfmNetCore.Controllers
{
    public class FileManagerController : Controller
    {
        private readonly string _webRootPath;
        private readonly string _webPath;
        private readonly List<string> _allowedExtensions;

        public FileManagerController(IHostingEnvironment env)
        {
			// FileManager Content Folder Path
            _webPath = "fm_content_folder";
            _webRootPath = Path.Combine(env.WebRootPath, _webPath);
            _allowedExtensions = new List<string> { "jpg", "jpe", "jpeg", "gif", "png", "svg", "txt", "pdf", "odp", "ods", "odt", "rtf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "csv", "ogv", "avi", "mkv", "mp4", "webm", "m4v", "ogg", "mp3", "wav", "zip", "rar", "md" };
        }

        public IActionResult Index(string mode, string path, string name, List<IFormFile> files, string old, string @new, string source, string target, string content, bool thumbnail)
        {
            if (!string.IsNullOrWhiteSpace(path) && path.StartsWith("/"))
                path = path.Substring(1);
            if (!string.IsNullOrWhiteSpace(@new) && @new.StartsWith("/"))
                @new = @new == "/" ? string.Empty : @new.Substring(1);
            if (!string.IsNullOrWhiteSpace(source) && source.StartsWith("/"))
                source = source.Substring(1);
            if (!string.IsNullOrWhiteSpace(target) && target.StartsWith("/"))
                target = target.Substring(1);

            switch (mode)
            {
                case "initiate":
                    return Json(Initiate());
                case "getfolder":
                    return Json(GetFolder(path));
                case "addfolder":
                    return Json(AddFolder(path, name));
                case "upload":
                    return Json(Upload(path, files).Result);
                case "rename":
                    return Json(Rename(old, @new));
                case "move":
                    return Json(Move(old, @new));
                case "copy":
                    return Json(Copy(source, target));
                case "editfile":
                    return Json(EditFile(path));
                case "savefile":
                    return Json(SaveFile(path, content));
                case "delete":
                    return Json(Delete(path));
                case "download":
                    if (Request.Headers["accept"].ToString().Contains("json"))
                    {
                        return Json(Download(path));
                    }
                    else
                    {
                        var file = DownloadFile(path);
                        return File(file.FileBytes, "application/x-msdownload", file.FileName);
                    }
                case "getimage":
                    return GetImage(path, thumbnail);
                case "readfile":
                    break;
                case "summarize":
                    return Json(Summarize());
            }

            throw new Exception("Unknown Request!");
        }

        private dynamic Initiate()
        {
            var result = new
            {
                Data = new
                {
                    Type = "initiate",
                    Attributes = new
                    {
                        Config = new
                        {
                            Security = new
                            {
                                ReadOnly = false,
                                Extensions = new
                                {
                                    IgnoreCase = true,
                                    Policy = "ALLOW_LIST",
                                    Restrictions = _allowedExtensions
                                }
                            }
                        }
                    }
                }
            };

            return result;

        }

        private dynamic GetFolder(string path)
        {


            if (path == null) path = string.Empty;

            var rootpath = Path.Combine(_webRootPath, path);

            var rootDirectory = new DirectoryInfo(rootpath);


            var data = new List<dynamic>();

            foreach (var directory in rootDirectory.GetDirectories())
            {
                var item = new
                {
                    Id = MakeWebPath(Path.Combine(path, directory.Name), false, true),
                    Type = "folder",
                    Attributes = new
                    {
                        Name = directory.Name,
                        Path = MakeWebPath(Path.Combine(_webPath, path, directory.Name), true, true),
                        Readable = 1,
                        Writable = 1,
                        Created = directory.CreationTime.ToString(CultureInfo.InvariantCulture),
                        Modified = directory.LastWriteTime.ToString(CultureInfo.InvariantCulture),
                        Timestamp = (int) (DateTime.Now - directory.LastWriteTime).Ticks
                    }
                };

                data.Add(item);
            }

            foreach (var file in rootDirectory.GetFiles())
            {
                var item = new
                {
                    Id = MakeWebPath(Path.Combine(path, file.Name)),
                    Type = "file",
                    Attributes = new
                    {
                        Name = file.Name,
                        Path = MakeWebPath(Path.Combine(_webPath, path, file.Name), true),
                        Readable = 1,
                        Writable = 1,
                        Created = file.CreationTime.ToString(CultureInfo.InvariantCulture),
                        Modified = file.LastWriteTime.ToString(CultureInfo.InvariantCulture),
                        Extension = file.Extension.Replace(".", ""),
                        Size = file.Length,
                        Timestamp = (int) (DateTime.Now - file.LastWriteTime).Ticks
                    }
                };

                data.Add(item);
            }

            var result = new
            {
                Data = data

            };

            return result;
        }

        private dynamic AddFolder(string path, string name)
        {
            var newDirectoryPath = Path.Combine(_webRootPath, path, name);

            var directoryExist = Directory.Exists(newDirectoryPath);

            if (directoryExist)
            {
                var errorResult = new  { Errors = new List<dynamic>() };

                errorResult.Errors.Add(new
                {
                    Code = "500",
                    Title = "DIRECTORY_ALREADY_EXISTS",
                    Meta = new
                    {
                        Arguments = new List<string>
                        {
                            name
                        }
                    }
                });

                return errorResult;
            }

            Directory.CreateDirectory(newDirectoryPath);
            var directory = new DirectoryInfo(newDirectoryPath);

            var result = new
            {
                Data =
                    new
                    {
                        Id = MakeWebPath(Path.Combine(path, directory.Name), false, true),
                        Type = "folder",
                        Attributes = new
                        {
                            Name = directory.Name,
                            Path = MakeWebPath(Path.Combine(_webPath, path, directory.Name), true, true),
                            Readable = 1,
                            Writable = 1,
                            Created = DateTime.Now.ToString(CultureInfo.InvariantCulture),
                            Modified = DateTime.Now.ToString(CultureInfo.InvariantCulture)
                        }
                    }
            };

            return result;
        }

        private async Task<dynamic> Upload(string path, IEnumerable<IFormFile> files)
        {
            var result = new {Data = new List<dynamic>()}; 

            foreach (var file in files)
            {
                if (file.Length <= 0) continue;

                var fileExist = System.IO.File.Exists(Path.Combine(_webRootPath, path, file.FileName));

                if (fileExist)
                {
                    var errorResult = new { Errors = new List<dynamic>() };

                    errorResult.Errors.Add(new
                    {
                        Code = "500",
                        Title = "FILE_ALREADY_EXISTS",
                        Meta = new
                        {
                            Arguments = new List<string>
                            {
                                file.FileName
                            }
                        }
                    });

                    return errorResult;
                }

                using (var fileStream = new FileStream(Path.Combine(_webRootPath, path, file.FileName), FileMode.Create))
                {
                    await file.CopyToAsync(fileStream);
                }

                result.Data.Add(new
                {
                    Id = MakeWebPath(Path.Combine(path, file.FileName)),
                    Type = "file",
                    Attributes = new
                    {
                        Name = file.FileName,
                        Extension = Path.GetExtension(file.FileName).Replace(".", ""),
                        Path = MakeWebPath(Path.Combine(_webPath, path, file.FileName), true),
                        Readable = 1,
                        Writable = 1,
                        Created = DateTime.Now.ToString(CultureInfo.InvariantCulture),
                        Modified = DateTime.Now.ToString(CultureInfo.InvariantCulture),
                        Size = file.Length
                    }
                });

            }

            return result;
        }

        private dynamic Rename(string old, string @new)
        {
            var oldPath = Path.Combine(_webRootPath, old);

            var fileAttributes = System.IO.File.GetAttributes(oldPath);

            if (fileAttributes == FileAttributes.Directory)
            {
                var oldDirectoryName = Path.GetDirectoryName(old).Split('\\').Last();
                var newDirectoryPath = old.Replace(oldDirectoryName, @new);
                var newPath = Path.Combine(_webRootPath, newDirectoryPath);

                var directoryExist = Directory.Exists(newPath);

                if (directoryExist)
                {
                    var errorResult = new { Errors = new List<dynamic>() };

                    errorResult.Errors.Add(new
                    {
                        Code = "500",
                        Title = "DIRECTORY_ALREADY_EXISTS",
                        Meta = new
                        {
                            Arguments = new List<string>
                            {
                                @new
                            }
                        }
                    });

                    return errorResult;
                }


                Directory.Move(oldPath, newPath);

                var result = new
                {
                    Data = new
                    {
                        Id = newDirectoryPath,
                        Type = "folder",
                        Attributes = new
                        {
                            Name = @new,
                            Readable = 1,
                            Writable = 1,
                            // created date, size vb.
                            Modified = DateTime.Now.ToString(CultureInfo.InvariantCulture),
                        }
                    }
                };

                return result;
            }
            else
            {

                var oldFileName = Path.GetFileName(old);
                var newFilePath = old.Replace(oldFileName, @new);
                var newPath = Path.Combine(_webRootPath, newFilePath);

                var fileExist = System.IO.File.Exists(newPath);

                if (fileExist)
                {
                    var errorResult = new { Errors = new List<dynamic>() };

                    errorResult.Errors.Add(new
                    {
                        Code = "500",
                        Title = "FILE_ALREADY_EXISTS",
                        Meta = new
                        {
                            Arguments = new List<string>
                            {
                                @new
                            }
                        }
                    });

                    return errorResult;
                }

                System.IO.File.Move(oldPath, newPath);

                var result = new
                {
                    Data = new
                    {
                        Id = newFilePath,
                        Type = "file",
                        Attributes = new
                        {
                            Name = @new,
                            Extension = Path.GetExtension(newPath).Replace(".", ""),
                            Readable = 1,
                            Writable = 1,
                            // created date, size vb.
                            Modified = DateTime.Now.ToString(CultureInfo.InvariantCulture),
                        }
                    }
                };

                return result;
            }
        }

        private dynamic Move(string old, string @new)
        {
            var fileAttributes = System.IO.File.GetAttributes(Path.Combine(_webRootPath, old));

            if (fileAttributes == FileAttributes.Directory)
            {
                var directoryName = Path.GetDirectoryName(old).Split('\\').Last();
                var newDirectoryPath = Path.Combine(@new, directoryName);
                var oldPath = Path.Combine(_webRootPath, old);
                var newPath = Path.Combine(_webRootPath, @new, directoryName);


                var directoryExist = Directory.Exists(newPath);

                if (directoryExist)
                {
                    var errorResult = new { Errors = new List<dynamic>() };

                    errorResult.Errors.Add(new
                    {
                        Code = "500",
                        Title = "DIRECTORY_ALREADY_EXISTS",
                        Meta = new
                        {
                            Arguments = new List<string>
                            {
                                directoryName
                            }
                        }
                    });

                    return errorResult;
                }

                Directory.Move(oldPath, newPath);

                var result = new
                {
                    Data = new
                    {
                        Id = newDirectoryPath,
                        Type = "folder",
                        Attributes = new
                        {
                            Name = directoryName,
                            Readable = 1,
                            Writable = 1,
                            // created date, size vb.
                            Modified = DateTime.Now.ToString(CultureInfo.InvariantCulture),
                        }
                    }
                };

                return result;
            }
            else
            {
                var fileName = Path.GetFileName(old);
                var newFilePath = Path.Combine(@new, fileName);
                var oldPath = Path.Combine(_webRootPath, old);

                var newPath = @new == "/"
                    ? Path.Combine(_webRootPath, fileName.Replace("/", ""))
                    : Path.Combine(_webRootPath, @new, fileName);


                var fileExist = System.IO.File.Exists(newPath);

                if (fileExist)
                {
                    var errorResult = new { Errors = new List<dynamic>() };

                    errorResult.Errors.Add(new
                    {
                        Code = "500",
                        Title = "FILE_ALREADY_EXISTS",
                        Meta = new
                        {
                            Arguments = new List<string>
                            {
                                fileName
                            }
                        }
                    });

                    return errorResult;
                }

                System.IO.File.Move(oldPath, newPath);

                var result = new
                {
                    Data = new
                    {
                        Id = newFilePath,
                        Type = "file",
                        Attributes = new
                        {
                            Name = fileName,
                            Extension = Path.GetExtension(@new).Replace(".", ""),
                            Readable = 1,
                            Writable = 1,
                            // created date, size vb.
                            Modified = DateTime.Now.ToString(CultureInfo.InvariantCulture),
                        }
                    }
                };

                return result;
            }
        }

        private dynamic Copy(string source, string target)
        {
            var fileAttributes = System.IO.File.GetAttributes(Path.Combine(_webRootPath, source));

            if (fileAttributes == FileAttributes.Directory)
            {
                var directoryName = Path.GetDirectoryName(source).Split('\\').Last();
                var newDirectoryPath = Path.Combine(target, directoryName);
                var oldPath = Path.Combine(_webRootPath, source);
                var newPath = Path.Combine(_webRootPath, target, directoryName);


                var directoryExist = Directory.Exists(newPath);

                if (directoryExist)
                {
                    var errorResult = new { Errors = new List<dynamic>() };

                    errorResult.Errors.Add(new
                    {
                        Code = "500",
                        Title = "DIRECTORY_ALREADY_EXISTS",
                        Meta = new
                        {
                            Arguments = new List<string>
                            {
                                directoryName
                            }
                        }
                    });

                    return errorResult;
                }

                DirectoryCopy(oldPath, newPath);

                var result = new
                {
                    Data = new
                    {
                        Id = newDirectoryPath,
                        Type = "folder",
                        Attributes = new
                        {
                            Name = directoryName,
                            Readable = 1,
                            Writable = 1,
                            // created date, size vb.
                            Modified = DateTime.Now.ToString(CultureInfo.InvariantCulture),
                        }
                    }
                };

                return result;
            }
            else
            {
                var fileName = Path.GetFileName(source);
                var newFilePath = Path.Combine(@target, fileName);
                var oldPath = Path.Combine(_webRootPath, source);
                var newPath = Path.Combine(_webRootPath, target, fileName);

                var fileExist = System.IO.File.Exists(newPath);

                if (fileExist)
                {
                    var errorResult = new { Errors = new List<dynamic>() };

                    errorResult.Errors.Add(new
                    {
                        Code = "500",
                        Title = "FILE_ALREADY_EXISTS",
                        Meta = new
                        {
                            Arguments = new List<string>
                            {
                                fileName
                            }
                        }
                    });

                    return errorResult;
                }

                System.IO.File.Copy(oldPath, newPath);

                var result = new
                {
                    Data = new
                    {
                        Id = newFilePath,
                        Type = "file",
                        Attributes = new
                        {
                            Name = fileName,
                            Extension = Path.GetExtension(fileName).Replace(".", ""),
                            Readable = 1,
                            Writable = 1,
                            // created date, size vb.
                            Modified = DateTime.Now.ToString(CultureInfo.InvariantCulture),
                        }
                    }
                };

                return result;

            }
        }

        private dynamic EditFile(string path)
        {
            var fileName = Path.GetFileName(path);
            var fileExtension = Path.GetExtension(path).Replace(".", "");
            var filePath = Path.Combine(_webRootPath, path);

            var content = System.IO.File.ReadAllText(filePath, Encoding.UTF8);

            var result = new
            {
                Data = new
                {
                    Id = path,
                    Type = "file",
                    Attributes = new
                    {
                        Name = fileName,
                        Extension = fileExtension,
                        Writable = 1,
                        Readable = 1,
                        // created vb.
                        Content = content,
                        Path = $"/{Path.Combine(path)}"
                    }
                }
            };

            return result;
        }

        private dynamic SaveFile(string path, string content)
        {
            var filePath = Path.Combine(_webRootPath, path);

            System.IO.File.WriteAllText(filePath, content);

            var fileName = Path.GetFileName(path);
            var fileExtension = Path.GetExtension(fileName);

            var result = new
            {
                Data = new
                {
                    Id = path,
                    Type = "file",
                    Attributes = new
                    {
                        Name = fileName,
                        Extension = fileExtension,
                        Readable = 1,
                        Writable = 1
                        // created vb.
                    }
                }
            };

            return result;
        }

        private dynamic Delete(string path)
        {
            var fileAttributes = System.IO.File.GetAttributes(Path.Combine(_webRootPath, path));

            if (fileAttributes == FileAttributes.Directory)
            {
                var directoryName = Path.GetDirectoryName(path).Split('\\').Last();

                Directory.Delete(Path.Combine(_webRootPath, path), true);

                var result = new
                {
                    Data = new
                    {
                        Id = path,
                        Type = "folder",
                        Attributes = new
                        {
                            Name = directoryName,
                            Readable = 1,
                            Writable = 1,
                            // created date, size vb.
                            Modified = DateTime.Now.ToString(CultureInfo.InvariantCulture),
                            Path = path
                        }
                    }
                };

                return result;
            }
            else
            {
                var fileName = Path.GetFileName(Path.Combine(_webRootPath, path));
                var fileExtension = Path.GetExtension(fileName).Replace(".", "");

                System.IO.File.Delete(Path.Combine(_webRootPath, path));

                var result = new
                {
                    Data = new
                    {
                        Id = path,
                        Type = "file",
                        Attributes = new
                        {
                            Name = fileName,
                            Extension = fileExtension,
                            Readable = 1,
                            Writable = 1,
                            // created date, size vb.
                            Modified = DateTime.Now.ToString(CultureInfo.InvariantCulture),
                            // Path = $"/{fileName}"
                        }
                    }
                };

                return result;
            }
        }

        private dynamic Download(string path)
        {
            var fileName = Path.GetFileName(Path.Combine(_webRootPath, path));
            var fileExtension = Path.GetExtension(fileName).Replace(".", "");

            // undone dosya var m� kontrol�...

            var result = new
            {
                Data = new
                {
                    Id = path,
                    Type = "file",
                    Attributes = new
                    {
                        Name = fileName,
                        Extension = fileExtension,
                        Readable = 1,
                        Writable = 1,
                        // created date, size vb.
                        Modified = DateTime.Now.ToString(CultureInfo.InvariantCulture),
                        //Path = $"{path}"
                    }
                }
            };

            return result;

        }

        private dynamic DownloadFile(string path)
        {
            var filepath = Path.Combine(_webRootPath, path);
            var fileName = Path.GetFileName(filepath);
            byte[] fileBytes = System.IO.File.ReadAllBytes(filepath);

            var file = new
            {
                FileName = fileName,
                FileBytes = fileBytes
            };

            return file;
        }

        private IActionResult GetImage(string path, bool thumbnail)
        {
            var filepath = Path.Combine(_webRootPath, path);
            var fileName = Path.GetFileName(filepath);
            byte[] fileBytes = System.IO.File.ReadAllBytes(filepath);

            return File(fileBytes, "application/x-msdownload", fileName);
        }

        private dynamic Summarize()
        {
            var directories = Directory.GetDirectories(_webRootPath, "*", SearchOption.AllDirectories).Length;

            var directoryInfo = new DirectoryInfo(_webRootPath);
            var files = directoryInfo.GetFiles("*", SearchOption.AllDirectories);
            var allSize = files.Select(f => f.Length).Sum();



            var result = new
            {
                Data = new
                {
                    Id = "/",
                    Type = "summary",
                    Attributes = new
                    {
                        Size = allSize,
                        Files = files.Length,
                        Folders = directories,
                        SizeLimit = 0
                    }
                }
            };

            return result;
        }



        private static void DirectoryCopy(string sourceDirName, string destDirName)
        {
            // Get the subdirectories for the specified directory.
            var dir = new DirectoryInfo(sourceDirName);

            if (!dir.Exists)
            {
                throw new DirectoryNotFoundException(
                    "Source directory does not exist or could not be found: "
                    + sourceDirName);
            }

            var dirs = dir.GetDirectories();
            // If the destination directory doesn't exist, create it.
            if (!Directory.Exists(destDirName))
            {
                Directory.CreateDirectory(destDirName);
            }

            // Get the files in the directory and copy them to the new location.
            var files = dir.GetFiles();
            foreach (var file in files)
            {
                var temppath = Path.Combine(destDirName, file.Name);
                file.CopyTo(temppath, false);
            }

            // If copying subdirectories, copy them and their contents to new location.
            foreach (var subdir in dirs)
            {
                var temppath = Path.Combine(destDirName, subdir.Name);
                DirectoryCopy(subdir.FullName, temppath);
            }
        }

        private static string MakeWebPath(string path, bool addSeperatorToBegin = false, bool addSeperatorToLast = false)
        {
            path = path.Replace("\\", "/");

            if (addSeperatorToBegin) path = "/" + path;
            if (addSeperatorToLast) path = path + "/";

            return path;
        }

    }
}