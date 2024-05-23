const net = require("net");
const { sleep, getTime } = require("./utils");

let connectCheckServer = (eventBus, port,  host) =>
  new Promise((resolve, reject) => {
    let config = { port, host };
    var client = net.connect(config, () => {
      console.log(
        `============连接到服务器:【${
          client.remoteAddress
        }:${port}】======${getTime()}`
      );
      // client.write(JSON.stringify({ targetTypes }));
      resolve(client);
    });
    client.on("end", function () {
      console.log("客户端断开与服务器的连接" + getTime());
    });

    client.on("error", async (e) => {
      reject();
      console.log(e);
      if (["ECONNRESET"].includes(e.code)) {
        console.log("服务器主动断开连接");
        eventBus.emit("connectedError");
        let isNeedCheck = true;
        while (isNeedCheck) {
          console.log(`======重试中=====${getTime()}`);
          try {
            let newClient = await connectCheckServer(
              eventBus,
              port,
              host,
            );
            isNeedCheck = false;
            eventBus.emit("reConnectSuccess", newClient);
          } catch (e) {
            await sleep(3000);
          }
        }
      }
    });
  });
module.exports = connectCheckServer;
