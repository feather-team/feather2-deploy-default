var path = require('path');

require('./upload.js');

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

function localDeliver(id, release, content, next){
	feather.util.write(release, content);
	next();
}

function remoteDeliver(id, release, content, receiver, next){
	feather.util.upload(
		receiver, 
		null, 
		{
			to: release
		}, 
		content, 
		id,
		function(err, res){
			if(err || res.trim() != '0'){
				feather.log.error('upload file [' + id + '] to [' + release +
					'] by receiver [' + receiver + '] error [' + (err || res) + ']');
			}else{
				var time = '[' + feather.log.now(true) + ']';
				process.stdout.write(' - '.green.bold + time.grey + ' ' + id + ' >> '.yellow.bold + release + '\n');
				next();
			}
		}
	);
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
			var subOnly = opts.subOnly, from = opts.from, to = opts.to, include = opts.include, exclude = opts.exclude, receiver = opts.receiver;

			if(feather.util.exists(to) && !feather.util.isDir(to) || !opts.to){
				feather.log.error('unable to deliver files to dir[' + to + ']: invalid output dir.');
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
		        		remoteDeliver(file.id, target, content, receiver, arguments.callee);
		        	}else{
		        		localDeliver(file.id, target, content, arguments.callee);
		        	}
				}else{
					arguments.callee();
				}
			})();
		}
	})();
};