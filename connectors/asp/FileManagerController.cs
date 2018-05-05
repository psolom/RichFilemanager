using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc;
using System.IO;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using System.Net.Mime;

namespace API.NetCore.Controllers
{
    [Route("[controller]")]

    public class FileManagerController : Controller
    {
        private readonly string _webRootPath;
        private readonly string _webPath;
        private readonly List<string> _allowedExtensions;

        public FileManagerController(IHostingEnvironment env)
        {
            // FileManager Content Folder
            _webPath = "ContentLibrary";
            if (string.IsNullOrWhiteSpace(env.WebRootPath))
            {
                env.WebRootPath = Directory.GetCurrentDirectory();
            }
            _webRootPath = Path.Combine(env.WebRootPath, _webPath);
            _allowedExtensions = new List<string> { "jpg", "jpe", "jpeg", "gif", "png", "svg", "txt", "pdf", "odp", "ods", "odt", "rtf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "csv", "ogv", "avi", "mkv", "mp4", "webm", "m4v", "ogg", "mp3", "wav", "zip", "rar", "md" };

        }

        public IActionResult Index(string mode, string path, string name, List<IFormFile> files, string old, string @new, string source, string target, string content, bool thumbnail, string @string)
        {
            try
            {
                if (mode == null)
                {
                    return null;
                }

                if (!string.IsNullOrWhiteSpace(path) && path.StartsWith("/"))
                    path = path.Substring(1);
                if (!string.IsNullOrWhiteSpace(@new) && @new.StartsWith("/"))
                    @new = @new == "/" ? string.Empty : @new.Substring(1);
                if (!string.IsNullOrWhiteSpace(source) && source.StartsWith("/"))
                    source = source.Substring(1);
                if (!string.IsNullOrWhiteSpace(target) && target.StartsWith("/"))
                    target = target.Substring(1);


                switch (mode.ToLower(CultureInfo.CurrentCulture))
                {
                    case "initiate":
                        return Json(Initiate());
                    case "getinfo":
                        return Json(GetInfo(path));
                    case "readfolder":
                        return Json(ReadFolder(path));
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
                    case "savefile":
                        return Json(SaveFile(path, content));
                    case "delete":
                        return Json(Delete(path));
                    case "download":
                        return Download(path);
                    case "getimage":
                        return GetImage(path, thumbnail);
                    case "readfile":
                        return ReadFile(path);
                    case "summarize":
                        return Json(Summarize());
                    case "seekfolder":
                        return Json(SeekFolder(path, @string));
                }

                throw new Exception("Unknown Request!");
            }
            catch (Exception e)
            {
                // returns all unhandeled exceptions and returns them in JSON format with 500.
                // Issue #314
                return new JsonResult(e.Message)
                {
                    StatusCode = StatusCodes.Status500InternalServerError,
                    ContentType = "application/json"
                };
            }
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

        private Int32 GetUnixTimestamp(DateTime dt)
        {
            return (Int32)(dt.ToUniversalTime().Subtract(new DateTime(1970, 1, 1))).TotalSeconds;
        }

        private dynamic SeekFolder(string path, string search)
        {
            if (path == null) { path = string.Empty; };

            var searchPath = Path.Combine(_webRootPath, path);
            var data = new List<dynamic>();

            foreach (FileInfo file in new DirectoryInfo(searchPath).GetFiles("*" + search + "*", SearchOption.AllDirectories))
            {
                var item = new
                {
                    Id = MakeWebPath(Path.Combine(Path.GetRelativePath(_webRootPath, file.DirectoryName), file.Name), true),
                    Type = "file",
                    Attributes = new
                    {
                        Name = file.Name,
                        Path = MakeWebPath(Path.Combine(Path.GetRelativePath(_webRootPath, file.DirectoryName), file.Name), true),
                        Readable = 1,
                        Writable = 1,
                        Created = GetUnixTimestamp(file.CreationTimeUtc),
                        Modified = GetUnixTimestamp(file.LastWriteTimeUtc),
                        Size = file.Length,
                        Extension = file.Extension.TrimStart('.'),
                        // Insert Height and Width logic for images
                        Timestamp = DateTime.Now.Subtract(file.LastWriteTime).TotalSeconds
                    }
                };
                data.Add(item);
            }
            foreach (DirectoryInfo dir in new DirectoryInfo(searchPath).GetDirectories("*" + search + "*", SearchOption.AllDirectories))
            {

                var item = new
                {
                    Id = MakeWebPath(Path.GetRelativePath(_webRootPath, dir.FullName), false, true),
                    Type = "folder",
                    Attributes = new
                    {
                        Name = dir.Name,
                        Path = MakeWebPath(dir.FullName, true, true),
                        Readable = 1,
                        Writable = 1,
                        Created = GetUnixTimestamp(dir.CreationTimeUtc),
                        Modified = GetUnixTimestamp(dir.LastWriteTimeUtc),
                        Timestamp = DateTime.Now.Subtract(dir.LastWriteTime).TotalSeconds
                    }
                };
                data.Add(item);
            }
            return new
            {
                Data = data
            };
        }

        private dynamic GetInfo(string path)
        {
            if (path == null) { path = string.Empty; };

            var filePath = Path.Combine(_webRootPath, path);
            FileInfo file = new FileInfo(path);

            return new
            {
                Data = new
                {
                    Id = MakeWebPath(Path.Combine(Path.GetRelativePath(_webRootPath, file.DirectoryName), file.Name), true),
                    Type = "file",
                    Attributes = new
                    {
                        Name = file.Name,
                        Path = MakeWebPath(Path.Combine(Path.GetRelativePath(_webRootPath, file.DirectoryName), file.Name), false),
                        Readable = 1,
                        Writable = 1,
                        Created = GetUnixTimestamp(file.CreationTimeUtc),
                        Modified = GetUnixTimestamp(file.LastWriteTimeUtc),
                        Size = file.Length,
                        Extension = file.Extension.TrimStart('.'),
                        Timestamp = DateTime.Now.Subtract(file.LastWriteTime).TotalSeconds
                    }
                }
            };
        }

        private dynamic ReadFolder(string path)
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
                        Created = GetUnixTimestamp(directory.CreationTime),
                        Modified = GetUnixTimestamp(directory.LastWriteTime),
                        Timestamp = DateTime.Now.Subtract(directory.LastWriteTime).TotalSeconds
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
                        Created = GetUnixTimestamp(file.CreationTime),
                        Modified = GetUnixTimestamp(file.LastWriteTime),
                        Extension = file.Extension.Replace(".", ""),
                        Size = file.Length,
                        Timestamp = DateTime.Now.Subtract(file.LastWriteTime).TotalSeconds,
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
                var errorResult = new { Errors = new List<dynamic>() };

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
                            Created = GetUnixTimestamp(DateTime.Now),
                            Modified = GetUnixTimestamp(DateTime.Now)
                        }
                    }
            };

            return result;
        }

        private async Task<dynamic> Upload(string path, IEnumerable<IFormFile> files)
        {
            var result = new { Data = new List<dynamic>() };

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
                        Created = GetUnixTimestamp(DateTime.Now),
                        Modified = GetUnixTimestamp(DateTime.Now),
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

            if ((fileAttributes & FileAttributes.Directory) == FileAttributes.Directory) //Fixed if the directory is compressed
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
                            Created = GetUnixTimestamp(DateTime.Now),
                            Modified = GetUnixTimestamp(DateTime.Now)
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
                            Created = GetUnixTimestamp(DateTime.Now),
                            Modified = GetUnixTimestamp(DateTime.Now)
                        }
                    }
                };

                return result;
            }
        }

        private dynamic Move(string old, string @new)
        {
            var fileAttributes = System.IO.File.GetAttributes(Path.Combine(_webRootPath, old));

            if ((fileAttributes & FileAttributes.Directory) == FileAttributes.Directory) //Fixed if the directory is compressed
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
                            Created = GetUnixTimestamp(DateTime.Now),
                            Modified = GetUnixTimestamp(DateTime.Now)
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
                            Created = GetUnixTimestamp(DateTime.Now),
                            Modified = GetUnixTimestamp(DateTime.Now)
                        }
                    }
                };

                return result;
            }
        }

        private dynamic Copy(string source, string target)
        {
            var fileAttributes = System.IO.File.GetAttributes(Path.Combine(_webRootPath, source));

            if ((fileAttributes & FileAttributes.Directory) == FileAttributes.Directory) //Fixed if the directory is compressed
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
                            Created = GetUnixTimestamp(DateTime.Now),
                            Modified = GetUnixTimestamp(DateTime.Now)
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
                            Created = GetUnixTimestamp(DateTime.Now),
                            Modified = GetUnixTimestamp(DateTime.Now)
                        }
                    }
                };

                return result;

            }
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
                    }
                }
            };

            return result;
        }

        private dynamic Delete(string path)
        {
            var fileAttributes = System.IO.File.GetAttributes(Path.Combine(_webRootPath, path));

            if ((fileAttributes & FileAttributes.Directory) == FileAttributes.Directory) //Fixed if the directory is compressed
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
                            Created = GetUnixTimestamp(DateTime.Now),
                            Modified = GetUnixTimestamp(DateTime.Now),
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
                            Created = GetUnixTimestamp(DateTime.Now),
                            Modified = GetUnixTimestamp(DateTime.Now)
                            // Path = $"/{fileName}"
                        }
                    }
                };

                return result;
            }
        }

        private dynamic ReadFile(string path)
        {
            var filePath = Path.Combine(_webRootPath, path);
            var fileName = Path.GetFileName(filePath);
            byte[] fileBytes = System.IO.File.ReadAllBytes(filePath);

            var cd = new ContentDisposition
            {
                Inline = true,
                FileName = fileName
            };
            Response.Headers.Add("Content-Disposition", cd.ToString());

            return File(fileBytes, "application/octet-stream");
        }

        private IActionResult GetImage(string path, bool thumbnail)
        {
            var filePath = Path.Combine(_webRootPath, path);
            var fileName = Path.GetFileName(filePath);
            byte[] fileBytes = System.IO.File.ReadAllBytes(filePath);

            var cd = new ContentDisposition
            {
                Inline = true,
                FileName = fileName
            };
            Response.Headers.Add("Content-Disposition", cd.ToString());

            return File(fileBytes, "image/*");
        }

        private dynamic Download(string path)
        {
            var filePath = Path.Combine(_webRootPath, path);
            var fileName = Path.GetFileName(filePath);
            byte[] fileBytes = System.IO.File.ReadAllBytes(filePath);

            return File(fileBytes, "application/x-msdownload", fileName);
        }

        private dynamic Summarize()
        {
            // Get Dir count
            var directories = Directory.GetDirectories(_webRootPath, "*", SearchOption.AllDirectories).Length;

            // Get file count
            var directoryInfo = new DirectoryInfo(_webRootPath);
            var files = directoryInfo.GetFiles("*", SearchOption.AllDirectories);
            
            // Get combined file sizes
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
