var ftp = require('fis-deploy-ftp');

module.exports = function(file, release, content, connect, next){
    ftp({
        release: release
    }, file, content, {
        connect: connect
    }, next);
};