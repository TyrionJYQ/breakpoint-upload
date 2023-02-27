import { createRequire } from "module";
const require = createRequire(import.meta.url);
const Koa = require("koa");
const cors = require("@koa/cors");
const Router = require("@koa/router");
const { koaBody } = require("koa-body");
const path = require("path");
const fs = require("fs");
const __dirname = path.resolve();
const session = require("koa-session");

const app = new Koa();
app.use(
  cors({
    credentials: true,
  })
);
app.use(
  session(
    {
      sameSite: "none",
    },
    app
  )
);
app.use(koaBody());
const router = new Router();
const outputPath = path.join(__dirname, "server/resources");
let currChunk;
// 上传请求
router.post(
  "/upload",
  // 处理文件 form-data 数据
  koaBody({
    multipart: true,
    formidable: {
      uploadDir: outputPath,
      onFileBegin: (name, file) => {
        const [filename, fileHash, index] = name.split("-");
        const dir = path.join(outputPath, filename);
        // 保存当前 chunk 信息，发生错误时进行返回
        currChunk = {
          filename,
          fileHash,
          index,
        };

        // 检查文件夹是否存在如果不存在则新建文件夹
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir);
        }

        // 覆盖文件存放的完整路径
        file.path = `${dir}/${fileHash}-${index}`;
      },
      onError: (error) => {
        app.status = 400;
        app.body = { code: 400, msg: "上传失败", data: currChunk };
        return;
      },
    },
  }),
  // 处理响应
  async (ctx) => {
    ctx.set("Content-Type", "application/json");
    ctx.body = JSON.stringify({
      code: 2000,
      message: "upload successfully！",
    });
  }
);

router.get("/fetch-test", async (ctx) => {
  var exdate = new Date();
  exdate.setTime(exdate.getTime() + 2 * 60 * 60 * 1000);
  //   expires=${exdate.toUTCString()}
  ctx.cookies.set("fetch-cookie", `gggggggggg; SameSite=None; Secure;`, {
    httpOnly: true,
  });

  ctx.set("Access-Control-Allow-Credentials", true);

  ctx.body = JSON.stringify({
    code: 2000,
    message: "cookie set success",
  });
});

// 合并请求
router.post("/mergeChunks", async (ctx) => {
  const { filename, size } = ctx.request.body;
  // 合并 chunks
  await mergeFileChunk(path.join(outputPath, "_" + filename), filename, size);

  // 处理响应
  ctx.set("Content-Type", "application/json");
  ctx.body = JSON.stringify({
    data: {
      code: 2000,
      filename,
      size,
    },
    message: "merge chunks successful！",
  });
});

router.get("/", async (ctx) => {
  ctx.body = "hello koa";
});

// 通过管道处理流
const pipeStream = (path, writeStream) => {
  return new Promise((resolve) => {
    const readStream = fs.createReadStream(path);
    readStream.pipe(writeStream);
    readStream.on("end", () => {
      fs.unlinkSync(path);
      resolve();
    });
  });
};

// 合并切片
const mergeFileChunk = async (filePath, filename, size) => {
  const chunkDir = path.join(outputPath, filename);
  const chunkPaths = fs.readdirSync(chunkDir);

  if (!chunkPaths.length) return;

  // 根据切片下标进行排序，否则直接读取目录的获得的顺序可能会错乱
  chunkPaths.sort((a, b) => a.split("-")[1] - b.split("-")[1]);
  console.log("chunkPaths = ", chunkPaths);

  await Promise.all(
    chunkPaths.map((chunkPath, index) =>
      pipeStream(
        path.resolve(chunkDir, chunkPath),
        // 指定位置创建可写流
        fs.createWriteStream(filePath, {
          start: index * size,
          end: (index + 1) * size,
        })
      )
    )
  );
  // 合并后删除保存切片的目录
  fs.rmdirSync(chunkDir);
};

app.use(router.routes()).use(router.allowedMethods());

app.listen(30001);
