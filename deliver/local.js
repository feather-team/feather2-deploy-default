module.exports = function(file, release, content, options, next){
    feather.util.write(release, content);
    next();
}