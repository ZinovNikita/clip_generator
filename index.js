const fs = require("fs");
const ffmpeg = require('fluent-ffmpeg');
const { exit } = require("process");
const config = {
    routes: [
        {method: 'GET',regexp: /^(\/)$/, func: 'main_page'},
        {method: 'GET',regexp: /^\/(.*).html$/, func: 'pages'},
        {method: 'GET',regexp: /^\/bg\/(.*)$/, func: 'bg_video'},
        {method: 'GET',regexp: /^(\/videos_delete)$/, func: 'del_video'},
        {method: 'GET',regexp: /^\/videos\/(.*)$/, func: 'get_video'},
        {method: 'GET',regexp: /^\/audios\/(.*)$/, func: 'get_audio'},
    ]
};
let d = fs.readFileSync(__dirname + "/config.json");
try{
    let c = JSON.parse(d);
    for(let k in c)
        config[k] = c[k];
}
catch(e){
    console.log('Config File Error:',e.message);
    exit(1);
}
const rnd = ()=>{
    let a = (1*[...`${new Date().getTime()}`].reverse().join(""))/1000000000
    return Math.floor(Math.PI*(Math.random()*a+(a/(Math.random()*10+0.1)))%a)/a;
}
const methods = {
    main_page(req,res){
        methods.pages(req,res,['/index.html','index']);
    },
    pages(req,res,par){
        let f_name = `${__dirname}/pages/${par[1]}.html`;
        if(fs.existsSync(f_name)){
            res.writeHead(200,{'Content-type': 'text/html'});
            fs.createReadStream(f_name).pipe(res);
        }
        else{
            res.writeHead(404);
            res.end('Page not found');
        }
    },
    bg_video(req,res){
        let b_list = fs.readdirSync(config.bg_path);
        let b_path = `${config.bg_path}\\${b_list[Math.floor(rnd() * b_list.length)]}`;
        fs.createReadStream(b_path).pipe(res);
    },
    del_video(req,res){
        fs.readdir(config.chunck_path, function(er, files) {
            if(er) return;
            files.forEach(file=>{
              fs.stat(`${config.chunck_path}\\${file}`, (err, stat)=>{
                if(err) return;
                if((new Date().getTime() - stat.birthtimeMs) > 60000)
                    fs.unlink(`${config.chunck_path}\\${file}`,()=>{});
              });
            });
        });
        res.end('OK');
    },
    get_video(req,res,vm){
        const f_name = `${config.chunck_path}\\${vm[1]}.mp4`;
        if(fs.existsSync(f_name))
            return fs.createReadStream(f_name).pipe(res);
        let v_list = fs.readdirSync(config.video_path);
        let v_path = `${config.video_path}\\${v_list[Math.floor(rnd() * v_list.length)]}`;
        ffmpeg.ffprobe(v_path, (err, data)=>{
            let d = data.format.duration;
            let s = Math.floor(rnd() * d);
            let t = 30;
            if(d<t){
                s = 0;
                t = d;
            }
            if(s+t > d)
                s -= t;
            if(s<0)
                s = 0;
            ffmpeg()
                .input(v_path)
                .inputOptions([`-ss ${s}`])
                .outputOptions([`-t ${t}`])
                .output(f_name)
                .videoCodec('copy')
                .audioCodec('copy')
                .on('end', ()=>{
                    fs.createReadStream(f_name).pipe(res);
                })
                .on('error',(...a)=>{
                    console.log('ERROR',a);
                    res.writeHead(500);
                    res.end(JSON.stringify(a));
                })
                .run();
        });
    },
    get_audio(req,res){
        let a_list = fs.readdirSync(config.audio_path);
        let a_path = `${config.audio_path}\\${a_list[Math.floor(rnd() * a_list.length)]}`;
        fs.createReadStream(a_path).pipe(res);
    }
}
const app = require('http').createServer((req,res)=>{
    let matches = config.routes.filter(el=>(el.method == req.method && el.regexp.test(req.url)));
    if(matches && matches.length>0)
        methods[matches[0].func](req,res,req.url.match(matches[0].regexp));
    else{
        res.writeHead(404);
        return res.end('Page not found');
    }
});
methods.del_video(null,{end(){}});
app.listen(config.port);
console.log(`Server Started on ${config.port}`)