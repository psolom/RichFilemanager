#!/usr/bin/perl 

use warnings;
use strict;
use CGI;
use File::Spec;

#2015-02-26, Jack Challen 
# newer version of the jQueryFileTree.pl connector.
# Written from scratch based on the output from Dave Rogers

#This is the root of the directories returned; the script won't return anything above this
my $root = "/var/www/html"; # no trailing slash as it's compared to the output of canonpath

my $q = CGI->new();
print $q->header();

my $dir = $q->param("dir"); # the directory from the user

my $dir_path = File::Spec->canonpath($dir);
if($dir_path !~ /^$root/) {
    die "Invalid path $dir supplied\n";
}

#This bit's untested
my $checkbox = "";
if($q->param("multiSelect")) {
    $checkbox = "<input type=\"checkbox\" />"
}

my (@files, @directories);

opendir(my $dir_handle, $dir_path)
    or die "Couldn't open $dir_path: $!\n";
    @files       = grep { /^[^.]/ && -f File::Spec->catfile($dir_path, $_) } readdir $dir_handle;
    rewinddir $dir_handle;
    @directories = grep { /^[^.]/ && -d File::Spec->catdir($dir_path, $_) } readdir $dir_handle;
closedir($dir_handle);

print "<ul class=\"jqueryFileTree\">\n";
foreach my $directory (sort @directories) {
    print "        <li class=\"directory collapsed\">$checkbox<a rel=\"$dir_path/$directory/\">$directory</a></li>\n";
}
foreach my $file (sort @files) {
    my $file_ext = (split /\./, $file)[1] || "";
    print "        <li class=\"file ext_${file_ext}\">$checkbox<a rel=\"$dir_path/$file\">$file</a></li>\n";
}
print "</ul>\n";
