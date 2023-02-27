<script setup>
import { ref, computed } from "vue";
import SparkMD5 from "spark-md5";
import { uploadFile, mergeChunks } from "./request";
function fectchTest() {
  fetch("http://localhost:30001/fetch-test", {
    method: "GET",
    credentials: "include",
    // mode: "cors",
  }).then(
    (res) => {
      console.log(res);
    },
    (err) => {
      console.log(err);
    }
  );
}
const DefualtChunkSize = 1000000;
const fileupload = ref(null);
let fileChunkList = ref([]);
const currFile = ref({});
function onFileChange() {
  let file = fileupload.value.files[0];
  currFile.value = file;
  console.log(file, 10000);
  getFileChunk(file).then((fileHash) => {
    uploadChunks(fileHash);
  });
}

// 获取文件分块
const getFileChunk = (file, chunkSize = DefualtChunkSize) => {
  return new Promise((resovle) => {
    let blobSlice =
        File.prototype.slice ||
        File.prototype.mozSlice ||
        File.prototype.webkitSlice,
      chunks = Math.ceil(file.size / chunkSize),
      currentChunk = 0,
      spark = new SparkMD5.ArrayBuffer(),
      fileReader = new FileReader();

    fileReader.onload = function (e) {
      console.log("read chunk nr", currentChunk + 1, "of");

      const chunk = e.target.result;
      spark.append(chunk);
      currentChunk++;

      if (currentChunk < chunks) {
        loadNext();
      } else {
        let fileHash = spark.end();
        console.info("finished computed hash", fileHash);
        resovle({ fileHash });
      }
    };

    fileReader.onerror = function () {
      console.warn("oops, something went wrong.");
    };

    function loadNext() {
      let start = currentChunk * chunkSize,
        end = start + chunkSize >= file.size ? file.size : start + chunkSize;
      let chunk = blobSlice.call(file, start, end);
      fileChunkList.value.push({
        chunk,
        size: chunk.size,
        name: currFile.value.name,
      });
      fileReader.readAsArrayBuffer(chunk);
    }

    loadNext();
  });
};

const uploadChunks = (fileHash) => {
  const requests = fileChunkList.value.map((item, index) => {
    const formData = new FormData();
    formData.append(`${currFile.value.name}-${fileHash}-${index}`, item.chunk);
    formData.append("filename", currFile.value.name);
    formData.append("hash", `${fileHash}-${index}`);
    formData.append("fileHash", fileHash);
    return uploadFile("/upload", formData, onUploadProgress(item));
  });

  Promise.all(requests).then(() => {
    mergeChunks("/mergeChunks", {
      size: DefualtChunkSize,
      filename: currFile.value.name,
    });
  });
};

// 总进度条
const totalPercentage = computed(() => {
  if (!fileChunkList.value.length) return 0;
  const loaded = fileChunkList.value
    .map((item) => item.size * item.percentage)
    .reduce((curr, next) => curr + next);
  return parseInt((loaded / currFile.value.size).toFixed(2));
});

// 分块进度条
const onUploadProgress = (item) => (e) => {
  item.percentage = parseInt(String((e.loaded / e.total) * 100));
};
</script>

<template>
  <div class="wrapper">
    <input type="file" ref="fileupload" @change="onFileChange" />
    <hr />
    <ul>
      <li v-for="item in fileChunkList">
        <span>{{ item.name }} </span>
        <span>{{ item.size }} </span>
        <progress :value="item.percentage" max="100">
          {{ item.percentage }}%
        </progress>
      </li>
    </ul>
    <!-- fecth测试 -->
    <div>
      <button @click="fectchTest">fetch</button>
    </div>
    <div>
      <a href="http://127.0.0.1:30001/">30001</a>
    </div>
  </div>
</template>

<style scoped>
ul {
  li {
    display: flex;
    span,
    progress {
      flex: 1;
    }
  }
}
</style>
