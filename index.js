var path = require('path');
var fs = require('fs')
var Deliver = {
	http: require('./deliver/http.js'),
	ftp: require('./deliver/ftp.js'),
	local: require('./deliver/local.js')
};    

var AdmZip = require('adm-zip');

function replaceFrom(path, from, subOnly){
    if(path.indexOf(from) === 0){
        from = from.replace(/\/$/, '');

        if(subOnly){
            return path.substring(from.length);
        } else {
            var index = from.lastIndexOf('/');

            if(index < 1){
                return path;
            }else{
                return path.substring(index);
            }
        }
    }

    return path;
}

function deliver(file, content, opt, callback){
	if(opt.receiver){
		Deliver.http(file, opt.target, content, opt.receiver, callback);
	}else if(opt.connect){
		Deliver.ftp(file, opt.target, content, opt.connect, callback);
	}else{
		Deliver.local(file, opt.target, content, null, callback);
	}
}

function promiseZipOut(zip){
	return new Promise(function(resolve){
		var filename = Date.now() + '.zip';
	    var targetPath = path.resolve(fis.project.getTempRoot() + '/zip/', filename);

	    if (!fis.util.exists(targetPath)) {
	        fis.util.mkdir(fis.util.pathinfo(targetPath).dirname);
	    }

	    var obj = new AdmZip();

	    for(var i in zip.files){
	    	obj.addFile(i, typeof zip.files[i] == 'string' ? new Buffer(zip.files[i]) : zip.files[i]);
	    }

	    obj.writeZip(targetPath, function(){
    		var file = new feather.file(feather.project.getProjectPath() + '/' + filename);
    		var content = feather.util.read(targetPath);
	        deliver(file, content, zip, function(){
	        	var hash = new feather.file(feather.project.getProjectPath() + '/' + filename + '.hash');
	        	deliver(hash, feather.util.md5(content, 32), {
	        		connect: zip.connect,
					receiver: zip.receiver,
					target: zip.hash
	        	}, resolve);
	        });
    	});
	});
}

module.exports = function(options, modified, total, next){
	var chains = [];

	if(!options.dest){
		options.dest = 'preview';
	}

	options.dest.split(/\s*,\s*/g).forEach(function(destName){
		if(!destName) return;	

		var opts = {};

		if(destName[0] == '.'){
			opts.to = path.normalize(process.cwd() + '/' + destName);
			chains.push(opts);
		}else{
			var config = feather.config.get('deploy.' + destName);

			if(config){
				chains = chains.concat(config);
			}else{
				feather.log.error('invalid deploy destination options [' + destName + ']!');
			}
		}
	});

	feather.emit('deploy:start', {
		options: options,
		modified: modified,
		total: total
	});

	var zips = {};

	(function deploy(){
		if(!chains.length){
			var promises = [];

			for(var i in zips){
				promises.push(promiseZipOut(zips[i]));
			}

			Promise.all(promises).then(function(){
				feather.emit('deploy:end');
				next();
			})
		}else{
			var opts = chains.shift();
			var subOnly = opts.subOnly, from = opts.from, to = opts.to, include = opts.include, exclude = opts.exclude, replace = opts.replace || [];
			var zipOnly = opts.zipOnly;
			var receiver = opts.receiver;
			var connect = opts.connect;

			if(opts.zip && !zips[opts.zip]){
				var target = opts.zip.indexOf('/') == 0 ? opts.zip : path.resolve(feather.project.getProjectPath(), opts.zip);

				zips[opts.zip] = {
					target: target,
					connect: connect,
					receiver: receiver,
					files: {},
					hash: target + '.hash'
				};
			}

			if(feather.util.exists(to) && !feather.util.isDir(to) || !opts.to){
				feather.log.error('unable to deliver files to dir[' + to + ']: invalid output dir.');
			}

			if(replace){
				if(!Array.isArray(replace)){
					replace = [replace];
				}

				//replace
				replace.forEach(function(options){
					if(!options.from || typeof options.to === 'undefined'){
        				feather.log.error('Invalid, please set option: {from: `reg/string` to: `function/string` }');
    				}
				});
			}

			var start = 0; end = modified.length;

			(function(){	
				if(start == end){
					deploy();
					return;
				}

				var file = modified[start++];

				if(
					file.release &&
					(from && file.release.indexOf(from) === 0 || !from) &&
					feather.util.filter(file.release, include, exclude)
				){
					replace.forEach(function(opts){
						require('./lib/replace.js')(file, opts);
					});

					var release = replaceFrom(file.getHashRelease(), from, subOnly);
		        	var target = feather.util(to, release);
		        	var content = file.getContent();

		        	if(zips[opts.zip]){
		        		zips[opts.zip].files[release.replace(/^\/+/, '')] = content;
		        	}

		        	if(!zipOnly){
		        		deliver(file, content, {
			        		target: target,
			        		receiver: receiver,
			        		connect: connect
			        	}, arguments.callee);
		        	}else{
		        		arguments.callee();
		        	}
				}else{
					arguments.callee();
				}
			})();
		}
	})();
};