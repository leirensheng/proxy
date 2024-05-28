let connectCheckServer = require("./ipcClient2");
let { sleep } = require("./utils");
let PubSub = require("./pubBus");
module.exports = class BaseSend {
  constructor() {
    this.eventBus = new PubSub();
    this.isReady = false;
    this.options = null;
    this.platform = "";
  }

  async tryConnect() {
    this.isReady = false;
    while (!this.isReady) {
      try {
        let ip = "192.168.2.15";
        this.client = await connectCheckServer(this.eventBus, 9999, ip);
        this.isReady = true;
        this.handleConnected();
      } catch (e) {
        this.isReady = false;
        console.log(`=======未发现端口【${9999}】的服务, 重试中==========`);
        await sleep(3000);
      }
    }
  }
  async handleConnectedError() {
    this.connectErrorTimer = setTimeout(() => {
      console.log(`测试proxy服务端已经断开2分钟了`);
      //   sendAppMsg("出错", `测试proxy服务端已经断开2分钟了`, {
      //     type: "error",
      //   });
    }, 2 * 60000);
  }

  async handleReceiveData(data) {
    try {
      let obj = JSON.parse(data);
      let { type } = obj;
      this.eventBus.emit(type, obj);
    } catch (e) {
      console.log("接受到服务器的", data.toString());
      console.log(e);
    }
  }

  async handleConnected() {
    clearTimeout(this.connectErrorTimer);
    this.eventBus.emit("connectedReady");
    this.client.on("data", (data) => {
      this.handleReceiveData(data);
    });
  }

  async close() {
    return new Promise((resolve) => {
      this.eventBus.once("endDone", resolve);
      this.client.end();
    });
  }

  // removeProxyIp(uniqueId) {
  //   return new Promise((r) => {
  //     this.eventBus.once("removeOneProxy" + uniqueId, () => {
  //       resolve();
  //     });
  //   });
  // }
  myProxy() {
    return new Promise((resolve) => {
      this.eventBus.once("proxyDone", ({ res }) => {
        resolve(res);
      });
      this.client.write(
        JSON.stringify({
          proxyData: true,
          platform: this.platform,
          uniqueId: this.uniqueId,
        })
      );
    });
  }

  removeProxyIp() {
    if (!this.isNeedProxy) {
      return;
    }
    return new Promise((resolve) => {
      this.eventBus.once("removeProxyIpDone", ({ res }) => {
        resolve(res);
        console.log("删除了当前的ip了")
      });
      this.client.write(
        JSON.stringify({
          removeProxyIp: true,
          platform: this.platform,
          uniqueId: this.uniqueId,
        })
      );
    });
  }

  getAgent() {
    return new Promise((resolve) => {
      this.eventBus.once("getAgentDone", ({ ip }) => resolve(ip));
      this.client.write(
        JSON.stringify({
          uniqueId: this.uniqueId,
          getAgent: true,
          platform: this.platform,
          valueType: this.valueType,
          options: this.options,
        })
      );
    });
  }

  pauseProxy() {
    return new Promise((resolve) => {
      this.eventBus.once("pauseProxyDone", resolve);
      this.client.write(
        JSON.stringify({
          uniqueId: this.uniqueId,
          pauseProxy: true,
          platform: this.platform,
        })
      );
    });
  }
};
