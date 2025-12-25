const net = require("net");
let connectionMap = {};

let createIpcServer = (port) =>
  new Promise((resolve) => {
    var server = net.createServer((connection) => {
      let ip = connection.remoteAddress;
      if (!connectionMap[ip]) {
        connectionMap[ip] = [];
        connectionMap[ip].isHandling = false;
      }
      let target = connectionMap[ip];
      target.push(connection);

      console.log("客户端连接成功");
      connection.on("data", (data) => {
        console.log(
          `收到客户端消息【${ip.replace("::ffff:", "")}】`,
          data.toString().replace(`"next":true,`, "")
        );
        try {
          let receiveData = JSON.parse(data.toString());
          if (receiveData.proxyData) {
            let { url, data, platform } = proxyData;
            
            connection.emit("next", receiveData.msg);
          }
        } catch (e) {
          console.log(e);
        }
      });
      connection.on("end", () => {
        console.log("客户端关闭连接");
        let i = target.indexOf(connection);
        target.splice(i, 1);
      });
      connection.on("error", (e) => {
        console.log(e.code);
        if (e.code === "ECONNRESET") {
          console.log("客户端关闭连接");
          let i = target.indexOf(connection);
          target.splice(i, 1);
        }
      });
    });
    server.listen(port, () => {
      resolve();
      console.log("server is listening:" + port);
    });
  });
module.exports = {
  createIpcServer,
  connectionMap,
};



//
//
// this.client.write(
//   JSON.stringify({
//     getAgent: true,
//     platform: 'damai',
//     uniqueId: "4343",
//     options: JSON.stringify({
//       a:12
//     })
//   })
// );

// this.client.write(
//   JSON.stringify({
//     refreshOption: true,
//     platform: 'damai',
//     uniqueId: "4343",
//     options: JSON.stringify({
//       a:12
//     })
//   })
// );

// this.client.write(
//   JSON.stringify({
//     proxyData: true,
//     platform: 'damai',
//     uniqueId: "4343",
//   })
// );