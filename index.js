/**
 * Created by Administrator on 2016/8/15.
 */
var path = require('path');
var fs = require('fs');

var _ = fis.util;

var fisPack = module.exports = {};
module.exports = function(ret, pack, settings, opt, packCss) {
    //console.log(opt);

    // var root = fis.project.getProjectPath();
    // var ns = fis.get('namespace');
    // var mapFile = ns ? (ns + '-map.json') : 'map.json';
    // var map = fis.file.wrap(path.join(root, mapFile));
    // console.log(map);

    if (Object.keys(pack).length) {
        fis.log.warn('`packTo` or `fis-pack.json` is useless while you are using `fis3-packager-deps-packs`');
    }
    // 是否添加调试信息
    var useTrack = true;

    if (_.has(settings, 'useTrack')) {
        useTrack = settings.useTrack;
        delete settings.useTrack;
    }

    // 忽略 packTo 信息，直接从 settings 中读取。
    var src = ret.src;
    pack = settings;
    var sources = [];
    var packed = {}; // cache all packed resource.
    var root = fis.project.getProjectPath();

    var requireMap = {};

    // 生成数组
    Object.keys(src).forEach(function(key) {
        sources.push(src[key]);
    });

    var getDeps = (function(src, ids) {
        return function(file, async) {
            var list = [];
            var pending = [{ file: file, async: async }];
            var collected = [];
            var asyncCollected = [];

            while (pending.length) {
                var current = pending.shift();
                var cf = current.file;
                var ca = current.async;
                var includeAsync = current.includeAsync;

                if (cf.requires && cf.requires.length && !~collected.indexOf(cf)) {
                    collected.push(cf);
                    cf.requires.forEach(function(id) {
                        //console.log(id);

                        if (!ids[id]) return;
                        ca || ~list.indexOf(ids[id]) || list.push(ids[id]);

                        pending.push({
                            file: ids[id],
                            async: ca
                        });
                    });
                }

                if ((ca || includeAsync) && file.asyncs && file.asyncs.length && !~asyncCollected.indexOf(cf)) {
                    asyncCollected.push(cf);
                    cf.asyncs.forEach(function(id) {
                        if (!ids[id]) return;

                        ~list.indexOf(ids[id]) || list.push(ids[id]);

                        pending.push({
                            file: ids[id],
                            async: false,
                            includeAsync: true
                        });
                    });
                }
            }

            return list;
        };
    })(src, ret.ids);

    function find(reg, rExt) {
        var pseudo, result;

        if (src[reg]) {
            return [src[reg]];
        } else if (reg === '**') {
            // do nothing
        } else if (typeof reg === 'string') {
            if (/^(.*):(.+)$/.test(reg)) {
                pseudo = RegExp.$2;
                reg = RegExp.$1 || '**';
            }

            reg = _.glob(reg);
        }

        result = sources.filter(function(file) {
            reg.lastIndex = 0;
            return (reg === '**' || reg.test(file.subpath)) && (!rExt || file.rExt === rExt);
        });

        if (pseudo) {
            var base = result;
            result = [];

            if (pseudo === 'deps' || pseudo === 'asyncs') {
                base.forEach(function(file) {
                    result.push.apply(result, getDeps(file, pseudo === 'asyncs'));
                });
            } else {
                fis.log.error('The pseudo class `%s` is not supported.', pseudo);
            }
        }
        return result;
    }

    Object.keys(pack).forEach(function(subpath, index) {
        var patterns = pack[subpath];

        if (!Array.isArray(patterns)) {
            patterns = [patterns];
        }

        var pkg = fis.file.wrap(path.join(root, subpath));

        if (typeof ret.src[pkg.subpath] !== 'undefined') {
            fis.log.warning('there is a namesake file of package [' + subpath + ']');
        }

        var list = [];

        patterns.forEach(function(pattern, index) {
            var exclude = typeof pattern === 'string' && pattern.substring(0, 1) === '!';

            if (exclude) {
                pattern = pattern.substring(1);
                index === 0 && (list = find('**'));
            }

            var mathes = find(pattern);
            list = _[exclude ? 'difference' : 'union'](list, mathes);
        });

        // sort by dependency
        var filtered = [];
        while (list.length) {
            add(list.shift());
        }

        function add(file) {
            if (file.requires) {
                file.requires.forEach(function(id) {
                    var dep = ret.ids[id];
                    var idx;
                    if (dep && dep.rExt === pkg.rExt && ~(idx = list.indexOf(dep))) {
                        add(list.splice(idx, 1)[0]);
                    }
                })
            }

            if (!packed[file.subpath] && file.rExt === pkg.rExt) {
                packed[file.subpath] = true;
                filtered.push(file);
            }
        }

        var content = '';
        var has = [];
        var requires = [];

        var subDeps = [];

        filtered.forEach(function(file) {

            // var id = file.getId();
            var id = file.id;
            //console.log(1+id+file.getId);

            if (ret.map.res[id]) {
                // var c = file.getContent();
                var c = file._content;

                // 派送事件
                var message = {
                    file: file,
                    content: c,
                    pkg: pkg
                };
                fis.emit('pack:file', message);
                c = message.content;

                var prefix = useTrack ? ('/*!' + file.id + '*/\n') : ''; // either js or css
                if (file.isJsLike) {
                    prefix = ';' + prefix;
                } else if (file.isCssLike && c) {
                    c = c.replace(/@charset\s+(?:'[^']*'|"[^"]*"|\S*);?/gi, '');
                }

                if (content) prefix = '\n' + prefix;

                content += prefix + c;

                requires = requires.concat(file.requires);
                has.push(id);
            }
        });

        filtered.forEach(function(file) {
            var id = file.id;

            if (isEntry(id)) {
                if (opt.hash) {
                    var ext = pkg.url.split('.')[1];
                    var md5 = fis.util.md5(file._content);
                    var realPath = pkg.url.replace('.' + ext, '_' + md5 + '.' + ext);
                    ret.map.res[id].uri = realPath;
                    ret.map.res[id].subpath = realPath;
                } else {
                    ret.map.res[id].uri = pkg.url;
                    ret.map.res[id].subpath = pkg.url;
                }


                // for (var x in ret.map.res[id].deps) {
                //
                //     var p = ret.map.res[id].deps[x];
                //     if(id.indexOf('topic')!==-1){
                //         console.log(p);
                //     }
                //     if (file._likes.isJsLike) {
                //         if (p.indexOf('jsx') !== -1 || p.indexOf('js') !== -1) {
                //             // ret.map.res[id].deps.splice(x, 1);
                //         }
                //     }
                //     if (file._likes.isCssLike) {
                //         if (p.indexOf('css') !== -1) {
                //             // ret.map.res[id].deps.splice(x, 1);
                //         }
                //     }
                // }

                var deps = ret.map.res[id].deps;
                if (deps !== undefined) {
                    // console.log(deps.length);
                    for (var x = deps.length - 1; x >= 0; x--) {
                        var p = deps[x];
                        if (file._likes.isJsLike) {
                            if (p.indexOf('jsx') !== -1 || p.indexOf('js') !== -1) {
                                deps.splice(x, 1);
                            }
                        }
                        if (file._likes.isCssLike) {
                            if (p.indexOf('css') !== -1) {
                                deps.splice(x, 1);
                            }
                        }
                    }
                }
                // var deps = ret.map.res[id].deps;
                // var p;
                // if (deps !== undefined) {
                //     var x = deps.length - 1;
                //     while ((p = deps[x--])) {
                //         if (file._likes.isJsLike) {
                //             if (p.indexOf('jsx') !== -1 || p.indexOf('js') !== -1) {
                //                 deps.splice(x + 1, 1);
                //             }
                //         }
                //         if (file._likes.isCssLike) {
                //             if (p.indexOf('css') !== -1) {
                //                 deps.splice(x + 1, 1);
                //             }
                //         }
                //     }
                // }
            }

                if (!packCss) {
                    if (ret.map.res[id].deps) {
                        ret.map.res[id].deps = ret.map.res[id].deps.concat(subDeps);
                    }
                }
            } else {
                if (!packCss) {
                    subDeps = subDeps.concat(file.map.deps);
                }
            }
        });

        if (has.length) {
            var dir = ('../' + fis.get('projectName') + pkg.release).split(pkg.basename)[0];
            var folder_exists = fs.exists(dir);
            if (!folder_exists) {
                _.mkdir(dir);
            }
            // console.log('../' + fis.get('projectName') + pkg.release);
            fs.writeFileSync('../' + fis.get('projectName') + pkg.release, content);
        }

        //判断是否是入口文件
        function isEntry(path) {
            var flag = false;
            var name = path.substr(path.lastIndexOf('/') + 1).split('.')[0];
            //console.log(1+name);
            Object.keys(pack).forEach(function(path) {
                if (path.indexOf(name) !== -1) {
                    flag = true;
                    //console.log(2+name);
                }
            });
            return flag;
        }

    });

    return ret;
};
