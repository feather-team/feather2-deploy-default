var path = require('path');
var Deliver = {
	http: require('./deliver/http.js'),
	ftp: require('./deliver/ftp.js'),
	local: require('./deliver/local.js')
};

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

	(function deploy(){
		if(!chains.length){
			next();
		}else{
			var opts = chains.shift();
			var subOnly = opts.subOnly, from = opts.from, to = opts.to, include = opts.include, exclude = opts.exclude, replace = opts.replace;
			var receiver = opts.receiver;
			var connect = opts.connect;

			if(feather.util.exists(to) && !feather.util.isDir(to) || !opts.to){
				feather.log.error('unable to deliver files to dir[' + to + ']: invalid output dir.');
			}

			if(replace){
				if(!Array.isArray(replace)){
					replace = [replace];
				}

				//replace
				replace.forEach(function(opts){
					require('fis3-deploy-replace')(opts, modified, total, function(){});
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
					var release = replaceFrom(file.getHashRelease(), from, subOnly);
		        	var target = feather.util(to, release);
		        	var content = file.getContent();

		        	if(receiver){
		        		Deliver.http(file, target, content, receiver, arguments.callee);
		        	}else if(connect){
		        		Deliver.ftp(file, target, content, connect, arguments.callee);
		        	}else{
		        		Deliver.local(file, target, content, null, arguments.callee);
		        	}
				}else{
					arguments.callee();
				}
			})();
		}
	})();
};