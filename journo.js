// Generated by CoffeeScript 1.5.0-pre
(function() {
  var Highlight, Journo, catchErrors, compareManifest, fatal, folderContents, fs, htmlPath, knox, loadConfig, loadManifest, manifestPath, mapLink, marked, ncp, path, postName, postPath, postTitle, postUrl, renderVariables, s3, shared, sortedPosts, writeManifest, _,
    __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  Journo = module.exports = {};

  marked = require('marked');

  _ = require('underscore');

  shared = {};

  Journo.render = function(post, source) {
    return catchErrors(function() {
      var content, markdown, title, variables;
      source || (source = fs.readFileSync(postPath(post)));
      shared.layout || (shared.layout = _.template(fs.readFileSync('layout.html').toString()));
      variables = renderVariables(post);
      markdown = _.template(source.toString())(variables);
      title = postTitle(markdown);
      content = marked.parser(marked.lexer(markdown));
      return shared.layout(_.extend(variables, {
        title: title,
        content: content
      }));
    });
  };

  fs = require('fs');

  path = require('path');

  ncp = require('ncp').ncp;

  Journo.publish = function() {
    var FTPClient, todo;
    FTPClient = require('ftp');
    shared.ftp = new FTPClient;
    Journo.build();
    todo = loadManifest();
    shared.ftp.on('ready', function() {
      var post, _i, _j, _len, _len1, _ref, _ref1, _results;
      _ref = todo.puts;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        post = _ref[_i];
        Journo.publishPost(post);
      }
      _ref1 = todo.deletes;
      _results = [];
      for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
        post = _ref1[_j];
        _results.push(Journo.unpublishPost(post));
      }
      return _results;
    });
    shared.ftp.connect(shared.config.ftp);
    return true;
  };

  Journo.build = function() {
    var file, html, post, _i, _len, _ref;
    loadConfig();
    loadManifest();
    if (!fs.existsSync('site')) {
      fs.mkdirSync('site');
    }
    ncp('public', 'site', function(err) {
      if (err) {
        throw err;
      }
    });
    _ref = folderContents('posts');
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      post = _ref[_i];
      html = Journo.render(post);
      file = htmlPath(post);
      if (!fs.existsSync(path.dirname(file))) {
        fs.mkdirSync(path.dirname(file));
      }
      fs.writeFileSync(file, html);
    }
    return fs.writeFileSync("site/feed.rss", Journo.feed());
  };

  loadConfig = function() {
    if (shared.config) {
      return;
    }
    try {
      shared.config = JSON.parse(fs.readFileSync('config.json'));
    } catch (err) {
      fatal("Unable to read config.json");
    }
    return shared.siteUrl = shared.config.url.replace(/\/$/, '');
  };

  Journo.FTP = {};

  Journo.FTP.publishPost = function(post) {
    return fs.readFile(postPath(post), function(err, content) {
      return shared.ftp.put(new Buffer(Journo.render(post, content)), post, function(err) {
        if (err) {
          throw err;
        }
      });
    });
  };

  Journo.FTP.unpublishPost = function(post) {
    throw 'TK';
  };

  Journo.S3 = {};

  knox = require('knox');

  s3 = null;

  Journo.S3.connect = function() {
    loadConfig();
    return s3 || (s3 = knox.createClient(shared.config.s3));
  };

  Journo.S3.publishPost = function(post) {
    var client, request;
    client = Journo.S3.connect();
    throw 'content TK';
    request = client.put(path.join(shared.config.s3.path, post), {
      'Content-Length': content.length,
      'Content-Type': 'text/html',
      'x-amz-acl': 'public-read'
    });
    request.on('response', function(response) {
      if (response.statusCode === 200) {
        return console.log("PUT " + post);
      }
    });
    return request.end(content);
  };

  manifestPath = 'journo-manifest.json';

  loadManifest = function() {
    var todo;
    shared.manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath)) : {};
    todo = compareManifest();
    writeManifest();
    return todo;
  };

  writeManifest = function() {
    return fs.writeFileSync(manifestPath, JSON.stringify(shared.manifest));
  };

  compareManifest = function() {
    var content, deletes, entry, file, meta, posts, puts, stat, _i, _len, _ref;
    posts = folderContents('posts');
    puts = [];
    deletes = [];
    _ref = shared.manifest;
    for (file in _ref) {
      meta = _ref[file];
      if (!(__indexOf.call(posts, file) < 0)) {
        continue;
      }
      deletes.push(file);
      delete shared.manifest[file];
    }
    for (_i = 0, _len = posts.length; _i < _len; _i++) {
      file = posts[_i];
      stat = fs.statSync("posts/" + file);
      entry = shared.manifest[file];
      if (!entry || entry.mtime !== stat.mtime) {
        entry || (entry = {
          pubtime: new Date
        });
        entry.mtime = stat.mtime;
        content = fs.readFileSync("posts/" + file).toString();
        entry.title = postTitle(content);
        puts.push(file);
        shared.manifest[file] = entry;
      }
    }
    return {
      puts: puts,
      deletes: deletes
    };
  };

  Highlight = require('highlight').Highlight;

  marked.setOptions({
    highlight: function(code, lang) {
      return Highlight(code);
    }
  });

  Journo.feed = function() {
    var RSS, config, content, description, feed, lexed, post, title, _i, _len, _ref, _ref1;
    RSS = require('rss');
    loadConfig();
    config = shared.config;
    feed = new RSS({
      title: config.title,
      description: config.description,
      feed_url: "" + shared.siteUrl + "/rss.xml",
      site_url: shared.siteUrl,
      author: config.author
    });
    _ref = sortedPosts().slice(0, 20);
    for (_i = 0, _len = _ref.length; _i < _len; _i++) {
      post = _ref[_i];
      content = fs.readFileSync(postPath(post)).toString();
      lexed = marked.lexer(content);
      title = postTitle(content);
      description = (_ref1 = _.find(lexed, function(token) {
        return token.type === 'paragraph';
      })) != null ? _ref1.text : void 0;
      description = marked.parser(marked.lexer(_.template(description)(renderVariables(post))));
      feed.item({
        title: title,
        description: description,
        url: postUrl(post),
        date: shared.manifest[post].pubtime
      });
    }
    return feed.xml();
  };

  Journo.init = function() {
    var bootstrap, here;
    here = fs.realpathSync('.');
    if (fs.existsSync('posts')) {
      return console.error("A blog already exists in " + here);
    }
    bootstrap = path.join(__dirname, 'bootstrap');
    return ncp(bootstrap, '.', function(err) {
      if (err) {
        return console.error(err);
      }
      return console.log("Initialized new blog in " + here);
    });
  };

  Journo.preview = function() {
    var http, mime, server, url, util;
    http = require('http');
    mime = require('mime');
    url = require('url');
    util = require('util');
    loadConfig();
    loadManifest();
    server = http.createServer(function(req, res) {
      var publicPath, rawPath;
      rawPath = url.parse(req.url).pathname.replace(/^\//, '') || 'index';
      if (rawPath === 'feed.rss') {
        res.writeHead(200, {
          'Content-Type': mime.lookup('.rss')
        });
        return res.end(Journo.feed());
      } else {
        publicPath = "public/" + rawPath;
        return fs.exists(publicPath, function(exists) {
          var post;
          if (exists) {
            res.writeHead(200, {
              'Content-Type': mime.lookup(publicPath)
            });
            return fs.createReadStream(publicPath).pipe(res);
          } else {
            post = "posts/" + rawPath + ".md";
            return fs.exists(post, function(exists) {
              if (exists) {
                return fs.readFile(post, function(err, content) {
                  res.writeHead(200, {
                    'Content-Type': 'text/html'
                  });
                  return res.end(Journo.render(post, content));
                });
              } else {
                res.writeHead(404);
                return res.end('404 Not Found');
              }
            });
          }
        });
      }
    });
    server.listen(1234);
    return console.log("Journo is previewing at http://localhost:1234");
  };

  Journo.run = function() {
    var args, command;
    args = process.argv.slice(2);
    command = args[0] || 'preview';
    if (Journo[command]) {
      return Journo[command]();
    } else {
      return console.error("Journo doesn't know how to '" + command + "'");
    }
  };

  postPath = function(post) {
    return "posts/" + post;
  };

  htmlPath = function(post) {
    var name;
    name = postName(post);
    if (name === 'index') {
      return 'site/index.html';
    } else {
      return "site/" + name + "/index.html";
    }
  };

  postName = function(post) {
    return path.basename(post, '.md');
  };

  postUrl = function(post) {
    return "" + shared.siteUrl + "/" + (postName(post));
  };

  postTitle = function(content) {
    var _ref;
    return (_ref = _.find(marked.lexer(content), function(token) {
      return token.type === 'heading';
    })) != null ? _ref.text : void 0;
  };

  folderContents = function(folder) {
    return fs.readdirSync(folder).filter(function(f) {
      return f.charAt(0) !== '.';
    });
  };

  sortedPosts = function() {
    return _.sortBy(_.without(_.keys(shared.manifest), 'index.md'), function(post) {
      return shared.manifest[post].pubtime;
    });
  };

  renderVariables = function(post) {
    return {
      _: _,
      fs: fs,
      path: path,
      folderContents: folderContents,
      mapLink: mapLink,
      postName: postName,
      post: path.basename(post),
      posts: sortedPosts(),
      manifest: shared.manifest
    };
  };

  mapLink = function(place, additional, zoom) {
    var query;
    if (additional == null) {
      additional = '';
    }
    if (zoom == null) {
      zoom = 15;
    }
    query = encodeURIComponent("" + place + ", " + additional);
    return "<a href=\"https://maps.google.com/maps?q=" + query + "&t=h&z=" + zoom + "\">" + place + "</a>";
  };

  catchErrors = function(func) {
    try {
      return func();
    } catch (err) {
      console.error(err.stack);
      return "<pre>" + err.stack + "</pre>";
    }
  };

  fatal = function(message) {
    console.error(message);
    return process.exit(1);
  };

}).call(this);
