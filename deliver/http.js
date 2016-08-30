require('../lib/upload.js');

module.exports = function(file, release, content, receiver, next){
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
                feather.log.error('upload file [' + file.id + '] to [' + release +
                    '] by receiver [' + receiver + '] error [' + (err || res) + ']');
            }else{
                var time = '[' + feather.log.now(true) + ']';
                process.stdout.write(' - '.green.bold + time.grey + ' ' + id + ' >> '.yellow.bold + release + '\n');
                next();
            }
        }
    );
};